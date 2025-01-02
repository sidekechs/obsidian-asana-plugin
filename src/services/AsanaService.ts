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

    async getProjects(): Promise<AsanaProject[]> {
        try {
            const workspaces = await this.client.workspaces.findAll();
            const workspace = workspaces.data[0];
            if (!workspace) {
                throw new Error('No workspace found');
            }

            const allProjects: any[] = [];
            let offset: string | undefined;

            do {
                const response = await this.client.projects.findAll({
                    workspace: workspace.gid,
                    limit: 100,
                    ...(offset ? { offset } : {})
                });

                allProjects.push(...response.data);
                offset = response._response.next_page?.offset;
            } while (offset);

            return allProjects.map((p: any) => ({
                gid: p.gid,
                name: p.name,
                color: p.color,
                notes: p.notes
            }));
        } catch (error) {
            console.error('Error fetching projects:', error);
            throw error;
        }
    }

    async getProject(projectId: string): Promise<AsanaProject> {
        try {
            const project = await this.client.projects.findById(projectId);

            return {
                gid: project.gid,
                name: project.name
            };
        } catch (error) {
            console.error('Error fetching project:', error);
            throw error;
        }
    }

    async getTasksForProject(projectId: string): Promise<AsanaTask[]> {
        try {
            const allTasks: any[] = [];
            let offset: string | undefined;

            do {
                const response = await this.client.tasks.findByProject(projectId, {
                    opt_fields: 'name,notes,due_on,completed,custom_fields,assignee,projects,tags,workspace,permalink_url',
                    limit: 100,
                    ...(offset ? { offset } : {})
                } as any); // Type assertion needed for pagination params

                // Filter incomplete tasks on our side
                const incompleteTasks = response.data.filter((t: any) => !t.completed);
                allTasks.push(...incompleteTasks);
                
                offset = response._response.next_page?.offset;
            } while (offset);

            return allTasks.map((t: any) => ({
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
            const allComments: any[] = [];
            let offset: string | undefined;

            do {
                const stories = await this.client.stories.findByTask(taskId, {
                    opt_fields: 'created_by.name,created_at,text,type,resource_subtype',
                    limit: 100,
                    ...(offset ? { offset } : {})
                } as any);

                const comments = stories.data
                    .filter((story: any) => story.type === 'comment')
                    .map((story: any) => ({
                        gid: story.gid,
                        author: story.created_by.name,
                        timestamp: new Date(story.created_at),
                        text: story.text,
                        resource_subtype: story.resource_subtype
                    }));

                allComments.push(...comments);
                offset = stories._response.next_page?.offset;
            } while (offset);

            return allComments.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        } catch (error) {
            console.error('Error fetching task comments:', error);
            throw error;
        }
    }

    async addComment(taskId: string, text: string) {
        try {
            await this.client.stories.createOnTask(taskId, {
                text: text
            });
        } catch (error) {
            console.error('Error adding comment:', error);
            throw error;
        }
    }

    async getProjectMembers(projectId: string) {
        try {
            const workspaces = await this.client.workspaces.findAll();
            const workspace = workspaces.data[0];
            if (!workspace) {
                throw new Error('No workspace found');
            }
            const response = await this.client.users.findByWorkspace(workspace.gid);
            return response.data.map((user: any) => ({
                gid: user.gid,
                name: user.name
            }));
        } catch (error) {
            console.error('Error fetching workspace members:', error);
            throw error;
        }
    }

    async createTask(data: {
        name: string;
        notes?: string;
        projectId?: string;
        assigneeId?: string;
        dueDate?: string;
        priority?: 'high' | 'medium' | 'low';
    }) {
        try {
            const taskData: any = {
                name: data.name,
                notes: data.notes || '',
                assignee: data.assigneeId,
                due_on: data.dueDate,
                workspace: (await this.client.workspaces.findAll()).data[0].gid
            };

            if (data.projectId) {
                taskData.projects = [data.projectId];
            }

            // Create the task first
            const createdTask = await this.client.tasks.create(taskData);

            // If priority is set, update it separately
            if (data.priority && createdTask.gid && data.projectId) {
                try {
                    // Get the custom fields for the project
                    const projectResponse: any = await this.client.projects.findById(data.projectId, {
                        opt_fields: 'custom_fields,custom_fields.name,custom_fields.enum_options'
                    });
                    
                    // Find the Priority custom field
                    const priorityField = projectResponse.custom_fields?.find((field: any) => field.name === 'Priority');
                    
                    if (priorityField) {
                        // Find the enum option that matches our priority
                        const priorityOption = priorityField.enum_options?.find((option: any) => 
                            option.name.toLowerCase() === data.priority?.toLowerCase()
                        );

                        if (priorityOption) {
                            // Update the task with the correct custom field
                            const customFields: { [key: string]: string } = {};
                            customFields[priorityField.gid] = priorityOption.gid;
                            
                            await this.client.tasks.update(createdTask.gid, {
                                custom_fields: customFields
                            });
                        }
                    }
                } catch (error) {
                    console.warn('Could not set priority:', error);
                    // Don't fail the whole operation if just priority setting fails
                }
            }

            // Fetch the complete task data including permalink_url
            const completeTask = await this.client.tasks.findById(createdTask.gid, {
                opt_fields: 'name,notes,due_on,completed,custom_fields,assignee,projects,tags,workspace,permalink_url'
            });

            // Map the response to our AsanaTask type
            return {
                gid: completeTask.gid,
                name: completeTask.name,
                notes: completeTask.notes,
                due_on: completeTask.due_on,
                completed: completeTask.completed,
                custom_fields: completeTask.custom_fields.map((cf: any) => ({
                    gid: cf.gid,
                    name: cf.name,
                    display_value: cf.display_value,
                    type: cf.type
                })),
                assignee: completeTask.assignee ? {
                    gid: completeTask.assignee.gid,
                    name: completeTask.assignee.name,
                    email: completeTask.assignee.email
                } : null,
                projects: completeTask.projects.map((p: any) => ({
                    gid: p.gid,
                    name: p.name
                })),
                tags: completeTask.tags.map((tag: any) => ({
                    gid: tag.gid,
                    name: tag.name
                })),
                workspace: {
                    gid: completeTask.workspace.gid,
                    name: completeTask.workspace.name
                },
                permalink_url: completeTask.permalink_url
            };
        } catch (error) {
            console.error('Error creating task:', error);
            throw error;
        }
    }

    updateAccessToken(newToken: string) {
        this.initialize(newToken);
    }
}
