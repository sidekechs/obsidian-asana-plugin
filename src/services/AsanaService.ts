import { Notice } from 'obsidian';
import Asana from 'asana';
import { AsanaProject, AsanaTask } from '../types';

interface AsanaUpdateParams {
    name?: string;
    notes?: string;
    due_on?: string | null;
    completed?: boolean;
}

export class AsanaService {
    private client: Asana.Client;

    constructor(accessToken: string) {
        this.initialize(accessToken);
    }

    private initialize(accessToken: string) {
        if (!accessToken) {
            console.warn('Asana access token not set');
            return;
        }

        try {
            this.client = Asana.Client.create({
                defaultHeaders: { 'asana-enable': 'new_sections,string_ids' }
            }).useAccessToken(accessToken);
        } catch (error) {
            console.error('Failed to initialize Asana client:', error);
            throw new Error('Failed to initialize Asana client');
        }
    }

    async getCurrentUser() {
        try {
            return await this.client.users.me();
        } catch (error) {
            console.error('Error fetching current user:', error);
            throw error;
        }
    }

    async getProjects(workspaceId: string): Promise<AsanaProject[]> {
        try {
            const projects = await this.client.projects.findAll({
                workspace: workspaceId,
                opt_fields: 'name,archived'
            });

            return projects.data
                .filter((p: any) => !p.archived)
                .map((p: any) => ({
                    gid: p.gid,
                    name: p.name
                }));
        } catch (error) {
            console.error('Error fetching projects:', error);
            throw error;
        }
    }

    async getTasksForProject(projectId: string): Promise<AsanaTask[]> {
        try {
            const tasks = await this.client.tasks.findByProject(projectId, {
                opt_fields: 'name,notes,due_on,completed,custom_fields,assignee,projects,tags,workspace,permalink_url'
            });
            
            return tasks.data.map((t: any) => ({
                gid: t.gid,
                name: t.name,
                notes: t.notes,
                due_on: t.due_on,
                completed: t.completed,
                custom_fields: t.custom_fields.map((cf: any) => ({
                    gid: cf.gid,
                    name: cf.name,
                    display_value: cf.display_value,
                    type: cf.type
                })),
                assignee: t.assignee ? {
                    gid: t.assignee.gid,
                    name: t.assignee.name,
                    email: t.assignee.email
                } : null,
                projects: t.projects.map((p: any) => ({
                    gid: p.gid,
                    name: p.name
                })),
                tags: t.tags.map((tag: any) => ({
                    gid: tag.gid,
                    name: tag.name
                })),
                workspace: {
                    gid: t.workspace.gid,
                    name: t.workspace.name
                },
                permalink_url: t.permalink_url
            }));
        } catch (error) {
            console.error('Error fetching tasks:', error);
            throw error;
        }
    }

    async updateTask(taskId: string, data: AsanaUpdateParams) {
        try {
            await this.client.tasks.update(taskId, data);
        } catch (error) {
            console.error('Error updating task:', error);
            throw error;
        }
    }

    async getTaskComments(taskId: string) {
        try {
            const stories = await this.client.stories.findByTask(taskId);
            return stories.data
                .filter((story: any) => story.type === 'comment')
                .map((story: any) => ({
                    author: story.created_by.name,
                    timestamp: new Date(story.created_at),
                    text: story.text
                }));
        } catch (error) {
            console.error('Error fetching task comments:', error);
            throw error;
        }
    }

    updateAccessToken(newToken: string) {
        this.initialize(newToken);
    }
}
