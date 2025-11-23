import {ServiceConfig} from '../services/ComponentBuilder';

/**
 * Creates ServiceConfig for integration tests from environment variables.
 * Reads from .env file values or falls back to defaults.
 */
export function getIntegrationTestServiceConfig(): ServiceConfig {
    return {
        projectId: process.env.GCLOUD_PROJECT || 'test-project',
        cloudTasksLocation: process.env.CLOUD_TASKS_LOCATION || 'us-central1',
        functionsUrl: process.env.FUNCTIONS_URL!,
    };
}

/**
 * Creates a default test configuration for MergeService
 * Used in unit tests to avoid duplicating config setup
 */
export function createUnitTestServiceConfig(): ServiceConfig {
    return {
        projectId: 'test-project',
        cloudTasksLocation: 'us-central1',
        functionsUrl: 'http://foo:999999',
    };
}