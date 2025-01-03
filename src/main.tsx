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
import { CreateTaskModal } from './ui/CreateTaskModal';

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

        // Create task from line command
        this.addCommand({
            id: 'create-task-from-line',
            name: 'Create Asana task from current line',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'a' }],
            editorCallback: (editor) => {
                const currentLine = editor.getCursor().line;
                const line = editor.getLine(currentLine);
                
                // Check if line is a task
                if (!line.trim().startsWith('- [ ]')) {
                    new Notice('Current line is not a task');
                    return;
                }

                // Extract task name (remove checkbox and trim)
                const taskName = line.replace(/^-\s*\[\s*\]\s*/, '').trim();

                // Get the next lines until we hit an empty line or another list item
                let description = '';
                let nextLine = currentLine + 1;
                while (nextLine < editor.lineCount()) {
                    const nextLineText = editor.getLine(nextLine);
                    if (!nextLineText.trim() || nextLineText.trim().startsWith('-')) {
                        break;
                    }
                    if (description) description += '\n';
                    description += nextLineText.trim();
                    nextLine++;
                }
                
                new CreateTaskModal(
                    this.app,
                    this.asanaService,
                    taskName,
                    async (data) => {
                        try {
                            const task = await this.asanaService.createTask({
                                name: data.name,
                                notes: data.notes || description,
                                projectId: data.projectId,
                                assigneeId: data.assigneeId,
                                dueDate: data.dueDate,
                                priority: data.priority
                            });

                            // Get project and workspace info
                            const project = await this.asanaService.getProject(data.projectId);
                            const workspace = await this.asanaService.getCurrentUser();
                            
                            // Create a complete task object for file creation
                            const completeTask = {
                                ...task,
                                workspace: workspace.workspaces[0],
                                projects: [project]
                            };

                            // Create the local file
                            const taskFolderPath = this.settings.taskFolder || 'Tasks';
                            const fileName = await this.taskFileService.createTaskFile(
                                completeTask,
                                project.name,
                                taskFolderPath,
                                this.settings.templateFile
                            );

                            const priorityEmoji = {
                                high: '🔴',
                                medium: '🟡',
                                low: '🟢'
                            }[data.priority || 'medium'];

                            // Format the due date if present
                            const dateStr = completeTask.due_on ? ` 📅 ${completeTask.due_on}` : '';

                            // Create Obsidian wiki-link and Asana link
                            const escapedPath = fileName.replace(/\.md$/, '');
                            const obsidianLink = `[[${escapedPath}|open in obsidian]]`;
                            const asanaLink = `[open in asana](${task.permalink_url})`;

                            const newLine = `- [ ] ${data.name}${dateStr} ${obsidianLink} | ${asanaLink}`;
                            editor.setLine(currentLine, newLine);
                            new Notice('Task created in Asana and local file created');
                        } catch (error) {
                            console.error('Error creating task:', error);
                            new Notice('Failed to create task in Asana');
                        }
                    }
                ).open();
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
                                this.settings.taskFolder || 'Tasks',
                                this.settings.templateFile
                            );
                        });
                    }
                    new Notice(`Tasks imported to "${this.settings.taskFolder || 'Tasks'}/${project.name}"`);
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
