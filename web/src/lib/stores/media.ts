// Media player store - manages playback state and current media
import { writable, derived, get } from 'svelte/store';
import type { Item } from '../types';
import { updateVideoProgress } from '../api/items';

// Current media item
export const currentMedia = writable<Item | null>(null);

// Playback state
export const isPlaying = writable(false);
export const currentTime = writable(0); // Current playback position in seconds
export const duration = writable(0); // Total duration in seconds
export const volume = writable(0.7); // Volume 0-1
export const isMuted = writable(false);
export const playbackSpeed = writable(1.0);

// Derived stores
export const progress = derived([currentTime, duration], ([$currentTime, $duration]) => {
    if ($duration === 0) return 0;
    return ($currentTime / $duration) * 100;
});

export const formattedCurrentTime = derived(currentTime, ($currentTime) => {
    return formatTime($currentTime);
});

export const formattedDuration = derived(duration, ($duration) => {
    return formatTime($duration);
});

// Media type
export const mediaType = derived(currentMedia, ($currentMedia) => {
    if (!$currentMedia) return null;
    if ($currentMedia.source === 'youtube' || $currentMedia.external_id) return 'video';
    if ($currentMedia.source === 'podcast' || $currentMedia.enclosure) return 'audio';
    return null;
});

// Media URL
export const mediaUrl = derived(currentMedia, ($currentMedia) => {
    if (!$currentMedia) return null;

    // YouTube video
    if ($currentMedia.external_id) {
        return `https://www.youtube.com/watch?v=${$currentMedia.external_id}`;
    }

    // Podcast/audio enclosure
    if ($currentMedia.enclosure) {
        if (typeof $currentMedia.enclosure === 'string') {
            return $currentMedia.enclosure;
        }
        if (typeof $currentMedia.enclosure === 'object' && 'url' in $currentMedia.enclosure) {
            return $currentMedia.enclosure.url;
        }
    }

    return null;
});

// Actions
export function playMedia(item: Item) {
    currentMedia.set(item);
    currentTime.set(item.playback_position || 0);
    duration.set(item.media_duration_seconds || 0);
    isPlaying.set(true);
}

export function togglePlayPause() {
    isPlaying.update(playing => !playing);
}

export function play() {
    isPlaying.set(true);
}

export function pause() {
    isPlaying.set(false);
}

export function stop() {
    isPlaying.set(false);
    currentTime.set(0);
    currentMedia.set(null);
}

export function seek(timeInSeconds: number) {
    currentTime.set(timeInSeconds);
}

export function setVolume(vol: number) {
    volume.set(Math.max(0, Math.min(1, vol)));
}

export function toggleMute() {
    isMuted.update(muted => !muted);
}

export function skip(seconds: number) {
    currentTime.update(t => {
        const newTime = Math.max(0, Math.min(get(duration), t + seconds));
        return newTime;
    });
}

export function setPlaybackSpeed(speed: number) {
    playbackSpeed.set(speed);
}

// Save progress to backend (debounced)
let saveProgressTimer: ReturnType<typeof setTimeout> | null = null;

export function updateProgress(timeInSeconds: number) {
    currentTime.set(timeInSeconds);

    const media = get(currentMedia);
    if (!media) return;

    // Debounce saving to backend (save every 5 seconds)
    if (saveProgressTimer) {
        clearTimeout(saveProgressTimer);
    }

    saveProgressTimer = setTimeout(async () => {
        try {
            await updateVideoProgress(media.id, timeInSeconds);
        } catch (err) {
            console.error('Failed to save progress:', err);
        }
    }, 5000);
}

// Helper: Format seconds to MM:SS or HH:MM:SS
function formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
