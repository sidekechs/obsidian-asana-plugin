import { TFile, Vault, getLinkpath } from 'obsidian';
import { AsanaTask, AsanaTaskData } from '../types';

interface TaskData {
    completed: boolean;
    name: string;
    notes: string;
    due_on: string | null;
}

export class TaskFileService {
    constructor(private vault: Vault) {}

    async createTaskFile(task: AsanaTask, projectName: string, taskFolder: string): Promise<string> {
        const sanitizedName = this.sanitizeFileName(task.name);
        const fileName = `${taskFolder}/${projectName}/${sanitizedName}.md`;
        
        const frontmatter = this.createTaskFrontmatter(task);
        const content = await this.createTaskContent(task, frontmatter);

        try {
            // Ensure the task folder exists
            await this.vault.adapter.mkdir(`${taskFolder}/${projectName}`);
            
            // Create or update the file
            const normalizedPath = getLinkpath(fileName);
            const existingFile = this.vault.getAbstractFileByPath(normalizedPath);
            
            if (existingFile instanceof TFile) {
                await this.vault.modify(existingFile, content);
            } else {
                await this.vault.create(fileName, content);
            }

            return fileName;
        } catch (error) {
            console.error(`Error creating task file ${fileName}:`, error);
            throw new Error(`Failed to create task file: ${error.message}`);
        }
    }

    private sanitizeFileName(name: string): string {
        return name.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    private createTaskFrontmatter(task: AsanaTask): string {
        const frontmatterObj = {
            asana_id: task.gid,
            status: task.completed ? 'completed' : 'active',
            due_date: task.due_on || '',
            assignee: task.assignee?.name || '',
            projects: task.projects.map(p => p.name),
            tags: task.tags.map(t => t.name),
            asana_url: task.permalink_url,
            workspace: task.workspace.name,
            custom_fields: task.custom_fields.reduce((acc, field) => {
                acc[field.name] = field.display_value || '';
                return acc;
            }, {} as Record<string, string>)
        };

        const frontmatterStr = Object.entries(frontmatterObj)
            .map(([key, value]) => {
                if (Array.isArray(value)) {
                    return `${key}:\n${value.map(v => `  - ${JSON.stringify(v)}`).join('\n')}`;
                }
                return `${key}: ${JSON.stringify(value)}`;
            })
            .join('\n');

        return `---\n${frontmatterStr}\n---`;
    }

    private createTaskContent(task: AsanaTask, frontmatter: string): string {
        return `${frontmatter}\n\n# ${task.name}\n\n${task.notes || ''}\n\n## Comments\n\n`;
    }

    extractTaskData(content: string, metadata: any): TaskData {
        // Extract name from first heading
        const nameMatch = content.match(/^# (.+)$/m);
        const name = nameMatch ? nameMatch[1].trim() : '';

        // Extract notes (everything between the first heading and "## Comments")
        const notesMatch = content.match(/^# .+\n\n([\s\S]+?)(?=\n\n## Comments|$)/m);
        const notes = notesMatch ? notesMatch[1].trim() : '';

        return {
            name,
            notes,
            completed: metadata.status === 'completed',
            due_on: metadata.due_date || null
        };
    }
}
