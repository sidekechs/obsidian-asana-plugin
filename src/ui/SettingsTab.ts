import { App, PluginSettingTab, Setting } from 'obsidian';
import AsanaPlugin from '../main';

export class AsanaSettingTab extends PluginSettingTab {
    private plugin: AsanaPlugin;

    constructor(app: App, plugin: AsanaPlugin) {
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
            .setDesc('The template file for new tasks')
            .addText(text => text
                .setPlaceholder('Enter the template file name...')
                .setValue(this.plugin.settings.templateFile)
                .onChange(async (value) => {
                    this.plugin.settings.templateFile = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Sync Interval')
            .setDesc('How often to sync tasks with Asana (in minutes)')
            .addText(text => text
                .setPlaceholder('Enter interval in minutes...')
                .setValue(String(this.plugin.settings.syncInterval))
                .onChange(async (value) => {
                    const interval = parseInt(value);
                    if (!isNaN(interval) && interval > 0) {
                        this.plugin.settings.syncInterval = interval;
                        await this.plugin.saveSettings();
                    }
                }));
    }
}
