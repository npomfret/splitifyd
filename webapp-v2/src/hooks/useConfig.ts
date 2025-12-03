import { configStore } from '@/stores/config-store';
import type { ClientAppConfiguration } from '@billsplit-wl/shared';
import { useSignalEffect } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';

export function useConfig(): ClientAppConfiguration | null {
    const [config, setConfig] = useState<ClientAppConfiguration | null>(configStore.configSignal.value);

    useEffect(() => {
        if (!configStore.configSignal.value && !configStore.loading) {
            configStore.loadConfig().catch(() => {
                // Error is stored in configStore.error
            });
        }
    }, []);

    // Subscribe to signal changes and update state to trigger re-renders
    useSignalEffect(() => {
        setConfig(configStore.configSignal.value);
    });

    return config;
}
