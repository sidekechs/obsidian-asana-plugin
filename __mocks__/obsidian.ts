export class Plugin {
    app: App;
    manifest: any;

    constructor(app: App, manifest: any) {
        this.app = app;
        this.manifest = manifest;
    }

    addRibbonIcon() { return document.createElement('div'); }
    addCommand() {}
    addSettingTab() {}
    registerEvent() {}
    loadData() { return Promise.resolve({}); }
    saveData() { return Promise.resolve(); }
}

export class TAbstractFile {
    path: string;
    name: string;
    vault: Vault;

    constructor(path: string) {
        this.path = path;
        this.name = path.split('/').pop() || '';
        this.vault = new Vault();
    }
}

export class TFile extends TAbstractFile {
    basename: string;
    extension: string;

    constructor(path: string) {
        super(path);
        const nameParts = this.name.split('.');
        this.extension = nameParts.pop() || '';
        this.basename = nameParts.join('.');
    }
}

export class Notice {
    constructor(message: string) {
        console.log('Notice:', message);
    }
}

export class Modal {
    app: App;
    
    constructor(app: App) {
        this.app = app;
    }

    open() {}
    close() {}
    onOpen() {}
    onClose() {}
}

export class PluginSettingTab {
    app: App;
    plugin: Plugin;

    constructor(app: App, plugin: Plugin) {
        this.app = app;
        this.plugin = plugin;
    }

    display() {}
    hide() {}
}

export class Setting {
    constructor(containerEl: HTMLElement) {}
    setName(name: string) { return this; }
    setDesc(desc: string) { return this; }
    addText(cb: (text: TextComponent) => any) { return this; }
    addButton(cb: (button: ButtonComponent) => any) { return this; }
}

export class TextComponent {
    setValue(value: string) { return this; }
    onChange(callback: (value: string) => any) { return this; }
}

export class ButtonComponent {
    setButtonText(text: string) { return this; }
    onClick(callback: () => any) { return this; }
}

export class Vault {
    adapter = {
        mkdir: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue(true),
        read: jest.fn().mockResolvedValue(''),
        write: jest.fn().mockResolvedValue(undefined),
    };
    
    create = jest.fn().mockResolvedValue(undefined);
    modify = jest.fn().mockResolvedValue(undefined);
    delete = jest.fn().mockResolvedValue(undefined);
    getAbstractFileByPath = jest.fn().mockReturnValue(null);
    on = jest.fn().mockReturnValue({ unsubscribe: jest.fn() });
}

export class App {
    vault = new Vault();
    workspace = {
        getActiveFile: jest.fn().mockReturnValue(null),
        on: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    };
    metadataCache = {
        getFileCache: jest.fn().mockReturnValue(null),
    };
}

export const getLinkpath = (path: string) => {
    return path.replace(/[^a-zA-Z0-9_-]/g, '_');
};
