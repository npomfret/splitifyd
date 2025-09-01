import {describe, expect, test} from 'vitest';
import {ApiDriver, generateNewUserDetails} from "@splitifyd/test-support";

describe('Firebase Auth Emulator Integration', () => {

    const driver = new ApiDriver();

    test('should be able to register a new user in the emulator', async () => {
        const userData = generateNewUserDetails();
        const registeredUser = await driver.register(userData);

        expect(registeredUser).toHaveProperty('user');
        expect(registeredUser.user).toHaveProperty('uid');
        expect(registeredUser.user).toHaveProperty('email', userData.email);
    });
});
