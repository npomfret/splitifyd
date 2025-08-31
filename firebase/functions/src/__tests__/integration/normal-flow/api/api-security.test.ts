// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeAll, describe, expect, test } from 'vitest';

import { ApiDriver } from '@splitifyd/test-support';
import { FirebaseIntegrationTestUserPool } from '../../../support/FirebaseIntegrationTestUserPool';
import {firestoreDb} from "../../../../firebase";

describe('API Security & Headers', () => {
    let driver: ApiDriver;
    let userPool: FirebaseIntegrationTestUserPool;

    beforeAll(async () => {
        driver = new ApiDriver(firestoreDb);

        // Create user pool with 6 users (covers all test needs)
        userPool = new FirebaseIntegrationTestUserPool(driver, 6);
        await userPool.initialize();
    });

    test('should return proper CORS headers', async () => {
        const testOrigin = 'http://localhost:3000';
        const url = `${driver.getBaseUrl()}/health`;

        const response = await fetch(url, {
            method: 'OPTIONS',
            headers: {
                Origin: testOrigin,
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type,Authorization',
            },
        });

        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
        expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
        expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
    });

    test('should return security headers', async () => {
        const url = `${driver.getBaseUrl()}/health`;
        const response = await fetch(url);

        expect(response.status).toBe(200);
        expect(response.headers.get('X-Content-Type-Options')).toBeTruthy();
        expect(response.headers.get('X-Frame-Options')).toBeTruthy();
        expect(response.headers.get('X-XSS-Protection')).toBeTruthy();
    });
});