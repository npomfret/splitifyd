import type { ClientAppConfiguration, TenantConfig } from '@billsplit-wl/shared';
import { ReadonlySignal, signal } from '@preact/signals';
import { firebaseConfigManager } from '../app/firebase-config';
import i18n from '../i18n';
import { syncThemeHash } from '../utils/theme-bootstrap';

const DEFAULT_THEME_COLOR = '#1a73e8';
const DEFAULT_APP_NAME = 'Splitifyd';
const DEFAULT_FAVICON = '/src/assets/logo.svg';

const setTranslationAppName = (appName: string): void => {
    if (!i18n.options?.interpolation) {
        return;
    }

    if (!i18n.options.interpolation.defaultVariables) {
        i18n.options.interpolation.defaultVariables = {};
    }

    i18n.options.interpolation.defaultVariables.appName = appName;

    i18n.emit('languageChanged', i18n.language);
};

const ensureMetaThemeColor = (): HTMLMetaElement | null => {
    if (typeof document === 'undefined') {
        return null;
    }

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
    }
    return meta;
};

const ensureFavicon = (): HTMLLinkElement | null => {
    if (typeof document === 'undefined') {
        return null;
    }

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    return link;
};

const applyDocumentTitle = (brandName?: string | null): void => {
    if (typeof document === 'undefined') {
        return;
    }

    document.title = brandName?.trim() || DEFAULT_APP_NAME;
};

const updateBrandingMetadata = (tenant: TenantConfig | null | undefined): void => {
    if (typeof document === 'undefined') {
        return;
    }

    const tokens = tenant?.brandingTokens.tokens;

    const metaTheme = ensureMetaThemeColor();
    if (metaTheme) {
        metaTheme.content = tenant?.branding.primaryColor ?? DEFAULT_THEME_COLOR;
    }

    const favicon = ensureFavicon();
    if (favicon) {
        const faviconHref = tokens?.assets.faviconUrl ?? tokens?.assets.logoUrl ?? DEFAULT_FAVICON;
        favicon.setAttribute('href', faviconHref);
    }

    const appName = tokens?.legal.appName ?? null;
    applyDocumentTitle(appName);
};

interface ConfigStore {
    // State getters - readonly values for external consumers
    readonly config: ClientAppConfiguration | null;
    readonly loading: boolean;
    readonly error: Error | null;
    readonly appName: string;

    // Signal accessors for reactive components - return readonly signals
    readonly configSignal: ReadonlySignal<ClientAppConfiguration | null>;
    readonly loadingSignal: ReadonlySignal<boolean>;
    readonly errorSignal: ReadonlySignal<Error | null>;

    // Actions
    loadConfig(): Promise<void>;
    reset(): void;
}

class ConfigStoreImpl implements ConfigStore {
    // Private signals - encapsulated within the class
    readonly #configSignal = signal<ClientAppConfiguration | null>(null);
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
    get appName() {
        const appName = this.#configSignal.value?.tenant?.brandingTokens.tokens.legal.appName;
        return appName?.trim() || DEFAULT_APP_NAME;
    }

    // Signal accessors for reactive components - return readonly signals
    get configSignal(): ReadonlySignal<ClientAppConfiguration | null> {
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
            syncThemeHash(config.theme?.hash ?? null);
            updateBrandingMetadata(config.tenant);
            setTranslationAppName(this.appName);
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
        if (typeof document !== 'undefined') {
            document.title = DEFAULT_APP_NAME;
        }
        updateBrandingMetadata(null);
        setTranslationAppName(DEFAULT_APP_NAME);
    }
}

// Export singleton instance
export const configStore = new ConfigStoreImpl();

setTranslationAppName(DEFAULT_APP_NAME);
