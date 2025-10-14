import { describe, expect, it } from 'vitest';
import { validateAppConfiguration } from '../../middleware/config-validation';

describe('Configuration Response Functions', () => {

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
