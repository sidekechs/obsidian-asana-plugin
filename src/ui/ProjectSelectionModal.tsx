import { App, Modal, Notice, MarkdownView } from 'obsidian';
import { createRoot } from 'react-dom/client';
import React, { useState } from 'react';
import { ProjectSelector } from '../components/ProjectSelector';
import { AsanaService } from '../services/AsanaService';
import { TaskFileService } from '../services/TaskFileService';
import { AsanaPluginSettings } from '../types/settings';
import styled from '@emotion/styled';

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

interface TaskFormData {
    name: string;
    notes: string;
    priority: 'low' | 'medium' | 'high';
    dueDate: string;
}

export class ProjectSelectionModal extends Modal {
    private asanaService: AsanaService;
    private taskFileService: TaskFileService;
    private settings: AsanaPluginSettings;
    private root: ReturnType<typeof createRoot> | null = null;
    private title: string = '';
    private description: string = '';

    constructor(
        app: App, 
        asanaService: AsanaService,
        taskFileService: TaskFileService,
        settings: AsanaPluginSettings,
        private content: string, 
        private onSubmit: (projectId: string) => void
    ) {
        super(app);
        this.asanaService = asanaService;
        this.taskFileService = taskFileService;
        this.settings = settings;
        const { title, description } = this.parseContent(content);
        this.title = title;
        this.description = description;
    }

    private parseContent(content: string): { title: string; description: string } {
        console.log('Raw content:', content);
        
        // Split into lines first
        const lines = content.split('\n');
        console.log('Lines after split:', lines);

        // Check if the first line is a checkbox item
        const firstLine = lines[0] || '';
        const hasCheckbox = firstLine.match(/^-\s*\[[\sxX ]?\]\s*/);

        let title = '';
        let description = '';

        if (hasCheckbox) {
            // If it starts with a checkbox, use the first line as title (without checkbox)
            title = firstLine.replace(/^-\s*\[[\sxX ]?\]\s*/, '').trim();
            description = lines.slice(1).join('\n').trim();
        } else {
            // Original paragraph-based logic for non-checkbox content
            let paragraphs: string[] = [];
            let currentParagraph: string[] = [];

            for (const line of lines) {
                if (line.trim() === "") {
                    // If we hit a blank line, we finalize the current paragraph
                    if (currentParagraph.length > 0) {
                        paragraphs.push(currentParagraph.join('\n'));
                        currentParagraph = [];
                    }
                } else {
                    currentParagraph.push(line);
                }
            }

            // Push the last paragraph if there's remaining text
            if (currentParagraph.length > 0) {
                paragraphs.push(currentParagraph.join('\n'));
            }

            console.log('Parsed paragraphs:', paragraphs);

            // First paragraph becomes the title
            title = (paragraphs[0] || '').trim();
            
            // All remaining paragraphs become the description
            description = paragraphs.slice(1).join('\n\n').trim();
        }
        
        console.log('Final parsed result:', { title, description });
        return { title, description };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        const container = contentEl.createDiv();
        this.root = createRoot(container);
        this.root.render(
            <this.TaskForm 
                asanaService={this.asanaService}
                initialTitle={this.title}
                initialDescription={this.description}
                onSubmit={this.handleSubmit}
                onCancel={() => this.close()}
            />
        );
    }

    private handleSubmit = async (data: TaskFormData, projectId: string) => {
        try {
            const task = await this.asanaService.createTask({
                name: data.name,
                notes: data.notes,
                projectId: projectId,
                dueDate: data.dueDate || undefined,
                priority: data.priority
            });

            if (task) {
                // Create the task file using template
                const project = await this.asanaService.getProject(projectId);
                const taskFile = await this.taskFileService.createTaskFile(
                    task,
                    project.name,
                    this.settings.taskFolder,
                    'task_template.md'  // Always use task_template.md
                );

                // Update the selected text with task links
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView) {
                    const editor = activeView.editor;
                    const selection = editor.getSelection();
                    const cursor = editor.getCursor();
                    
                    // Create the task path and links
                    const workspaceName = task.workspace?.name || 'Default';
                    const projectName = project.name;
                    const taskPath = `Asana Tasks/${workspaceName}/${projectName}/${task.name}`;
                    const obsidianLink = `[[${taskPath}|open in obsidian]]`;
                    const asanaLink = `[[${taskPath}|open in asana]]`;
                    const links = ` ${obsidianLink} | ${asanaLink}`;

                    if (selection) {
                        // Find the line containing the selection
                        const doc = editor.getValue();
                        const lines = doc.split('\n');
                        let taskLine = -1;
                        
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].includes(selection)) {
                                taskLine = i;
                                break;
                            }
                        }

                        if (taskLine >= 0) {
                            // Get the line's current content
                            const line = lines[taskLine];
                            const lineStart = editor.posToOffset({ line: taskLine, ch: 0 });
                            const lineEnd = editor.posToOffset({ line: taskLine, ch: line.length });
                            
                            // Append links to the end of the line
                            editor.replaceRange(
                                links,
                                editor.offsetToPos(lineEnd)
                            );
                            
                            // If there's a description, add it on the next line
                            if (data.notes) {
                                const description = '\n   ' + data.notes.split('\n').map(line => line.trim()).join('\n   ');
                                editor.replaceRange(
                                    description,
                                    { line: taskLine + 1, ch: 0 },
                                    { line: taskLine + 1, ch: 0 }
                                );
                            }
                        }
                    } else {
                        // If no selection, create a new task line
                        const dueDate = data.dueDate ? ` 📅 ${data.dueDate}` : '';
                        const taskLine = `- [ ] ${task.name}${dueDate}${links}`;
                        editor.replaceRange(taskLine, cursor);
                        
                        // Add description if present
                        if (data.notes) {
                            const description = '\n   ' + data.notes.split('\n').map(line => line.trim()).join('\n   ');
                            editor.replaceRange(description, {
                                line: cursor.line,
                                ch: taskLine.length
                            });
                        }
                    }
                }

                this.onSubmit(projectId);
                this.close();
                new Notice('Task created successfully!');
            }
        } catch (error) {
            console.error('Error creating task:', error);
            new Notice('Failed to create task in Asana');
        }
    };

    private TaskForm = ({ 
        asanaService, 
        initialTitle, 
        initialDescription,
        onSubmit,
        onCancel
    }: { 
        asanaService: AsanaService;
        initialTitle: string;
        initialDescription: string;
        onSubmit: (data: TaskFormData, projectId: string) => void;
        onCancel: () => void;
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

    onClose() {
        if (this.root) {
            this.root.unmount();
        }
        const { contentEl } = this;
        contentEl.empty();
    }
}
