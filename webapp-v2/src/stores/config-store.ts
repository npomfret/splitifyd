import { ReadonlySignal, signal } from '@preact/signals';
import type { AppConfiguration } from '@splitifyd/shared';
import { firebaseConfigManager } from '../app/firebase-config';

interface ConfigStore {
    // State getters - readonly values for external consumers
    readonly config: AppConfiguration | null;
    readonly loading: boolean;
    readonly error: Error | null;

    // Signal accessors for reactive components - return readonly signals
    readonly configSignal: ReadonlySignal<AppConfiguration | null>;
    readonly loadingSignal: ReadonlySignal<boolean>;
    readonly errorSignal: ReadonlySignal<Error | null>;

    // Actions
    loadConfig(): Promise<void>;
    reset(): void;
}

class ConfigStoreImpl implements ConfigStore {
    // Private signals - encapsulated within the class
    readonly #configSignal = signal<AppConfiguration | null>(null);
    readonly #loadingSignal = signal<boolean>(false);
    readonly #errorSignal = signal<Error | null>(null);

    // Private state
    #initialized = false;

    // State getters - readonly values for external consumers
    get config() {
        return this.#configSignal.value;
    }
    get loading() {
        return this.#loadingSignal.value;
    }
    get error() {
        return this.#errorSignal.value;
    }

    // Signal accessors for reactive components - return readonly signals
    get configSignal(): ReadonlySignal<AppConfiguration | null> {
        return this.#configSignal;
    }
    get loadingSignal(): ReadonlySignal<boolean> {
        return this.#loadingSignal;
    }
    get errorSignal(): ReadonlySignal<Error | null> {
        return this.#errorSignal;
    }

    async loadConfig(): Promise<void> {
        // Prevent multiple simultaneous loads
        if (this.#initialized || this.#loadingSignal.value) {
            return;
        }

        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;

        let configLoaded = false;

        try {
            const config = await firebaseConfigManager.getConfig();
            this.#configSignal.value = config;
            this.#errorSignal.value = null;
            configLoaded = true;
        } catch (error) {
            this.#errorSignal.value = error instanceof Error ? error : new Error(String(error));
            throw error;
        } finally {
            this.#loadingSignal.value = false;
            this.#initialized = configLoaded;
        }
    }

    reset(): void {
        this.#initialized = false;
        this.#configSignal.value = null;
        this.#loadingSignal.value = false;
        this.#errorSignal.value = null;
    }
}

// Export singleton instance
export const configStore = new ConfigStoreImpl();
