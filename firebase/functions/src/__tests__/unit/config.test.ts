import { AppConfigurationBuilder } from '@splitifyd/test-support';
import { describe, expect, it } from 'vitest';
import { validateAppConfiguration } from '../../middleware/config-validation';

describe('Configuration Response Functions', () => {
    describe('Configuration Validation', () => {
        it('should validate a complete configuration', () => {
            const config = new AppConfigurationBuilder().build();

            expect(() => validateAppConfiguration(config)).not.toThrow();
        });

        it('should validate configuration with tenant payload', () => {
            const configWithTenant = new AppConfigurationBuilder()
                .withFirebaseConfig({
                    authDomain: 'tenant.firebaseapp.com',
                    projectId: 'tenant-project',
                    storageBucket: 'tenant.firebasestorage.app',
                    messagingSenderId: '654321',
                    appId: '1:654321:web:def',
                })
                .withTenantOverrides({
                    tenantId: 'acme',
                    branding: {
                        marketingFlags: {
                            showPricingPage: false,
                        },
                    },
                    features: {
                        enableMultiCurrency: true,
                    },
                })
                .build();

            expect(() => validateAppConfiguration(configWithTenant)).not.toThrow();
        });

        it('should reject invalid configuration', () => {
            const invalidConfig = new AppConfigurationBuilder()
                .withFirebaseConfig({ appId: '' })
                .build();

            expect(() => validateAppConfiguration(invalidConfig)).toThrow();
        });
    });
});
