import { App, Plugin, PluginSettingTab, Setting, Modal, Notice, MarkdownView, TFile } from 'obsidian';
import Asana from 'asana';

interface AsanaPluginSettings {
    asanaAccessToken: string;
}

interface AsanaProject {
    gid: string;
    name: string;
}

interface AsanaTask {
    gid: string;
    name: string;
    due_on?: string;
}

class ProjectSelectionModal extends Modal {
    projects: AsanaProject[];
    onChoose: (project: AsanaProject) => void;

    constructor(app: App, projects: AsanaProject[], onChoose: (project: AsanaProject) => void) {
        super(app);
        this.projects = projects;
        this.onChoose = onChoose;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: "Select Asana Project" });

        const projectList = contentEl.createEl("div", { cls: "project-list" });
        
        this.projects.forEach(project => {
            const projectEl = projectList.createEl("div", {
                cls: "project-item",
                text: project.name
            });
            
            projectEl.addEventListener("click", () => {
                this.onChoose(project);
                this.close();
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class AsanaSettingTab extends PluginSettingTab {
    plugin: AsanaPlugin;

    constructor(app: App, plugin: AsanaPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Asana Personal Access Token')
            .setDesc('Enter your Asana Personal Access Token')
            .addText(text => text
                .setPlaceholder('Enter your token...')
                .setValue(this.plugin.settings.asanaAccessToken || '')
                .onChange(async (value) => {
                    this.plugin.settings.asanaAccessToken = value;
                    await this.plugin.saveSettings();
                }));
    }
}

export default class AsanaPlugin extends Plugin {
    settings: AsanaPluginSettings;
    private client: any;

    async onload() {
        await this.loadSettings();
        this.client = Asana.Client.create().useAccessToken(this.settings.asanaAccessToken);

        this.addCommand({
            id: 'fetch-asana-projects',
            name: 'Fetch Asana Projects',
            callback: async () => {
                await this.fetchAsanaProjects();
            }
        });

        this.addRibbonIcon('list-check', 'Fetch Asana Projects', async () => {
            await this.fetchAsanaProjects();
        });

        // Register the file event listener for task completion
        this.registerEvent(
            this.app.vault.on('modify', async (file: TFile) => {
                if (file.extension === 'md') {
                    await this.handleFileModification(file);
                }
            })
        );

        this.addSettingTab(new AsanaSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, {
            asanaAccessToken: ''
        }, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async fetchAsanaProjects() {
        if (!this.settings.asanaAccessToken) {
            new Notice('Please set your Asana access token in the plugin settings');
            return;
        }

        try {
            const workspaces = await this.client.workspaces.findAll();
            if (!workspaces.data.length) {
                new Notice('No workspaces found in your Asana account');
                return;
            }

            const workspace = workspaces.data[0];
            const projects = await this.client.projects.findByWorkspace(workspace.gid);

            if (!projects.data.length) {
                new Notice('No projects found in the workspace');
                return;
            }

            new ProjectSelectionModal(this.app, projects.data, async (selectedProject) => {
                await this.fetchTasksForProject(selectedProject);
            }).open();

        } catch (error) {
            console.error('Error fetching Asana data:', error);
            new Notice('Failed to fetch Asana projects. Check console for details.');
        }
    }

    async fetchTasksForProject(project: AsanaProject) {
        try {
            const tasks = await this.client.tasks.findByProject(project.gid);
            
            if (!tasks.data.length) {
                new Notice('No tasks found in this project');
                return;
            }

            // Create a new note with the tasks, including task IDs
            const taskContent = tasks.data.map((task: AsanaTask) => {
                return `- [ ] ${task.name} [asana-id:${task.gid}]${task.due_on ? ` (Due: ${task.due_on})` : ''}`;
            }).join('\n');

            const noteContent = `# ${project.name} Tasks\n\n${taskContent}`;
            
            // Create a new note in the vault's root directory
            const fileName = `${project.name.replace(/[\\/:*?"<>|]/g, '_')} Tasks.md`;
            
            try {
                await this.app.vault.create(fileName, noteContent);
                new Notice(`Tasks imported to "${fileName}"`);
            } catch (error) {
                console.error('Error creating file:', error);
                new Notice('Failed to create the tasks file. Check console for details.');
            }

        } catch (error) {
            console.error('Error fetching tasks:', error);
            new Notice('Failed to fetch tasks. Check console for details.');
        }
    }

    async handleFileModification(file: TFile) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const taskMatch = line.match(/^- \[([ xX])\] (.*?) \[asana-id:([^\]]+)\]/);
            
            if (taskMatch) {
                const [, checkboxState, taskName, taskId] = taskMatch;
                const isChecked = checkboxState.toLowerCase() === 'x';
                
                // Get the previous state from the task cache
                const cacheKey = `task-${taskId}`;
                const data = await this.loadData();
                const previousState = data[cacheKey];
                
                // If the state has changed, update Asana
                if (previousState !== isChecked) {
                    try {
                        await this.client.tasks.update(taskId, {
                            completed: isChecked
                        });
                        
                        if (isChecked) {
                            await this.client.stories.createOnTask(taskId, {
                                text: "Task completed via Obsidian"
                            });
                        }
                        
                        // Cache the new state
                        data[cacheKey] = isChecked;
                        await this.saveData(data);
                        
                        new Notice(`Task "${taskName}" ${isChecked ? 'completed' : 'uncompleted'} in Asana`);
                    } catch (error) {
                        console.error('Error updating task in Asana:', error);
                        new Notice('Failed to update task in Asana. Check console for details.');
                    }
                }
            }
        }
    }
}
