import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
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

        // Developer Mode Indicator
        const devBanner = containerEl.createDiv('dev-mode-banner');
        devBanner.style.backgroundColor = '#4CAF50';
        devBanner.style.color = 'white';
        devBanner.style.padding = '10px';
        devBanner.style.borderRadius = '5px';
        devBanner.style.marginBottom = '20px';
        devBanner.style.textAlign = 'center';
        devBanner.style.fontWeight = 'bold';
        devBanner.innerHTML = '🚀 DEVELOPER MODE ACTIVE - v2.0.0-dev';

        // Test Connection Button
        new Setting(containerEl)
            .setName('Test Connection')
            .setDesc('Test your Asana API connection and show a notification')
            .addButton(button => button
                .setButtonText('Test Connection')
                .setCta()
                .onClick(async () => {
                    new Notice('🎉 Development version is working!', 3000);
                    
                    if (this.plugin.settings.asanaAccessToken) {
                        try {
                            button.setDisabled(true);
                            button.setButtonText('Testing...');
                            
                            // Test API connection
                            const user = await this.plugin.asanaService.getCurrentUser();
                            new Notice(`✅ Connected as: ${user.name}`, 5000);
                            
                            button.setButtonText('Connected!');
                            setTimeout(() => {
                                button.setButtonText('Test Connection');
                                button.setDisabled(false);
                            }, 2000);
                        } catch (error) {
                            new Notice('❌ Connection failed: ' + error.message, 5000);
                            button.setButtonText('Test Connection');
                            button.setDisabled(false);
                        }
                    } else {
                        new Notice('⚠️ Please enter your Asana API token first', 3000);
                    }
                }));

        // Archaeopteryx Compatibility Section
        containerEl.createEl('h2', { text: 'Archaeopteryx Compatibility' });
        
        new Setting(containerEl)
            .setName('Use Archaeopteryx API')
            .setDesc('Enable this to use the Archaeopteryx proxy API instead of direct Asana API')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useArchaeopteryxAPI)
                .onChange(async (value) => {
                    this.plugin.settings.useArchaeopteryxAPI = value;
                    await this.plugin.saveSettings();
                    // Refresh the settings display
                    this.display();
                }));

        if (this.plugin.settings.useArchaeopteryxAPI) {
            new Setting(containerEl)
                .setName('Archaeopteryx API Endpoint')
                .setDesc('The URL of the endpoint that will return your todo items')
                .addText(text => text
                    .setPlaceholder('https://obsidian-connect...')
                    .setValue(this.plugin.settings.archaeopteryxAPIEndpoint)
                    .onChange(async (value) => {
                        this.plugin.settings.archaeopteryxAPIEndpoint = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Archaeopteryx Access Token')
                .setDesc('API Key for the Archaeopteryx proxy')
                .addText(text => text
                    .setPlaceholder('zpka_...')
                    .setValue(this.plugin.settings.archaeopteryxAccessToken)
                    .onChange(async (value) => {
                        this.plugin.settings.archaeopteryxAccessToken = value;
                        await this.plugin.saveSettings();
                    }));
        }

        containerEl.createEl('h2', { text: 'Asana Settings' });

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
