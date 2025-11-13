declare global {
    interface Window {
        __splitifydTheme?: {
            storageKey: string;
            hash?: string | null;
        };
    }
}

export {};
