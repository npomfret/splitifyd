import type { Email } from '@billsplit-wl/shared';
import { ClientAppConfiguration, FirebaseConfig, TenantConfig, toEmail } from '@billsplit-wl/shared';
import { z } from 'zod';
import { DOCUMENT_CONFIG, VALIDATION_LIMITS } from './constants';
import { inferProjectId, isEmulator, isRealFirebase } from './firebase';
import { logger } from './logger';
import { validateAppConfiguration } from './middleware/config-validation';

// Cache for lazy-loaded configurations
let cachedConfig: AppConfig | null = null;
let cachedAppConfig: ClientAppConfiguration | null = null;
let cachedEnv: z.infer<typeof envSchema> | null = null;

// Define environment variable schema
const envSchema = z.object({
    FUNCTIONS_EMULATOR: z.string().optional(),
    FIREBASE_CONFIG: z.string().optional(),
    __CLIENT_API_KEY: z.string().optional(),
    __CLIENT_AUTH_DOMAIN: z.string().optional(),
    __CLIENT_STORAGE_BUCKET: z.string().optional(),
    __CLIENT_MESSAGING_SENDER_ID: z.string().optional(),
    __CLIENT_APP_ID: z.string().optional(),
    __CLIENT_MEASUREMENT_ID: z.string().optional(),
    FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
    FIRESTORE_EMULATOR_HOST: z.string().optional(),
    __DEV_FORM_EMAIL: z.string().optional(),
    __DEV_FORM_PASSWORD: z.string().optional(),
    __WARNING_BANNER: z.string().optional(),
    // Cache configuration (seconds) - paths not listed get no-cache
    __CACHE_PATH_HOME: z.coerce.number(),
    __CACHE_PATH_LOGIN: z.coerce.number(),
    __CACHE_PATH_TERMS: z.coerce.number(),
    __CACHE_PATH_PRIVACY: z.coerce.number(),
    __CACHE_PATH_API_CONFIG: z.coerce.number(),
    __CACHE_THEME_VERSIONED: z.coerce.number(),
    __CACHE_THEME_UNVERSIONED: z.coerce.number(),
});

interface CacheConfig {
    paths: Record<string, number>;
    themeVersioned: number;
    themeUnversioned: number;
}

// Type for the CONFIG object
interface AppConfig {
    isEmulator: boolean;
    requestBodyLimit: string;
    validation: {
        maxObjectDepth: number;
        maxStringLength: number;
        maxPropertyCount: number;
        maxPropertyNameLength: number;
    };
    formDefaults: {
        email: Email;
        password: string;
    };
    warningBanner: string;
    cache: CacheConfig;
    securityHeaders: {
        hstsEnabled: boolean;
        cspPolicy: string;
    };
    cloudTasks: {
        /** Skip OIDC auth in emulator since StubCloudTasksClient doesn't send real tokens */
        requireOidcAuth: boolean;
    };
}

// Lazy environment variable loader
function getEnv(): z.infer<typeof envSchema> {
    if (cachedEnv) return cachedEnv;

    try {
        cachedEnv = envSchema.parse(process.env);
        return cachedEnv;
    } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error('Invalid environment variables', errorObj);

        if (error instanceof z.ZodError) {
            const errorMessages = error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new Error(`Environment variable validation failed: ${errorMessages}`);
        }
        throw new Error(`Environment variable validation failed: ${errorObj.message}`);
    }
}

// Build the CONFIG object lazily
function buildConfig(): AppConfig {
    const env = getEnv();

    // Validate required deployed environment variables
    if (isRealFirebase()) {
        const requiredVars = ['__CLIENT_API_KEY', '__CLIENT_AUTH_DOMAIN', '__CLIENT_STORAGE_BUCKET', '__CLIENT_MESSAGING_SENDER_ID', '__CLIENT_APP_ID'];

        const missing = requiredVars.filter((key) => !env[key as keyof typeof env]);
        if (missing.length > 0) {
            throw new Error(`Missing environment variables in deployed environment: ${missing.join(', ')}`);
        }
    }

    const emulator = isEmulator();
    return {
        isEmulator: emulator,
        requestBodyLimit: '1mb',
        validation: {
            maxObjectDepth: VALIDATION_LIMITS.MAX_DOCUMENT_DEPTH,
            maxStringLength: DOCUMENT_CONFIG.DEPLOYED_MAX_STRING_LENGTH,
            maxPropertyCount: DOCUMENT_CONFIG.DEPLOYED_MAX_PROPERTY_COUNT,
            maxPropertyNameLength: VALIDATION_LIMITS.MAX_PROPERTY_NAME_LENGTH,
        },
        formDefaults: {
            email: toEmail(env.__DEV_FORM_EMAIL ?? ''),
            password: env.__DEV_FORM_PASSWORD ?? '',
        },
        warningBanner: env.__WARNING_BANNER ?? '',
        cache: {
            paths: {
                '/': env.__CACHE_PATH_HOME,
                '/login': env.__CACHE_PATH_LOGIN,
                '/terms': env.__CACHE_PATH_TERMS,
                '/privacy': env.__CACHE_PATH_PRIVACY,
                '/api/config': env.__CACHE_PATH_API_CONFIG,
            },
            themeVersioned: env.__CACHE_THEME_VERSIONED,
            themeUnversioned: env.__CACHE_THEME_UNVERSIONED,
        },
        securityHeaders: {
            hstsEnabled: !emulator,
            cspPolicy: emulator
                ? 'default-src \'self\'; '
                    + 'script-src \'self\'; '
                    + 'style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; '
                    + 'font-src \'self\' https://fonts.gstatic.com; '
                    + 'img-src \'self\' data: https:; '
                    + 'connect-src \'self\' http://localhost:* ws://localhost:*; '
                    + 'frame-ancestors \'none\';'
                : 'default-src \'self\'; '
                    + 'script-src \'self\' https://apis.google.com https://www.gstatic.com; '
                    + 'style-src \'self\' https://fonts.googleapis.com; '
                    + 'font-src \'self\' https://fonts.gstatic.com; '
                    + 'img-src \'self\' data: https:; '
                    + 'connect-src \'self\' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com; '
                    + 'frame-ancestors \'none\'; '
                    + 'report-uri /csp-violation-report;',
        },
        cloudTasks: {
            requireOidcAuth: !emulator,
        },
    };
}

// Export lazy getter for CONFIG
export function getAppConfig(): AppConfig {
    if (!cachedConfig) {
        cachedConfig = buildConfig();
    }
    return cachedConfig;
}

// Helper functions for building AppConfiguration
function getFirebaseAuthUrl(config: AppConfig, env: z.infer<typeof envSchema>): string | undefined {
    if (!isEmulator()) {
        return undefined;
    }

    // Get auth URL from Firebase environment variable - required in emulator, and provided by the emulator at runtime
    const authHost = env.FIREBASE_AUTH_EMULATOR_HOST;
    if (!authHost) {
        throw new Error('FIREBASE_AUTH_EMULATOR_HOST environment variable must be set when using emulator. Set it in your .env file.');
    }

    return `http://${authHost}`;
}

function getFirebaseFirestoreUrl(config: AppConfig, env: z.infer<typeof envSchema>): string | undefined {
    if (!isEmulator()) {
        return undefined;
    }

    // Get Firestore URL from Firebase environment variable - required in emulator - provided by the emulator at runtime
    const firestoreHost = env.FIRESTORE_EMULATOR_HOST;
    if (!firestoreHost) {
        throw new Error('FIRESTORE_EMULATOR_HOST environment variable must be set when using emulator. Set it in your .env file.');
    }

    const validHosts = /^(?:127\.0\.0\.1|localhost|0\.0\.0\.0):\d+$/;
    if (!validHosts.test(firestoreHost)) {
        throw Error(`firestoreHost looks wrong: ${firestoreHost}. Expected localhost, 127.0.0.1, or 0.0.0.0 with a port.`);
    }

    return `http://${firestoreHost}`;
}

// Build the complete AppConfiguration lazily
function buildAppConfiguration(): ClientAppConfiguration {
    const config = getAppConfig();
    const env = getEnv();
    const projectId = inferProjectId();
    const _isEmulator = isEmulator();

    // Build firebase config based on environment
    const MINIMAL_EMULATOR_CLIENT_CONFIG = {
        // Minimal config for development - these values are not used by the emulator
        apiKey: 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg',
        authDomain: '',
        projectId,
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        measurementId: '',
    };

    const firebase: FirebaseConfig = _isEmulator
        ? MINIMAL_EMULATOR_CLIENT_CONFIG
        : {
            apiKey: env.__CLIENT_API_KEY!,
            authDomain: env.__CLIENT_AUTH_DOMAIN!,
            projectId,
            storageBucket: env.__CLIENT_STORAGE_BUCKET!,
            messagingSenderId: env.__CLIENT_MESSAGING_SENDER_ID!,
            appId: env.__CLIENT_APP_ID!,
            measurementId: env.__CLIENT_MEASUREMENT_ID,
        };

    // Validate required fields in deployed environment
    if (!_isEmulator && (!firebase.apiKey || !firebase.authDomain || !firebase.storageBucket || !firebase.messagingSenderId || !firebase.appId)) {
        logger.error('Firebase config is incomplete in deployed environment', new Error('Missing required Firebase config'), {
            hasApiKey: !!env.__CLIENT_API_KEY,
            hasAuthDomain: !!env.__CLIENT_AUTH_DOMAIN,
        });
        throw new Error('Firebase configuration is incomplete in deployed environment');
    }

    return {
        firebase,
        warningBanner: config.warningBanner || undefined,
        formDefaults: config.formDefaults,
        firebaseAuthUrl: getFirebaseAuthUrl(config, env),
        firebaseFirestoreUrl: getFirebaseFirestoreUrl(config, env),
    };
}

const IDENTITY_TOOLKIT_SERVICE_PATH = '/identitytoolkit.googleapis.com';
const IDENTITY_TOOLKIT_PRODUCTION_BASE_URL = 'https://identitytoolkit.googleapis.com';

function getIdentityToolkitBaseUrl(): string {
    const config = getAppConfig();

    if (!isEmulator()) {
        return IDENTITY_TOOLKIT_PRODUCTION_BASE_URL;
    }

    const env = getEnv();
    const authUrl = getFirebaseAuthUrl(config, env);
    if (!authUrl) {
        throw new Error('Auth emulator URL is not configured');
    }

    return `${authUrl}${IDENTITY_TOOLKIT_SERVICE_PATH}`;
}

function getIdentityToolkitApiKey(): string {
    const env = getEnv();
    const apiKey = env.__CLIENT_API_KEY ?? (() => getClientAppConfiguration().firebase.apiKey)();

    if (!apiKey || apiKey.trim().length === 0) {
        throw new Error('Firebase API key is not configured');
    }

    return apiKey;
}

export function getIdentityToolkitConfig(): { apiKey: string; baseUrl: string; } {
    return {
        apiKey: getIdentityToolkitApiKey(),
        baseUrl: getIdentityToolkitBaseUrl(),
    };
}

// Lazy getter for APP_CONFIG (used internally)
function getClientAppConfiguration(): ClientAppConfiguration {
    if (!cachedAppConfig) {
        try {
            const builtConfig = buildAppConfiguration();

            // Skip validation in emulator since we're using dummy values
            if (!isEmulator()) {
                // Validate in deployed environment
                cachedAppConfig = validateAppConfiguration(builtConfig);
            } else {
                cachedAppConfig = builtConfig;
            }

            // App configuration built and validated successfully
        } catch (error) {
            logger.error('Failed to build or validate app configuration', error);

            // Fail fast - don't let the app start with invalid configuration
            throw new Error(`Configuration error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return cachedAppConfig;
}

export function getTenantAwareAppConfig(tenant?: TenantConfig): ClientAppConfiguration {
    const baseConfig = getClientAppConfiguration();

    if (!tenant) {
        return baseConfig;
    }

    return {
        ...baseConfig,
        tenant,
    };
}
