import { AsanaService } from '../AsanaService';
import { AsanaProject, AsanaTask } from '../../types';

// Mock Asana client
jest.mock('asana', () => ({
    Client: {
        create: jest.fn().mockReturnValue({
            useAccessToken: jest.fn().mockReturnThis(),
            users: {
                me: jest.fn().mockResolvedValue({
                    gid: 'user123',
                    workspaces: [{ gid: 'workspace123' }]
                })
            },
            projects: {
                findAll: jest.fn().mockResolvedValue({
                    data: [
                        { gid: 'project1', name: 'Project 1', archived: false },
                        { gid: 'project2', name: 'Project 2', archived: true }
                    ],
                    _response: {
                        next_page: null
                    }
                })
            },
            tasks: {
                findByProject: jest.fn().mockResolvedValue({
                    data: [
                        {
                            gid: 'task1',
                            name: 'Task 1',
                            notes: 'Notes 1',
                            due_on: '2024-01-01',
                            completed: false,
                            custom_fields: [],
                            assignee: null,
                            projects: [],
                            tags: [],
                            workspace: { gid: 'workspace1', name: 'Workspace 1' },
                            permalink_url: 'https://app.asana.com/task1'
                        }
                    ]
                }),
                update: jest.fn().mockResolvedValue({})
            },
            workspaces: {
                findAll: jest.fn().mockResolvedValue({
                    data: [{ gid: 'workspace1' }]
                })
            }
        })
    }
}));

describe('AsanaService', () => {
    let service: AsanaService;
    let mockClient: any;

    beforeEach(() => {
        service = new AsanaService('test-token');
        mockClient = require('asana').Client.create();
    });

    describe('getCurrentUser', () => {
        it('should fetch current user', async () => {
            const user = await service.getCurrentUser();
            expect(user).toEqual({
                gid: 'user123',
                workspaces: [{ gid: 'workspace123' }]
            });
        });
    });

    describe('getProjects', () => {
        it('should fetch projects successfully', async () => {
            const mockProjects = [
                { gid: '1', name: 'Project 1' },
                { gid: '2', name: 'Project 2' }
            ];
            mockClient.projects.findAll.mockResolvedValue({
                data: mockProjects,
                _response: { next_page: null }
            });
            mockClient.workspaces.findAll.mockResolvedValue({
                data: [{ gid: 'workspace1' }]
            });

            const projects = await service.getProjects();
            expect(projects).toHaveLength(2);
            expect(projects[0].gid).toBe('1');
            expect(projects[1].gid).toBe('2');
        });

        it('should handle pagination', async () => {
            const mockProjects1 = [{ gid: '1', name: 'Project 1' }];
            const mockProjects2 = [{ gid: '2', name: 'Project 2' }];
            mockClient.projects.findAll
                .mockResolvedValueOnce({
                    data: mockProjects1,
                    _response: { next_page: { offset: 'offset1' } }
                })
                .mockResolvedValueOnce({
                    data: mockProjects2,
                    _response: { next_page: null }
                });
            mockClient.workspaces.findAll.mockResolvedValue({
                data: [{ gid: 'workspace1' }]
            });

            const projects = await service.getProjects();
            expect(projects).toHaveLength(2);
            expect(projects[0].gid).toBe('1');
            expect(projects[1].gid).toBe('2');
        });
    });

    describe('getTasksForProject', () => {
        it('should fetch tasks for a project', async () => {
            const tasks = await service.getTasksForProject('project1');
            expect(tasks).toHaveLength(1);
            expect(tasks[0]).toMatchObject({
                gid: 'task1',
                name: 'Task 1',
                notes: 'Notes 1',
                due_on: '2024-01-01',
                completed: false
            });
        });
    });

    describe('updateTask', () => {
        it('should update task details', async () => {
            const updateData = {
                name: 'Updated Task',
                completed: true
            };
            await service.updateTask('task1', updateData);
            // Verify that update was called with correct parameters
            expect(mockClient.tasks.update).toHaveBeenCalledWith('task1', updateData);
        });
    });
});
