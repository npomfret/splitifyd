import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { firebaseConfigManager } from '../app/firebase-config';

interface AppConfiguration {
    firebase: {
        apiKey: string;
        authDomain: string;
        projectId: string;
        storageBucket: string;
        messagingSenderId: string;
        appId: string;
    };
    firebaseAuthUrl?: string;
    environment: {
        warningBanner?: string;
    };
    formDefaults: {
        displayName?: string;
        email?: string;
        password?: string;
    };
}

const configSignal = signal<AppConfiguration | null>(null);
const loadingSignal = signal(false);
const errorSignal = signal<Error | null>(null);

let initialized = false;

export function useConfig() {
    useEffect(() => {
        if (!initialized && !loadingSignal.value && !configSignal.value) {
            initialized = true;
            loadingSignal.value = true;

            firebaseConfigManager
                .getConfig()
                .then((config) => {
                    configSignal.value = config;
                    errorSignal.value = null;
                })
                .catch((error) => {
                    errorSignal.value = error;
                })
                .finally(() => {
                    loadingSignal.value = false;
                });
        }
    }, []);

    return configSignal.value;
}
