import { AsanaService } from './AsanaService';
import { AsanaTask } from '../types';
import { TFile, Vault } from 'obsidian';

// Use the global moment from Obsidian
declare const moment: any;

export class DailyTasksService {
    constructor(
        private vault: Vault,
        private asanaService: AsanaService
    ) {}

    async fetchDailyTasks(): Promise<AsanaTask[]> {
        try {
            // Get all projects
            const projects = await this.asanaService.getProjects();
            const today = moment().format('YYYY-MM-DD');
            const allTasks: AsanaTask[] = [];

            // Fetch tasks from each project
            for (const project of projects) {
                const tasks = await this.asanaService.getTasksForProject(project.gid);
                
                // Filter for today's tasks or overdue tasks
                const relevantTasks = tasks.filter(task => {
                    if (!task.due_on) return false;
                    
                    const dueDate = moment(task.due_on);
                    const isToday = dueDate.format('YYYY-MM-DD') === today;
                    const isOverdue = dueDate.isBefore(moment(), 'day');
                    
                    return (isToday || isOverdue) && !task.completed;
                });
                
                allTasks.push(...relevantTasks);
            }

            // Sort by due date and priority
            return allTasks.sort((a, b) => {
                // First by due date
                const dateA = moment(a.due_on);
                const dateB = moment(b.due_on);
                const dateDiff = dateA.diff(dateB);
                if (dateDiff !== 0) return dateDiff;
                
                // Then by priority if available
                const priorityA = this.getPriorityValue(a);
                const priorityB = this.getPriorityValue(b);
                return priorityB - priorityA;
            });
        } catch (error) {
            throw new Error(`Failed to fetch daily tasks: ${error.message}`);
        }
    }

    private getPriorityValue(task: AsanaTask): number {
        // Check custom fields for priority
        const priorityField = task.custom_fields?.find(cf => cf.name === 'Priority');
        if (priorityField?.display_value) {
            switch (priorityField.display_value.toLowerCase()) {
                case 'high': return 3;
                case 'medium': return 2;
                case 'low': return 1;
                default: return 0;
            }
        }
        return 0;
    }

    async createDailyTasksNote(tasks: AsanaTask[], fileName?: string): Promise<TFile> {
        const today = moment();
        const noteFileName = fileName || `Daily Tasks - ${today.format('YYYY-MM-DD')}.md`;
        const folderPath = 'Daily Tasks';
        
        // Ensure folder exists
        if (!this.vault.getAbstractFileByPath(folderPath)) {
            await this.vault.createFolder(folderPath);
        }
        
        const filePath = `${folderPath}/${noteFileName}`;
        
        // Generate content
        const content = this.generateDailyTasksContent(tasks, today);
        
        // Create or update the file
        const existingFile = this.vault.getAbstractFileByPath(filePath);
        if (existingFile instanceof TFile) {
            await this.vault.modify(existingFile, content);
            return existingFile;
        } else {
            return await this.vault.create(filePath, content);
        }
    }

    private generateDailyTasksContent(tasks: AsanaTask[], date: moment.Moment): string {
        let content = `# Daily Tasks - ${date.format('MMMM D, YYYY')}\n\n`;
        
        if (tasks.length === 0) {
            content += `> No tasks due today! 🎉\n\n`;
            return content;
        }
        
        // Group tasks by project
        const tasksByProject = new Map<string, AsanaTask[]>();
        
        tasks.forEach(task => {
            const projectName = task.projects?.[0]?.name || 'No Project';
            if (!tasksByProject.has(projectName)) {
                tasksByProject.set(projectName, []);
            }
            tasksByProject.get(projectName)!.push(task);
        });
        
        // Generate content for each project
        tasksByProject.forEach((projectTasks, projectName) => {
            content += `## ${projectName}\n\n`;
            
            projectTasks.forEach(task => {
                const checkbox = task.completed ? '[x]' : '[ ]';
                const priority = this.getPriorityEmoji(task);
                const dueDate = moment(task.due_on);
                const isOverdue = dueDate.isBefore(moment(), 'day');
                const dateIndicator = isOverdue ? ' 🔴 OVERDUE' : '';
                
                // Add task with metadata
                content += `- ${checkbox} ${priority}${task.name}${dateIndicator}\n`;
                content += `  - asana_gid:: ${task.gid}\n`;
                content += `  - permalink:: ${task.permalink_url}\n`;
                
                if (task.assignee) {
                    content += `  - assignee:: ${task.assignee.name}\n`;
                }
                
                if (task.notes) {
                    content += `  - notes:: ${task.notes.split('\n')[0]}...\n`;
                }
                
                content += '\n';
            });
        });
        
        return content;
    }

    private getPriorityEmoji(task: AsanaTask): string {
        const priorityField = task.custom_fields?.find(cf => cf.name === 'Priority');
        if (priorityField?.display_value) {
            switch (priorityField.display_value.toLowerCase()) {
                case 'high': return '🔴 ';
                case 'medium': return '🟡 ';
                case 'low': return '🟢 ';
            }
        }
        return '';
    }
}