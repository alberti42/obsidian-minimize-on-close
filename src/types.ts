// types.ts

import { HotkeysSettingTab } from "obsidian";

// Plugin settings
export interface MinimizeOnCloseSettings {
    mac: boolean,
    linux: boolean,
    win: boolean,
    compatibility: '1.2',
}

export function isHotkeysSettingTab(obj: unknown): obj is HotkeysSettingTab {
    // Check if `obj` is an object and has the `setQuery` method
    return typeof obj === 'object' && obj !== null && 'setQuery' in obj && typeof (obj as HotkeysSettingTab).setQuery === 'function';
}
