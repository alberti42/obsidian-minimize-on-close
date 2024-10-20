// obsidian-augment.d.ts

import 'obsidian';

declare module "obsidian" {
    interface App {
        setting: Setting;
    }
    interface Setting {
        openTabById(id: string): SettingTab;
        contentEl:HTMLElement;
        tabContentContainer:HTMLElement;
        activeTab: SettingTab;
    }
    interface SettingTab {
        id: string;
        name: string;
        navEl: HTMLElement;
    }
    interface HotkeysSettingTab extends SettingTab {
        setQuery: (str: string) => void;
    }
    interface WorkspaceLeaf {
        parentSplit: WorkspaceSplit;
    }
    interface WorkspaceSplit {
        // Array of child splits or leaves
        children: WorkspaceItem[];
    }
}
