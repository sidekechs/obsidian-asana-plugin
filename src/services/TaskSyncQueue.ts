import { TFile } from 'obsidian';

export class TaskSyncQueue {
    private queue: Array<() => Promise<void>> = [];
    private processing = false;

    async enqueue(task: () => Promise<void>) {
        this.queue.push(task);
    }

    async processNext() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;
        try {
            const task = this.queue.shift();
            if (task) {
                await task();
            }
        } finally {
            this.processing = false;
        }
    }
}
