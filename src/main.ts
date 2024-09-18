/* eslint-disable @typescript-eslint/no-inferrable-types */

// Import necessary Obsidian API components
import {
	App,
	Plugin,
	PluginSettingTab,
	PluginManifest,
    View,
    Platform,
} from "obsidian";
import { platform } from "os";

// Main plugin class
export default class MinimizeOnClose extends Plugin {

    private minimized = false;
    private current_window: any | null = null;
    private remote: any;
    private eventsRegistered = false;
	
    constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);

        const { remote } = require("electron");

        this.remote = remote;

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
            this.current_window = this.remote.getCurrentWindow();

            if(this.current_window) {
                this.registerEvents();
            }
        })
    }

    registerEvents() {
        if (Platform.isMacOS) {
            if(this.eventsRegistered) return;
            // Listen to layout changes (pane closed/opened)
            this.app.workspace.on("layout-change", this.onLayoutChange);
            // Listen to the 'restore' event to detect when the window is restored
            this.current_window.on('restore', this.onRestore);
            this.eventsRegistered = true;
        }
    }

    unregisterEvents() {
        if(!this.eventsRegistered) return;
        this.app.workspace.off("layout-change", this.onLayoutChange);
        if(this.current_window) {
            this.current_window.off('restore', this.onRestore);
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
        
	}

    async saveSettings() {
       
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

	}

	hide(): void {   
    }
}
