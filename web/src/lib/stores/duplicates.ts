// Duplicate detection and management store
import { writable, derived, get } from 'svelte/store';
import type { Item } from '$lib/types';

export interface DuplicateSettings {
  enabled: boolean;
  method: 'url' | 'title' | 'fuzzy'; // url = exact URL match, title = exact title match, fuzzy = similar titles
  sensitivity: number; // For fuzzy matching (0-100, higher = more strict)
  autoAction: 'none' | 'mark_read' | 'hide'; // What to do with duplicates
  keepInFeed: 'oldest' | 'newest' | 'first_subscribed'; // Which duplicate to keep
}

export interface DuplicateGroup {
  id: string;
  items: Item[];
  similarity: number; // 0-100
  matchType: 'url' | 'title' | 'fuzzy';
  representativeTitle: string;
}

const DUPLICATES_STORAGE_KEY = 'feedstream_duplicates';

// Default settings
const defaultSettings: DuplicateSettings = {
  enabled: true,
  method: 'url',
  sensitivity: 85,
  autoAction: 'none',
  keepInFeed: 'first_subscribed',
};

// Load settings from localStorage
function loadSettings(): DuplicateSettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const saved = localStorage.getItem(DUPLICATES_STORAGE_KEY);
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

// Save settings to localStorage
function saveSettings(settings: DuplicateSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DUPLICATES_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save duplicate settings:', e);
  }
}

// Create the settings store
function createDuplicateSettingsStore() {
  const { subscribe, set, update } = writable<DuplicateSettings>(loadSettings());

  return {
    subscribe,
    set: (settings: DuplicateSettings) => {
      saveSettings(settings);
      set(settings);
    },
    update,
    setMethod: (method: DuplicateSettings['method']) => {
      update((settings) => {
        const newSettings = { ...settings, method };
        saveSettings(newSettings);
        return newSettings;
      });
    },
    setSensitivity: (sensitivity: number) => {
      update((settings) => {
        const newSettings = { ...settings, sensitivity: Math.max(0, Math.min(100, sensitivity)) };
        saveSettings(newSettings);
        return newSettings;
      });
    },
    setAutoAction: (autoAction: DuplicateSettings['autoAction']) => {
      update((settings) => {
        const newSettings = { ...settings, autoAction };
        saveSettings(newSettings);
        return newSettings;
      });
    },
    setKeepInFeed: (keepInFeed: DuplicateSettings['keepInFeed']) => {
      update((settings) => {
        const newSettings = { ...settings, keepInFeed };
        saveSettings(newSettings);
        return newSettings;
      });
    },
    toggle: () => {
      update((settings) => {
        const newSettings = { ...settings, enabled: !settings.enabled };
        saveSettings(newSettings);
        return newSettings;
      });
    },
  };
}

export const duplicateSettings = createDuplicateSettingsStore();

// Find duplicates by URL
function findDuplicatesByUrl(items: Item[]): Map<string, Item[]> {
  const urlMap = new Map<string, Item[]>();

  for (const item of items) {
    if (!item.url) continue;

    // Normalize URL for comparison (remove tracking parameters, etc.)
    const normalizedUrl = normalizeUrl(item.url);

    if (!urlMap.has(normalizedUrl)) {
      urlMap.set(normalizedUrl, []);
    }
    urlMap.get(normalizedUrl)!.push(item);
  }

  // Filter to only entries with multiple items
  const duplicates = new Map<string, Item[]>();
  for (const [url, items] of urlMap.entries()) {
    if (items.length > 1) {
      duplicates.set(url, items);
    }
  }

  return duplicates;
}

// Find duplicates by exact title match
function findDuplicatesByTitle(items: Item[]): Map<string, Item[]> {
  const titleMap = new Map<string, Item[]>();

  for (const item of items) {
    if (!item.title) continue;

    const normalizedTitle = item.title.toLowerCase().trim();

    if (!titleMap.has(normalizedTitle)) {
      titleMap.set(normalizedTitle, []);
    }
    titleMap.get(normalizedTitle)!.push(item);
  }

  // Filter to only entries with multiple items
  const duplicates = new Map<string, Item[]>();
  for (const [title, items] of titleMap.entries()) {
    if (items.length > 1) {
      duplicates.set(title, items);
    }
  }

  return duplicates;
}

// Simple fuzzy matching using word overlap
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));

  if (words1.size === 0 && words2.size === 0) return 100;

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return Math.round((intersection.size / union.size) * 100);
}

// Find duplicates by fuzzy title matching
function findDuplicatesFuzzy(items: Item[], sensitivity: number): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const item1 = items[i];
    if (processed.has(item1.id) || !item1.title) continue;

    const similarItems: Item[] = [item1];
    processed.add(item1.id);

    for (let j = i + 1; j < items.length; j++) {
      const item2 = items[j];
      if (processed.has(item2.id) || !item2.title) continue;

      const similarity = calculateSimilarity(item1.title, item2.title);

      if (similarity >= sensitivity) {
        similarItems.push(item2);
        processed.add(item2.id);
      }
    }

    if (similarItems.length > 1) {
      const avgSimilarity = Math.round(
        similarItems.reduce((acc, item) =>
          acc + calculateSimilarity(item1.title, item.title!), 0
        ) / similarItems.length
      );

      groups.push({
        id: `fuzzy-${groups.length}`,
        items: similarItems,
        similarity: avgSimilarity,
        matchType: 'fuzzy',
        representativeTitle: item1.title,
      });
    }
  }

  return groups;
}

// Normalize URL by removing common tracking parameters
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'source', 'ref', 'referrer',
    ];

    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }

    // Remove fragment
    parsed.hash = '';

    return parsed.toString();
  } catch {
    return url;
  }
}

// Convert URL-based duplicates to DuplicateGroup format
function urlMapToGroups(urlMap: Map<string, Item[]>): DuplicateGroup[] {
  return Array.from(urlMap.entries()).map(([url, items], idx) => ({
    id: `url-${idx}`,
    items,
    similarity: 100, // URL match is 100% similarity
    matchType: 'url' as const,
    representativeTitle: items[0]?.title || 'Untitled',
  }));
}

// Convert title-based duplicates to DuplicateGroup format
function titleMapToGroups(titleMap: Map<string, Item[]>): DuplicateGroup[] {
  return Array.from(titleMap.entries()).map(([title, items], idx) => ({
    id: `title-${idx}`,
    items,
    similarity: 100, // Exact title match is 100% similarity
    matchType: 'title' as const,
    representativeTitle: title,
  }));
}

// Main function to find duplicates based on current settings
export function findDuplicates(items: Item[], settings: DuplicateSettings): DuplicateGroup[] {
  if (!settings.enabled || items.length === 0) {
    return [];
  }

  switch (settings.method) {
    case 'url':
      return urlMapToGroups(findDuplicatesByUrl(items));

    case 'title':
      return titleMapToGroups(findDuplicatesByTitle(items));

    case 'fuzzy':
      return findDuplicatesFuzzy(items, settings.sensitivity);

    default:
      return [];
  }
}

// Store for currently detected duplicates
function createDuplicatesStore() {
  const { subscribe, set, update } = writable<DuplicateGroup[]>([]);

  return {
    subscribe,
    set,
    update,
    scan: (items: Item[]) => {
      const settings = get(duplicateSettings);
      const duplicates = findDuplicates(items, settings);
      set(duplicates);
      return duplicates;
    },
    clear: () => set([]),
  };
}

export const duplicates = createDuplicatesStore();

// Derived store for duplicate count
export const duplicateCount = derived(duplicates, ($duplicates) =>
  $duplicates.reduce((acc, group) => acc + group.items.length, 0)
);

// Derived store for duplicate group count
export const duplicateGroupCount = derived(duplicates, ($duplicates) => $duplicates.length);

// Check if an item is part of a duplicate group
export function getDuplicateGroup(item: Item, groups: DuplicateGroup[]): DuplicateGroup | null {
  for (const group of groups) {
    if (group.items.some(i => i.id === item.id)) {
      return group;
    }
  }
  return null;
}

// Get preferred item to keep from a duplicate group
export function getPreferredItem(group: DuplicateGroup, keepPreference: DuplicateSettings['keepInFeed']): Item {
  switch (keepPreference) {
    case 'oldest':
      return group.items.reduce((oldest, item) =>
        new Date(item.published || item.published_at || item.created_at) <
            new Date(oldest.published || oldest.published_at || oldest.created_at)
          ? item
          : oldest
      );

    case 'newest':
      return group.items.reduce((newest, item) =>
        new Date(item.published || item.published_at || item.created_at) >
            new Date(newest.published || newest.published_at || newest.created_at)
          ? item
          : newest
      );

    case 'first_subscribed':
    default:
      // Sort by feed_id - assuming lower feed_id means subscribed first
      return group.items.reduce((first, item) =>
        (item.feed_id || '') < (first.feed_id || '') ? item : first
      );
  }
}
