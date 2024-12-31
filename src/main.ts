import { 
    App, 
    Plugin, 
    Notice, 
    TFile,
    TAbstractFile
} from 'obsidian';

import { 
    AsanaPluginSettings, 
    DEFAULT_SETTINGS,
    AsanaProject,
    AsanaTask
} from './types';

import { ProjectSelectionModal } from './ui/ProjectSelectionModal';
import { AsanaSettingTab } from './ui/SettingsTab';
import { AsanaService } from './services/AsanaService';
import { TaskFileService } from './services/TaskFileService';
import { TaskSyncQueue } from './services/TaskSyncQueue';

export default class AsanaPlugin extends Plugin {
    settings: AsanaPluginSettings;
    private asanaService: AsanaService;
    private taskFileService: TaskFileService;
    private taskSyncQueue: TaskSyncQueue;
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

    private initializeServices() {
        this.asanaService = new AsanaService(this.settings.asanaAccessToken);
        this.taskFileService = new TaskFileService(this.app.vault);
        this.taskSyncQueue = new TaskSyncQueue();
    }

    private addCommands() {
        this.addCommand({
            id: 'fetch-asana-projects',
            name: 'Fetch Asana Projects',
            callback: async () => {
                try {
                    await this.fetchAsanaProjects();
                } catch (error) {
                    console.error('Error fetching projects:', error);
                    new Notice('Failed to fetch projects');
                }
            }
        });

        this.addCommand({
            id: 'open-asana-task',
            name: 'Open Asana Task in Browser',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                const metadata = activeFile ? 
                    this.app.metadataCache.getFileCache(activeFile)?.frontmatter : null;
                
                if (checking) {
                    return !!metadata?.asana_url;
                }

                if (metadata?.asana_url) {
                    window.open(metadata.asana_url);
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'sync-current-task',
            name: 'Sync Current Task with Asana',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (checking) {
                    return this.isTaskFile(activeFile);
                }

                if (activeFile) {
                    this.syncTaskFile(activeFile);
                    return true;
                }
                return false;
            }
        });
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

    private startSyncInterval() {
        if (this.syncIntervalId) return;

        this.syncIntervalId = window.setInterval(() => {
            this.syncAllTasks();
        }, this.settings.syncInterval * 60 * 1000);
    }

    private stopSyncInterval() {
        if (this.syncIntervalId) {
            window.clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
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
}
