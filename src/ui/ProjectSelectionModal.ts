import { App, Modal } from 'obsidian';
import { AsanaProject } from '../types';

export class ProjectSelectionModal extends Modal {
    private projects: AsanaProject[];
    private onChoose: (project: AsanaProject) => void;

    constructor(app: App, projects: AsanaProject[], onChoose: (project: AsanaProject) => void) {
        super(app);
        this.projects = projects;
        this.onChoose = onChoose;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Select a Project' });

        const projectList = contentEl.createEl('div', { cls: 'project-list' });

        this.projects.forEach(project => {
            const projectEl = projectList.createEl('div', {
                cls: 'project-item',
                text: project.name
            });

            projectEl.addEventListener('click', async () => {
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
