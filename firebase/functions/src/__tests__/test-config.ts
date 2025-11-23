import {ServiceConfig, getServiceConfig} from '../merge/ServiceConfig';

/**
 * Creates a default test configuration for unit tests.
 * Used in unit tests to avoid duplicating config setup and to bypass
 * environment variable requirements.
 */
export function createUnitTestServiceConfig(): ServiceConfig {
    return {
        projectId: 'test-project',
        cloudTasksLocation: 'location',
        functionsUrl: 'http://foo:9999',
    };
}