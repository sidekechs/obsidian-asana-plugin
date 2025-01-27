import { App, Modal } from 'obsidian';
import { AsanaProject } from '../types';
import { createRoot } from 'react-dom/client';
import React, { useState, useEffect } from 'react';
import { ActionSearchBar, Action } from '../components/ui/action-search-bar';
import { Search } from 'lucide-react';

export class ProjectSelectionModal extends Modal {
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
        
        // Create container for React
        const reactContainer = contentEl.createDiv();
        this.root = createRoot(reactContainer);
        
        // Render React component
        this.root.render(
            <ProjectSelectionContent 
                projects={this.projects} 
                onChoose={(project) => {
                    this.onChoose(project);
                    this.close();
                }}
            />
        );
    }

    onClose() {
        const { contentEl } = this;
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
        contentEl.empty();
    }
}

interface ProjectSelectionContentProps {
    projects: AsanaProject[];
    onChoose: (project: AsanaProject) => void;
}

function ProjectSelectionContent({ projects, onChoose }: ProjectSelectionContentProps) {
    const [filteredProjects, setFilteredProjects] = useState<AsanaProject[]>(projects);

    // Convert projects to actions
    const projectActions: Action[] = projects.map(project => ({
        id: project.gid,
        label: project.name,
        icon: <Search className="h-4 w-4 text-blue-500" />,
        end: 'Project'
    }));

    const handleActionSelect = (action: Action) => {
        const project = projects.find(p => p.gid === action.id);
        if (project) {
            onChoose(project);
        }
    };

    return (
        <div className="project-selection-modal">
            <h2 className="text-xl font-bold mb-4">Select a Project</h2>
            <ActionSearchBar 
                actions={projectActions}
                onSelect={handleActionSelect}
            />
        </div>
    );
}
