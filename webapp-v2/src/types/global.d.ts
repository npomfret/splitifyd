declare global {
    interface Window {
        __tenantTheme?: {
            storageKey: string;
            hash?: string | null;
        };
    }
}

export {};
