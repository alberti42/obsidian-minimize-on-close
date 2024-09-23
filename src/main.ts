// Import necessary Obsidian API components
import { DEFAULT_SETTINGS } from "default";
import {
	App,
	Plugin,
	PluginSettingTab,
	PluginManifest,
    View,
    Platform,
    Setting,
    ToggleComponent,
} from "obsidian";
import { MinimizeOnCloseSettings } from "types";

import * as electron from "electron";
import * as EventEmitter from "node:events";

// Main plugin class
export default class MinimizeOnClose extends Plugin {

    private minimized = false;
    private current_window: Electron.BrowserWindow | null = null;
    public eventsRegistered = false;
    public settings: MinimizeOnCloseSettings = { ...DEFAULT_SETTINGS };
	
    constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);

        // Bind the context of `onLayoutChange` to the plugin instance
        this.onLayoutChange = this.onLayoutChange.bind(this);
        this.onRestore = this.onRestore.bind(this);
	}

    // Load plugin settings
    async onload() {
        // Load settings and set `this.registered_MAC_addresses`
        await this.loadSettings();

        // Add setting tab
        this.addSettingTab(new MinimizeOnCloseSettingTab(this.app, this));

        this.addCommands();
        
        this.app.workspace.onLayoutReady(() => {
            this.current_window = electron.remote.getCurrentWindow();
            this.registerEvents();
        });
    }

    addCommands() {
        this.addCommand({
            id: 'minimize-on-close-to-icon',
            name: "Minimize window to icon right now",
            callback: () => {
                if(this.current_window) {
                    this.current_window.minimize();
                }
            }
        });

        this.addCommand({
            id: 'minimize-on-close-exit',
            name: "Exit app",
            callback: () => {
                if(this.current_window) {
                    electron.remote.app.quit();
                }
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
            // Listen to layout changes (pane closed/opened)
            this.app.workspace.on("layout-change", this.onLayoutChange);
            if(this.current_window) {
                // Listen to the 'restore' event to detect when the window is restored
                this.current_window.on('restore', this.onRestore);
            }
            this.eventsRegistered = true;
        }
    }

    unregisterEvents() {
        if(!this.eventsRegistered) return;
        this.app.workspace.off("layout-change", this.onLayoutChange);
        if(this.current_window) {
            // `Electron.BrowserWindow` extends `NodeJS.EventEmitter`, which provides `removeListener`
            (this.current_window as unknown as EventEmitter).removeListener('restore', this.onRestore); // Use removeListener instead of off
        }
        this.eventsRegistered = false;
    }

    onRestore() {
        // console.log("Window Restored");
        this.minimized = false; // Reset minimized state when the window is restored
    }

    onLayoutChange() {
        // Check whether the layout is ready and current window has been identified
        if(!this.current_window) return;

        const leaf = this.app.workspace.getActiveViewOfType(View)?.leaf;
        
        // Check if the last pane is closed and minimize if not already minimized
        if (this.minimized || leaf?.getViewState().type !== "empty" || leaf?.parentSplit.children.length != 1 ) return;

        // Minimize the window
        this.current_window.minimize();
        this.minimized = true;
    }

	onunload() {        
        this.unregisterEvents();
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

                    // Create a MutationObserver to monitor changes in the settings container
                    const observer = new MutationObserver((mutations: MutationRecord[], observer: MutationObserver) => {
                        let doBreak = false;
                        for (const mutation of mutations) {
                            // Loop through added nodes to check if the desired element has been added
                            mutation.addedNodes.forEach((node) => {
                                if (!doBreak && node instanceof HTMLElement && node.querySelector('.search-input-container.mod-hotkey input')) {
                                    const searchInput = node.querySelector('.search-input-container.mod-hotkey input') as HTMLInputElement;
                                    if (searchInput) {
                                        // Set the text to be passed to the input field
                                        searchInput.value = 'minimize-on-close';

                                        // Trigger an input event to simulate the text being typed
                                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));

                                        // Stop searching
                                        doBreak = true;
                                    }
                                }
                            });
                            if(doBreak) break;
                        }
                        // Stop observing
                        observer.disconnect();
                    });

                    // Start observing the settings pane for child nodes being added
                    observer.observe(this.app.setting.tabContentContainer, {
                        childList: true,
                        subtree: true
                    });

                    this.app.setting.openTabById('hotkeys');
                };

                em.appendChild(link);
                frag.appendChild(em);
                frag.appendText(' configuration pane.');
            }));


        const div = document.createElement('div');
        div.classList.add('plugin-comment-instructions');


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
