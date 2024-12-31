import { TFile } from 'obsidian';
import { TaskSyncQueue } from '../TaskSyncQueue';

jest.mock('obsidian');

describe('TaskSyncQueue', () => {
    let queue: TaskSyncQueue;

    beforeEach(() => {
        queue = new TaskSyncQueue();
    });

    describe('queueTask', () => {
        it('should execute tasks in order', async () => {
            const file = new TFile();
            file.path = 'test/test.md';

            const results: number[] = [];
            const task1 = async () => {
                await Promise.resolve();
                results.push(1);
            };

            const task2 = async () => {
                results.push(2);
            };

            await queue.queueTask(file, task1);
            await queue.queueTask(file, task2);

            expect(results).toEqual([1, 2]);
        });

        it('should handle errors in tasks', async () => {
            const file = new TFile();
            file.path = 'test/test.md';

            const results: string[] = [];
            const errorTask = () => Promise.reject(new Error('Task failed'));
            const successTask = async () => {
                results.push('success');
            };

            // First task should fail
            try {
                await queue.queueTask(file, errorTask);
            } catch (error) {
                expect(error.message).toBe('Task failed');
            }

            // Second task should succeed
            await queue.queueTask(file, successTask);

            // Verify the queue is empty and all tasks have been processed
            await queue.queueTask(file, async () => {
                expect(results).toEqual(['success']);
            });
        });

        it('should process tasks for different files independently', async () => {
            const file1 = new TFile();
            file1.path = 'test/test1.md';
            const file2 = new TFile();
            file2.path = 'test/test2.md';

            const results: string[] = [];
            const task1 = async () => {
                await Promise.resolve();
                results.push('file1');
            };

            const task2 = async () => {
                results.push('file2');
            };

            await queue.queueTask(file1, task1);
            await queue.queueTask(file2, task2);

            expect(results).toEqual(['file1', 'file2']);
        });
    });
});
