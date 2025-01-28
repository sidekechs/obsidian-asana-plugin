export interface AsanaTask {
    gid: string;
    name: string;
    notes: string;
    due_on: string | null;
    completed: boolean;
    custom_fields: AsanaCustomField[];
    assignee: AsanaUser | null;
    projects: AsanaProject[];
    tags: AsanaTag[];
    workspace: AsanaWorkspace;
    permalink_url: string;
}

export interface AsanaCustomField {
    gid: string;
    name: string;
    type: string;
    display_value: string;
}

export interface AsanaUser {
    gid: string;
    name: string;
    email?: string;
}

export interface AsanaProject {
    gid: string;
    name: string;
}

export interface AsanaTag {
    gid: string;
    name: string;
}

export interface AsanaWorkspace {
    gid: string;
    name: string;
}

export interface AsanaTaskData {
    name: string;
    notes: string;
    completed: boolean;
    due_on: string | null;
}
