import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../apiClient';

// Mock browser-logger
vi.mock('../../utils/browser-logger', () => ({
    logApiRequest: vi.fn(),
    logApiResponse: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
}));

// Mock window.API_BASE_URL
Object.defineProperty(window, 'API_BASE_URL', {
    value: 'http://localhost:5001/test-project/us-central1',
    writable: true,
});

// Mock localStorage for auth token
const mockLocalStorage = {
    getItem: vi.fn(() => 'mock-auth-token'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
});

describe('ApiClient Interceptors', () => {
    let apiClient: ApiClient;
    let fetchMock: any;

    beforeEach(() => {
        apiClient = new ApiClient();

        // Mock fetch
        fetchMock = vi.fn();
        global.fetch = fetchMock;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Request Interceptors', () => {
        it('applies request interceptors in order', async () => {
            const interceptor1 = vi.fn(async (config) => ({
                ...config,
                headers: { ...config.headers, 'X-Interceptor-1': 'applied' },
            }));

            const interceptor2 = vi.fn(async (config) => ({
                ...config,
                headers: { ...config.headers, 'X-Interceptor-2': 'applied' },
            }));

            // Mock successful response
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true }),
            });

            // Add interceptors
            const remove1 = apiClient.addRequestInterceptor(interceptor1);
            const remove2 = apiClient.addRequestInterceptor(interceptor2);

            try {
                await apiClient.request({
                    endpoint: '/test',
                    method: 'GET',
                });

                // Verify interceptors were called
                expect(interceptor1).toHaveBeenCalledTimes(1);
                expect(interceptor2).toHaveBeenCalledTimes(1);

                // Verify interceptor1 was called first
                const config1 = interceptor1.mock.calls[0][0];
                expect(config1.endpoint).toBe('/test');
                expect(config1.method).toBe('GET');

                // Verify interceptor2 received output from interceptor1
                const config2 = interceptor2.mock.calls[0][0];
                expect(config2.headers).toEqual(expect.objectContaining({ 'X-Interceptor-1': 'applied' }));

                // Verify final request includes both interceptor modifications
                expect(fetchMock).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'X-Interceptor-1': 'applied',
                            'X-Interceptor-2': 'applied',
                        }),
                    }),
                );
            } finally {
                remove1();
                remove2();
            }
        });

        it('allows interceptors to modify request endpoint and method', async () => {
            const interceptor = vi.fn(async (config) => ({
                ...config,
                endpoint: '/modified-endpoint',
                method: 'POST' as const,
            }));

            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true }),
            });

            const remove = apiClient.addRequestInterceptor(interceptor);

            try {
                await apiClient.request({
                    endpoint: '/original',
                    method: 'GET',
                });

                expect(interceptor).toHaveBeenCalledWith(
                    expect.objectContaining({
                        endpoint: '/original',
                        method: 'GET',
                    }),
                );

                // Verify the modified endpoint was used in fetch
                expect(fetchMock).toHaveBeenCalledWith(
                    expect.stringContaining('/modified-endpoint'),
                    expect.objectContaining({
                        method: 'POST',
                    }),
                );
            } finally {
                remove();
            }
        });

        it('allows interceptors to add authentication headers', async () => {
            const authInterceptor = vi.fn(async (config) => ({
                ...config,
                headers: {
                    ...config.headers,
                    'Custom-Auth': 'Bearer custom-token',
                },
            }));

            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true }),
            });

            const remove = apiClient.addRequestInterceptor(authInterceptor);

            try {
                await apiClient.request({
                    endpoint: '/protected',
                    method: 'GET',
                });

                expect(fetchMock).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'Custom-Auth': 'Bearer custom-token',
                        }),
                    }),
                );
            } finally {
                remove();
            }
        });
    });

    describe('Response Interceptors', () => {
        it('applies response interceptors in order', async () => {
            const mockResponse = { data: 'original' };

            const interceptor1 = vi.fn(async (response, _) => ({
                ...response,
                interceptor1: 'applied',
            }));

            const interceptor2 = vi.fn(async (response, _) => ({
                ...response,
                interceptor2: 'applied',
            }));

            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
            });

            // Add interceptors
            const remove1 = apiClient.addResponseInterceptor(interceptor1);
            const remove2 = apiClient.addResponseInterceptor(interceptor2);

            try {
                const result = await apiClient.request({
                    endpoint: '/test',
                    method: 'GET',
                });

                // Verify interceptors were called
                expect(interceptor1).toHaveBeenCalledTimes(1);
                expect(interceptor2).toHaveBeenCalledTimes(1);

                // Verify interceptor1 received original response
                expect(interceptor1).toHaveBeenCalledWith(mockResponse, expect.objectContaining({ endpoint: '/test', method: 'GET' }));

                // Verify interceptor2 received modified response from interceptor1
                expect(interceptor2).toHaveBeenCalledWith(
                    expect.objectContaining({
                        data: 'original',
                        interceptor1: 'applied',
                    }),
                    expect.any(Object),
                );

                // Verify final result includes both interceptor modifications
                expect(result).toEqual({
                    data: 'original',
                    interceptor1: 'applied',
                    interceptor2: 'applied',
                });
            } finally {
                remove1();
                remove2();
            }
        });

        it('allows interceptors to transform response data', async () => {
            const transformInterceptor = vi.fn(async (response) => {
                if (typeof response === 'object' && response !== null && 'data' in response) {
                    return {
                        ...response,
                        data: (response as any).data.toUpperCase(),
                    };
                }
                return response;
            });

            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ data: 'hello world' }),
            });

            const remove = apiClient.addResponseInterceptor(transformInterceptor);

            try {
                const result = await apiClient.request({
                    endpoint: '/test',
                    method: 'GET',
                });

                expect(transformInterceptor).toHaveBeenCalledWith({ data: 'hello world' }, expect.any(Object));

                expect(result).toEqual({ data: 'HELLO WORLD' });
            } finally {
                remove();
            }
        });

        it('provides request config to response interceptors', async () => {
            const configAwareInterceptor = vi.fn(async (response, config) => {
                return {
                    ...response,
                    requestMethod: config.method,
                    requestEndpoint: config.endpoint,
                };
            });

            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ original: true }),
            });

            const remove = apiClient.addResponseInterceptor(configAwareInterceptor);

            try {
                const result = await apiClient.request({
                    endpoint: '/test-endpoint',
                    method: 'POST',
                    body: { test: 'data' },
                });

                expect(configAwareInterceptor).toHaveBeenCalledWith(
                    { original: true },
                    expect.objectContaining({
                        endpoint: '/test-endpoint',
                        method: 'POST',
                        body: { test: 'data' },
                    }),
                );

                expect(result).toEqual({
                    original: true,
                    requestMethod: 'POST',
                    requestEndpoint: '/test-endpoint',
                });
            } finally {
                remove();
            }
        });
    });

    describe('Interceptor Management', () => {
        it('allows removing request interceptors', async () => {
            const interceptor = vi.fn(async (config) => config);

            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true }),
            });

            // Add and immediately remove interceptor
            const remove = apiClient.addRequestInterceptor(interceptor);
            remove();

            await apiClient.request({
                endpoint: '/test',
                method: 'GET',
            });

            // Interceptor should not have been called
            expect(interceptor).not.toHaveBeenCalled();
        });

        it('allows removing response interceptors', async () => {
            const interceptor = vi.fn(async (response) => response);

            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true }),
            });

            // Add and immediately remove interceptor
            const remove = apiClient.addResponseInterceptor(interceptor);
            remove();

            await apiClient.request({
                endpoint: '/test',
                method: 'GET',
            });

            // Interceptor should not have been called
            expect(interceptor).not.toHaveBeenCalled();
        });

        it('handles multiple interceptors being removed', async () => {
            const interceptor1 = vi.fn(async (config) => ({ ...config, test1: true }));
            const interceptor2 = vi.fn(async (config) => ({ ...config, test2: true }));
            const interceptor3 = vi.fn(async (config) => ({ ...config, test3: true }));

            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true }),
            });

            // Add three interceptors
            const remove1 = apiClient.addRequestInterceptor(interceptor1);
            const remove2 = apiClient.addRequestInterceptor(interceptor2);
            const remove3 = apiClient.addRequestInterceptor(interceptor3);

            // Remove the middle one
            remove2();

            await apiClient.request({
                endpoint: '/test',
                method: 'GET',
            });

            // Only interceptors 1 and 3 should have been called
            expect(interceptor1).toHaveBeenCalledTimes(1);
            expect(interceptor2).not.toHaveBeenCalled();
            expect(interceptor3).toHaveBeenCalledTimes(1);

            // Clean up
            remove1();
            remove3();
        });
    });

    describe('Error Handling with Interceptors', () => {
        it('applies interceptors even when request fails', async () => {
            const requestInterceptor = vi.fn(async (config) => ({
                ...config,
                headers: { ...config.headers, 'X-Test': 'value' },
            }));

            // Mock failed response
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: async () => ({
                    code: 'INTERNAL_ERROR',
                    message: 'Something went wrong',
                }),
            });

            const remove = apiClient.addRequestInterceptor(requestInterceptor);

            try {
                await apiClient.request({
                    endpoint: '/failing-endpoint',
                    method: 'GET',
                });

                // Should not reach here
                expect(true).toBe(false);
            } catch (error) {
                // Request interceptor should still have been applied
                expect(requestInterceptor).toHaveBeenCalledTimes(1);

                // Verify the intercepted config was used in fetch
                expect(fetchMock).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'X-Test': 'value',
                        }),
                    }),
                );
            } finally {
                remove();
            }
        });

        it('handles interceptor errors gracefully', async () => {
            const faultyInterceptor = vi.fn(async () => {
                throw new Error('Interceptor error');
            });

            const remove = apiClient.addRequestInterceptor(faultyInterceptor);

            try {
                await apiClient.request({
                    endpoint: '/test',
                    method: 'GET',
                });

                // Should not reach here
                expect(true).toBe(false);
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe('Interceptor error');
            } finally {
                remove();
            }
        });
    });
});
