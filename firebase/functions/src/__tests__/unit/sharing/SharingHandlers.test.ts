import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs and path before importing SharingHandlers
vi.mock('fs');
vi.mock('path');

// Import after mocking
import type { TenantRegistryService } from '../../../services/tenant/TenantRegistryService';
import { SharingHandlers } from '../../../sharing/SharingHandlers';

describe('SharingHandlers', () => {
    const mockTemplate = `<!DOCTYPE html>
<html>
<head>
    <title>Test</title>
</head>
<body></body>
</html>`;

    const mockTranslations = {
        sharing: {
            ogDescription: 'Test description for sharing',
            joinTitle: 'Join a group on {{appName}}',
        },
    };

    const createMockTenantRegistry = (tenantConfig: object): TenantRegistryService => ({
        resolveTenant: vi.fn().mockResolvedValue({
            config: tenantConfig,
        }),
    } as unknown as TenantRegistryService);

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock fs.existsSync to return true for template and translations
        vi.mocked(fs.existsSync).mockReturnValue(true);

        // Mock fs.readFileSync to return appropriate content
        vi.mocked(fs.readFileSync).mockImplementation((filePath: fs.PathOrFileDescriptor) => {
            const pathStr = String(filePath);
            if (pathStr.includes('translation.json')) {
                return JSON.stringify(mockTranslations);
            }
            return mockTemplate;
        });

        // Mock path.join and path.resolve to return predictable paths
        vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
        vi.mocked(path.resolve).mockImplementation((...args) => args.join('/'));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('HTML escaping', () => {
        it('should escape HTML special characters in tenant appName', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: '<script>alert("xss")</script>' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            expect(html).toContain('&lt;script&gt;');
            expect(html).not.toContain('<script>alert');
        });

        it('should escape double quotes in tenant values', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'Test "Quoted" App' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            expect(html).toContain('&quot;');
            expect(html).not.toContain('content="Test "Quoted"');
        });

        it('should escape ampersands in tenant values', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'Ben & Jerry\'s Splits' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            expect(html).toContain('&amp;');
        });
    });

    describe('OG tag generation', () => {
        it('should include all required OG meta tags', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            expect(html).toContain('og:title');
            expect(html).toContain('og:description');
            expect(html).toContain('og:image');
            expect(html).toContain('og:url');
            expect(html).toContain('og:type');
            expect(html).toContain('og:site_name');
        });

        it('should include Twitter Card meta tags', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            expect(html).toContain('twitter:card');
            expect(html).toContain('twitter:title');
            expect(html).toContain('twitter:description');
            expect(html).toContain('twitter:image');
        });

        it('should use translated description', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            expect(html).toContain('Test description for sharing');
        });

        it('should interpolate appName in join title', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'MyBillApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            expect(html).toContain('Join a group on MyBillApp');
        });
    });

    describe('Image fallback chain', () => {
        it('should use tenant ogImage when available', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                        sharing: { ogImage: 'https://example.com/og-image.png' },
                        assets: { logoUrl: 'https://example.com/logo.png' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            expect(html).toContain('https://example.com/og-image.png');
        });

        it('should fall back to logoUrl when ogImage not set', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                        assets: { logoUrl: 'https://example.com/logo.png' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            expect(html).toContain('https://example.com/logo.png');
        });

        it('should use empty image when no tenant images set', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            // When no tenant logo is set, image should be empty (will 404, but tenants always have logos)
            expect(html).toContain('og:image" content=""');
        });
    });

    describe('Response headers', () => {
        it('should set Content-Type to text/html', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            expect(res.headers['Content-Type']).toBe('text/html; charset=utf-8');
        });

        it('should set Vary: Host header for CDN caching', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            expect(res.headers['Vary']).toBe('Host');
        });

        it('should set Cache-Control header', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            expect(res.headers['Cache-Control']).toBe('public, max-age=300');
        });
    });

    describe('Canonical URL', () => {
        it('should build canonical URL from host and path', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join', { host: 'myapp.example.com' });
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            expect(html).toContain('https://myapp.example.com/join');
        });

        it('should include query params in canonical URL', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join?shareToken=abc123', { host: 'myapp.example.com' });
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            expect(html).toContain('https://myapp.example.com/join?shareToken=abc123');
        });

        it('should prefer x-forwarded-host header', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join', {
                host: 'internal.host',
                'x-forwarded-host': 'public.example.com',
            });
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            expect(html).toContain('https://public.example.com/join');
        });
    });

    describe('Route-specific titles', () => {
        it('should use join title for /join route', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            expect(html).toContain('Join a group on TestApp');
        });

        it('should use appName for default route', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/other-page');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            // Default route should just use appName
            expect(html).toMatch(/og:title.*content="TestApp"/);
        });
    });

    describe('Language detection', () => {
        it('should use English translations by default (no lang param)', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join?shareToken=abc123');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            // English translation
            expect(html).toContain('Join a group on TestApp');
        });

        it('should use German translations when lang=de', async () => {
            // Mock German translations
            vi.mocked(fs.readFileSync).mockImplementation((filePath: fs.PathOrFileDescriptor) => {
                const pathStr = String(filePath);
                if (pathStr.includes('/de/translation.json')) {
                    return JSON.stringify({
                        sharing: {
                            ogDescription: 'Teilen Sie Ausgaben einfach mit Freunden und Familie',
                            joinTitle: 'Einer Gruppe auf {{appName}} beitreten',
                        },
                    });
                }
                if (pathStr.includes('translation.json')) {
                    return JSON.stringify(mockTranslations);
                }
                return mockTemplate;
            });

            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join?shareToken=abc123&lang=de');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            // German translations
            expect(html).toContain('Einer Gruppe auf TestApp beitreten');
            expect(html).toContain('Teilen Sie Ausgaben einfach mit Freunden und Familie');
        });

        it('should fall back to English for unsupported language', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join?shareToken=abc123&lang=xyz');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            // Should fall back to English
            expect(html).toContain('Join a group on TestApp');
        });

        it('should handle Spanish translations when lang=es', async () => {
            // Mock Spanish translations
            vi.mocked(fs.readFileSync).mockImplementation((filePath: fs.PathOrFileDescriptor) => {
                const pathStr = String(filePath);
                if (pathStr.includes('/es/translation.json')) {
                    return JSON.stringify({
                        sharing: {
                            ogDescription: 'Divide gastos fácilmente con amigos y familiares',
                            joinTitle: 'Únete a un grupo en {{appName}}',
                        },
                    });
                }
                if (pathStr.includes('translation.json')) {
                    return JSON.stringify(mockTranslations);
                }
                return mockTemplate;
            });

            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'MiApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join?shareToken=abc123&lang=es');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            // Spanish translations
            expect(html).toContain('Únete a un grupo en MiApp');
            expect(html).toContain('Divide gastos fácilmente con amigos y familiares');
        });
    });

    describe('Fallback behavior', () => {
        it('should use fallback appName when not in tenant config', async () => {
            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {},
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            expect(html).toContain('BillSplit');
        });

        it('should use fallback translations when file not found', async () => {
            // Make translation file not exist
            vi.mocked(fs.existsSync).mockImplementation((filePath: fs.PathLike) => {
                const pathStr = String(filePath);
                if (pathStr.includes('translation.json')) {
                    return false;
                }
                return true;
            });

            const tenantRegistry = createMockTenantRegistry({
                brandingTokens: {
                    tokens: {
                        legal: { appName: 'TestApp' },
                    },
                },
            });

            const handlers = new SharingHandlers(tenantRegistry);
            const req = createMockRequest('/join');
            const res = createMockResponse();

            await handlers.serveShareablePage(req, res, vi.fn());

            const html = res.sendData;
            // Should contain fallback description
            expect(html).toContain('Split expenses easily with friends and family');
        });
    });
});

// Helper functions to create mock request/response objects

function createMockRequest(originalUrl: string, headers: Record<string, string> = {}): any {
    const defaultHost = 'localhost';
    const [pathPart, queryString] = originalUrl.split('?');
    const query: Record<string, string> = {};

    if (queryString) {
        queryString.split('&').forEach((pair) => {
            const [key, value] = pair.split('=');
            if (key) {
                query[key] = value ?? '';
            }
        });
    }

    return {
        path: pathPart,
        originalUrl,
        protocol: 'https',
        hostname: headers['host'] ?? defaultHost,
        query,
        headers: {
            host: headers['host'] ?? defaultHost,
            ...headers,
        },
    };
}

function createMockResponse(): any {
    const res: any = {
        headers: {} as Record<string, string>,
        statusCode: 200,
        sendData: '',
        setHeader(name: string, value: string) {
            this.headers[name] = value;
            return this;
        },
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        send(data: string) {
            this.sendData = data;
            return this;
        },
    };
    return res;
}
