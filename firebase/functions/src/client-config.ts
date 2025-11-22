import { AppConfiguration, EnvironmentConfig, FirebaseConfig, TenantConfig, toEmail } from '@billsplit-wl/shared';
import { DisplayName } from '@billsplit-wl/shared';
import type { Email } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';
import { z } from 'zod';
import { DOCUMENT_CONFIG, SYSTEM, VALIDATION_LIMITS } from './constants';
import { logger } from './logger';
import { validateAppConfiguration } from './middleware/config-validation';
import { assertValidInstanceName, type InstanceName } from './shared/instance-name';

// Cache for lazy-loaded configurations
let cachedConfig: ClientConfig | null = null;
let cachedAppConfig: AppConfiguration | null = null;
let cachedEnv: z.infer<typeof envSchema> | null = null;

// Define environment variable schema
const instanceNameSchema = z
    .string()
    .optional()
    .default('prod')
    .superRefine((value, ctx) => {
        try {
            assertValidInstanceName(value);
        } catch (error) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: error instanceof Error ? error.message : String(error),
            });
        }
    })
    .transform((value) => value as InstanceName);

const envSchema = z.object({
    INSTANCE_NAME: instanceNameSchema,
    FUNCTIONS_EMULATOR: z.string().optional(),
    GCLOUD_PROJECT: z.string().optional(),
    CLIENT_API_KEY: z.string().optional(),
    CLIENT_AUTH_DOMAIN: z.string().optional(),
    CLIENT_STORAGE_BUCKET: z.string().optional(),
    CLIENT_MESSAGING_SENDER_ID: z.string().optional(),
    CLIENT_APP_ID: z.string().optional(),
    CLIENT_MEASUREMENT_ID: z.string().optional(),
    FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
    FIRESTORE_EMULATOR_HOST: z.string().optional(),
    DEV_FORM_EMAIL: z.string().optional(),
    DEV_FORM_PASSWORD: z.string().optional(),
    WARNING_BANNER: z.string().optional(),
});

// Type for the CONFIG object
interface ClientConfig {
    instanceName: z.infer<typeof instanceNameSchema>;
    isProduction: boolean;
    requestBodyLimit: string;
    validation: {
        maxRequestSizeBytes: number;
        maxObjectDepth: number;
        maxStringLength: number;
        maxPropertyCount: number;
        maxPropertyNameLength: number;
    };
    document: {
        listLimit: number;
        previewLength: number;
    };
    formDefaults: {
        displayName: DisplayName;
        email: Email;
        password: string;
    };
    warningBanner: string;
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
function buildConfig(): ClientConfig {
    const env = getEnv();
    const name = env.INSTANCE_NAME;
    const isProduction = name === 'prod';

    // Validate required production variables
    if (isProduction) {
        const requiredVars = ['GCLOUD_PROJECT', 'CLIENT_API_KEY', 'CLIENT_AUTH_DOMAIN', 'CLIENT_STORAGE_BUCKET', 'CLIENT_MESSAGING_SENDER_ID', 'CLIENT_APP_ID'];

        const missing = requiredVars.filter((key) => !env[key as keyof typeof env]);
        if (missing.length > 0) {
            throw new Error(`Missing environment variables in production: ${missing.join(', ')}`);
        }
    }

    return {
        instanceName: name,
        isProduction,
        requestBodyLimit: '1mb',
        validation: {
            maxRequestSizeBytes: SYSTEM.BYTES_PER_KB * SYSTEM.BYTES_PER_KB,
            maxObjectDepth: VALIDATION_LIMITS.MAX_DOCUMENT_DEPTH,
            maxStringLength: isProduction ? DOCUMENT_CONFIG.PROD_MAX_STRING_LENGTH : DOCUMENT_CONFIG.DEV_MAX_STRING_LENGTH,
            maxPropertyCount: isProduction ? DOCUMENT_CONFIG.PROD_MAX_PROPERTY_COUNT : DOCUMENT_CONFIG.DEV_MAX_PROPERTY_COUNT,
            maxPropertyNameLength: VALIDATION_LIMITS.MAX_PROPERTY_NAME_LENGTH,
        },
        document: {
            listLimit: DOCUMENT_CONFIG.LIST_LIMIT,
            previewLength: DOCUMENT_CONFIG.PREVIEW_LENGTH,
        },
        formDefaults: {
            displayName: toDisplayName(isProduction ? '' : 'test'),
            email: toEmail(env.DEV_FORM_EMAIL ?? ''),
            password: env.DEV_FORM_PASSWORD ?? '',
        },
        warningBanner: env.WARNING_BANNER ?? '',
    };
}

// Export lazy getter for CONFIG
export function getConfig(): ClientConfig {
    if (!cachedConfig) {
        cachedConfig = buildConfig();
    }
    return cachedConfig;
}

// Helper functions for building AppConfiguration
function getFirebaseAuthUrl(config: ClientConfig, env: z.infer<typeof envSchema>): string | undefined {
    if (config.isProduction) {
        return undefined;
    }

    // Get auth URL from Firebase environment variable - required in development, and provided by the emulator at runtime
    const authHost = env.FIREBASE_AUTH_EMULATOR_HOST;
    if (!authHost) {
        throw new Error('FIREBASE_AUTH_EMULATOR_HOST environment variable must be set in development. Set it in your .env file.');
    }

    return `http://${authHost}`;
}

function getFirebaseFirestoreUrl(config: ClientConfig, env: z.infer<typeof envSchema>): string | undefined {
    if (config.isProduction) {
        return undefined;
    }

    // Get Firestore URL from Firebase environment variable - required in development - provided by the emulator at runtime
    const firestoreHost = env.FIRESTORE_EMULATOR_HOST;
    if (!firestoreHost) {
        throw new Error('FIRESTORE_EMULATOR_HOST environment variable must be set in development. Set it in your .env file.');
    }

    const validHosts = /^(?:127\.0\.0\.1|localhost|0\.0\.0\.0):\d+$/;
    if (!validHosts.test(firestoreHost)) {
        throw Error(`firestoreHost looks wrong: ${firestoreHost}. Expected localhost, 127.0.0.1, or 0.0.0.0 with a port.`);
    }

    return `http://${firestoreHost}`;
}

function getWarningBanner(config: ClientConfig): string | undefined {
    return config.warningBanner || undefined;
}

// Build the complete AppConfiguration lazily
function buildAppConfiguration(): AppConfiguration {
    const config = getConfig();
    const env = getEnv();
    const projectId = env.GCLOUD_PROJECT!;

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

    const firebase: FirebaseConfig = config.isProduction
        ? {
            apiKey: env.CLIENT_API_KEY!,
            authDomain: env.CLIENT_AUTH_DOMAIN!,
            projectId,
            storageBucket: env.CLIENT_STORAGE_BUCKET!,
            messagingSenderId: env.CLIENT_MESSAGING_SENDER_ID!,
            appId: env.CLIENT_APP_ID!,
            measurementId: env.CLIENT_MEASUREMENT_ID,
        }
        : MINIMAL_EMULATOR_CLIENT_CONFIG;

    // Validate required fields in production
    if (config.isProduction && (!firebase.apiKey || !firebase.authDomain || !firebase.storageBucket || !firebase.messagingSenderId || !firebase.appId)) {
        logger.error('Firebase config is incomplete in production', new Error('Missing required Firebase config'), {
            hasApiKey: !!env.CLIENT_API_KEY,
            hasAuthDomain: !!env.CLIENT_AUTH_DOMAIN,
            instanceName: env.INSTANCE_NAME,
        });
        throw new Error('Firebase configuration is incomplete in production');
    }

    const environment: EnvironmentConfig = {
        warningBanner: getWarningBanner(config),
    };

    return {
        firebase,
        environment,
        formDefaults: config.formDefaults,
        firebaseAuthUrl: getFirebaseAuthUrl(config, env),
        firebaseFirestoreUrl: getFirebaseFirestoreUrl(config, env),
    };
}

const IDENTITY_TOOLKIT_SERVICE_PATH = '/identitytoolkit.googleapis.com';
const IDENTITY_TOOLKIT_PRODUCTION_BASE_URL = 'https://identitytoolkit.googleapis.com';

function getIdentityToolkitBaseUrl(): string {
    const config = getConfig();

    if (config.isProduction) {
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
    const apiKey = env.CLIENT_API_KEY ?? (() => getAppConfig().firebase.apiKey)();

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
function getAppConfig(): AppConfiguration {
    if (!cachedAppConfig) {
        try {
            const builtConfig = buildAppConfiguration();
            const config = getConfig();

            // Skip validation in development since we're using dummy values
            if (config.isProduction) {
                // Validate in production
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

export function getTenantAwareAppConfig(tenant?: TenantConfig): AppConfiguration {
    const baseConfig = getAppConfig();

    if (!tenant) {
        return baseConfig;
    }

    return {
        ...baseConfig,
        tenant,
    };
}
