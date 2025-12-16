import { z } from 'zod';
import { getEmulatorPorts, inferProjectId, isEmulator, isRealFirebase } from '../firebase';
import { logger } from '../logger';

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
     * Base URL for public storage access (emulator or production)
     */
    storagePublicBaseUrl: string;
    /**
     * Service account email for Cloud Tasks OIDC authentication
     * Defaults to the project's default App Engine service account
     */
    cloudTasksServiceAccount: string;
}

// Cache for lazy-loaded service configuration
let cachedServiceConfig: ServiceConfig | null = null;
let cachedEnv: z.infer<typeof serviceEnvSchema> | null = null;

// Define environment variable schema for service config
// All required fields must be explicitly set in .env files - no defaults
// Custom env vars use __ prefix to distinguish from Firebase-provided vars
const serviceEnvSchema = z.object({
    __CLOUD_TASKS_LOCATION: z.string().min(1, '__CLOUD_TASKS_LOCATION is required'),
    __CLOUD_TASKS_SERVICE_ACCOUNT: z.string().optional(), // Defaults to project's default App Engine service account
    __MIN_REGISTRATION_DURATION_MS: z.coerce.number().min(0, '__MIN_REGISTRATION_DURATION_MS must be non-negative'),
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

/**
 * Build ServiceConfig from environment variables
 */
function buildServiceConfig(): ServiceConfig {
    const env = getServiceEnv();

    if (process.env.FUNCTIONS_CONTROL_API) {
        // this is deployment
        return {
            projectId: inferProjectId(),
            cloudTasksLocation: 'foo',
            cloudTasksServiceAccount: 'foo',
            functionsUrl: 'foo',
            minRegistrationDurationMs: -1,
            storagePublicBaseUrl: 'https://firebasestorage.googleapis.com',
        };
    } else if (isRealFirebase()) {
        const requiredVars = [
            '__CLOUD_TASKS_LOCATION',
            '__CLOUD_TASKS_SERVICE_ACCOUNT',
            '__MIN_REGISTRATION_DURATION_MS',
        ];
        const missing = requiredVars.filter((key) => env[key as keyof typeof env] === undefined);

        if (missing.length > 0) {
            throw new Error(`Missing required service configuration in production: ${missing.join(', ')}`);
        }

        const projectId = inferProjectId();
        const cloudTasksLocation = env.__CLOUD_TASKS_LOCATION!;

        return {
            projectId,
            cloudTasksLocation,
            cloudTasksServiceAccount: env.__CLOUD_TASKS_SERVICE_ACCOUNT!,
            functionsUrl: `https://${cloudTasksLocation}-${projectId}.cloudfunctions.net`,
            minRegistrationDurationMs: env.__MIN_REGISTRATION_DURATION_MS!,
            storagePublicBaseUrl: 'https://firebasestorage.googleapis.com',
        };
    } else if (isEmulator()) {
        const requiredVars = [
            'FIREBASE_CONFIG',
            '__MIN_REGISTRATION_DURATION_MS',
            '__CLOUD_TASKS_LOCATION',
        ];
        const missing = requiredVars.filter((key) => env[key as keyof typeof env] === undefined);

        if (missing.length > 0) {
            throw new Error(`Missing required service configuration in emulator: ${missing.join(', ')}`);
        }

        const projectId = inferProjectId();
        const cloudTasksLocation = env.__CLOUD_TASKS_LOCATION;
        const functionsPort = getEmulatorPorts().functions;
        const functionsUrl = `http://localhost:${functionsPort}/${projectId}/${cloudTasksLocation}`;

        return {
            projectId,
            cloudTasksLocation,
            cloudTasksServiceAccount: 'foo',
            functionsUrl,
            minRegistrationDurationMs: env.__MIN_REGISTRATION_DURATION_MS,
            storagePublicBaseUrl: env.FIREBASE_STORAGE_EMULATOR_HOST
                ? `http://${env.FIREBASE_STORAGE_EMULATOR_HOST}`
                : 'https://firebasestorage.googleapis.com',
        };
    } else {
        throw Error('should not get here');
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
