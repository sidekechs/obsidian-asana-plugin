import { App, Modal, Notice, Setting } from 'obsidian';
import { createRoot } from 'react-dom/client';
import React, { useState, useEffect } from 'react';
import { ProjectSelector } from '../components/ProjectSelector';
import { AsanaService } from '../services/AsanaService';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import styled from '@emotion/styled';

const ModalContainer = styled.div`
    min-width: 500px;
    max-width: 800px;
    padding: 20px;

    .setting-item {
        margin-bottom: 24px;
    }

    .setting-item-control {
        width: 100%;
    }

    .text-input-field {
        width: 100%;
        padding: 8px;
        margin-bottom: 8px;
    }

    .description-field {
        width: 100%;
        min-height: 100px;
        padding: 8px;
        margin-bottom: 8px;
        resize: vertical;
    }

    .dropdown {
        width: 100%;
        padding: 8px;
    }

    .date-picker {
        width: 100%;
        padding: 8px;
        margin-bottom: 8px;
    }

    .button-container {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
    }

    button {
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    }

    button.mod-cta {
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
    }

    .priority-selector {
        display: flex;
        gap: 10px;
        margin-bottom: 8px;
    }

    .priority-button {
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        opacity: 0.6;
        transition: opacity 0.2s;
    }

    .priority-button.selected {
        opacity: 1;
        font-weight: bold;
    }

    .priority-high {
        background-color: var(--color-red);
        color: white;
    }

    .priority-medium {
        background-color: var(--color-yellow);
        color: black;
    }

    .priority-low {
        background-color: var(--color-green);
        color: white;
    }
`;

interface CreateTaskModalProps {
    app: App;
    asanaService: AsanaService;
    initialTaskName: string;
    onSubmit: (data: {
        name: string;
        notes: string;
        projectId?: string;
        assigneeId?: string;
        dueDate?: string;
        priority?: 'high' | 'medium' | 'low';
    }) => Promise<void>;
    onClose: () => void;
}

const CreateTaskForm: React.FC<CreateTaskModalProps> = ({
    app,
    asanaService,
    initialTaskName,
    onSubmit,
    onClose
}) => {
    // Remove checkbox from initial task name
    const cleanTaskName = initialTaskName.replace(/^-\s*\[\s*\]\s*/, '').trim();
    
    const [taskName, setTaskName] = useState(cleanTaskName);
    const [description, setDescription] = useState('');
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [selectedAssignee, setSelectedAssignee] = useState<string>('');
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
    const [assignees, setAssignees] = useState<Array<{ gid: string; name: string }>>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Load assignees when a project is selected
        const loadAssignees = async () => {
            if (selectedProject) {
                try {
                    const projectMembers = await asanaService.getProjectMembers(selectedProject);
                    setAssignees(projectMembers);
                } catch (error) {
                    console.error('Error loading assignees:', error);
                }
            }
        };
        loadAssignees();
    }, [selectedProject]);

    const handleSubmit = async () => {
        if (!taskName.trim()) {
            new Notice('Task name is required');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit({
                name: taskName,
                notes: description,
                projectId: selectedProject || undefined,
                assigneeId: selectedAssignee || undefined,
                dueDate: dueDate ? dueDate.toISOString().split('T')[0] : undefined,
                priority
            });
            onClose();
        } catch (error) {
            console.error('Error creating task:', error);
            new Notice('Failed to create task');
            setIsSubmitting(false);
        }
    };

    return (
        <ModalContainer>
            <div className="setting-item">
                <div className="setting-item-info">
                    <div className="setting-item-name">Task Name</div>
                </div>
                <div className="setting-item-control">
                    <input
                        type="text"
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                        className="text-input-field"
                        placeholder="Enter task name"
                    />
                </div>
            </div>

            <div className="setting-item">
                <div className="setting-item-info">
                    <div className="setting-item-name">Description</div>
                </div>
                <div className="setting-item-control">
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="description-field"
                        placeholder="Enter task description"
                    />
                </div>
            </div>

            <div className="setting-item">
                <div className="setting-item-info">
                    <div className="setting-item-name">Priority</div>
                </div>
                <div className="setting-item-control">
                    <div className="priority-selector">
                        <button
                            className={`priority-button priority-high ${priority === 'high' ? 'selected' : ''}`}
                            onClick={() => setPriority('high')}
                        >
                            High
                        </button>
                        <button
                            className={`priority-button priority-medium ${priority === 'medium' ? 'selected' : ''}`}
                            onClick={() => setPriority('medium')}
                        >
                            Medium
                        </button>
                        <button
                            className={`priority-button priority-low ${priority === 'low' ? 'selected' : ''}`}
                            onClick={() => setPriority('low')}
                        >
                            Low
                        </button>
                    </div>
                </div>
            </div>

            <div className="setting-item">
                <div className="setting-item-info">
                    <div className="setting-item-name">Project</div>
                </div>
                <div className="setting-item-control">
                    <ProjectSelector
                        asanaService={asanaService}
                        onProjectSelect={setSelectedProject}
                    />
                </div>
            </div>

            {selectedProject && (
                <div className="setting-item">
                    <div className="setting-item-info">
                        <div className="setting-item-name">Assignee</div>
                    </div>
                    <div className="setting-item-control">
                        <select
                            value={selectedAssignee}
                            onChange={(e) => setSelectedAssignee(e.target.value)}
                            className="dropdown"
                        >
                            <option value="">Select Assignee</option>
                            {assignees.map((assignee) => (
                                <option key={assignee.gid} value={assignee.gid}>
                                    {assignee.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="setting-item">
                <div className="setting-item-info">
                    <div className="setting-item-name">Due Date</div>
                </div>
                <div className="setting-item-control">
                    <DatePicker
                        selected={dueDate}
                        onChange={(date: Date) => setDueDate(date)}
                        dateFormat="yyyy-MM-dd"
                        className="date-picker"
                        placeholderText="Select due date"
                        minDate={new Date()}
                        isClearable
                    />
                </div>
            </div>

            <div className="button-container">
                <button onClick={onClose}>Cancel</button>
                <button 
                    className="mod-cta" 
                    onClick={handleSubmit}
                    disabled={isSubmitting || !taskName.trim()}
                >
                    {isSubmitting ? 'Creating...' : 'Create Task'}
                </button>
            </div>
        </ModalContainer>
    );
};

export class CreateTaskModal extends Modal {
    private root: any;

    constructor(
        app: App,
        private asanaService: AsanaService,
        private initialTaskName: string,
        private onSubmit: (data: {
            name: string;
            notes: string;
            projectId?: string;
            assigneeId?: string;
            dueDate?: string;
            priority?: 'high' | 'medium' | 'low';
        }) => Promise<void>
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.root = createRoot(contentEl);
        this.root.render(
            <CreateTaskForm
                app={this.app}
                asanaService={this.asanaService}
                initialTaskName={this.initialTaskName}
                onSubmit={this.onSubmit}
                onClose={() => this.close()}
            />
        );
    }

    onClose() {
        const { contentEl } = this;
        this.root.unmount();
        contentEl.empty();
    }
}
