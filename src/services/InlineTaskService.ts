import { Editor, EditorPosition, MarkdownView } from 'obsidian';
import { AsanaService } from './AsanaService';
import { AsanaTask } from '../types';

export interface InlineTaskData {
    gid?: string;
    title: string;
    completed: boolean;
    notes?: string;
    projectId?: string;
    assigneeId?: string;
    dueDate?: string;
    permalink?: string;
    line: number;
    originalText: string;
}

export class InlineTaskService {
    constructor(private asanaService: AsanaService) {}

    /**
     * Parse a line to extract task data
     */
    parseTaskLine(line: string, lineNumber: number): InlineTaskData | null {
        // Match checkbox tasks: - [ ] or - [x]
        const taskMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.+)$/);
        if (!taskMatch) return null;

        const [fullMatch, indent, checkMark, content] = taskMatch;
        const completed = checkMark.toLowerCase() === 'x';
        
        // Extract task title (remove metadata)
        let title = content;
        const metadataMatch = content.match(/^(.*?)(?:\s*::\s*|$)/);
        if (metadataMatch) {
            title = metadataMatch[1].trim();
        }

        // Remove priority emoji if present
        title = title.replace(/^[🔴🟡🟢]\s*/, '');

        return {
            title,
            completed,
            line: lineNumber,
            originalText: line
        };
    }

    /**
     * Extract metadata from subsequent lines
     */
    extractTaskMetadata(lines: string[], startLine: number): Partial<InlineTaskData> {
        const metadata: Partial<InlineTaskData> = {};
        let currentLine = startLine + 1;

        while (currentLine < lines.length) {
            const line = lines[currentLine];
            
            // Stop if we hit a non-indented line or another task
            if (!line.match(/^\s{2,}/) || line.match(/^\s*-\s*\[/)) {
                break;
            }

            // Extract metadata fields
            const metaMatch = line.match(/^\s*-\s*(\w+)::\s*(.+)$/);
            if (metaMatch) {
                const [, key, value] = metaMatch;
                switch (key) {
                    case 'asana_gid':
                        metadata.gid = value.trim();
                        break;
                    case 'permalink':
                        metadata.permalink = value.trim();
                        break;
                    case 'notes':
                        metadata.notes = value.trim();
                        break;
                    case 'due_date':
                        metadata.dueDate = value.trim();
                        break;
                    case 'project':
                        metadata.projectId = value.trim();
                        break;
                    case 'assignee':
                        metadata.assigneeId = value.trim();
                        break;
                }
            }

            currentLine++;
        }

        return metadata;
    }

    /**
     * Get task at cursor position
     */
    getTaskAtCursor(editor: Editor): InlineTaskData | null {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const task = this.parseTaskLine(line, cursor.line);
        
        if (!task) return null;

        // Get all lines to extract metadata
        const content = editor.getValue();
        const lines = content.split('\n');
        const metadata = this.extractTaskMetadata(lines, cursor.line);
        
        return { ...task, ...metadata };
    }

    /**
     * Save or update task in Asana
     */
    async saveTask(editor: Editor, view: MarkdownView, extraData?: Partial<AsanaTask>): Promise<void> {
        const task = this.getTaskAtCursor(editor);
        if (!task) {
            throw new Error('No task found at cursor position');
        }

        try {
            let asanaTask: AsanaTask;

            if (task.gid) {
                // Update existing task
                const updateData: any = {
                    name: task.title,
                    completed: extraData?.completed ?? task.completed
                };

                if (task.notes) updateData.notes = task.notes;
                if (task.dueDate) updateData.due_on = task.dueDate;

                await this.asanaService.updateTask(task.gid, updateData);
                
                // Fetch updated task to get latest data
                asanaTask = await this.asanaService.getTask(task.gid);
            } else {
                // Create new task - need to get project from user or use default
                const projects = await this.asanaService.getProjects();
                if (projects.length === 0) {
                    throw new Error('No projects found in Asana');
                }

                // For now, use first project - in real implementation, show project selector
                const projectId = task.projectId || projects[0].gid;

                asanaTask = await this.asanaService.createTask({
                    name: task.title,
                    notes: task.notes,
                    projectId: projectId,
                    dueDate: task.dueDate,
                    assigneeId: task.assigneeId
                });
            }

            // Update the line in the editor with new metadata
            this.updateTaskLine(editor, task.line, asanaTask);
        } catch (error) {
            throw new Error(`Failed to save task: ${error.message}`);
        }
    }

    /**
     * Complete a task
     */
    async completeTask(editor: Editor, view: MarkdownView): Promise<void> {
        const task = this.getTaskAtCursor(editor);
        if (!task) {
            throw new Error('No task found at cursor position');
        }

        if (!task.gid) {
            // If no GID, save task first
            await this.saveTask(editor, view, { completed: true });
        } else {
            // Update completion status
            await this.asanaService.updateTask(task.gid, { completed: true });
            
            // Update checkbox in editor
            const line = editor.getLine(task.line);
            const updatedLine = line.replace(/\[\s*\]/, '[x]');
            editor.setLine(task.line, updatedLine);
        }
    }

    /**
     * Update task line with Asana data
     */
    private updateTaskLine(editor: Editor, lineNumber: number, asanaTask: AsanaTask): void {
        const lines = editor.getValue().split('\n');
        const taskLine = lines[lineNumber];
        
        // Update checkbox status
        let updatedLine = taskLine;
        if (asanaTask.completed) {
            updatedLine = updatedLine.replace(/\[\s*\]/, '[x]');
        } else {
            updatedLine = updatedLine.replace(/\[[xX]\]/, '[ ]');
        }

        // Set the updated task line
        editor.setLine(lineNumber, updatedLine);

        // Check if metadata already exists
        const hasMetadata = lineNumber + 1 < lines.length && 
                          lines[lineNumber + 1].match(/^\s{2,}-\s*asana_gid::/);

        if (!hasMetadata) {
            // Insert metadata after the task line
            const metadata = [
                `  - asana_gid:: ${asanaTask.gid}`,
                `  - permalink:: ${asanaTask.permalink_url}`
            ];

            if (asanaTask.assignee) {
                metadata.push(`  - assignee:: ${asanaTask.assignee.name}`);
            }

            // Insert metadata lines
            const cursor = editor.getCursor();
            editor.setCursor({ line: lineNumber, ch: updatedLine.length });
            editor.replaceSelection('\n' + metadata.join('\n'));
            editor.setCursor(cursor);
        }
    }

}