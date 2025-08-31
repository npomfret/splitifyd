import { beforeAll, describe, expect, test } from 'vitest';
import { ApiDriver, UserBuilder } from '@splitifyd/test-support';

describe('Firebase Auth Emulator Integration', () => {
    let driver: ApiDriver;

    beforeAll(() => {
        driver = new ApiDriver();
    });

    test('should be able to register a new user in the emulator', async () => {
        const newUser = new UserBuilder().build();
        const registeredUser = await driver.register(newUser);

        expect(registeredUser).toHaveProperty('user');
        expect(registeredUser.user).toHaveProperty('uid');
        expect(registeredUser.user).toHaveProperty('email', newUser.email);
    });
});
