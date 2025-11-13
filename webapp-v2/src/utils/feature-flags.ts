import { configStore } from '@/stores/config-store.ts';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export type FeatureFlagName = 'enableAdvancedReporting' | 'enableMultiCurrency' | 'enableCustomFields';

export function readFeatureFlag(flag: FeatureFlagName, defaultValue = false): boolean {
    const config = configStore.configSignal.value;
    const value = config?.tenant?.features?.[flag];
    // The branded boolean types are compatible with boolean at runtime
    return (value ?? defaultValue) as boolean;
}

export function useFeatureFlag(flag: FeatureFlagName, defaultValue = false): boolean {
    const [enabled, setEnabled] = useState(() => readFeatureFlag(flag, defaultValue));

    useEffect(() => {
        const update = () => {
            setEnabled(readFeatureFlag(flag, defaultValue));
        };

        update();

        const subscription = configStore.configSignal.subscribe(update);
        return () => {
            subscription?.();
        };
    }, [flag, defaultValue]);

    return enabled;
}

interface FeatureGateProps {
    feature: FeatureFlagName;
    children: ComponentChildren;
    fallback?: ComponentChildren;
    defaultValue?: boolean;
}

export function FeatureGate({
    feature,
    children,
    fallback = null,
    defaultValue,
}: FeatureGateProps): ComponentChildren {
    const enabled = useFeatureFlag(feature, defaultValue ?? false);

    return enabled ? children : fallback ?? null;
}
