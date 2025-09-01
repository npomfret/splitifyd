// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import {beforeEach, describe, expect, test} from 'vitest';
import {borrowTestUsers} from '@splitifyd/test-support';
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";

describe('User Authentication', () => {
    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(2);
    });

    const getTestUsers = (count: number): AuthenticatedFirebaseUser[] => {
        return users.slice(0, count);
    };

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