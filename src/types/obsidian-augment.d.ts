// obsidian-augment.d.ts

import 'obsidian';

declare module "obsidian" {
    interface App {
        setting: Setting;
    }
    interface Setting {
        openTabById(id: string): void;
        contentEl:HTMLElement;
        tabContentContainer:HTMLElement;
    }    
    interface WorkspaceLeaf {
        parentSplit: WorkspaceSplit;
    }
    interface WorkspaceSplit {
        // Array of child splits or leaves
        children: WorkspaceItem[];
    }
}