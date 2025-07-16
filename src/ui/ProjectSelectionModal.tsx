import { App, Modal, Notice, MarkdownView } from 'obsidian';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { AsanaService } from '../services/AsanaService';
import { TaskFileService } from '../services/TaskFileService';
import { AsanaPluginSettings } from '../types/settings';
import { TaskForm, TaskFormData } from '../components/TaskForm';


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
        // Split into lines first
        const lines = content.split('\n');

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

            // First paragraph becomes the title
            title = (paragraphs[0] || '').trim();
            
            // All remaining paragraphs become the description
            description = paragraphs.slice(1).join('\n\n').trim();
        }
        
        return { title, description };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        const container = contentEl.createDiv();
        this.root = createRoot(container);
        this.root.render(
            <TaskForm 
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
            new Notice('Failed to create task in Asana');
        }
    };


    onClose() {
        if (this.root) {
            this.root.unmount();
        }
        const { contentEl } = this;
        contentEl.empty();
    }
}
