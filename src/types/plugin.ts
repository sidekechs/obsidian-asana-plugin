import { Plugin } from 'obsidian';
import { AsanaPluginSettings } from './settings';
import { AsanaService } from '../services/AsanaService';

export interface IAsanaPlugin extends Plugin {
    settings: AsanaPluginSettings;
    asanaService: AsanaService;
    saveSettings(): Promise<void>;
    initializeServices(): void;
    stopSyncInterval(): void;
    startSyncInterval(): void;
    updateAutoSaveInterval(): void;
}
