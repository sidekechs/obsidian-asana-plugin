import { TFile, Vault } from 'obsidian';
import { AsanaService } from './AsanaService';
import { TaskFileService } from './TaskFileService';

export class TaskSyncService {
    constructor(
        private vault: Vault,
        private asanaService: AsanaService,
        private taskFileService: TaskFileService
    ) {}

    async syncTaskToAsana(file: TFile): Promise<void> {
        try {
            // Read the file content
            const content = await this.vault.read(file);
            const [frontmatter, ...bodyParts] = content.split('---\n').filter(Boolean);
            const metadata = this.taskFileService.parseFrontmatter(frontmatter);

            // Get the task ID from frontmatter or from the line content
            let taskId = metadata.asana_gid;
            if (!taskId) {
                // Try to find task ID in the content
                const lines = content.split('\n');
                for (const line of lines) {
                    const appLinkMatch = line.match(/asana:\/\/0\/(\d+)/);
                    if (appLinkMatch) {
                        taskId = appLinkMatch[1];
                        break;
                    }
                }
            }

            if (!taskId) {
                throw new Error('No Asana task ID found in frontmatter or content');
            }

            // Extract task data from the file
            const taskData = this.taskFileService.extractTaskData(content, metadata);

            // Update the task in Asana
            await this.asanaService.updateTask(taskId, {
                name: taskData.name,
                notes: taskData.notes,
                completed: taskData.completed,
                due_on: taskData.due_on
            });

            // Update the local file to reflect any changes
            await this.taskFileService.updateTaskFile(file, taskData);
        } catch (error) {
            throw error;
        }
    }
}
