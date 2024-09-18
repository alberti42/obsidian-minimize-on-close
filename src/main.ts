/* eslint-disable @typescript-eslint/no-inferrable-types */

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

import { remote } from "electron"; // For type definition only
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

        
        this.app.workspace.onLayoutReady(() => {
            this.current_window = remote.getCurrentWindow();
            this.registerEvents();
        })
    }

    registerEvents() {
        if(this.eventsRegistered) return;
        if (!this.settings.onlyForMac || Platform.isMacOS) {
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
        const { containerEl } = this;
        
		containerEl.empty();
        containerEl.classList.add('minimize-on-close-settings');

        const onlyForMac_setting = new Setting(containerEl)
            .setName('Only for Apple devices')
            .setDesc("If this option is disabled, Obsidian's window in minimized to icon after all panes are closed for all operating systems (just just Apple).");

        let onlyForMac_toggle: ToggleComponent;
        onlyForMac_setting.addToggle(toggle => {
            onlyForMac_toggle = toggle;
            toggle
            .setValue(this.plugin.settings.onlyForMac)
            .onChange(async (value: boolean) => {
                this.plugin.settings.onlyForMac = value;
                this.plugin.saveSettings();
                if(value) {
                    // just for mac
                    if(this.plugin.eventsRegistered && !Platform.isMacOS) {
                        this.plugin.unregisterEvents();
                    }
                } else {
                    // for all OS
                    if(!this.plugin.eventsRegistered) {
                        this.plugin.registerEvents();
                    }
                }
            })
        });

        onlyForMac_setting.addExtraButton((button) => {
            button
                .setIcon("reset")
                .setTooltip("Reset to default value")
                .onClick(() => {
                    const value = DEFAULT_SETTINGS.onlyForMac;                    
                    onlyForMac_toggle.setValue(value);
                });
        });


	}

	hide(): void {   
    }
}
