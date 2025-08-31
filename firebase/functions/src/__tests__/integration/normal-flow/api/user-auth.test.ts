// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeAll, describe, expect, test } from 'vitest';

import {  User, borrowTestUsers } from '@splitifyd/test-support';

describe('User Authentication', () => {
    let allUsers: User[] = [];

    // Helper to get users from pool
    const getTestUsers = (count: number): User[] => {
        return allUsers.slice(0, count);
    };

    beforeAll(async () => {
        ({users: allUsers } = await borrowTestUsers(6));
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