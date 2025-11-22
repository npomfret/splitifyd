import { describe, expect, it } from 'vitest';

import { StubAuthService } from './StubAuthService';
import { toEmail } from "@billsplit-wl/shared";

describe('StubAuthService.verifyPassword', () => {
    const anEmail = toEmail('user@example.com');

    it('returns true for the default seeded password', async () => {
        const auth = new StubAuthService();
        auth.setUser('user-1', {uid: 'user-1', email: anEmail});

        await expect(auth.verifyPassword(anEmail, 'ValidPass123!')).resolves.toBe(true);
    });

    it('returns false when the password does not match', async () => {
        const auth = new StubAuthService();
        auth.setUser('user-1', {uid: 'user-1', email: anEmail});

        await expect(auth.verifyPassword(anEmail, 'WrongPassword!')).resolves.toBe(false);
    });

    it('returns false when the email is not recognised', async () => {
        const auth = new StubAuthService();
        auth.setUser('user-1', {uid: 'user-1', email: anEmail});

        await expect(auth.verifyPassword(toEmail('missing@example.com'), 'ValidPass123!')).resolves.toBe(false);
    });

    it('reflects password updates applied through updateUser', async () => {
        const auth = new StubAuthService();
        auth.setUser('user-1', {uid: 'user-1', email: anEmail});

        await auth.updateUser('user-1', {password: 'NewSecret123!'});

        await expect(auth.verifyPassword(anEmail, 'ValidPass123!')).resolves.toBe(false);
        await expect(auth.verifyPassword(anEmail, 'NewSecret123!')).resolves.toBe(true);
    });
});
