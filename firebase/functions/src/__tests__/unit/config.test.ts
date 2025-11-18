import { AppConfigurationBuilder } from '@billsplit-wl/test-support';
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
                })
                .build();

            expect(() => validateAppConfiguration(configWithTenant)).not.toThrow();
        });

        it('should reject invalid configuration', () => {
            const invalidConfig = new AppConfigurationBuilder().build();
            const firebaseConfig = invalidConfig.firebase as unknown as Record<string, unknown>;
            delete firebaseConfig.appId;

            expect(() => validateAppConfiguration(invalidConfig)).toThrow();
        });
    });
});
