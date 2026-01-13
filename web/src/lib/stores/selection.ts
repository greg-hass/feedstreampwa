import { writable, derived } from 'svelte/store';

export const isSelectionMode = writable(false);
export const selectedItemIds = writable<Set<string>>(new Set());

export function toggleSelectionMode() {
    isSelectionMode.update(current => {
        if (current) {
            // Clearing selection when exiting mode
            selectedItemIds.set(new Set());
        }
        return !current;
    });
}

export function toggleItemSelection(itemId: string) {
    selectedItemIds.update(current => {
        const newSet = new Set(current);
        if (newSet.has(itemId)) {
            newSet.delete(itemId);
        } else {
            newSet.add(itemId);
        }
        
        // If we selected an item, ensure mode is on
        if (newSet.size > 0) {
            isSelectionMode.set(true);
        }
        
        // If we deselected the last item, optionally turn off mode? 
        // For now, let's keep it on until manually cancelled or action performed
        
        return newSet;
    });
}

export function selectAll(itemIds: string[]) {
    selectedItemIds.set(new Set(itemIds));
    isSelectionMode.set(true);
}

export function clearSelection() {
    selectedItemIds.set(new Set());
    isSelectionMode.set(false);
}

export const selectedCount = derived(selectedItemIds, $ids => $ids.size);
