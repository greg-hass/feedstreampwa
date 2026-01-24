const SMART_FOLDER_NAMES: Record<string, string> = {
  rss: "RSS Feeds",
  youtube: "YouTube",
  reddit: "Reddit",
  podcast: "Podcasts",
};

export function getPageTitle(
  viewMode: string,
  activeSmartFolder: string | null,
  activeFolderId: string | null,
  selectedFeedUrl: string | null,
  folders: Array<{ id: string; name: string }>
): string {
  if (viewMode === "smart" && activeSmartFolder) {
    return SMART_FOLDER_NAMES[activeSmartFolder] || "Smart Folder";
  }

  if (viewMode === "folder" && activeFolderId) {
    const folder = folders.find((f) => f.id === activeFolderId);
    return folder?.name || "Folder";
  }

  if (viewMode === "feed" && selectedFeedUrl) {
    return "Feed";
  }

  if (viewMode === "unread") return "Unread";
  if (viewMode === "bookmarks") return "Bookmarks";
  if (viewMode === "discover") return "Discover";

  return "All Articles";
}
