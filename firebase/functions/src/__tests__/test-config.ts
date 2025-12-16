import { ServiceConfig } from '../merge/ServiceConfig';

/**
 * Creates a default test configuration for unit tests.
 * Used in unit tests to avoid duplicating config setup and to bypass
 * environment variable requirements.
 */
export function createUnitTestServiceConfig(): ServiceConfig {
    return {
        projectId: 'test-project',
        cloudTasksLocation: 'us-central1',
        cloudTasksServiceAccount: 'test-project@appspot.gserviceaccount.com',
        functionsUrl: 'http://foo/test-project/us-central1',
        minRegistrationDurationMs: 0,
        storagePublicBaseUrl: 'https://firebasestorage.googleapis.com',
    };
}
