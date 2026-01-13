/**
 * Calculate estimated reading time for text content
 * Average reading speed: 200-250 words per minute
 * We'll use 225 WPM as a middle ground
 */
export function calculateReadTime(html: string): number {
    if (!html) return 0;
    
    // Strip HTML tags
    const text = html.replace(/<[^>]*>/g, ' ');
    
    // Count words (split by whitespace and filter empty strings)
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    
    // Calculate minutes (round up)
    const minutes = Math.ceil(wordCount / 225);
    
    return Math.max(1, minutes); // Minimum 1 minute
}

/**
 * Format read time for display
 */
export function formatReadTime(minutes: number): string {
    if (minutes === 1) return '1 min read';
    if (minutes < 60) return `${minutes} min read`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
        return hours === 1 ? '1 hour read' : `${hours} hours read`;
    }
    
    return `${hours}h ${remainingMinutes}m read`;
}
