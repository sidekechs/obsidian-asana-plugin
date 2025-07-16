import React, { useState } from 'react';
import { Notice } from 'obsidian';
import styled from '@emotion/styled';
import { ProjectSelector } from './ProjectSelector';
import { AsanaService } from '../services/AsanaService';

const ModalContainer = styled.div`
    min-width: 800px;
    max-width: 1000px;
    min-height: 500px;
    padding: 20px;

    .modal-content {
        margin-bottom: 20px;
    }

    .form-group {
        margin-bottom: 20px;
    }

    .form-label {
        display: block;
        margin-bottom: 10px;
        font-weight: 500;
        color: var(--text-normal);
    }

    .form-input {
        width: 100%;
        padding: 10px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 14px;
    }

    .form-textarea {
        min-height: 200px;
        resize: vertical;
        font-family: var(--font-monospace);
        line-height: 1.5;
    }

    .priority-buttons {
        display: flex;
        gap: 10px;
        margin-top: 10px;
    }

    .priority-button {
        padding: 6px 16px;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;

        &:hover {
            background: var(--background-modifier-hover);
        }

        &.selected {
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border-color: var(--interactive-accent);
        }
    }

    .button-container {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 20px;
    }

    .save-button {
        padding: 10px 20px;
        border-radius: 4px;
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        cursor: pointer;
        font-weight: 500;
        font-size: 14px;
        transition: all 0.2s ease;

        &:hover {
            opacity: 0.9;
        }
    }

    .cancel-button {
        padding: 10px 20px;
        border-radius: 4px;
        background: var(--background-modifier-hover);
        color: var(--text-normal);
        border: 1px solid var(--background-modifier-border);
        cursor: pointer;
        font-weight: 500;
        font-size: 14px;
        transition: all 0.2s ease;

        &:hover {
            background: var(--background-secondary-alt);
        }
    }
`;

export interface TaskFormData {
    name: string;
    notes: string;
    priority: 'low' | 'medium' | 'high';
    dueDate: string;
}

interface TaskFormProps {
    asanaService: AsanaService;
    initialTitle: string;
    initialDescription: string;
    onSubmit: (data: TaskFormData, projectId: string) => void;
    onCancel: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ 
    asanaService, 
    initialTitle, 
    initialDescription,
    onSubmit,
    onCancel
}) => {
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState(initialDescription);
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    const handleProjectSelect = (projectId: string) => {
        setSelectedProjectId(projectId);
    };

    const handleSave = () => {
        if (!selectedProjectId) {
            new Notice('Please select a project');
            return;
        }

        onSubmit(
            {
                name: title,
                notes: description,
                priority,
                dueDate
            },
            selectedProjectId
        );
    };

    return (
        <ModalContainer>
            <div className="form-group">
                <label className="form-label">Title</label>
                <input
                    type="text"
                    className="form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Task title"
                />
            </div>

            <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                    className="form-input form-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Task description"
                />
            </div>

            <div className="form-group">
                <label className="form-label">Due Date</label>
                <input
                    type="date"
                    className="form-input"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                />
            </div>

            <div className="form-group">
                <label className="form-label">Priority</label>
                <div className="priority-buttons">
                    <button
                        className={`priority-button ${priority === 'low' ? 'selected' : ''}`}
                        onClick={() => setPriority('low')}
                    >
                        Low
                    </button>
                    <button
                        className={`priority-button ${priority === 'medium' ? 'selected' : ''}`}
                        onClick={() => setPriority('medium')}
                    >
                        Medium
                    </button>
                    <button
                        className={`priority-button ${priority === 'high' ? 'selected' : ''}`}
                        onClick={() => setPriority('high')}
                    >
                        High
                    </button>
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Project</label>
                <ProjectSelector
                    asanaService={asanaService}
                    onProjectSelect={handleProjectSelect}
                />
            </div>

            <div className="button-container">
                <button className="cancel-button" onClick={onCancel}>
                    Cancel
                </button>
                <button className="save-button" onClick={handleSave}>
                    Create Task
                </button>
            </div>
        </ModalContainer>
    );
};