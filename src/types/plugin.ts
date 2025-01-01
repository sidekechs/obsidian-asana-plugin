import { Plugin } from 'obsidian';
import { AsanaPluginSettings } from './settings';

export interface IAsanaPlugin extends Plugin {
    settings: AsanaPluginSettings;
    saveSettings(): Promise<void>;
    initializeServices(): void;
    stopSyncInterval(): void;
    startSyncInterval(): void;
    updateAutoSaveInterval(): void;
}
