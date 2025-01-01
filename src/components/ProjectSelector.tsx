import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { AsanaProject } from '../types';

interface ProjectSelectorProps {
    projects: AsanaProject[];
    onSelect: (project: AsanaProject) => void;
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
`;

const SearchInput = styled.input`
    width: 100%;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-primary);
`;

const ProjectList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
`;

const ProjectItem = styled.div`
    padding: 0.75rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    background-color: var(--background-secondary);

    &:hover {
        background-color: var(--background-modifier-hover);
    }
`;

const Pagination = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid var(--background-modifier-border);
`;

const Button = styled.button`
    padding: 0.5rem 1rem;
    border-radius: 4px;
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    cursor: pointer;
    transition: opacity 0.2s ease;

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({ projects, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(0);
    const itemsPerPage = 10;

    const filteredProjects = projects.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
    const currentProjects = filteredProjects.slice(
        currentPage * itemsPerPage,
        (currentPage + 1) * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(0);
    }, [searchTerm]);

    return (
        <Container>
            <SearchInput
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />

            <ProjectList>
                {currentProjects.map((project) => (
                    <ProjectItem
                        key={project.gid}
                        onClick={() => onSelect(project)}
                    >
                        {project.name}
                    </ProjectItem>
                ))}
            </ProjectList>

            {totalPages > 1 && (
                <Pagination>
                    <Button
                        onClick={() => setCurrentPage(p => p - 1)}
                        disabled={currentPage === 0}
                    >
                        Previous
                    </Button>
                    <span>
                        Page {currentPage + 1} of {totalPages}
                    </span>
                    <Button
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={currentPage >= totalPages - 1}
                    >
                        Next
                    </Button>
                </Pagination>
            )}
        </Container>
    );
};
