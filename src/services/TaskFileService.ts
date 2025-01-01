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

    async createTaskFile(task: AsanaTask, projectName: string, taskFolder: string, templatePath?: string): Promise<string> {
        const sanitizedName = this.sanitizeFileName(task.name || 'Untitled Task');
        let fileName = `${taskFolder}/${projectName}/${sanitizedName}.md`;
        
        // Ensure unique filename
        let counter = 1;
        while (this.vault.getAbstractFileByPath(getLinkpath(fileName))) {
            const newName = `${sanitizedName} ${counter}`;
            fileName = `${taskFolder}/${projectName}/${newName}.md`;
            counter++;
        }

        const frontmatter = this.createTaskFrontmatter(task);
        const content = await this.createTaskContent(task, frontmatter, templatePath);

        try {
            // Ensure the task folder exists
            await this.vault.adapter.mkdir(`${taskFolder}/${projectName}`);
            
            // Create the file
            await this.vault.create(fileName, content);
            return fileName;
        } catch (error) {
            console.error(`Error creating task file ${fileName}:`, error);
            throw new Error(`Failed to create task file: ${error.message}`);
        }
    }

    private sanitizeFileName(name: string): string {
        // Replace invalid characters with underscores and trim
        const sanitized = name
            .replace(/[\\/:*?"<>|]/g, '_') // Replace Windows-invalid chars
            .replace(/\s+/g, ' ')          // Replace multiple spaces with single space
            .trim();                       // Remove leading/trailing spaces
        
        return sanitized || 'Untitled Task';
    }

    private createTaskFrontmatter(task: AsanaTask): string {
        const frontmatterObj = {
            asana_gid: task.gid,
            status: task.completed ? 'completed' : 'active',
            due_date: task.due_on || '',
            assignee: task.assignee?.name || '',
            created_at: new Date().toISOString(),
            tags: task.tags?.map(tag => tag.name) || [],
            projects: task.projects?.map(p => p.name) || [],
            workspace: task.workspace?.name || '',
            permalink_url: task.permalink_url || ''
        };

        return '---\n' + Object.entries(frontmatterObj)
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join('\n') + '\n---\n\n';
    }

    private async createTaskContent(task: AsanaTask, frontmatter: string, templatePath?: string): Promise<string> {
        let content = frontmatter;

        if (templatePath) {
            try {
                const templateFile = this.vault.getAbstractFileByPath(templatePath);
                if (templateFile instanceof TFile) {
                    let template = await this.vault.read(templateFile);
                    
                    // Replace template variables
                    template = template
                        .replace(/{{task_name}}/g, task.name || 'Untitled Task')
                        .replace(/{{task_description}}/g, task.notes || '')
                        .replace(/{{task_status}}/g, task.completed ? 'Completed' : 'Active')
                        .replace(/{{task_due_date}}/g, task.due_on || 'No due date')
                        .replace(/{{task_assignee}}/g, task.assignee?.name || 'Unassigned')
                        .replace(/{{task_tags}}/g, (task.tags?.map(tag => tag.name) || []).join(', '))
                        .replace(/{{task_projects}}/g, (task.projects?.map(p => p.name) || []).join(', '))
                        .replace(/{{task_workspace}}/g, task.workspace?.name || '')
                        .replace(/{{task_url}}/g, task.permalink_url || '')
                        .replace(/{{date}}/g, new Date().toISOString().split('T')[0])
                        .replace(/{{time}}/g, new Date().toLocaleTimeString());

                    return content + template;
                }
            } catch (error) {
                console.error('Error reading template file:', error);
            }
        }

        // Default content if no template or template fails
        content += `# ${task.name || 'Untitled Task'}\n\n`;
        
        if (task.notes) {
            content += `## Description\n${task.notes}\n\n`;
        }

        content += '## Comments\n\n';
        return content;
    }

    async updateTaskFile(file: TFile, taskData: TaskData): Promise<void> {
        const content = await this.vault.read(file);
        const [frontmatter, ...bodyParts] = content.split('---\n').filter(Boolean);
        const body = bodyParts.join('---\n');

        const updatedFrontmatter = {
            ...this.parseFrontmatter(frontmatter),
            status: taskData.completed ? 'completed' : 'active',
            due_date: taskData.due_on || '',
        };

        const newContent = '---\n' + 
            Object.entries(updatedFrontmatter)
                .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                .join('\n') +
            '\n---\n\n' +
            body;

        await this.vault.modify(file, newContent);
    }

    public parseFrontmatter(frontmatter: string): Record<string, any> {
        const result: Record<string, any> = {};
        const lines = frontmatter.split('\n');
        
        for (const line of lines) {
            const match = line.match(/^(\w+):\s*(.+)$/);
            if (match) {
                try {
                    result[match[1]] = JSON.parse(match[2]);
                } catch {
                    result[match[1]] = match[2];
                }
            }
        }
        
        return result;
    }

    extractTaskData(content: string, metadata: any): TaskData {
        // Split content to remove frontmatter
        const parts = content.split('---\n');
        if (parts.length < 3) {
            return {
                name: '',
                notes: '',
                completed: metadata.status === 'completed',
                due_on: metadata.due_date || null
            };
        }

        // Get the actual content (after frontmatter)
        const bodyContent = parts.slice(2).join('---\n').trim();
        const lines = bodyContent.split('\n');
        
        // Extract name from first heading
        const nameMatch = bodyContent.match(/^# (.+)$/m);
        const name = nameMatch ? nameMatch[1].trim() : '';

        // Process the rest as notes, excluding the Comments section
        let notes = '';
        let foundComments = false;

        for (const line of lines) {
            // Skip the title line
            if (line.startsWith('# ')) {
                continue;
            }

            // Stop at Comments section
            if (line.startsWith('## Comments')) {
                foundComments = true;
                break;
            }

            // Add non-empty lines to notes
            if (line.trim()) {
                if (notes) {
                    notes += '\n';
                }
                notes += line.trim();
            }
        }

        return {
            name,
            notes,
            completed: metadata.status === 'completed',
            due_on: metadata.due_date || null
        };
    }
}
