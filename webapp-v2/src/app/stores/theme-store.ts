import {signal} from '@preact/signals';
import type {UserThemeColor} from '@splitifyd/shared';
import type {ClientUser} from "@splitifyd/shared";

export interface ThemeState {
    userThemes: Map<string, UserThemeColor>;
    isDarkMode: boolean;
    currentUserTheme: UserThemeColor | null;
}

export interface ThemeActions {
    setUserTheme: (userId: string, themeColor: UserThemeColor) => void;
    setDarkMode: (isDark: boolean) => void;
    getCurrentUserTheme: (user: ClientUser | null) => UserThemeColor | null;
    applyThemeToDOM: (themeColor: UserThemeColor | null, isDark: boolean) => void;
}

export interface ThemeStore extends ThemeState, ThemeActions {}

class ThemeStoreImpl implements ThemeStore {
    // Private signals - encapsulated within the class
    readonly #userThemesSignal = signal<Map<string, UserThemeColor>>(new Map());
    readonly #isDarkModeSignal = signal<boolean>(typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false);
    readonly #currentUserThemeSignal = signal<UserThemeColor | null>(null);

    // State getters - readonly values for external consumers
    get userThemes() {
        return this.#userThemesSignal.value;
    }
    get isDarkMode() {
        return this.#isDarkModeSignal.value;
    }
    get currentUserTheme() {
        return this.#currentUserThemeSignal.value;
    }

    private constructor() {
        this.initializeDarkModeListener();
    }

    static create(): ThemeStoreImpl {
        return new ThemeStoreImpl();
    }

    private initializeDarkModeListener() {
        if (typeof window !== 'undefined') {
            // Listen for system dark mode changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                this.#isDarkModeSignal.value = e.matches;
                this.updateCSSVariables();
            });
        }
    }

    setUserTheme(userId: string, themeColor: UserThemeColor): void {
        const newMap = new Map(this.#userThemesSignal.value);
        newMap.set(userId, themeColor);
        this.#userThemesSignal.value = newMap;
    }

    setDarkMode(isDark: boolean): void {
        this.#isDarkModeSignal.value = isDark;
        this.updateCSSVariables();
    }

    getCurrentUserTheme(user: ClientUser | null): UserThemeColor | null {
        if (!user) return null;

        // Check if theme is already in the user object
        if (user.themeColor) {
            return user.themeColor;
        }

        // Check if theme is cached in the store
        return this.#userThemesSignal.value.get(user.uid) || null;
    }

    applyThemeToDOM(themeColor: UserThemeColor | null, isDark: boolean): void {
        if (!themeColor) return;

        const color = isDark ? themeColor.dark : themeColor.light;

        if (typeof window !== 'undefined' && document.documentElement) {
            // Set CSS custom properties
            document.documentElement.style.setProperty('--theme-primary', color);
            document.documentElement.style.setProperty('--theme-primary-light', `${color}20`); // 20% opacity
            document.documentElement.style.setProperty('--theme-primary-dark', themeColor.dark);
            document.documentElement.style.setProperty('--theme-name', `"${themeColor.name}"`);
            document.documentElement.style.setProperty('--theme-pattern', themeColor.pattern);

            // Set theme color meta tag for mobile browsers
            let metaThemeColor = document.querySelector('meta[name="theme-color"]');
            if (!metaThemeColor) {
                metaThemeColor = document.createElement('meta');
                metaThemeColor.setAttribute('name', 'theme-color');
                document.head.appendChild(metaThemeColor);
            }
            metaThemeColor.setAttribute('content', color);
        }
    }

    private updateCSSVariables(): void {
        const currentTheme = this.currentUserTheme;
        this.applyThemeToDOM(currentTheme, this.isDarkMode);
    }

    // Method to be called by auth store when user changes
    updateCurrentUserTheme(user: ClientUser | null): void {
        const theme = this.getCurrentUserTheme(user);

        // Update current user theme signal
        this.#currentUserThemeSignal.value = theme;

        if (theme) {
            // Cache the theme
            if (user) {
                this.setUserTheme(user.uid, theme);
            }

            // Apply to DOM
            this.applyThemeToDOM(theme, this.isDarkMode);
        }
    }

    // Get theme colors for other users (for avatars, etc.)
    getThemeForUser(userId: string): UserThemeColor | null {
        return this.#userThemesSignal.value.get(userId) || null;
    }

    // Clear all cached themes (for logout)
    reset(): void {
        this.#userThemesSignal.value = new Map();
        this.#currentUserThemeSignal.value = null;
    }
}

// Singleton instance
let themeStoreInstance: ThemeStoreImpl | null = null;

const getThemeStore = (): ThemeStoreImpl => {
    if (!themeStoreInstance) {
        themeStoreInstance = ThemeStoreImpl.create();
    }
    return themeStoreInstance;
};

export const themeStore = getThemeStore();
