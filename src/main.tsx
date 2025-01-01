import { 
    App, 
    Plugin, 
    Notice, 
    TFile,
    TAbstractFile,
    MarkdownView,
    Modal
} from 'obsidian';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { 
    AsanaPluginSettings, 
    DEFAULT_SETTINGS, 
    IAsanaPlugin, 
    AsanaProject, 
    IAsanaTask, 
    IAsanaUser 
} from './types';
import { AsanaSettingTab } from './ui/SettingsTab';
import { AsanaService } from './services/AsanaService';
import { TaskFileService } from './services/TaskFileService';
import { TaskSyncQueue } from './services/TaskSyncQueue';
import { TaskSyncService } from './services/TaskSyncService';
import { ProjectSelector } from './components/ProjectSelector';
import { TaskComments } from './components/TaskComments';

class ProjectModal extends Modal {
    private projects: AsanaProject[];
    private onChoose: (project: AsanaProject) => void;
    private root: ReturnType<typeof createRoot> | null = null;

    constructor(app: App, projects: AsanaProject[], onChoose: (project: AsanaProject) => void) {
        super(app);
        this.projects = projects;
        this.onChoose = onChoose;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        const container = contentEl.createDiv();
        this.root = createRoot(container);
        this.root.render(
            <ProjectSelector 
                projects={this.projects} 
                onSelect={(project) => {
                    this.onChoose(project);
                    this.close();
                }}
            />
        );
    }

    onClose() {
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
        const { contentEl } = this;
        contentEl.empty();
    }
}

class CommentsModal extends Modal {
    private taskId: string;
    private asanaService: AsanaService;
    private root: ReturnType<typeof createRoot> | null = null;

    constructor(app: App, taskId: string, asanaService: AsanaService) {
        super(app);
        this.taskId = taskId;
        this.asanaService = asanaService;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        const container = contentEl.createDiv();
        this.root = createRoot(container);
        this.root.render(
            <TaskComments 
                taskId={this.taskId} 
                asanaService={this.asanaService}
            />
        );
    }

    onClose() {
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
        const { contentEl } = this;
        contentEl.empty();
    }
}

export default class AsanaPlugin extends Plugin implements IAsanaPlugin {
    settings: AsanaPluginSettings;
    private asanaService: AsanaService;
    private taskFileService: TaskFileService;
    private taskSyncQueue: TaskSyncQueue;
    private taskSyncService: TaskSyncService;
    private syncIntervalId: number | null = null;

    async onload() {
        await this.loadSettings();
        this.initializeServices();
        this.addCommands();
        this.addRibbonIcon('list-check', 'Fetch Asana Projects', async () => {
            try {
                await this.fetchAsanaProjects();
            } catch (error) {
                console.error('Error fetching projects:', error);
                new Notice('Failed to fetch projects');
            }
        });
        this.registerEventHandlers();
        this.addSettingTab(new AsanaSettingTab(this.app, this));
        this.startSyncInterval();
    }

    onunload() {
        this.stopSyncInterval();
    }

    public initializeServices() {
        this.asanaService = new AsanaService(this.settings.asanaAccessToken);
        this.taskFileService = new TaskFileService(this.app.vault);
        this.taskSyncQueue = new TaskSyncQueue();
        this.taskSyncService = new TaskSyncService(
            this.app.vault,
            this.asanaService,
            this.taskFileService
        );
    }

    public async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    public async saveSettings() {
        try {
            await this.saveData(this.settings);
        } catch (error) {
            console.error('Error saving settings:', error);
            new Notice('Failed to save settings');
        }
    }

    public startSyncInterval() {
        this.stopSyncInterval();
        if (this.settings.syncInterval > 0) {
            this.syncIntervalId = window.setInterval(
                () => this.syncTasks(),
                this.settings.syncInterval * 60000
            );
        }
    }

    public stopSyncInterval() {
        if (this.syncIntervalId !== null) {
            clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
        }
    }

    private addCommands() {
        // Save command
        this.addCommand({
            id: 'save-current-task',
            name: 'Save current task to Asana',
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) {
                    new Notice('No active file');
                    return;
                }
                try {
                    await this.taskSyncService.syncTaskToAsana(activeFile);
                    new Notice('Task saved to Asana');
                } catch (error) {
                    console.error('Error saving task:', error);
                    new Notice('Failed to save task to Asana');
                }
            }
        });

        // Fetch projects command
        this.addCommand({
            id: 'fetch-asana-projects',
            name: 'Fetch projects from Asana',
            callback: async () => {
                try {
                    await this.fetchAsanaProjects();
                } catch (error) {
                    console.error('Error fetching projects:', error);
                    new Notice('Failed to fetch projects');
                }
            }
        });

        // Open in browser command
        this.addCommand({
            id: 'open-in-asana',
            name: 'Open current task in Asana',
            callback: () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) {
                    new Notice('No active file');
                    return;
                }
                const metadata = this.app.metadataCache.getFileCache(activeFile)?.frontmatter;
                if (!metadata?.permalink_url) {
                    new Notice('No Asana URL found');
                    return;
                }
                window.open(metadata.permalink_url, '_blank');
            }
        });

        // Sync current task command
        this.addCommand({
            id: 'sync-with-asana',
            name: 'Sync current task with Asana',
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) {
                    new Notice('No active file');
                    return;
                }
                try {
                    await this.taskSyncService.syncTaskToAsana(activeFile);
                    new Notice('Task synced with Asana');
                } catch (error) {
                    console.error('Error syncing task:', error);
                    new Notice('Failed to sync task with Asana');
                }
            }
        });

        // Open comments command
        this.addCommand({
            id: 'view-asana-comments',
            name: 'View Asana task comments',
            callback: () => {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (!activeView?.file) {
                    new Notice('No active file');
                    return;
                }
                const metadata = this.app.metadataCache.getFileCache(activeView.file)?.frontmatter;
                if (!metadata?.asana_gid) {
                    new Notice('No Asana task ID found');
                    return;
                }
                new CommentsModal(this.app, metadata.asana_gid, this.asanaService).open();
            }
        });
    }

    private registerEventHandlers() {
        // ... existing event handlers
    }

    private async fetchAsanaProjects() {
        try {
            const user = await this.asanaService.getCurrentUser();
            const workspaceId = user.workspaces[0].gid;
            const projects = await this.asanaService.getProjects(workspaceId);

            new ProjectModal(this.app, projects, async (project) => {
                try {
                    const tasks = await this.asanaService.getTasksForProject(project.gid);
                    for (const task of tasks) {
                        this.taskSyncQueue.enqueue(async () => {
                            await this.taskFileService.createTaskFile(
                                task,
                                project.name,
                                this.settings.taskFolder,
                                this.settings.templateFile
                            );
                        });
                    }
                    new Notice(`Tasks imported to "${this.settings.taskFolder}/${project.name}"`);
                } catch (error) {
                    console.error('Error fetching tasks:', error);
                    new Notice('Failed to fetch tasks. Check console for details.');
                    throw error;
                }
            }).open();
        } catch (error) {
            console.error('Error:', error);
            new Notice('Failed to fetch projects');
            throw error;
        }
    }

    private async syncTasks() {
        // ... existing sync logic
    }
}
