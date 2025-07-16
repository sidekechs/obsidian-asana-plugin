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
import { DailyTasksService } from './services/DailyTasksService';
import { InlineTaskService } from './services/InlineTaskService';
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
    asanaService: AsanaService;
    private taskFileService: TaskFileService;
    private taskSyncQueue: TaskSyncQueue;
    private taskSyncService: TaskSyncService;
    private dailyTasksService: DailyTasksService;
    private inlineTaskService: InlineTaskService;
    private syncIntervalId: number | null = null;

    async onload() {
        await this.loadSettings();

        // Show development mode notification
        new Notice('🚀 Asana Plugin (DEV MODE) loaded successfully!', 5000);

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
        try {
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
            this.dailyTasksService = new DailyTasksService(
                this.app.vault,
                this.asanaService
            );
            this.inlineTaskService = new InlineTaskService(this.asanaService);
        } catch (error) {
            // Services will be initialized when API token is set
            new Notice('Please configure your Asana API token in settings');
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        
        // Check for archaeopteryx migration
        await this.checkArchaeopteryxMigration();
    }

    async checkArchaeopteryxMigration() {
        // Check if we need to import archaeopteryx settings
        if (!this.settings.asanaAccessToken && !this.settings.archaeopteryxAccessToken) {
            // Try to load archaeopteryx data
            const archaeopteryxPath = this.app.vault.configDir + '/plugins/archaeopteryx/data.json';
            try {
                const archaeopteryxData = await this.app.vault.adapter.read(archaeopteryxPath);
                const data = JSON.parse(archaeopteryxData);
                
                if (data.archaeopteryx_access_token || data.asana_personal_access_token) {
                    // Import archaeopteryx settings
                    this.settings.useArchaeopteryxAPI = true;
                    this.settings.archaeopteryxAPIEndpoint = data.archaeopteryx_api_endpoint || this.settings.archaeopteryxAPIEndpoint;
                    this.settings.archaeopteryxAccessToken = data.archaeopteryx_access_token || '';
                    this.settings.asanaAccessToken = data.asana_personal_access_token || '';
                    
                    await this.saveSettings();
                    new Notice('Imported settings from Archaeopteryx plugin');
                }
            } catch (error) {
                // No archaeopteryx data found, that's okay
            }
        }
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
        // Archaeopteryx commands
        // Get Daily Tasks command
        this.addCommand({
            id: 'archaeopteryx-get-daily-tasks',
            name: 'Get Daily Tasks',
            hotkeys: [{ modifiers: ['Alt', 'Shift'], key: 'd' }],
            callback: async () => {
                if (!this.dailyTasksService) {
                    new Notice('Please configure your Asana API token in settings');
                    return;
                }
                try {
                    const notice = new Notice('Fetching daily tasks...', 0);
                    const tasks = await this.dailyTasksService.fetchDailyTasks();
                    const file = await this.dailyTasksService.createDailyTasksNote(tasks);
                    notice.hide();
                    
                    new Notice(`Daily tasks loaded: ${tasks.length} tasks found`);
                    
                    // Open the daily tasks file
                    await this.app.workspace.getLeaf().openFile(file);
                } catch (error) {
                    new Notice('Failed to fetch daily tasks: ' + error.message);
                }
            }
        });

        // Save Task command
        this.addCommand({
            id: 'archaeopteryx-save-task',
            name: 'Save Task',
            hotkeys: [{ modifiers: ['Alt', 'Shift'], key: 's' }],
            editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
                if (!this.inlineTaskService) return false;
                const task = this.inlineTaskService.getTaskAtCursor(editor);
                if (task) {
                    if (!checking) {
                        this.inlineTaskService.saveTask(editor, view)
                            .then(() => new Notice('Task saved to Asana'))
                            .catch(err => new Notice('Failed to save task: ' + err.message));
                    }
                    return true;
                }
                return false;
            }
        });

        // Complete Task command
        this.addCommand({
            id: 'archaeopteryx-complete-task',
            name: 'Complete Task',
            hotkeys: [{ modifiers: ['Alt', 'Shift'], key: 'c' }],
            editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
                if (!this.inlineTaskService) return false;
                const task = this.inlineTaskService.getTaskAtCursor(editor);
                if (task) {
                    if (!checking) {
                        this.inlineTaskService.completeTask(editor, view)
                            .then(() => new Notice('Task marked as complete'))
                            .catch(err => new Notice('Failed to complete task: ' + err.message));
                    }
                    return true;
                }
                return false;
            }
        });

        // Update Task command
        this.addCommand({
            id: 'archaeopteryx-update-task',
            name: 'Update Task',
            hotkeys: [{ modifiers: ['Alt', 'Shift'], key: 'u' }],
            editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
                if (!this.inlineTaskService) return false;
                const task = this.inlineTaskService.getTaskAtCursor(editor);
                if (task && task.gid) {
                    if (!checking) {
                        this.inlineTaskService.saveTask(editor, view)
                            .then(() => new Notice('Task updated in Asana'))
                            .catch(err => new Notice('Failed to update task: ' + err.message));
                    }
                    return true;
                }
                return false;
            }
        });

        // Original commands (keeping these for compatibility)
        // Create task from selection command
        this.addCommand({
            id: 'create-task-from-selection',
            name: 'Create Asana task from selection',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'a' }],
            editorCallback: (editor) => {
                const selectedText = editor.getSelection();
                if (!selectedText) {
                    new Notice('Please select some text first');
                    return;
                }

                this.createTask(selectedText);
            }
        });

        // Command to create a new task (opens modal)
        this.addCommand({
            id: 'create-task',
            name: 'Create Task',
            editorCallback: (editor: Editor) => {
                const selectedText = editor.getSelection();
                this.createTask(selectedText);
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
                            // Error syncing task
                        }
                    }
                    
                    new Notice(`Successfully synced ${syncCount} tasks`);
                } catch (error) {
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
            new Notice('Failed to open task in Asana');
        }
    }

    private async createTask(content: string) {
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
            new Notice('Failed to delete task in Asana');
        }
    }

    async syncTasks() {
        try {
            await this.taskSyncQueue.processNext();
        } catch (error) {
            // Error syncing task
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
            new Notice('Failed to save task to Asana: ' + error.message);
        }
    }

    private async syncTaskFile(file: TFile) {
        try {
            await this.taskFileService.syncTask(file);
            new Notice('Task updated in Asana');
        } catch (error) {
            new Notice('Failed to update task in Asana');
            throw error;
        }
    }
}
