import { TaskFileService } from '../TaskFileService';
import { Vault, TFile } from 'obsidian';
import { AsanaTask } from '../../types';
import { AsanaService } from '../AsanaService';

describe('TaskFileService', () => {
    let service: TaskFileService;
    let mockVault: jest.Mocked<Vault>;
    let mockMetadataCache: any;
    let mockAsanaService: any;

    beforeEach(() => {
        mockVault = {
            create: jest.fn(),
            read: jest.fn(),
            adapter: {
                mkdir: jest.fn()
            },
            getAbstractFileByPath: jest.fn()
        } as any;

        mockMetadataCache = {
            getFileCache: jest.fn()
        };

        mockAsanaService = {
            updateTask: jest.fn()
        };

        service = new TaskFileService(mockVault, mockMetadataCache, mockAsanaService);
    });

    const mockTask: AsanaTask = {
        gid: 'task1',
        name: 'Test Task',
        notes: 'Test Notes',
        due_on: '2024-01-01',
        completed: false,
        custom_fields: [
            { gid: 'cf1', name: 'Priority', display_value: 'High', type: 'enum' }
        ],
        assignee: {
            gid: 'user1',
            name: 'John Doe',
            email: 'john@example.com'
        },
        projects: [{ gid: 'project1', name: 'Project 1' }],
        tags: [{ gid: 'tag1', name: 'Important' }],
        workspace: { gid: 'workspace1', name: 'Workspace 1' },
        permalink_url: 'https://app.asana.com/task1'
    };

    describe('createTaskFile', () => {
        it('should create a task file with correct content', async () => {
            const fileName = await service.createTaskFile(mockTask, 'Project 1', 'Tasks');
            
            expect(mockVault.adapter.mkdir).toHaveBeenCalledWith('Tasks/Project 1');
            expect(mockVault.create).toHaveBeenCalled();
            
            const createCall = mockVault.create.mock.calls[0];
            expect(createCall[0]).toContain('Tasks/Project 1/Test_Task.md');
            
            const content = createCall[1];
            expect(content).toContain('asana_id: "task1"');
            expect(content).toContain('status: "active"');
            expect(content).toContain('due_date: "2024-01-01"');
            expect(content).toContain('assignee: "John Doe"');
            expect(content).toContain('# Test Task');
            expect(content).toContain('Test Notes');
        });

        it('should handle special characters in task name', async () => {
            const taskWithSpecialChars = {
                ...mockTask,
                name: 'Test/Task:With*Special?Chars'
            };
            
            const fileName = await service.createTaskFile(taskWithSpecialChars, 'Project 1', 'Tasks');
            const createCall = mockVault.create.mock.calls[0];
            expect(createCall[0]).not.toContain('/Test/Task:With*Special?Chars.md');
            expect(createCall[0]).toContain('Test_Task_With_Special_Chars.md');
        });
    });

    describe('extractTaskData', () => {
        it('should extract task data from file content', () => {
            const content = `---
asana_id: "task1"
status: "completed"
due_date: "2024-01-01"
assignee: "John Doe"
---

# Updated Task Title

Updated task notes

## Comments`;

            const metadata = {
                asana_id: 'task1',
                status: 'completed',
                due_date: '2024-01-01',
                assignee: 'John Doe'
            };

            const taskData = service.extractTaskData(content, metadata);
            expect(taskData).toEqual({
                completed: true,
                name: 'Updated Task Title',
                notes: 'Updated task notes',
                due_on: '2024-01-01'
            });
        });

        it('should handle missing metadata and content', () => {
            const content = '';
            const metadata = {};

            const taskData = service.extractTaskData(content, metadata);
            expect(taskData).toEqual({
                completed: false,
                name: '',
                notes: '',
                due_on: null
            });
        });
    });
});
