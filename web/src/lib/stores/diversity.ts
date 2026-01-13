// Source diversity tracking - helps users discover content from varied sources
import { derived, writable, get } from 'svelte/store';
import type { Item } from '$lib/types';

export interface DiversitySettings {
  enabled: boolean;
  highlightThreshold: number; // Show indicator for feeds below this % of total items
  maxPerFeed: number | null; // Optional: soft limit per feed in view
}

export interface ItemWithDiversity extends Item {
  _diversityScore?: number;
  _isDiverseSource?: boolean;
}

const DIVERSITY_STORAGE_KEY = 'feedstream_diversity';

// Default settings
const defaultSettings: DiversitySettings = {
  enabled: false,
  highlightThreshold: 15, // Highlight feeds contributing less than 15% of items
  maxPerFeed: null,
};

// Load settings from localStorage
function loadSettings(): DiversitySettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const saved = localStorage.getItem(DIVERSITY_STORAGE_KEY);
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

// Save settings to localStorage
function saveSettings(settings: DiversitySettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DIVERSITY_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save diversity settings:', e);
  }
}

// Create the settings store
function createDiversitySettingsStore() {
  const { subscribe, set, update } = writable<DiversitySettings>(loadSettings());

  return {
    subscribe,
    set: (settings: DiversitySettings) => {
      saveSettings(settings);
      set(settings);
    },
    update,
    toggle: () => {
      update((settings) => {
        const newSettings = { ...settings, enabled: !settings.enabled };
        saveSettings(newSettings);
        return newSettings;
      });
    },
    setThreshold: (threshold: number) => {
      update((settings) => {
        const newSettings = { ...settings, highlightThreshold: threshold };
        saveSettings(newSettings);
        return newSettings;
      });
    },
    setMaxPerFeed: (max: number | null) => {
      update((settings) => {
        const newSettings = { ...settings, maxPerFeed: max };
        saveSettings(newSettings);
        return newSettings;
      });
    },
  };
}

export const diversitySettings = createDiversitySettingsStore();

// Calculate feed distribution from items
function calculateFeedDistribution(items: Item[]): Map<string, number> {
  const distribution = new Map<string, number>();

  for (const item of items) {
    const feedId = item.feed_id || 'unknown';
    distribution.set(feedId, (distribution.get(feedId) || 0) + 1);
  }

  return distribution;
}

// Calculate diversity score for an item based on its feed's representation
// Lower representation = higher diversity score (0-100)
function calculateDiversityScore(
  item: Item,
  distribution: Map<string, number>,
  totalItems: number
): number {
  if (totalItems === 0) return 0;

  const feedId = item.feed_id || 'unknown';
  const feedCount = distribution.get(feedId) || 0;
  const feedPercentage = (feedCount / totalItems) * 100;

  // Invert the percentage so less-represented feeds get higher scores
  // If a feed has 5% of items, it gets a diversity score of 95
  return Math.round(100 - feedPercentage);
}

// Derived store that adds diversity information to items
export function createDiversityEnrichedItems(itemsStore: any) {
  return derived([itemsStore, diversitySettings], ([$items, $settings]) => {
    if (!$settings.enabled || !$items || $items.length === 0) {
      return $items;
    }

    // Calculate feed distribution
    const distribution = calculateFeedDistribution($items);
    const totalItems = $items.length;

    // Calculate threshold count
    const thresholdCount = Math.ceil((totalItems * $settings.highlightThreshold) / 100);

    // Enrich items with diversity information
    return $items.map((item: Item): ItemWithDiversity => {
      const feedId = item.feed_id || 'unknown';
      const feedCount = distribution.get(feedId) || 0;
      const diversityScore = calculateDiversityScore(item, distribution, totalItems);

      return {
        ...item,
        _diversityScore: diversityScore,
        _isDiverseSource: feedCount <= thresholdCount,
      };
    });
  });
}

// Get statistics about feed diversity
export function getDiversityStats(items: Item[]): {
  totalFeeds: number;
  dominantFeed: { feedId: string; count: number; percentage: number } | null;
  averageArticlesPerFeed: number;
  distribution: Map<string, number>;
} {
  const distribution = calculateFeedDistribution(items);
  const totalFeeds = distribution.size;
  const totalItems = items.length;

  let maxCount = 0;
  let dominantFeedId = '';

  for (const [feedId, count] of distribution.entries()) {
    if (count > maxCount) {
      maxCount = count;
      dominantFeedId = feedId;
    }
  }

  return {
    totalFeeds,
    dominantFeed: totalItems > 0 ? {
      feedId: dominantFeedId,
      count: maxCount,
      percentage: Math.round((maxCount / totalItems) * 100),
    } : null,
    averageArticlesPerFeed: totalFeeds > 0 ? Math.round(totalItems / totalFeeds) : 0,
    distribution,
  };
}

// Check if an item should be highlighted as a diverse source
export function isDiverseSource(item: ItemWithDiversity): boolean {
  return !!item._isDiverseSource;
}

// Get diversity score for an item
export function getDiversityScore(item: ItemWithDiversity): number {
  return item._diversityScore ?? 0;
}
