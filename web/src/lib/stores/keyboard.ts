import { writable } from 'svelte/store';

export interface KeyboardShortcut {
    key: string;
    description: string;
    action: () => void;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
}

export const shortcuts = writable<KeyboardShortcut[]>([]);
export const showShortcutsHelp = writable(false);

/**
 * Register keyboard shortcuts
 */
export function registerShortcuts(newShortcuts: KeyboardShortcut[]) {
    shortcuts.set(newShortcuts);
}

/**
 * Handle keyboard events
 */
export function handleKeyboardEvent(event: KeyboardEvent, activeShortcuts: KeyboardShortcut[]) {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
    }

    for (const shortcut of activeShortcuts) {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
            event.preventDefault();
            shortcut.action();
            return;
        }
    }
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    
    if (shortcut.ctrl) {
        parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
    }
    if (shortcut.shift) {
        parts.push('⇧');
    }
    if (shortcut.alt) {
        parts.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt');
    }
    
    parts.push(shortcut.key.toUpperCase());
    
    return parts.join(' + ');
}
