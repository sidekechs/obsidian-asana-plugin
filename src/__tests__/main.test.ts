import { App } from 'obsidian';
import AsanaPlugin from '../main';
import { AsanaProject } from '../types';

jest.mock('obsidian');

describe('AsanaPlugin', () => {
    let app: App;
    let plugin: AsanaPlugin;

    beforeEach(() => {
        app = new App();
        plugin = new AsanaPlugin(app, {
            id: 'asana-plugin',
            name: 'Asana Plugin',
            version: '1.0.0',
            minAppVersion: '0.15.0',
            description: 'Asana integration for Obsidian',
            author: 'Test Author',
            authorUrl: 'https://github.com/testauthor',
            isDesktopOnly: false
        });
    });

    describe('fetchAsanaProjects', () => {
        it('should fetch projects successfully', async () => {
            const mockProject = {
                gid: '123',
                name: 'Test Project',
                workspace: { gid: '456', name: 'Test Workspace' }
            };

            // Mock the Asana service
            (plugin as any).asanaService = {
                getProjects: jest.fn().mockResolvedValue([mockProject])
            };

            const projects = await plugin.fetchAsanaProjects();
            expect(projects).toEqual([mockProject]);
        });

        it('should handle API errors', async () => {
            (plugin as any).asanaService = {
                getProjects: jest.fn().mockRejectedValue(new Error('API Error'))
            };

            await expect(plugin.fetchAsanaProjects()).rejects.toThrow('API Error');
        });
    });
});
