export function detectFeedKind(url: string): 'youtube' | 'reddit' | 'podcast' | 'generic' {
    const lower = url.toLowerCase();

    // YouTube detection
    if (lower.includes('youtube.com') ||
        lower.includes('youtu.be') ||
        lower.includes('feeds/videos.xml')) {
        return 'youtube';
    }

    // Reddit detection
    if (lower.includes('reddit.com') ||
        lower.includes('/.rss') ||
        lower.includes('/r/')) {
        return 'reddit';
    }

    // Podcast detection
    if (lower.includes('podcast') ||
        lower.includes('.mp3') ||
        lower.includes('itunes.apple.com') ||
        lower.includes('anchor.fm')) {
        return 'podcast';
    }

    return 'generic';
}
