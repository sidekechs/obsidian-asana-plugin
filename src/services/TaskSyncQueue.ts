import { TFile } from 'obsidian';

export class TaskSyncQueue {
    private taskQueue: Map<string, () => Promise<void>> = new Map();
    private processingQueue = false;

    async queueTask(file: TFile, syncFunction: () => Promise<void>) {
        this.taskQueue.set(file.path, syncFunction);
        await this.processQueue();
    }

    private async processQueue() {
        if (this.processingQueue || this.taskQueue.size === 0) return;

        this.processingQueue = true;
        const tasks = Array.from(this.taskQueue.values());
        this.taskQueue.clear();

        for (const task of tasks) {
            await task();
        }

        this.processingQueue = false;

        // Check if new tasks were added during processing
        if (this.taskQueue.size > 0) {
            await this.processQueue();
        }
    }
}
