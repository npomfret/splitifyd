import { ApiSerializer } from '@splitifyd/shared';
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getApiAppForTesting } from '../../index';

const deserialize = <T>(payload: string): T => ApiSerializer.deserialize<T>(payload);

describe('Public endpoints', () => {
    const app = getApiAppForTesting();
    let server: Server | null = null;
    let baseUrl: string;

    beforeAll(async () => {
        server = createServer(app);

        await new Promise<void>((resolve, reject) => {
            const onError = (error: Error) => {
                server?.off('error', onError);
                reject(error);
            };

            server!.listen(0, '127.0.0.1', () => {
                server?.off('error', onError);
                const address = server?.address();
                if (!address || typeof address === 'string') {
                    reject(new Error('Server did not provide address information'));
                    return;
                }
                baseUrl = `http://${address.address}:${address.port}`;
                resolve();
            });

            server!.on('error', onError);
        });
    });

    afterAll(async () => {
        if (!server) return;
        await new Promise<void>((resolve, reject) => {
            server!.close((error) => (error ? reject(error) : resolve()));
        });
        server = null;
    });

    it('GET /health responds with service status', async () => {
        const response = await fetch(`${baseUrl}/health`);

        expect(response.status).toBe(200);

        const body = deserialize<Record<string, unknown>>(await response.text());
        expect(body).toHaveProperty('timestamp');
        expect(body).toHaveProperty('checks');
    });

    it('HEAD /health responds with 200 and empty body', async () => {
        const response = await fetch(`${baseUrl}/health`, { method: 'HEAD' });

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toBe('');
    });

    it('GET /config returns default tenant when host does not match any tenant', async () => {
        const response = await fetch(`${baseUrl}/config`, {
            headers: { Host: 'nonexistent-host.example.com' },
        });

        // Should succeed with default tenant fallback
        expect(response.status).toBe(200);

        const config = deserialize<{ tenant?: { tenantId: string; }; firebase: Record<string, unknown>; }>(await response.text());
        expect(config).toHaveProperty('firebase');
        expect(config).toHaveProperty('tenant');
        expect(config.tenant).toHaveProperty('tenantId', 'default-tenant');
    });

    it('GET /policies/:id/current is accessible without tenant headers', async () => {
        const response = await fetch(`${baseUrl}/policies/terms-of-service/current`);

        expect([200, 404]).toContain(response.status);
    });
});
