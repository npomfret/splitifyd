import { getEnhancedConfigResponse } from '../../utils/config-response';
import { validateAppConfiguration } from '../../middleware/config-validation';

// Mock the getConfig and getAppConfig functions
vi.mock('../../client-config', () => ({
    getConfig: () => ({
        isDevelopment: false,
        isProduction: true,
        requestBodyLimit: '1mb',
        validation: {
            maxRequestSizeBytes: 1048576,
            maxObjectDepth: 10,
            maxStringLength: 10000,
            maxPropertyCount: 100,
            maxPropertyNameLength: 100,
        },
        document: {
            listLimit: 50,
            previewLength: 100,
        },
        formDefaults: {
            displayName: '',
            email: '',
            password: '',
        },
        warningBanner: '⚠️ this is a demo - your data will be deleted without notice',
    }),
    getAppConfig: () => ({
        firebase: {
            apiKey: 'test-api-key',
            authDomain: 'test.firebaseapp.com',
            projectId: 'test-project',
            storageBucket: 'test.firebasestorage.app',
            messagingSenderId: '123456789',
            appId: '1:123456789:web:abcdef',
            measurementId: 'G-TEST123',
        },
        api: {
            timeout: 30000,
            retryAttempts: 3,
        },
        environment: {
            warningBanner: '⚠️ this is a demo - your data will be deleted without notice',
        },
        formDefaults: {
            displayName: '',
            email: '',
            password: '',
        },
        firebaseAuthUrl: 'http://localhost:9099',
    }),
}));

// Mock logger
vi.mock('../../logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

describe('Configuration Response Functions', () => {
    describe('getEnhancedConfigResponse', () => {
        it('should return enhanced configuration format', () => {
            const config = getEnhancedConfigResponse();

            expect(config).toHaveProperty('firebase');
            expect(config).toHaveProperty('api');
            expect(config).toHaveProperty('environment');
            expect(config).toHaveProperty('formDefaults');
            expect(config).toHaveProperty('firebaseAuthUrl');

            expect(config.firebase).toEqual({
                apiKey: 'test-api-key',
                authDomain: 'test.firebaseapp.com',
                projectId: 'test-project',
                storageBucket: 'test.firebasestorage.app',
                messagingSenderId: '123456789',
                appId: '1:123456789:web:abcdef',
                measurementId: 'G-TEST123',
            });

            expect(config.environment).toMatchObject({
                warningBanner: '⚠️ this is a demo - your data will be deleted without notice',
            });
        });

        it('should validate configuration schema', () => {
            const config = getEnhancedConfigResponse();

            expect(() => validateAppConfiguration(config)).not.toThrow();
        });

        it('should include warning banner when configured', () => {
            const config = getEnhancedConfigResponse();

            // Warning banner is configured in the mock
            expect(config.environment.warningBanner).toBe('⚠️ this is a demo - your data will be deleted without notice');
        });

        it('should include form defaults as empty strings in production', () => {
            const config = getEnhancedConfigResponse();

            // Form defaults are empty strings in production
            expect(config.formDefaults).toEqual({
                displayName: '',
                email: '',
                password: '',
            });
        });
    });

    describe('Configuration Validation', () => {
        it('should validate a complete configuration', () => {
            const validConfig = {
                firebase: {
                    apiKey: 'test-key',
                    authDomain: 'test.firebaseapp.com',
                    projectId: 'test-project',
                    storageBucket: 'test.firebasestorage.app',
                    messagingSenderId: '123456',
                    appId: '1:123456:web:abc',
                },
                environment: {},
                formDefaults: {
                    displayName: '',
                    email: '',
                    password: '',
                },
            };

            expect(() => validateAppConfiguration(validConfig)).not.toThrow();
        });

        it('should reject invalid configuration', () => {
            const invalidConfig = {
                firebase: {
                    apiKey: '', // Empty string should fail
                    authDomain: 'test.firebaseapp.com',
                    projectId: 'test-project',
                    storageBucket: 'test.firebasestorage.app',
                    messagingSenderId: '123456',
                    appId: '1:123456:web:abc',
                },
                environment: {},
                formDefaults: {
                    displayName: '',
                    email: '',
                    password: '',
                },
            };

            expect(() => validateAppConfiguration(invalidConfig)).toThrow();
        });
    });
});
