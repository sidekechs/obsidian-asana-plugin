// Asana Types
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
    display_value: string | null;
    type: string;
}

export interface AsanaUser {
    gid: string;
    name: string;
    email: string;
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

// Plugin Types
export interface AsanaPluginSettings {
    asanaAccessToken: string;
    taskFolder: string;
    templateFile: string;
    syncInterval: number; // in minutes
    defaultProject?: string;
}

export const DEFAULT_SETTINGS: AsanaPluginSettings = {
    asanaAccessToken: '',
    taskFolder: 'Asana Tasks',
    templateFile: '',
    syncInterval: 5
};
