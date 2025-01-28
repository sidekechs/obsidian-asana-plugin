export interface AsanaPluginSettings {
    asanaAccessToken: string;
    taskFolder: string;
    templateFile: string;
    syncInterval: number;
    autoSaveInterval: number; // in seconds, 0 means disabled
}

export const DEFAULT_SETTINGS: AsanaPluginSettings = {
    asanaAccessToken: '',
    taskFolder: 'Tasks',
    templateFile: '',
    syncInterval: 5,
    autoSaveInterval: 0 // disabled by default
};
