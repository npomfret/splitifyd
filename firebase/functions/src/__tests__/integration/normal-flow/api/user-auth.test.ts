// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeAll, describe, expect, test } from 'vitest';

import { ApiDriver, User } from '@splitifyd/test-support';
import { FirebaseIntegrationTestUserPool } from '../../../support/FirebaseIntegrationTestUserPool';
import {firestoreDb} from "../../../../firebase";

describe('User Authentication', () => {
    let driver: ApiDriver;
    let userPool: FirebaseIntegrationTestUserPool;

    // Helper to get users from pool
    const getTestUsers = (count: number): User[] => {
        return userPool.getUsers(count);
    };

    beforeAll(async () => {
        driver = new ApiDriver(firestoreDb);

        // Create user pool with 6 users (covers all test needs)
        userPool = new FirebaseIntegrationTestUserPool(driver, 6);
        await userPool.initialize();
    });

    test('should allow users to register and log in', () => {
        const users = getTestUsers(2);
        expect(users.length).toBe(2);
        users.forEach((user) => {
            expect(user.uid).toBeDefined();
            expect(user.token).toBeDefined();
            expect(user.email).toContain('@example.com');
        });
    });
});