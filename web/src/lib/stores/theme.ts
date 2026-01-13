// Theme store - manages app themes with color schemes
import { writable, derived, get } from 'svelte/store';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'emerald' | 'blue' | 'purple' | 'rose' | 'amber' | 'cyan' | 'custom';

export interface CustomColors {
  primary: string;
  background: string;
  surface: string;
  raised: string;
}

export interface Theme {
  mode: ThemeMode;
  colorScheme: ColorScheme;
  customColors?: CustomColors;
}

// Preset color schemes
export const colorSchemes: Record<ColorScheme, { name: string; accent: string; description: string }> = {
  emerald: { name: 'Emerald', accent: '#10B981', description: 'Classic green accent' },
  blue: { name: 'Ocean Blue', accent: '#3B82F6', description: 'Calming blue tones' },
  purple: { name: 'Royal Purple', accent: '#8B5CF6', description: 'Elegant purple theme' },
  rose: { name: 'Sunset Rose', accent: '#F43F5E', description: 'Warm pink accents' },
  amber: { name: 'Golden Amber', accent: '#F59E0B', description: 'Warm yellow glow' },
  cyan: { name: 'Sky Cyan', accent: '#06B6D4', description: 'Fresh cyan highlights' },
  custom: { name: 'Custom', accent: '#10B981', description: 'Your personalized colors' },
};

const THEME_STORAGE_KEY = 'feedstream_theme';

// Default theme
const defaultTheme: Theme = {
  mode: 'dark',
  colorScheme: 'emerald',
};

// Create the theme store
function createThemeStore() {
  // Load from localStorage (only in browser)
  let initialTheme = defaultTheme;
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    initialTheme = savedTheme ? JSON.parse(savedTheme) : defaultTheme;
  }

  const { subscribe, set, update } = writable<Theme>(initialTheme);

  return {
    subscribe,
    set: (theme: Theme) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
      }
      set(theme);
      applyTheme(theme);
    },
    update,
    setMode: (mode: ThemeMode) => {
      update((theme) => {
        const newTheme = { ...theme, mode };
        if (typeof window !== 'undefined') {
          localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newTheme));
        }
        applyTheme(newTheme);
        return newTheme;
      });
    },
    setColorScheme: (colorScheme: ColorScheme) => {
      update((theme) => {
        const newTheme = { ...theme, colorScheme };
        if (typeof window !== 'undefined') {
          localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newTheme));
        }
        applyTheme(newTheme);
        return newTheme;
      });
    },
    setCustomColors: (customColors: CustomColors) => {
      update((theme) => {
        const newTheme: Theme = { ...theme, colorScheme: 'custom' as ColorScheme, customColors };
        if (typeof window !== 'undefined') {
          localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newTheme));
        }
        applyTheme(newTheme);
        return newTheme;
      });
    },
  };
}

export const theme = createThemeStore();

// Derived store for the effective accent color
export const accentColor = derived(theme, ($theme) => {
  if ($theme.colorScheme === 'custom' && $theme.customColors) {
    return $theme.customColors.primary;
  }
  return colorSchemes[$theme.colorScheme].accent;
});

// Apply theme to CSS variables
function applyTheme(theme: Theme) {
  // Only apply in browser
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
  const root = document.documentElement;

  // Get accent color
  const accent = theme.colorScheme === 'custom' && theme.customColors
    ? theme.customColors.primary
    : colorSchemes[theme.colorScheme].accent;

  // Apply accent color
  root.style.setProperty('--accent-color', accent);
  root.style.setProperty('--accent-color-rgb', hexToRgb(accent));

  // Apply custom colors if in custom mode
  if (theme.colorScheme === 'custom' && theme.customColors) {
    root.style.setProperty('--custom-background', theme.customColors.background);
    root.style.setProperty('--custom-surface', theme.customColors.surface);
    root.style.setProperty('--custom-raised', theme.customColors.raised);
  } else {
    // Remove custom color variables
    root.style.removeProperty('--custom-background');
    root.style.removeProperty('--custom-surface');
    root.style.removeProperty('--custom-raised');
  }

  // Apply light/dark mode class
  const effectiveMode = theme.mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme.mode;

  if (effectiveMode === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
}

// Helper: Convert hex to RGB for rgba() usage
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '16, 185, 129';
}

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const currentTheme = get(theme);
    if (currentTheme.mode === 'system') {
      applyTheme(currentTheme);
    }
  });

  // Apply theme on load
  applyTheme(get(theme));
}
