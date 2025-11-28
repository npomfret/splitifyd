import {z} from 'zod';
import {logger} from '../logger';

/**
 * Configuration for MergeService and related cloud infrastructure
 */
export interface ServiceConfig {
    /**
     * Google Cloud Project ID for Cloud Tasks
     */
    projectId: string;
    /**
     * Cloud Tasks location/region
     */
    cloudTasksLocation: string;
    /**
     * Base URL for Cloud Functions
     */
    functionsUrl: string;
    /**
     * Minimum duration for user registration operations in milliseconds
     */
    minRegistrationDurationMs: number;
    /**
     * Storage emulator host (e.g., "localhost:9199"), or null for production
     */
    storageEmulatorHost: string | null;
    /**
     * Service account email for Cloud Tasks OIDC authentication
     * Defaults to the project's default App Engine service account
     */
    cloudTasksServiceAccount: string;
}

// Cache for lazy-loaded service configuration
let cachedServiceConfig: ServiceConfig | null = null;
let cachedEnv: z.infer<typeof serviceEnvSchema> | null = null;

/**
 * Check if running in Firebase emulator
 */
function isEmulator(): boolean {
    return process.env.FUNCTIONS_EMULATOR === 'true';
}

function isRealFirebase(): boolean {
    return process.env.GAE_RUNTIME !== undefined;
}


// Define environment variable schema for service config
// All required fields must be explicitly set in .env files - no defaults
// Custom env vars use __ prefix to distinguish from Firebase-provided vars
const serviceEnvSchema = z.object({
    GCLOUD_PROJECT: z.string().min(1, 'GCLOUD_PROJECT is required').optional(), // Can be inferred from FIREBASE_CONFIG
    __CLOUD_TASKS_LOCATION: z.string().min(1, '__CLOUD_TASKS_LOCATION is required'),
    __CLOUD_TASKS_SERVICE_ACCOUNT: z.string().optional(), // Defaults to project's default App Engine service account
    __FUNCTIONS_URL: z.string().min(1, '__FUNCTIONS_URL is required'),
    __MIN_REGISTRATION_DURATION_MS: z.coerce.number().min(0, '__MIN_REGISTRATION_DURATION_MS must be non-negative'),
    __INSTANCE_NAME: z.string().min(1, '__INSTANCE_NAME is required'),
    FUNCTIONS_EMULATOR: z.string().optional(),
    FIREBASE_CONFIG: z.string().optional(),
    FIREBASE_STORAGE_EMULATOR_HOST: z.string().optional(),
});

/**
 * Lazy environment variable loader for service config
 */
function getServiceEnv(): z.infer<typeof serviceEnvSchema> {
    if (cachedEnv) return cachedEnv;

    try {
        cachedEnv = serviceEnvSchema.parse(process.env);
        return cachedEnv;
    } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error('Invalid service configuration environment variables', errorObj);

        if (error instanceof z.ZodError) {
            const errorMessages = error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new Error(`Service configuration validation failed: ${errorMessages}`);
        }
        throw new Error(`Service configuration validation failed: ${errorObj.message}`);
    }
}

function inferProjectId() {
    // FIREBASE_CONFIG is an env var provided to us, it looks like: {"projectId":"splitifyd","storageBucket":"splitifyd.firebasestorage.app"}
    const config = JSON.parse(process.env.FIREBASE_CONFIG!);
    const projectId = config.projectId;
    return projectId;
}

/**
 * Build ServiceConfig from environment variables
 */
function buildServiceConfig(): ServiceConfig {
    const env = getServiceEnv();

    if (process.env.FUNCTIONS_CONTROL_API) {
        // this is deployment
        return {
            projectId: inferProjectId(),
            cloudTasksLocation: "foo",
            cloudTasksServiceAccount: "foo",
            functionsUrl: "foo",
            minRegistrationDurationMs: -1,
            storageEmulatorHost: "foo",
        };
    } else if (isRealFirebase()) {
        const requiredVars = [
            'GCLOUD_PROJECT',
            '__CLOUD_TASKS_LOCATION',
            '__FUNCTIONS_URL',
            '__CLOUD_TASKS_SERVICE_ACCOUNT',
            '__MIN_REGISTRATION_DURATION_MS'
        ];
        const missing = requiredVars.filter((key) => env[key as keyof typeof env] === undefined);

        if (missing.length > 0) {
            throw new Error(`Missing required service configuration in production: ${missing.join(', ')}`);
        }

        return {
            projectId: inferProjectId(),
            cloudTasksLocation: env.__CLOUD_TASKS_LOCATION!,
            cloudTasksServiceAccount: env.__CLOUD_TASKS_SERVICE_ACCOUNT!,
            functionsUrl: env.__FUNCTIONS_URL!,
            minRegistrationDurationMs: env.__MIN_REGISTRATION_DURATION_MS!,
            storageEmulatorHost: null,
        };
    } else if (isEmulator()) {
        const requiredVars = [
            'FIREBASE_CONFIG',
            '__MIN_REGISTRATION_DURATION_MS'
        ];
        const missing = requiredVars.filter((key) => env[key as keyof typeof env] === undefined);

        if (missing.length > 0) {
            // console.log(JSON.stringify(process.env, null, 2))
            throw new Error(`Missing required service configuration in production: ${missing.join(', ')}`);
        }

        return {
            projectId: inferProjectId(),
            cloudTasksLocation: env.__CLOUD_TASKS_LOCATION,
            cloudTasksServiceAccount: "foo",
            functionsUrl: env.__FUNCTIONS_URL,
            minRegistrationDurationMs: env.__MIN_REGISTRATION_DURATION_MS,
            storageEmulatorHost: env.FIREBASE_STORAGE_EMULATOR_HOST || null,
        };
    } else {
        throw Error("should not get here")
    }
}

/**
 * Get ServiceConfig with lazy loading and caching
 * Validates environment variables and throws if misconfigured
 */
export function getServiceConfig(): ServiceConfig {
    if (!cachedServiceConfig) {
        cachedServiceConfig = buildServiceConfig();
    }
    return cachedServiceConfig;
}
