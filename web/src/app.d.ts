/// <reference types="svelte" />
/// <reference types="svelte/elements" />
/// <reference types="@sveltejs/kit" />
// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }

    interface YouTubePlayer {
        destroy(): void;
        getCurrentTime(): number;
        getPlayerState(): number;
    }

    interface YouTubeEvent {
        data: number;
    }

    interface YouTubeAPI {
        Player: new (
            elementId: string,
            config: {
                height: string;
                width: string;
                videoId: string;
                playerVars: {
                    autoplay: number;
                    playsinline: number;
                    modestbranding: number;
                    rel: number;
                    start: number;
                };
                events: { onStateChange: (event: YouTubeEvent) => void };
            },
        ) => YouTubePlayer;
        PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    }

    interface Window {
        YT?: YouTubeAPI;
        onYouTubeIframeAPIReady?: () => void;
    }
}

export { };
