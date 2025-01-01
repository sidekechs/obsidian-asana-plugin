import { 
    App, 
    Plugin, 
    Notice, 
    TFile,
    TAbstractFile,
    MarkdownView,
    Modal
} from 'obsidian';

import { 
    AsanaPluginSettings, 
    DEFAULT_SETTINGS,
    AsanaProject,
    AsanaTask,
    IAsanaPlugin
} from './types';

import { ProjectSelectionModal } from './ui/ProjectSelectionModal';
import { AsanaSettingTab } from './ui/SettingsTab';
import { AsanaService } from './services/AsanaService';
import { TaskFileService } from './services/TaskFileService';
import { TaskSyncQueue } from './services/TaskSyncQueue';
import { TaskCommentsModal } from './ui/TaskCommentsModal';
import { TaskSyncService } from './services/TaskSyncService';

export default class AsanaPlugin extends Plugin implements IAsanaPlugin {
    settings: AsanaPluginSettings;
    asanaService: AsanaService;
    taskFileService: TaskFileService;
    taskSyncService: TaskSyncService;
    taskSyncQueue: TaskSyncQueue;
    private syncInterval: number | null = null;
    private autoSaveInterval: number | null = null;
    private pendingChanges: Map<string, NodeJS.Timeout> = new Map();

    async onload() {
        console.log('Loading Asana plugin...');
        await this.loadSettings();

        this.asanaService = new AsanaService(this.settings.asanaAccessToken);
        this.taskFileService = new TaskFileService(this.app.vault);
        this.taskSyncService = new TaskSyncService(
            this.app.vault,
            this.asanaService,
            this.taskFileService
        );
        this.taskSyncQueue = new TaskSyncQueue();

        // Register file change event with debounce
        this.registerEvent(
            this.app.vault.on('modify', async (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.scheduleAutoSave(file);
                }
            })
        );

        console.log('Registering commands...');
        this.addCommands();

        // Add ribbon icon
        this.addRibbonIcon('list-check', 'Asana Integration: Fetch projects', async () => {
            try {
                await this.fetchAsanaProjects();
            } catch (error) {
                new Notice('Failed to fetch projects: ' + error.message);
            }
        });

        this.registerEventHandlers();
        this.addSettingTab(new AsanaSettingTab(this.app, this));
        this.startSyncInterval();
        this.updateAutoSaveInterval();
        console.log('Asana plugin loaded');
    }

    onunload() {
        this.stopSyncInterval();
        this.stopAutoSaveInterval();
        // Clear any pending saves
        for (const timeout of this.pendingChanges.values()) {
            clearTimeout(timeout);
        }
    }

    public initializeServices() {
        this.asanaService = new AsanaService(this.settings.asanaAccessToken);
        this.taskFileService = new TaskFileService(this.app.vault);
        this.taskSyncService = new TaskSyncService(
            this.app.vault,
            this.asanaService,
            this.taskFileService
        );
    }

    private async isAsanaTaskFile(file: TFile): Promise<boolean> {
        try {
            const content = await this.app.vault.read(file);
            const [frontmatter] = content.split('---\n').filter(Boolean);
            const metadata = this.taskFileService.parseFrontmatter(frontmatter);
            return !!metadata.asana_gid; // Return true if asana_gid exists and is not empty
        } catch (error) {
            console.error('Error checking if file is Asana task:', error);
            return false;
        }
    }

    private async saveCurrentTask() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
            new Notice('No active task file');
            return;
        }

        // Check if this is an Asana task file
        if (!await this.isAsanaTaskFile(activeFile)) {
            new Notice('Current file is not an Asana task');
            return;
        }

        try {
            await this.taskSyncService.syncTaskToAsana(activeFile);
            new Notice('Task saved to Asana');
        } catch (error) {
            console.error('Error saving task:', error);
            new Notice('Failed to save task to Asana: ' + error.message);
        }
    }

    private async scheduleAutoSave(file: TFile) {
        // First check if this is an Asana task file
        if (!await this.isAsanaTaskFile(file)) {
            return;
        }

        // Clear any existing timeout for this file
        const existingTimeout = this.pendingChanges.get(file.path);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // If auto-save is disabled, don't schedule a save
        if (this.settings.autoSaveInterval <= 0) {
            return;
        }

        // Schedule new save
        const timeout = setTimeout(async () => {
            try {
                await this.taskSyncService.syncTaskToAsana(file);
                this.pendingChanges.delete(file.path);
                new Notice('Task auto-saved to Asana');
            } catch (error) {
                console.error('Error auto-saving task:', error);
                new Notice('Failed to auto-save task: ' + error.message);
            }
        }, this.settings.autoSaveInterval * 1000);

        this.pendingChanges.set(file.path, timeout);
    }

    public updateAutoSaveInterval() {
        this.stopAutoSaveInterval();
        
        // Clear any pending saves
        for (const timeout of this.pendingChanges.values()) {
            clearTimeout(timeout);
        }
        this.pendingChanges.clear();

        // If auto-save is disabled, don't start the interval
        if (this.settings.autoSaveInterval <= 0) {
            return;
        }
    }

    private stopAutoSaveInterval() {
        if (this.autoSaveInterval !== null) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    private registerEventHandlers() {
        this.registerEvent(
            this.app.vault.on('modify', async (file: TAbstractFile) => {
                if (file instanceof TFile && this.isTaskFile(file)) {
                    await this.queueTaskSync(file);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('rename', async (file: TAbstractFile, oldPath: string) => {
                if (file instanceof TFile && this.isTaskFile(file)) {
                    await this.handleTaskFileRename(file, oldPath);
                }
            })
        );
    }

    private isTaskFile(file: TAbstractFile | null): boolean {
        if (!(file instanceof TFile)) return false;
        return file.path.startsWith(this.settings.taskFolder) && file.extension === 'md';
    }

    private async queueTaskSync(file: TFile) {
        await this.taskSyncQueue.queueTask(file, async () => {
            try {
                await this.syncTaskFile(file);
            } catch (error) {
                console.error(`Error syncing task ${file.path}:`, error);
                new Notice(`Failed to sync task: ${file.name}`);
            }
        });
    }

    public startSyncInterval() {
        this.stopSyncInterval();
        if (this.settings.syncInterval > 0) {
            this.syncInterval = window.setInterval(
                () => this.syncAllTasks(),
                this.settings.syncInterval * 60000
            );
        }
    }

    public stopSyncInterval() {
        if (this.syncInterval !== null) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    private async syncAllTasks() {
        const files = this.app.vault.getFiles();
        for (const file of files) {
            if (this.isTaskFile(file)) {
                await this.syncTaskFile(file);
            }
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.asanaService.updateAccessToken(this.settings.asanaAccessToken);
    }

    updateSettings(settings: Partial<AsanaPluginSettings>) {
        const oldSettings = { ...this.settings };
        
        // Update settings
        Object.assign(this.settings, settings);
        
        // Save settings
        this.saveSettings();

        // Handle specific setting changes
        if (settings.asanaAccessToken && settings.asanaAccessToken !== oldSettings.asanaAccessToken) {
            this.initializeServices();
        }
    }

    private async syncTaskFile(file: TFile) {
        try {
            const content = await this.app.vault.read(file);
            const metadata = this.app.metadataCache.getFileCache(file)?.frontmatter;
            
            if (!metadata?.asana_id) return;

            const taskData = this.taskFileService.extractTaskData(content, metadata);
            await this.asanaService.updateTask(metadata.asana_id, taskData);
            new Notice('Task updated in Asana');
        } catch (error) {
            console.error('Error updating task:', error);
            new Notice('Failed to update task in Asana');
            throw error;
        }
    }

    private async handleTaskFileRename(file: TFile, oldPath: string) {
        const metadata = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (!metadata?.asana_id) return;

        try {
            const newName = file.basename;
            await this.asanaService.updateTask(metadata.asana_id, { name: newName });
            new Notice('Task name updated in Asana');
        } catch (error) {
            console.error('Error updating task name:', error);
            new Notice('Failed to update task name in Asana');
        }
    }

    async fetchAsanaProjects() {
        try {
            const user = await this.asanaService.getCurrentUser();
            const projects = await this.asanaService.getProjects(user.workspaces[0].gid);

            if (!projects.length) {
                new Notice('No active projects found');
                return;
            }

            new ProjectSelectionModal(
                this.app,
                projects,
                async (project: AsanaProject) => {
                    await this.fetchTasksForProject(project);
                }
            ).open();

        } catch (error) {
            console.error('Error fetching projects:', error);
            new Notice('Failed to fetch projects. Check console for details.');
        }
    }

    async fetchTasksForProject(project: AsanaProject) {
        try {
            const tasks = await this.asanaService.getTasksForProject(project.gid);
            
            if (!tasks.length) {
                new Notice('No tasks found in this project');
                return;
            }

            for (const task of tasks) {
                await this.taskFileService.createTaskFile(task, project.name, this.settings.taskFolder);
            }

            new Notice(`Tasks imported to "${this.settings.taskFolder}/${project.name}"`);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            new Notice('Failed to fetch tasks. Check console for details.');
            throw error;
        }
    }

    private addCommands() {
        // Save command
        this.addCommand({
            id: 'save-current-task',
            name: 'Save current task to Asana',
            callback: async () => {
                await this.saveCurrentTask();
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
                await this.syncTaskFile(activeFile);
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
                new TaskCommentsModal(this.app, metadata.asana_gid, this.asanaService).open();
            }
        });
    }
}
