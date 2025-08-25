import { z } from 'zod';
import { DOCUMENT_CONFIG, SYSTEM, VALIDATION_LIMITS } from './constants';
import { AppConfiguration, EnvironmentConfig, FirebaseConfig } from './shared/shared-types';
import { validateAppConfiguration } from './middleware/config-validation';
import { logger } from './logger';

// Cache for lazy-loaded configurations
let cachedConfig: ClientConfig | null = null;
let cachedAppConfig: AppConfiguration | null = null;
let cachedEnv: z.infer<typeof envSchema> | null = null;

// Define environment variable schema
const envSchema = z.object({
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
export interface ClientConfig {
    isProduction: boolean;
    isDevelopment: boolean;
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
        displayName: string;
        email: string;
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
    const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
    const isProduction = !isEmulator;

    // Validate required production variables
    if (isProduction) {
        const requiredVars = [
            'GCLOUD_PROJECT',
            'CLIENT_API_KEY',
            'CLIENT_AUTH_DOMAIN',
            'CLIENT_STORAGE_BUCKET',
            'CLIENT_MESSAGING_SENDER_ID',
            'CLIENT_APP_ID'
        ];

        const missing = requiredVars.filter((key) => !env[key as keyof typeof env]);
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
        }
    }

    return {
        isProduction,
        isDevelopment: isEmulator,
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
            displayName: isEmulator ? 'test' : '',
            email: env.DEV_FORM_EMAIL ?? '',
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

    if (!/127\.0\.0\.1:\d{4}/.test(firestoreHost)) {
        throw Error(`firestoreHost looks wrong: ${firestoreHost}`);
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

    const firebase: FirebaseConfig = config.isProduction ? {
              apiKey: env.CLIENT_API_KEY!,
              authDomain: env.CLIENT_AUTH_DOMAIN!,
              projectId,
              storageBucket: env.CLIENT_STORAGE_BUCKET!,
              messagingSenderId: env.CLIENT_MESSAGING_SENDER_ID!,
              appId: env.CLIENT_APP_ID!,
              measurementId: env.CLIENT_MEASUREMENT_ID,
          } : MINIMAL_EMULATOR_CLIENT_CONFIG;

    // Validate required fields in production
    if (config.isProduction && (!firebase.apiKey || !firebase.authDomain || !firebase.storageBucket || !firebase.messagingSenderId || !firebase.appId)) {
        logger.error('Firebase config is incomplete in production', new Error('Missing required Firebase config'), {
            hasApiKey: !!env.CLIENT_API_KEY,
            hasAuthDomain: !!env.CLIENT_AUTH_DOMAIN,
            nodeEnv: process.env.NODE_ENV,
            emulator: env.FUNCTIONS_EMULATOR,
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

// Export lazy getter for APP_CONFIG
export function getAppConfig(): AppConfiguration {
    if (!cachedAppConfig) {
        try {
            const builtConfig = buildAppConfiguration();
            const config = getConfig();

            // Skip validation in development since we're using dummy values
            if (config.isDevelopment) {
                cachedAppConfig = builtConfig;
            } else {
                // Validate in production
                cachedAppConfig = validateAppConfiguration(builtConfig);
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
