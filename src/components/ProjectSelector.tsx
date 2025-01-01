import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { AsanaProject } from '../types';
import { AsanaService } from '../services/AsanaService';

export interface ProjectSelectorProps {
    asanaService: AsanaService;
    onProjectSelect: (projectId: string) => void;
}

const ProjectSelectorContainer = styled.div`
    max-height: 300px;
    overflow-y: auto;
`;

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({ asanaService, onProjectSelect }) => {
    const [projects, setProjects] = useState<AsanaProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadProjects = async () => {
            try {
                const projectList = await asanaService.getProjects();
                setProjects(projectList);
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
        return <div>Loading projects...</div>;
    }

    if (error) {
        return <div className="error">{error}</div>;
    }

    return (
        <ProjectSelectorContainer>
            <select
                onChange={(e) => onProjectSelect(e.target.value)}
                className="dropdown"
            >
                <option value="">Select Project</option>
                {projects.map((project) => (
                    <option key={project.gid} value={project.gid}>
                        {project.name}
                    </option>
                ))}
            </select>
        </ProjectSelectorContainer>
    );
};
