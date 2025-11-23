import type {MergeServiceConfig} from '../../services/ComponentBuilder';

/**
 * Creates MergeServiceConfig for integration tests from environment variables.
 * Reads from .env file values or falls back to defaults.
 */
export function getIntegrationTestMergeConfig(): MergeServiceConfig {
    return {
        projectId: process.env.GCLOUD_PROJECT || 'test-project',
        cloudTasksLocation: process.env.CLOUD_TASKS_LOCATION || 'us-central1',
        functionsUrl: process.env.FUNCTIONS_URL || 'http://localhost:5001',
    };
}
