// obsidian-augment.d.ts

import 'obsidian';

declare module "obsidian" {
    interface WorkspaceLeaf {
        parentSplit: WorkspaceSplit;
    }
    interface WorkspaceSplit {
        // Array of child splits or leaves
        children: WorkspaceItem[];
    }
}