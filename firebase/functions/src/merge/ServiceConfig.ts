import { z } from 'zod';
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

/**
 * Get project ID from FIREBASE_CONFIG or GCLOUD_PROJECT
 */
function getProjectId(): string {
    if (process.env.GCLOUD_PROJECT) {
        return process.env.GCLOUD_PROJECT;
    }

    if (process.env.FIREBASE_CONFIG) {
        try {
            const config = JSON.parse(process.env.FIREBASE_CONFIG);
            if (config.projectId) {
                return config.projectId;
            }
        } catch (e) {
            // Ignore parse errors, will be caught by validation
        }
    }

    throw new Error('Unable to determine project ID from GCLOUD_PROJECT or FIREBASE_CONFIG');
}

// Define environment variable schema for service config
// In emulator mode, some fields can be inferred and are optional
const serviceEnvSchema = z.object({
    GCLOUD_PROJECT: z.string().min(1, 'GCLOUD_PROJECT is required').optional(),
    CLOUD_TASKS_LOCATION: z.string().min(1, 'CLOUD_TASKS_LOCATION is required').optional(),
    FUNCTIONS_URL: z.string().min(1, 'FUNCTIONS_URL is required').optional(),
    MIN_REGISTRATION_DURATION_MS: z.coerce.number().min(0, 'MIN_REGISTRATION_DURATION_MS must be non-negative'),
    INSTANCE_NAME: z.string().optional().default('prod'),
    FUNCTIONS_EMULATOR: z.string().optional(),
    FIREBASE_CONFIG: z.string().optional(),
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
            // console.log(JSON.stringify(process.env, null, 2))
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
    const inEmulator = isEmulator();

    // Get project ID (can be inferred from FIREBASE_CONFIG in emulator)
    const projectId = env.GCLOUD_PROJECT || getProjectId();

    // In production (not emulator), all variables must be properly set
    if (!inEmulator) {
        const requiredVars = ['CLOUD_TASKS_LOCATION', 'FUNCTIONS_URL'];
        const missing = requiredVars.filter((key) => !env[key as keyof typeof env]);

        if (missing.length > 0) {
            throw new Error(`Missing required service configuration in production: ${missing.join(', ')}`);
        }

        return {
            projectId,
            cloudTasksLocation: env.CLOUD_TASKS_LOCATION!,
            functionsUrl: env.FUNCTIONS_URL!,
            minRegistrationDurationMs: env.MIN_REGISTRATION_DURATION_MS,
        };
    }

    // In emulator mode, provide sensible defaults
    const cloudTasksLocation = env.CLOUD_TASKS_LOCATION || 'us-central1'; // Default region from firebase.json
    const functionsUrl = env.FUNCTIONS_URL || 'http://localhost:6003'; // Default emulator functions port

    return {
        projectId,
        cloudTasksLocation,
        functionsUrl,
        minRegistrationDurationMs: env.MIN_REGISTRATION_DURATION_MS,
    };
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