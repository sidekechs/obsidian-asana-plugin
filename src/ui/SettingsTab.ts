import { App, PluginSettingTab, Setting } from 'obsidian';
import { IAsanaPlugin } from '../types';

export class AsanaSettingTab extends PluginSettingTab {
    private plugin: IAsanaPlugin;

    constructor(app: App, plugin: IAsanaPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Asana Access Token')
            .setDesc('Your Asana Personal Access Token')
            .addText(text => text
                .setPlaceholder('Enter your token...')
                .setValue(this.plugin.settings.asanaAccessToken)
                .onChange(async (value) => {
                    this.plugin.settings.asanaAccessToken = value;
                    await this.plugin.saveSettings();
                    this.plugin.initializeServices();
                }));

        new Setting(containerEl)
            .setName('Task Folder')
            .setDesc('The folder where tasks will be created')
            .addText(text => text
                .setPlaceholder('Enter the folder name...')
                .setValue(this.plugin.settings.taskFolder)
                .onChange(async (value) => {
                    this.plugin.settings.taskFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Template File')
            .setDesc('Template file path relative to vault root (e.g., templates/asana-task.md)')
            .addText(text => text
                .setPlaceholder('templates/asana-task.md')
                .setValue(this.plugin.settings.templateFile)
                .onChange(async (value) => {
                    this.plugin.settings.templateFile = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto-save Interval')
            .setDesc('How often to automatically save changes to Asana (in seconds, 0 to disable)')
            .addText(text => text
                .setPlaceholder('Enter interval in seconds...')
                .setValue(String(this.plugin.settings.autoSaveInterval))
                .onChange(async (value) => {
                    const interval = parseInt(value);
                    if (!isNaN(interval) && interval >= 0) {
                        this.plugin.settings.autoSaveInterval = interval;
                        await this.plugin.saveSettings();
                        this.plugin.updateAutoSaveInterval();
                    }
                }));

        new Setting(containerEl)
            .setName('Sync Interval')
            .setDesc('How often to sync tasks with Asana (in minutes, minimum 1)')
            .addText(text => text
                .setPlaceholder('Enter interval in minutes...')
                .setValue(String(this.plugin.settings.syncInterval))
                .onChange(async (value) => {
                    const interval = parseInt(value);
                    if (!isNaN(interval) && interval >= 1) {
                        this.plugin.settings.syncInterval = interval;
                        await this.plugin.saveSettings();
                        
                        // Restart sync interval with new timing
                        if (this.plugin.stopSyncInterval) {
                            this.plugin.stopSyncInterval();
                        }
                        if (this.plugin.startSyncInterval) {
                            this.plugin.startSyncInterval();
                        }
                    }
                }));

    }

    hide() {
        const { containerEl } = this;
        containerEl.empty();
    }
}
