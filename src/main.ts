// Import necessary Obsidian API components
import { DEFAULT_SETTINGS } from "default";
import {
	App,
	Plugin,
	PluginSettingTab,
	PluginManifest,
    Platform,
    Setting,
    ToggleComponent,
    WorkspaceLeaf,
} from "obsidian";
import { isHotkeysSettingTab, MinimizeOnCloseSettings } from "types";

import * as electron from "electron";

// Main plugin class
export default class MinimizeOnClose extends Plugin {

    public eventsRegistered = false;
    public settings: MinimizeOnCloseSettings = { ...DEFAULT_SETTINGS };
    private originalDetach:(()=>void) | null = null;
    private mainDoc:Document;
	
    constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
        this.mainDoc = document;
	}

    // Load plugin settings
    async onload() {
        // Load settings and set `this.registered_MAC_addresses`
        await this.loadSettings();

        // Add setting tab
        this.addSettingTab(new MinimizeOnCloseSettingTab(this.app, this));

        this.addCommands();
        
        this.app.workspace.onLayoutReady(() => {
            this.registerEvents();
        });
    }

    patchDetatchMethod() {
        if(this.originalDetach) return;
        this.originalDetach = WorkspaceLeaf.prototype.detach;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        // Monkey-patch the detach method
        WorkspaceLeaf.prototype.detach = function() {
            // Prevent minimization to icon if multiple windows are still opened
            
            const thisDoc = this.view.containerEl.ownerDocument;

            if(thisDoc===self.mainDoc) {
                let num_md = 0; // number markdown-type leaves
                let num_empty = 0; // number empty-type leaves
                self.app.workspace.iterateAllLeaves((leaf:WorkspaceLeaf)=>{
                    const doc = leaf.view.containerEl.ownerDocument;
                    if(doc===thisDoc) {
                        if(leaf.view.getViewType()==="markdown")  num_md++;
                        else if(leaf.view.getViewType()==="empty") num_empty++;    
                    }                
                });
                if(num_md+num_empty<=1) {
                    // Minimize the main window
                    electron.remote.getCurrentWindow().minimize(); 
                }
            }

            // Call the original detach method to actually close the leaf
            if(self.originalDetach) {
                return self.originalDetach.call(this);    
            }
        }
    }

    unPatchDetatchMethod() {
        if(this.originalDetach) {
            // console.log("UNPATCHING");
            WorkspaceLeaf.prototype.detach = this.originalDetach;
            this.originalDetach = null;
        }
    }

    addCommands() {
        this.addCommand({
            id: 'minimize-on-close-to-icon',
            name: "Minimize window to icon right now",
            callback: () => {
                electron.remote.getCurrentWindow().minimize();    
            }
        });

        this.addCommand({
            id: 'minimize-on-close-exit',
            name: "Exit app",
            callback: () => {
                electron.remote.app.quit();
            }
        });
    }

    registerEvents() {
        if(this.eventsRegistered) return;
        if(
            Platform.isMacOS && this.settings.mac
            || Platform.isLinux && this.settings.linux 
            || Platform.isWin && this.settings.win 
        ) {
            // Detect when a leaf closes
            this.patchDetatchMethod();
            this.eventsRegistered = true;
        }
    }

    unregisterEvents() {
        if(!this.eventsRegistered) return;
        // Stop detecting when a leaf closes
        this.unPatchDetatchMethod();
        this.eventsRegistered = false;
    }

	onunload() {        
        this.unregisterEvents();
    }

    async onExternalSettingsChange() {
        // Load settings
        await this.loadSettings();

        const activeTab = this.app.setting.activeTab;
        if(activeTab && activeTab instanceof MinimizeOnCloseSettingTab) activeTab.display();
    }

	async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

    async saveSettings() {
       await this.saveData(this.settings);
    }
}

// Plugin settings tab
class MinimizeOnCloseSettingTab extends PluginSettingTab {
	plugin: MinimizeOnClose;

	constructor(app: App, plugin: MinimizeOnClose) {
		super(app, plugin);
		this.plugin = plugin;
    }

	display(): void {
        // const createHotkeysPaneFragment = (): DocumentFragment => {
        //     return createFragment((frag) => {
        //         const em = frag.createEl('em');
        //         const link = frag.createEl('a', { href: '#', text: 'Community plugins'});
        //         link.onclick = () => {
        //             this.app.setting.openTabById('community-plugins');
        //         };
        //         em.appendChild(link);
        //     });
        // };

        const { containerEl } = this;
        
		containerEl.empty();
        containerEl.classList.add('minimize-on-close-settings');

        new Setting(containerEl).setName('Instructions').setHeading();

        new Setting(containerEl).setName(createFragment((frag:DocumentFragment) => {
                frag.appendText("You can select for which platform the plugin minimizes the app to an icon after \
                    all panes are closed. Moreover, you can assign custom hotkeys for quick access \
                    (e.g., '⌘Q' to minimize and '⌘⌥Q' to exit) from the ");
                const em = createEl('em');
                const link = frag.createEl('a', { href: '#', text: 'Hotkeys'});
                link.onclick = () => {
                    const tab = this.app.setting.openTabById('hotkeys');
                    if(isHotkeysSettingTab(tab)) {
                        tab.setQuery(this.plugin.manifest.id)
                    }
                };

                em.appendChild(link);
                frag.appendChild(em);
                frag.appendText(' configuration pane.');
            }));

        new Setting(containerEl).setName('Platforms').setHeading();

        const mac_setting = new Setting(containerEl)
            .setName('Enable on Apple computers')
            .setDesc("If this option is enabled, the app window in minimized to icon after all panes are closed on Apple computers.");

        let mac_toggle: ToggleComponent;
        mac_setting.addToggle(toggle => {
            mac_toggle = toggle;
            toggle
            .setValue(this.plugin.settings.mac)
            .onChange(async (value: boolean) => {
                this.plugin.settings.mac = value;
                this.plugin.saveSettings();
                if(Platform.isMacOS) {
                    if(value) {
                        this.plugin.registerEvents();
                    } else {
                        this.plugin.unregisterEvents();
                    }
                }
            })
        });

        mac_setting.addExtraButton((button) => {
            button
                .setIcon("reset")
                .setTooltip("Reset to default value")
                .onClick(() => {
                    const value = DEFAULT_SETTINGS.mac;                    
                    mac_toggle.setValue(value);
                });
        });

        const linux_setting = new Setting(containerEl)
            .setName('Enable on Linux computers')
            .setDesc("If this option is enabled, the app window in minimized to icon after all panes are closed on Linux computers.");

        let linux_toggle: ToggleComponent;
        linux_setting.addToggle(toggle => {
            linux_toggle = toggle;
            toggle
            .setValue(this.plugin.settings.linux)
            .onChange(async (value: boolean) => {
                this.plugin.settings.linux = value;
                this.plugin.saveSettings();
                if(Platform.isLinux) {
                    if(value) {
                        this.plugin.registerEvents();
                    } else {
                        this.plugin.unregisterEvents();
                    }
                }
            })
        });

        linux_setting.addExtraButton((button) => {
            button
                .setIcon("reset")
                .setTooltip("Reset to default value")
                .onClick(() => {
                    const value = DEFAULT_SETTINGS.linux;                    
                    linux_toggle.setValue(value);
                });
        });

        const win_setting = new Setting(containerEl)
            .setName('Enable on Windows computers')
            .setDesc("If this option is enabled, the app window in minimized to icon after all panes are closed on Windows computers.");

        let win_toggle: ToggleComponent;
        win_setting.addToggle(toggle => {
            win_toggle = toggle;
            toggle
            .setValue(this.plugin.settings.win)
            .onChange(async (value: boolean) => {
                this.plugin.settings.win = value;
                this.plugin.saveSettings();
                if(Platform.isWin) {
                    if(value) {
                        this.plugin.registerEvents();
                    } else {
                        this.plugin.unregisterEvents();
                    }
                }
            })
        });

        win_setting.addExtraButton((button) => {
            button
                .setIcon("reset")
                .setTooltip("Reset to default value")
                .onClick(() => {
                    const value = DEFAULT_SETTINGS.win;                    
                    win_toggle.setValue(value);
                });
        });


	}

	hide(): void {   
    }
}
