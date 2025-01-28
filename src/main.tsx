import { 
    App, 
    Plugin, 
    Notice, 
    TFile,
    TAbstractFile,
    MarkdownView,
    Modal,
    Editor
} from 'obsidian';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { 
    AsanaPluginSettings, 
    DEFAULT_SETTINGS, 
    IAsanaPlugin, 
    AsanaProject, 
    AsanaTask, 
    AsanaUser 
} from './types';
import { AsanaSettingTab } from './ui/SettingsTab';
import { AsanaService } from './services/AsanaService';
import { TaskFileService } from './services/TaskFileService';
import { TaskSyncQueue } from './services/TaskSyncQueue';
import { TaskSyncService } from './services/TaskSyncService';
import { ProjectSelector } from './components/ProjectSelector';
import { TaskComments } from './components/TaskComments';
import { ProjectSelectionModal } from './ui/ProjectSelectionModal';

class ProjectModal extends Modal {
    private projects: AsanaProject[];
    private onChoose: (project: AsanaProject) => void;
    private root: ReturnType<typeof createRoot> | null = null;
    private asanaService: AsanaService;

    constructor(app: App, projects: AsanaProject[], onChoose: (project: AsanaProject) => void, asanaService: AsanaService) {
        super(app);
        this.projects = projects;
        this.onChoose = onChoose;
        this.asanaService = asanaService;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        const container = contentEl.createDiv();
        this.root = createRoot(container);
        this.root.render(
            <ProjectSelector 
                asanaService={this.asanaService}
                onProjectSelect={(projectId) => {
                    const project = this.projects.find(p => p.gid === projectId);
                    if (project) {
                        this.onChoose(project);
                        this.close();
                    }
                }}
            />
        );
    }

    onClose() {
        if (this.root) {
            this.root.unmount();
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

        // Initialize services
        this.initializeServices();

        // Add settings tab
        this.addSettingTab(new AsanaSettingTab(this.app, this));

        // Add commands
        this.addCommands();

        // Register event handlers
        this.registerEventHandlers();

        // Start sync interval
        this.startSyncInterval();
    }

    onunload() {
        this.stopSyncInterval();
    }

    initializeServices() {
        this.asanaService = new AsanaService(this.settings.asanaAccessToken);
        this.taskFileService = new TaskFileService(
            this.app.vault,
            this.app.metadataCache,
            this.asanaService
        );
        this.taskSyncQueue = new TaskSyncQueue();
        this.taskSyncService = new TaskSyncService(
            this.app.vault,
            this.asanaService,
            this.taskFileService
        );
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.initializeServices();
        this.startSyncInterval();
    }

    startSyncInterval() {
        this.stopSyncInterval();
        if (this.settings.syncInterval > 0) {
            this.syncIntervalId = window.setInterval(() => {
                this.syncTasks();
            }, this.settings.syncInterval * 60 * 1000); // Convert minutes to milliseconds
        }
    }

    stopSyncInterval() {
        if (this.syncIntervalId !== null) {
            window.clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
        }
    }

    private addCommands() {
        // Create task from selection command
        this.addCommand({
            id: 'create-task-from-selection',
            name: 'Create Task from Selection',
            editorCallback: (editor) => {
                const selectedText = editor.getSelection();
                console.log('Raw selected text:', JSON.stringify(selectedText));
                console.log('Selection length:', selectedText.length);
                console.log('Selection lines:', selectedText.split('\n').length);

                if (!selectedText) {
                    new Notice('Please select some text first');
                    return;
                }

                this.createTask(selectedText);
            }
        });

        // Create task from current line command
        this.addCommand({
            id: 'create-task-from-line',
            name: 'Create Asana task from current line',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'a' }],
            editorCallback: (editor) => {
                const selectedText = editor.getSelection();
                console.log('Raw selected text:', JSON.stringify(selectedText));
                console.log('Selection length:', selectedText.length);
                console.log('Selection lines:', selectedText.split('\n').length);

                if (!selectedText) {
                    new Notice('Please select some text first');
                    return;
                }

                this.createTask(selectedText);
            }
        });

        // Command to create a new task
        this.addCommand({
            id: 'create-task',
            name: 'Create Task',
            editorCallback: (editor: Editor) => {
                const selectedText = editor.getSelection();
                new ProjectSelectionModal(
                    this.app,
                    this.asanaService,
                    this.taskFileService,
                    this.settings,
                    selectedText,
                    () => {}
                ).open();
            }
        });

        // Command to sync all tasks
        this.addCommand({
            id: 'sync-tasks',
            name: 'Sync All Tasks',
            callback: async () => {
                try {
                    const taskFolder = this.settings.taskFolder;
                    const files = this.app.vault.getFiles()
                        .filter(file => file.path.startsWith(taskFolder));
                    
                    let syncCount = 0;
                    for (const file of files) {
                        try {
                            await this.taskSyncService.syncTaskToAsana(file);
                            syncCount++;
                        } catch (error) {
                            console.error(`Error syncing task ${file.path}:`, error);
                        }
                    }
                    
                    new Notice(`Successfully synced ${syncCount} tasks`);
                } catch (error) {
                    console.error('Error syncing all tasks:', error);
                    new Notice('Failed to sync tasks');
                }
            }
        });

        // Command to open task in Asana
        this.addCommand({
            id: 'open-in-asana',
            name: 'Open Task in Asana',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile || !activeFile.path.startsWith(this.settings.taskFolder)) {
                    return false;
                }

                if (!checking) {
                    this.openTaskInAsana(activeFile);
                }

                return true;
            }
        });
    }

    async openTaskInAsana(file: TFile) {
        try {
            const content = await this.app.vault.read(file);
            const frontmatter = this.taskFileService.extractFrontmatter(content);
            if (frontmatter && frontmatter.permalink_url) {
                window.open(frontmatter.permalink_url);
            } else {
                new Notice('No Asana link found for this task');
            }
        } catch (error) {
            console.error('Error opening task in Asana:', error);
            new Notice('Failed to open task in Asana');
        }
    }

    private async createTask(content: string) {
        console.log('Creating task with raw content:', JSON.stringify(content));
        console.log('Content length:', content.length);
        console.log('Content lines:', content.split('\n').length);

        if (!this.asanaService) {
            new Notice('Please configure your Asana API token first.');
            return;
        }

        const modal = new ProjectSelectionModal(
            this.app,
            this.asanaService,
            this.taskFileService,
            this.settings,
            content,
            async (projectId: string) => {
                // Handle task creation callback if needed
            }
        );
        modal.open();
    }

    private registerEventHandlers() {
        // Register for file modifications
        this.registerEvent(
            this.app.vault.on('modify', (file: TAbstractFile) => {
                if (file instanceof TFile && file.path.startsWith(this.settings.taskFolder)) {
                    // Enqueue a function that syncs the task
                    this.taskSyncQueue.enqueue(async () => {
                        await this.taskFileService.syncTask(file);
                    });
                }
            })
        );

        // Register for file renames
        this.registerEvent(
            this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
                if (file instanceof TFile && file.path.startsWith(this.settings.taskFolder)) {
                    this.handleFileRename(file, oldPath);
                }
            })
        );

        // Register for file deletions
        this.registerEvent(
            this.app.vault.on('delete', (file: TAbstractFile) => {
                if (file instanceof TFile && file.path.startsWith(this.settings.taskFolder)) {
                    this.handleFileDelete(file);
                }
            })
        );
    }

    async handleFileRename(file: TFile, oldPath: string) {
        try {
            const content = await this.app.vault.read(file);
            const frontmatter = this.taskFileService.extractFrontmatter(content);
            if (frontmatter && frontmatter.asana_gid) {
                await this.asanaService.updateTask(frontmatter.asana_gid, {
                    name: file.basename
                });
            }
        } catch (error) {
            console.error('Error handling file rename:', error);
            new Notice('Failed to update task name in Asana');
        }
    }

    async handleFileDelete(file: TFile) {
        try {
            const content = await this.app.vault.read(file);
            const frontmatter = this.taskFileService.extractFrontmatter(content);
            if (frontmatter && frontmatter.asana_gid) {
                await this.asanaService.deleteTask(frontmatter.asana_gid);
            }
        } catch (error) {
            console.error('Error handling file delete:', error);
            new Notice('Failed to delete task in Asana');
        }
    }

    async syncTasks() {
        try {
            await this.taskSyncQueue.processNext();
        } catch (error) {
            console.error('Error syncing task:', error);
        }
    }

    public async fetchAsanaProjects() {
        if (!this.asanaService) {
            throw new Error('Asana service not initialized');
        }

        try {
            const projects = await this.asanaService.getProjects();
            return projects;
        } catch (error) {
            console.error('Error fetching projects:', error);
            throw error;
        }
    }

    public updateAutoSaveInterval() {
        this.stopSyncInterval();
        this.startSyncInterval();
    }

    private async saveCurrentTask() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
            new Notice('No active task file');
            return;
        }

        try {
            await this.taskFileService.saveTask(activeFile);
            new Notice('Task saved to Asana');
        } catch (error) {
            console.error('Error saving task:', error);
            new Notice('Failed to save task to Asana: ' + error.message);
        }
    }

    private async syncTaskFile(file: TFile) {
        try {
            await this.taskFileService.syncTask(file);
            new Notice('Task updated in Asana');
        } catch (error) {
            console.error('Error updating task:', error);
            new Notice('Failed to update task in Asana');
            throw error;
        }
    }
}
