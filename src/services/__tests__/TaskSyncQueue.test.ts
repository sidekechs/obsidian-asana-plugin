import { TFile } from 'obsidian';
import { TaskSyncQueue } from '../TaskSyncQueue';

jest.mock('obsidian');

describe('TaskSyncQueue', () => {
    let queue: TaskSyncQueue;

    beforeEach(() => {
        queue = new TaskSyncQueue();
    });

    it('should process tasks in order', async () => {
        const results: number[] = [];
        const task1 = async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            results.push(1);
        };
        const task2 = async () => {
            results.push(2);
        };

        // Enqueue tasks
        await queue.enqueue(task1);
        await queue.enqueue(task2);

        // Process tasks
        await queue.processNext();
        await queue.processNext();

        expect(results).toEqual([1, 2]);
    });

    it('should handle task errors gracefully', async () => {
        const results: string[] = [];
        const errorTask = async () => {
            throw new Error('Test error');
        };
        const successTask = async () => {
            results.push('success');
        };

        try {
            await queue.enqueue(errorTask);
            await queue.processNext();
        } catch (error) {
            results.push('error caught');
        }

        await queue.enqueue(successTask);
        await queue.processNext();

        await queue.enqueue(async () => {
            results.push('final task');
        });
        await queue.processNext();

        expect(results).toEqual(['error caught', 'success', 'final task']);
    });

    it('should process tasks independently', async () => {
        const results: string[] = [];
        const task1 = async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            results.push('task1');
        };
        const task2 = async () => {
            results.push('task2');
        };

        // Enqueue tasks
        await queue.enqueue(task1);
        await queue.enqueue(task2);

        // Process tasks
        await queue.processNext();
        await queue.processNext();

        expect(results).toEqual(['task1', 'task2']);
    });
});
