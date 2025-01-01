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
            }
        })
    }
}));

describe('AsanaService', () => {
    let service: AsanaService;

    beforeEach(() => {
        service = new AsanaService('test-token');
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
        it('should fetch and filter non-archived projects', async () => {
            const projects = await service.getProjects('workspace123');
            expect(projects).toHaveLength(1);
            expect(projects[0]).toEqual({
                gid: 'project1',
                name: 'Project 1'
            });
        });

        it('should handle pagination', async () => {
            const asanaClient = require('asana').Client.create();
            asanaClient.projects.findAll
                .mockResolvedValueOnce({
                    data: [
                        { gid: 'project1', name: 'Project 1', archived: false },
                        { gid: 'project2', name: 'Project 2', archived: true }
                    ],
                    _response: {
                        next_page: { offset: 'page2' }
                    }
                })
                .mockResolvedValueOnce({
                    data: [
                        { gid: 'project3', name: 'Project 3', archived: false },
                        { gid: 'project4', name: 'Project 4', archived: false }
                    ],
                    _response: {
                        next_page: null
                    }
                });

            const projects = await service.getProjects('workspace123');
            expect(projects).toHaveLength(3);
            expect(projects).toEqual([
                { gid: 'project1', name: 'Project 1' },
                { gid: 'project3', name: 'Project 3' },
                { gid: 'project4', name: 'Project 4' }
            ]);
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
            const asanaClient = require('asana').Client.create();
            expect(asanaClient.tasks.update).toHaveBeenCalledWith('task1', updateData);
        });
    });
});
