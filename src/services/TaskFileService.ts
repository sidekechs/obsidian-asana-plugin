import { TFile, Vault, getLinkpath, MetadataCache } from 'obsidian';
import { AsanaTask, AsanaTaskData } from '../types';
import { AsanaService } from './AsanaService';

interface TaskData {
    completed: boolean;
    name: string;
    notes: string;
    due_on: string | null;
}

export class TaskFileService {
    constructor(
        private vault: Vault, 
        private metadataCache: MetadataCache,
        private asanaService: AsanaService
    ) {}

    async createTaskFile(task: AsanaTask, projectName: string, taskFolder: string, templatePath?: string): Promise<string> {
        const sanitizedName = this.sanitizeFileName(task.name || 'Untitled Task');
        const workspaceName = this.sanitizeFileName(task.workspace?.name || 'Default Workspace');
        const sanitizedProjectName = this.sanitizeFileName(projectName);
        
        let fileName = `${taskFolder}/${workspaceName}/${sanitizedProjectName}/${sanitizedName}.md`;
        
        // Ensure unique filename
        let counter = 1;
        while (this.vault.getAbstractFileByPath(getLinkpath(fileName))) {
            const newName = `${sanitizedName} ${counter}`;
            fileName = `${taskFolder}/${workspaceName}/${sanitizedProjectName}/${newName}.md`;
            counter++;
        }

        try {
            // Ensure the nested folder structure exists
            await this.vault.adapter.mkdir(`${taskFolder}/${workspaceName}/${sanitizedProjectName}`);
            
            // Create frontmatter and content
            const frontmatter = this.createTaskFrontmatter(task);
            const content = await this.createTaskContent(task, frontmatter, templatePath);
            
            // Create the file
            await this.vault.create(fileName, content);
            return fileName;
        } catch (error) {
            console.error(`Error creating task file ${fileName}:`, error);
            throw new Error(`Failed to create task file: ${error.message}`);
        }
    }

    private sanitizeFileName(name: string): string {
        // Remove invalid characters and trim
        const sanitized = name
            .replace(/[\\/:*?"<>|]/g, '')  // Remove invalid filename characters
            .replace(/\s+/g, ' ')          // Replace multiple spaces with single space
            .trim();
        
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
                    
                    // Get workspace and project info
                    const workspaceName = task.workspace?.name || 'Default';
                    const projectName = task.projects?.[0]?.name || 'Uncategorized';
                    const taskPath = `Asana Tasks/${workspaceName}/${projectName}/${task.name}`;
                    const obsidianLink = `[[${taskPath}|open in obsidian]]`;
                    const asanaLink = `[[${taskPath}|open in asana]]`;
                    const links = `${obsidianLink} | ${asanaLink}`;
                    
                    // Replace template variables
                    template = template
                        .replace(/{{task_name}}/g, task.name || 'Untitled Task')
                        .replace(/{{task_description}}/g, task.notes || '')
                        .replace(/{{task_status}}/g, task.completed ? 'Completed' : 'Active')
                        .replace(/{{task_due_date}}/g, task.due_on || 'No due date')
                        .replace(/{{task_assignee}}/g, task.assignee?.name || 'Unassigned')
                        .replace(/{{task_tags}}/g, (task.tags?.map(tag => tag.name) || []).join(', '))
                        .replace(/{{task_projects}}/g, projectName)
                        .replace(/{{task_workspace}}/g, workspaceName)
                        .replace(/{{task_links}}/g, links)
                        .replace(/{{task_permalink}}/g, task.permalink_url || '')
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
            content += `${task.notes}\n\n`;
        }

        return content;
    }

    public parseFrontmatter(frontmatter: string): Record<string, any> {
        try {
            // Simple frontmatter parser
            const lines = frontmatter.split('\n');
            const result: Record<string, any> = {};
            
            for (const line of lines) {
                const match = line.match(/^(\w+):\s*(.+)$/);
                if (match) {
                    const [_, key, value] = match;
                    try {
                        // Try to parse as JSON first
                        result[key] = JSON.parse(value);
                    } catch {
                        // If not valid JSON, use the raw string
                        result[key] = value;
                    }
                }
            }
            
            return result;
        } catch (error) {
            console.error('Error parsing frontmatter:', error);
            return {};
        }
    }

    extractFrontmatter(content: string): any {
        const matches = content.match(/^---\n([\s\S]*?)\n---/);
        if (matches && matches[1]) {
            return this.parseFrontmatter(matches[1]);
        }
        return null;
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
        
        // Extract name from task line
        let name = '';
        let notes = '';
        let completed = metadata.status === 'completed';
        
        // Look for task line with links
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const taskMatch = line.match(/^-\s*\[([\sxX])\]\s*\*\*(.*?)\*\*/);
            if (taskMatch) {
                completed = taskMatch[1].toLowerCase() === 'x';
                name = taskMatch[2];
                
                // Rest of the lines are notes
                notes = lines.slice(i + 1).join('\n').trim();
                break;
            }
        }

        return {
            name,
            notes,
            completed,
            due_on: metadata.due_date || null
        };
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

    async saveTask(file: TFile): Promise<void> {
        const content = await this.vault.read(file);
        const metadata = this.metadataCache.getFileCache(file)?.frontmatter;
        
        if (!metadata?.asana_gid) {
            throw new Error('No Asana task ID found');
        }

        const taskData = this.extractTaskData(content, metadata);
        await this.asanaService.updateTask(metadata.asana_gid, taskData);
    }

    async syncTask(file: TFile): Promise<void> {
        const content = await this.vault.read(file);
        const metadata = this.metadataCache.getFileCache(file)?.frontmatter;
        
        if (!metadata?.asana_gid) {
            throw new Error('No Asana task ID found');
        }

        const taskData = this.extractTaskData(content, metadata);
        await this.asanaService.updateTask(metadata.asana_gid, taskData);
    }
}
