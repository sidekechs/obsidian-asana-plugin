import { App, Modal, ButtonComponent } from 'obsidian';
import { AsanaProject } from '../types';

export class ProjectSelectionModal extends Modal {
    private projects: AsanaProject[];
    private onChoose: (project: AsanaProject) => void;
    private currentPage: number = 0;
    private readonly itemsPerPage: number = 10;
    private searchTerm: string = '';

    constructor(app: App, projects: AsanaProject[], onChoose: (project: AsanaProject) => void) {
        super(app);
        this.projects = projects;
        this.onChoose = onChoose;
    }

    private getFilteredProjects(): AsanaProject[] {
        return this.projects.filter(project => 
            project.name.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
    }

    private getCurrentPageProjects(): AsanaProject[] {
        const filtered = this.getFilteredProjects();
        const start = this.currentPage * this.itemsPerPage;
        return filtered.slice(start, start + this.itemsPerPage);
    }

    private getTotalPages(): number {
        return Math.ceil(this.getFilteredProjects().length / this.itemsPerPage);
    }

    private renderPagination(containerEl: HTMLElement) {
        const paginationEl = containerEl.createEl('div', { cls: 'pagination' });
        
        // Previous button
        new ButtonComponent(paginationEl)
            .setButtonText('Previous')
            .setDisabled(this.currentPage === 0)
            .onClick(() => {
                this.currentPage--;
                this.renderContent();
            });

        // Page indicator
        paginationEl.createSpan({
            text: `Page ${this.currentPage + 1} of ${this.getTotalPages()}`
        });

        // Next button
        new ButtonComponent(paginationEl)
            .setButtonText('Next')
            .setDisabled(this.currentPage >= this.getTotalPages() - 1)
            .onClick(() => {
                this.currentPage++;
                this.renderContent();
            });
    }

    private renderSearch(containerEl: HTMLElement) {
        const searchEl = containerEl.createEl('div', { cls: 'search-container' });
        const searchInput = searchEl.createEl('input', {
            type: 'text',
            placeholder: 'Search projects...',
            cls: 'search-input'
        });

        searchInput.value = this.searchTerm;
        searchInput.addEventListener('input', (e) => {
            this.searchTerm = (e.target as HTMLInputElement).value;
            this.currentPage = 0; // Reset to first page when searching
            this.renderContent();
        });
    }

    private renderContent() {
        const { contentEl } = this;
        contentEl.empty();
        
        // Header
        contentEl.createEl('h2', { text: 'Select a Project' });

        // Search
        this.renderSearch(contentEl);

        // Project list
        const projectList = contentEl.createEl('div', { cls: 'project-list' });
        
        this.getCurrentPageProjects().forEach(project => {
            const projectEl = projectList.createEl('div', {
                cls: 'project-item'
            });

            // Project name
            projectEl.createSpan({
                text: project.name,
                cls: 'project-name'
            });

            projectEl.addEventListener('click', async () => {
                this.onChoose(project);
                this.close();
            });
        });

        // Pagination
        if (this.getTotalPages() > 1) {
            this.renderPagination(contentEl);
        }

        // Add styles
        this.addStyles();
    }

    private addStyles() {
        const styleEl = document.head.createEl('style');
        styleEl.textContent = `
            .project-list {
                max-height: 400px;
                overflow-y: auto;
                margin: 1rem 0;
            }

            .project-item {
                padding: 0.75rem 1rem;
                border-radius: 4px;
                margin-bottom: 0.5rem;
                cursor: pointer;
                transition: background-color 0.2s ease;
                display: flex;
                align-items: center;
            }

            .project-item:hover {
                background-color: var(--background-modifier-hover);
            }

            .project-name {
                flex-grow: 1;
            }

            .search-container {
                margin: 1rem 0;
            }

            .search-input {
                width: 100%;
                padding: 0.5rem;
                border-radius: 4px;
                border: 1px solid var(--background-modifier-border);
                background-color: var(--background-primary);
            }

            .pagination {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid var(--background-modifier-border);
            }
        `;
    }

    onOpen() {
        this.renderContent();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
