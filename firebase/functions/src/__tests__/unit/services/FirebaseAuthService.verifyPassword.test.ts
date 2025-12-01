import type { Auth } from 'firebase-admin/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toEmail } from '@billsplit-wl/shared';
import { FirebaseAuthService } from '../../../services/auth';
import { ApiError } from '../../../errors';

const noopAuth = {} as unknown as Auth;

type IdentityToolkitConfig = {
    apiKey: string;
    baseUrl: string;
};

function createService(overrides: Partial<IdentityToolkitConfig> = {}) {
    const identityToolkit: IdentityToolkitConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'https://identitytoolkit.googleapis.com',
        ...overrides,
    };

    return new FirebaseAuthService(noopAuth, identityToolkit, true, false);
}

describe('FirebaseAuthService.verifyPassword', () => {
    const envSnapshot: Partial<NodeJS.ProcessEnv> = {};

    beforeEach(() => {
        vi.restoreAllMocks();
        envSnapshot.__CLIENT_API_KEY = process.env.__CLIENT_API_KEY;
        envSnapshot.FIREBASE_AUTH_API_KEY = process.env.FIREBASE_AUTH_API_KEY;
        envSnapshot.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST;
        delete process.env.__CLIENT_API_KEY;
        delete process.env.FIREBASE_AUTH_API_KEY;
        delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        if (envSnapshot.__CLIENT_API_KEY !== undefined) {
            process.env.__CLIENT_API_KEY = envSnapshot.__CLIENT_API_KEY;
        } else {
            delete process.env.__CLIENT_API_KEY;
        }

        if (envSnapshot.FIREBASE_AUTH_API_KEY !== undefined) {
            process.env.FIREBASE_AUTH_API_KEY = envSnapshot.FIREBASE_AUTH_API_KEY;
        } else {
            delete process.env.FIREBASE_AUTH_API_KEY;
        }

        if (envSnapshot.FIREBASE_AUTH_EMULATOR_HOST !== undefined) {
            process.env.FIREBASE_AUTH_EMULATOR_HOST = envSnapshot.FIREBASE_AUTH_EMULATOR_HOST;
        } else {
            delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
        }
    });

    it('returns true when credentials are valid', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 }));
        const service = createService();

        const result = await service.verifyPassword(toEmail('user@example.com'), 'Secret123!');

        expect(result).toBe(true);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const callArgs = fetchSpy.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit | undefined];
        const requestUrl = callArgs[0];
        const init = callArgs[1] ?? {};

        expect(requestUrl).toBe('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test-api-key');
        expect(init.method).toBe('POST');
        expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
        expect(JSON.parse((init.body ?? '{}') as string)).toEqual({
            email: 'user@example.com',
            password: 'Secret123!',
            returnSecureToken: false,
        });

        fetchSpy.mockRestore();
    });

    it('returns false when password is invalid', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ error: { message: 'INVALID_PASSWORD' } }), { status: 400 }));
        const service = createService();

        const result = await service.verifyPassword(toEmail('user@example.com'), 'WrongPassword!');

        expect(result).toBe(false);
        fetchSpy.mockRestore();
    });

    it('returns false when email is not found', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ error: { message: 'EMAIL_NOT_FOUND' } }), { status: 400 }));
        const service = createService();

        const result = await service.verifyPassword(toEmail('missing@example.com'), 'Whatever123!');

        expect(result).toBe(false);
        fetchSpy.mockRestore();
    });

    it('throws an ApiError when requests are rate limited', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ error: { message: 'TOO_MANY_ATTEMPTS_TRY_LATER' } }), { status: 400 }));
        const service = createService();

        await expect(service.verifyPassword(toEmail('user@example.com'), 'Secret123!')).rejects.toMatchObject({
            code: 'RATE_LIMITED',
            statusCode: 429,
        });

        fetchSpy.mockRestore();
    });

    it('throws an ApiError when the Identity Toolkit API is unreachable', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
            throw new Error('ECONNREFUSED');
        });
        const service = createService();

        await expect(service.verifyPassword(toEmail('user@example.com'), 'Secret123!')).rejects.toMatchObject({
            code: 'UNAVAILABLE',
            statusCode: 503,
        });

        fetchSpy.mockRestore();
    });

    it('falls back to emulator base URL when FIREBASE_AUTH_EMULATOR_HOST is set', async () => {
        process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 }));
        const service = createService({ baseUrl: 'http://127.0.0.1:9099/identitytoolkit.googleapis.com' });

        await service.verifyPassword(toEmail('user@example.com'), 'Secret123!');

        const callArgs = fetchSpy.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit | undefined];
        expect(callArgs[0]).toBe('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test-api-key');

        fetchSpy.mockRestore();
    });

    it('throws a configuration error when no API key can be resolved', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
            throw new Error('fetch should not be called when API key is missing');
        });
        const service = new FirebaseAuthService(noopAuth, { baseUrl: 'https://identitytoolkit.googleapis.com', apiKey: '' }, true, false);

        const error = await service.verifyPassword(toEmail('user@example.com'), 'Secret123!').catch((err) => err);

        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ code: 'SERVICE_ERROR' });
        expect(fetchSpy).not.toHaveBeenCalled();

        fetchSpy.mockRestore();
    });
});
