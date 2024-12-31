import { App, Plugin, TFile } from 'obsidian';
import AsanaPlugin from '../main';
import { AsanaProject } from '../types';
import { AsanaService } from '../services/AsanaService';
import { TaskFileService } from '../services/TaskFileService';
import { TaskSyncQueue } from '../services/TaskSyncQueue';

jest.mock('../services/AsanaService');
jest.mock('../services/TaskFileService');
jest.mock('../services/TaskSyncQueue');

describe('AsanaPlugin', () => {
    let app: App;
    let plugin: AsanaPlugin;
    let mockAsanaService: jest.Mocked<AsanaService>;
    let mockTaskFileService: jest.Mocked<TaskFileService>;
    let mockTaskSyncQueue: jest.Mocked<TaskSyncQueue>;

    beforeEach(async () => {
        app = new App();
        plugin = new AsanaPlugin(app, {
            id: 'asana-plugin',
            name: 'Asana Plugin',
            version: '1.0.0',
            minAppVersion: '0.15.0',
            description: 'Asana integration for Obsidian',
            author: 'Test Author',
            authorUrl: 'https://github.com/testauthor',
            isDesktopOnly: false
        });

        // Create mock services
        mockAsanaService = new AsanaService('test-token') as jest.Mocked<AsanaService>;
        mockTaskFileService = new TaskFileService(app.vault) as jest.Mocked<TaskFileService>;
        mockTaskSyncQueue = new TaskSyncQueue() as jest.Mocked<TaskSyncQueue>;

        // Access private properties using type assertion
        (plugin as any).asanaService = mockAsanaService;
        (plugin as any).taskFileService = mockTaskFileService;
        (plugin as any).taskSyncQueue = mockTaskSyncQueue;

        await plugin.loadSettings();
    });

    describe('onload', () => {
        it('should initialize plugin correctly', async () => {
            await plugin.onload();
            expect(plugin.settings).toBeDefined();
            expect(plugin.settings.asanaAccessToken).toBe('');
            expect(plugin.settings.taskFolder).toBe('Tasks');
        });
    });

    describe('saveSettings', () => {
        it('should save settings and update services', async () => {
            const newSettings = {
                asanaAccessToken: 'new-token',
                taskFolder: 'New Tasks',
                templateFile: 'template.md',
                syncInterval: 10
            };
            plugin.settings = newSettings;
            await plugin.saveSettings();
            expect(mockAsanaService.updateAccessToken).toHaveBeenCalledWith('new-token');
        });
    });

    describe('fetchTasksForProject', () => {
        const mockProject: AsanaProject = {
            gid: 'project1',
            name: 'Test Project'
        };

        const mockTasks = [
            {
                gid: 'task1',
                name: 'Test Task 1',
                notes: 'Test Notes 1',
                completed: false,
                due_on: '2024-01-01',
                custom_fields: [],
                assignee: null,
                projects: [mockProject],
                tags: [],
                workspace: { gid: 'workspace1', name: 'Workspace 1' },
                permalink_url: 'https://app.asana.com/task1'
            }
        ];

        it('should fetch and create task files', async () => {
            mockAsanaService.getTasksForProject.mockResolvedValue(mockTasks);
            mockTaskFileService.createTaskFile.mockResolvedValue('Test Task 1');

            await plugin.fetchTasksForProject(mockProject);

            expect(mockAsanaService.getTasksForProject).toHaveBeenCalledWith(mockProject.gid);
            expect(mockTaskFileService.createTaskFile).toHaveBeenCalledWith(
                mockTasks[0],
                mockProject.name,
                plugin.settings.taskFolder
            );
        });

        it('should handle errors when fetching tasks', async () => {
            mockAsanaService.getTasksForProject.mockRejectedValue(new Error('API Error'));

            await expect(plugin.fetchTasksForProject(mockProject)).rejects.toThrow('API Error');
        });
    });
});
