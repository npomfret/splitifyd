// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import {describe, expect, test} from 'vitest';
import { ApiDriver } from '@splitifyd/test-support';

describe('API Security & Headers', () => {
    const apiDriver = new ApiDriver();

    test('should return proper CORS headers', async () => {
        const url = `${apiDriver.getBaseUrl()}/health`;

        const response = await fetch(url, {
            method: 'OPTIONS',
            headers: {
                Origin: 'http://localhost:3000',
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
        const url = `${apiDriver.getBaseUrl()}/health`;
        const response = await fetch(url);

        expect(response.status).toBe(200);
        expect(response.headers.get('X-Content-Type-Options')).toBeTruthy();
        expect(response.headers.get('X-Frame-Options')).toBeTruthy();
        expect(response.headers.get('X-XSS-Protection')).toBeTruthy();
    });
});