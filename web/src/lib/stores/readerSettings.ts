import { writable } from 'svelte/store';

export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type FontFamily = 'sans' | 'serif' | 'mono';
export type ReadingWidth = 'narrow' | 'medium' | 'wide';
export type ReaderTheme = 'light' | 'sepia' | 'dark' | 'black';

export interface ReaderSettings {
    fontSize: FontSize;
    fontFamily: FontFamily;
    readingWidth: ReadingWidth;
    theme: ReaderTheme;
}

function createReaderSettingsStore() {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('readerSettings') : null;
    const initial: ReaderSettings = stored ? JSON.parse(stored) : {
        fontSize: 'medium',
        fontFamily: 'sans',
        readingWidth: 'medium',
        theme: 'black'
    };
    
    const { subscribe, set, update } = writable<ReaderSettings>(initial);
    
    return {
        subscribe,
        set: (value: ReaderSettings) => {
            if (typeof window !== 'undefined') {
                localStorage.setItem('readerSettings', JSON.stringify(value));
            }
            set(value);
        },
        update: (fn: (value: ReaderSettings) => ReaderSettings) => {
            update((current) => {
                const newValue = fn(current);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('readerSettings', JSON.stringify(newValue));
                }
                return newValue;
            });
        },
        setFontSize: (fontSize: FontSize) => {
            update((current) => {
                const newValue = { ...current, fontSize };
                if (typeof window !== 'undefined') {
                    localStorage.setItem('readerSettings', JSON.stringify(newValue));
                }
                return newValue;
            });
        },
        setFontFamily: (fontFamily: FontFamily) => {
            update((current) => {
                const newValue = { ...current, fontFamily };
                if (typeof window !== 'undefined') {
                    localStorage.setItem('readerSettings', JSON.stringify(newValue));
                }
                return newValue;
            });
        },
        setReadingWidth: (readingWidth: ReadingWidth) => {
            update((current) => {
                const newValue = { ...current, readingWidth };
                if (typeof window !== 'undefined') {
                    localStorage.setItem('readerSettings', JSON.stringify(newValue));
                }
                return newValue;
            });
        },
        setTheme: (theme: ReaderTheme) => {
            update((current) => {
                const newValue = { ...current, theme };
                if (typeof window !== 'undefined') {
                    localStorage.setItem('readerSettings', JSON.stringify(newValue));
                }
                return newValue;
            });
        }
    };
}

export const readerSettings = createReaderSettingsStore();

// Text-to-speech state
export const isSpeaking = writable(false);
export const speechProgress = writable(0);

// Reading progress
export const scrollProgress = writable(0);
