import { configStore } from '@/stores/config-store';
import type { AppConfiguration } from '@splitifyd/shared';
import { useEffect } from 'preact/hooks';

export function useConfig(): AppConfiguration | null {
    useEffect(() => {
        if (!configStore.config && !configStore.loading) {
            configStore.loadConfig().catch(() => {});
        }
    }, []);

    return configStore.config;
}
