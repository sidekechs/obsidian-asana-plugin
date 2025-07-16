export interface AsanaPluginSettings {
    asanaAccessToken: string;
    taskFolder: string;
    templateFile: string;
    syncInterval: number;
    autoSaveInterval: number; // in seconds, 0 means disabled
    // Archaeopteryx compatibility settings
    useArchaeopteryxAPI: boolean;
    archaeopteryxAPIEndpoint: string;
    archaeopteryxAccessToken: string;
}

export const DEFAULT_SETTINGS: AsanaPluginSettings = {
    asanaAccessToken: '',
    taskFolder: 'Tasks',
    templateFile: '',
    syncInterval: 5,
    autoSaveInterval: 0, // disabled by default
    // Archaeopteryx compatibility
    useArchaeopteryxAPI: false,
    archaeopteryxAPIEndpoint: 'https://obsidian-connect-main-ece7e01.zuplo.app',
    archaeopteryxAccessToken: ''
};
