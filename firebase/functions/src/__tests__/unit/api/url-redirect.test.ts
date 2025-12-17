import type { UserId } from '@billsplit-wl/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppDriver } from '../AppDriver';

/**
 * URL Redirect Resolution API Tests
 *
 * Tests the resolve-redirect endpoint's redirect-following logic.
 * Uses vi.spyOn to mock the fetch API for controlled redirect scenarios.
 */
describe('URL Redirect Resolution API', () => {
    let appDriver: AppDriver;
    let user: UserId;

    beforeEach(async () => {
        appDriver = new AppDriver();
        const { users } = await appDriver.createTestUsers({ count: 1 });
        [user] = users;
    });

    afterEach(() => {
        appDriver.dispose();
        vi.restoreAllMocks();
    });

    describe('POST /utils/resolve-redirect', () => {
        it('should require authentication', async () => {
            await expect(
                appDriver.resolveRedirect({ url: 'https://maps.app.goo.gl/abc123' }, '' as any),
            )
                .rejects
                .toMatchObject({ code: 'AUTH_REQUIRED' });
        });

        it('should reject invalid URL format', async () => {
            await expect(
                appDriver.resolveRedirect({ url: 'not-a-valid-url' }, user),
            )
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });

        it('should reject empty URL', async () => {
            await expect(
                appDriver.resolveRedirect({ url: '' }, user),
            )
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });

        it('should reject non-allowed domains', async () => {
            await expect(
                appDriver.resolveRedirect({ url: 'https://evil-site.com/redirect' }, user),
            )
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });

        it('should accept Google Maps short URLs and follow redirects', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                status: 200,
                headers: new Headers(),
            } as Response);

            const result = await appDriver.resolveRedirect(
                { url: 'https://maps.app.goo.gl/eLBgYkQZPoEweLnZ6' },
                user,
            );

            expect(result.resolvedUrl).toBeDefined();
        });

        it('should accept Google Maps full URLs', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                status: 200,
                headers: new Headers(),
            } as Response);

            const result = await appDriver.resolveRedirect(
                { url: 'https://www.google.com/maps/place/Eiffel+Tower' },
                user,
            );

            expect(result.resolvedUrl).toBeDefined();
        });

        it('should accept Apple Maps URLs', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                status: 200,
                headers: new Headers(),
            } as Response);

            const result = await appDriver.resolveRedirect(
                { url: 'https://maps.apple.com/?q=Eiffel+Tower' },
                user,
            );

            expect(result.resolvedUrl).toBeDefined();
        });

        it('should accept Waze URLs', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                status: 200,
                headers: new Headers(),
            } as Response);

            const result = await appDriver.resolveRedirect(
                { url: 'https://waze.com/ul?ll=48.858844,2.294351' },
                user,
            );

            expect(result.resolvedUrl).toBeDefined();
        });

        it('should follow a single redirect and return final URL', async () => {
            const finalUrl = 'https://www.google.com/maps/place/Eiffel+Tower/@48.8583701,2.2944813';

            vi
                .spyOn(global, 'fetch')
                .mockResolvedValueOnce({
                    status: 302,
                    headers: new Headers({ location: finalUrl }),
                } as Response)
                .mockResolvedValueOnce({
                    status: 200,
                    headers: new Headers(),
                } as Response);

            const result = await appDriver.resolveRedirect(
                { url: 'https://maps.app.goo.gl/eLBgYkQZPoEweLnZ6' },
                user,
            );

            expect(result.resolvedUrl).toBe(finalUrl);
        });

        it('should follow multiple redirects', async () => {
            const intermediateUrl = 'https://goo.gl/maps/abc123';
            const finalUrl = 'https://www.google.com/maps/place/Eiffel+Tower';

            vi
                .spyOn(global, 'fetch')
                .mockResolvedValueOnce({
                    status: 301,
                    headers: new Headers({ location: intermediateUrl }),
                } as Response)
                .mockResolvedValueOnce({
                    status: 302,
                    headers: new Headers({ location: finalUrl }),
                } as Response)
                .mockResolvedValueOnce({
                    status: 200,
                    headers: new Headers(),
                } as Response);

            const result = await appDriver.resolveRedirect(
                { url: 'https://maps.app.goo.gl/shortlink' },
                user,
            );

            expect(result.resolvedUrl).toBe(finalUrl);
        });

        it('should return original URL when no redirects occur', async () => {
            const originalUrl = 'https://www.google.com/maps/place/Eiffel+Tower';

            vi.spyOn(global, 'fetch').mockResolvedValue({
                status: 200,
                headers: new Headers(),
            } as Response);

            const result = await appDriver.resolveRedirect(
                { url: originalUrl },
                user,
            );

            expect(result.resolvedUrl).toBe(originalUrl);
        });

        it('should return original URL when fetch fails', async () => {
            const originalUrl = 'https://maps.app.goo.gl/eLBgYkQZPoEweLnZ6';

            vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

            const result = await appDriver.resolveRedirect(
                { url: originalUrl },
                user,
            );

            // Should return the original URL when fetch fails
            expect(result.resolvedUrl).toBe(originalUrl);
        });

        it('should handle redirect with relative location header', async () => {
            const baseUrl = 'https://maps.app.goo.gl/eLBgYkQZPoEweLnZ6';
            const relativePath = '/maps/place/Eiffel+Tower';

            vi
                .spyOn(global, 'fetch')
                .mockResolvedValueOnce({
                    status: 302,
                    headers: new Headers({ location: relativePath }),
                } as Response)
                .mockResolvedValueOnce({
                    status: 200,
                    headers: new Headers(),
                } as Response);

            const result = await appDriver.resolveRedirect(
                { url: baseUrl },
                user,
            );

            // Should resolve relative URL against base
            expect(result.resolvedUrl).toBe('https://maps.app.goo.gl/maps/place/Eiffel+Tower');
        });
    });
});
