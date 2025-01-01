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

            // Get the task ID from frontmatter
            const taskId = metadata.asana_gid;
            if (!taskId) {
                throw new Error('No Asana task ID found in frontmatter');
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

            console.log('Task synced to Asana:', taskId);
        } catch (error) {
            console.error('Error syncing task to Asana:', error);
            throw error;
        }
    }
}
