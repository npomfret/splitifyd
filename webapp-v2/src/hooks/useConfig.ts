import { configStore } from '@/stores/config-store';
import type { AppConfiguration } from '@billsplit-wl/shared';
import { useEffect } from 'preact/hooks';

export function useConfig(): AppConfiguration | null {
    useEffect(() => {
        if (!configStore.configSignal.value && !configStore.loading) {
            configStore.loadConfig().catch(() => {});
        }
    }, []);

    return configStore.configSignal.value;
}
