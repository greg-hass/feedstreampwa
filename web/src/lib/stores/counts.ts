// Counts store - derived counts for navigation badges
import { derived, get } from 'svelte/store';
import { feeds, totalUnread, rssUnread, youtubeUnread, redditUnread, podcastUnread } from './feeds';
import { items, bookmarkedCount } from './items';

// Feed type to smart folder mapping
const feedTypeToSmartFolder: Record<string, 'rss' | 'youtube' | 'reddit' | 'podcast'> = {
  'rss': 'rss',
  'youtube': 'youtube',
  'reddit': 'reddit',
  'podcast': 'podcast',
  'generic': 'rss',
};

// Helper to sum up all items from feeds (for total counts)
function getTotalForFeedType(type: 'rss' | 'youtube' | 'reddit' | 'podcast'): number {
  const $feeds = get(feeds);
  return $feeds
    .filter((f) => f.type === type || f.kind === type)
    .reduce((sum, feed) => sum + (feed.unreadCount || 0), 0);
}

// All Articles: unread/total
// For total, we need to fetch all items or get from backend
// For now, showing unread only until we have total counts
export const allArticlesUnread = derived(totalUnread, ($totalUnread) => $totalUnread);
export const allArticlesTotal = derived(feeds, ($feeds) =>
  $feeds.reduce((sum, feed) => {
    // Each feed might have a totalCount field, or we use unread as fallback
    return sum + (feed.unreadCount || 0);
  }, 0)
);

// Library: total bookmarked items
export const libraryTotal = derived(bookmarkedCount, ($bookmarkedCount) => $bookmarkedCount);

// Smart Folders: unread/total for each
export const smartFolderCounts = derived(
  [rssUnread, youtubeUnread, redditUnread, podcastUnread, feeds],
  ([$rssUnread, $youtubeUnread, $redditUnread, $podcastUnread, $feeds]) => ({
    rss: { unread: $rssUnread, total: $rssUnread }, // Total = unread for now
    youtube: { unread: $youtubeUnread, total: $youtubeUnread },
    reddit: { unread: $redditUnread, total: $redditUnread },
    podcast: { unread: $podcastUnread, total: $podcastUnread },
  })
);

// Individual smart folder counts
export const rssCount = derived(smartFolderCounts, ($counts) => $counts.rss);
export const youtubeCount = derived(smartFolderCounts, ($counts) => $counts.youtube);
export const redditCount = derived(smartFolderCounts, ($counts) => $counts.reddit);
export const podcastCount = derived(smartFolderCounts, ($counts) => $counts.podcast);

// Total feeds count
export const totalFeeds = derived(feeds, ($feeds) => $feeds.length);

// Helper to format count display
export function formatCount(count: number): string {
  if (count === 0) return '0';
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

// Helper to format unread/total display
export function formatUnreadTotal(unread: number, total: number): string {
  if (total === 0) return '0';
  if (unread === total) return formatCount(total);
  return `${formatCount(unread)}/${formatCount(total)}`;
}
