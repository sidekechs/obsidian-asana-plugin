import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { AsanaProject } from '../types';
import { AsanaService } from '../services/AsanaService';
import { ActionSearchBar, Action } from './ui/action-search-bar';
import { Search } from 'lucide-react';

export interface ProjectSelectorProps {
    asanaService: AsanaService;
    onProjectSelect: (projectId: string) => void;
}

const ProjectSelectorContainer = styled.div`
    width: 100%;
    margin-bottom: 16px;

    .selected-project {
        padding: 8px 12px;
        padding-left: 32px;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
        background-color: var(--background-primary);
        color: var(--text-normal);
        font-size: 14px;
        cursor: pointer;
        position: relative;
        transition: all 0.2s ease;

        &:hover {
            background-color: var(--background-modifier-hover);
        }

        .search-icon {
            position: absolute;
            left: 8px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
        }
    }
`;

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({ asanaService, onProjectSelect }) => {
    const [projects, setProjects] = useState<AsanaProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedProject, setSelectedProject] = useState<AsanaProject | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const loadProjects = async () => {
            try {
                const projectList = await asanaService.getProjects();
                // Sort projects alphabetically by name
                const sortedProjects = projectList.sort((a, b) => 
                    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
                );
                setProjects(sortedProjects);
                setLoading(false);
            } catch (err) {
                setError('Failed to load projects');
                setLoading(false);
                console.error('Error loading projects:', err);
            }
        };

        loadProjects();
    }, [asanaService]);

    if (loading) {
        return <div className="loading">Loading projects...</div>;
    }

    if (error) {
        return <div className="error">{error}</div>;
    }

    const projectActions: Action[] = projects.map(project => ({
        id: project.gid,
        label: project.name,
        icon: <Search className="h-4 w-4" />,
        end: 'Project'
    }));

    const handleProjectSelect = (action: Action) => {
        const project = projects.find(p => p.gid === action.id);
        if (project) {
            setSelectedProject(project);
            setIsSearching(false);
            onProjectSelect(action.id);
        }
    };

    if (!isSearching && selectedProject) {
        return (
            <ProjectSelectorContainer>
                <div 
                    className="selected-project"
                    onClick={() => setIsSearching(true)}
                >
                    <Search className="search-icon h-4 w-4" />
                    {selectedProject.name}
                </div>
            </ProjectSelectorContainer>
        );
    }

    return (
        <ProjectSelectorContainer>
            <ActionSearchBar 
                actions={projectActions}
                onSelect={handleProjectSelect}
                placeholder="Search projects..."
            />
        </ProjectSelectorContainer>
    );
};
