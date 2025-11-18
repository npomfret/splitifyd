import { AppConfigurationBuilder } from '@billsplit-wl/test-support';
import { describe, expect, it } from 'vitest';
import { validateAppConfiguration } from '../../middleware/config-validation';

describe('Configuration Response Functions', () => {
    describe('Configuration Validation', () => {
        it('should validate a complete configuration', () => {
            const config = new AppConfigurationBuilder().build();

            expect(() => validateAppConfiguration(config)).not.toThrow();
        });

        it('should validate configuration with custom firebase config', () => {
            const configWithCustomFirebase = new AppConfigurationBuilder()
                .withFirebaseConfig({
                    ...new AppConfigurationBuilder().build().firebase,
                    apiKey: 'custom-api-key',
                })
                .build();

            expect(() => validateAppConfiguration(configWithCustomFirebase)).not.toThrow();
        });

        it('should reject invalid configuration', () => {
            const invalidConfig = new AppConfigurationBuilder().build();
            const firebaseConfig = invalidConfig.firebase as unknown as Record<string, unknown>;
            delete firebaseConfig.appId;

            expect(() => validateAppConfiguration(invalidConfig)).toThrow();
        });
    });
});
