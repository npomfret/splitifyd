import { configStore } from '@/stores/config-store';
import type { ClientAppConfiguration } from '@billsplit-wl/shared';
import { useEffect } from 'preact/hooks';

export function useConfig(): ClientAppConfiguration | null {
    useEffect(() => {
        if (!configStore.configSignal.value && !configStore.loading) {
            configStore.loadConfig().catch(() => {});
        }
    }, []);

    return configStore.configSignal.value;
}
