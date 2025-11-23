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
}

// Cache for lazy-loaded service configuration
let cachedServiceConfig: ServiceConfig | null = null;
let cachedEnv: z.infer<typeof serviceEnvSchema> | null = null;

// Define environment variable schema for service config
const serviceEnvSchema = z.object({
    GCLOUD_PROJECT: z.string().min(1, 'GCLOUD_PROJECT is required'),
    CLOUD_TASKS_LOCATION: z.string().min(1, 'CLOUD_TASKS_LOCATION is required'),
    FUNCTIONS_URL: z.string().min(1, 'FUNCTIONS_URL is required'),
    INSTANCE_NAME: z.string().optional().default('prod'),
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
    const isProduction = env.INSTANCE_NAME === 'prod';// todo: this is wrong - it should detect if or not this is running in "real" firebase

    // In production, all variables must be properly set
    if (isProduction) {
        const requiredVars = ['GCLOUD_PROJECT', 'CLOUD_TASKS_LOCATION', 'FUNCTIONS_URL'];
        const missing = requiredVars.filter((key) => !env[key as keyof typeof env]);

        if (missing.length > 0) {
            throw new Error(`Missing required service configuration in production: ${missing.join(', ')}`);
        }
    }

    return {
        projectId: env.GCLOUD_PROJECT,
        cloudTasksLocation: env.CLOUD_TASKS_LOCATION,
        functionsUrl: env.FUNCTIONS_URL,
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