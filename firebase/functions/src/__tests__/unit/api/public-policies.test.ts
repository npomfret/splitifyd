import type { UserId } from '@billsplit-wl/shared';
import { CreatePolicyRequestBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

/**
 * Tests for the public policy text endpoints.
 *
 * These endpoints return plain text policy content for tenant embedding.
 */
describe('public policy text endpoints', () => {
    let appDriver: AppDriver;
    let adminToken: UserId;

    beforeEach(async () => {
        appDriver = new AppDriver();

        // Create admin user to seed policies
        const adminResult = await appDriver.registerUser(
            new UserRegistrationBuilder()
                .withEmail('admin@test.com')
                .withPassword('password123456')
                .withDisplayName('Admin User')
                .build(),
        );
        adminToken = adminResult.user.uid as UserId;
        appDriver.seedAdminUser(adminToken);
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('getPrivacyPolicy', () => {
        it('should return privacy policy text as plain text', async () => {
            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Privacy Policy')
                    .withText('Privacy policy content.')
                    .build(),
                adminToken,
            );

            const result = await appDriver.getPrivacyPolicy();

            expect(typeof result).toBe('string');
            expect(result).toBe('Privacy policy content.');
        });

        it('should throw when policy does not exist', async () => {
            await expect(appDriver.getPrivacyPolicy()).rejects.toThrow();
        });
    });

    describe('getTermsOfService', () => {
        it('should return terms of service text as plain text', async () => {
            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Terms Of Service')
                    .withText('Terms of service content.')
                    .build(),
                adminToken,
            );

            const result = await appDriver.getTermsOfService();

            expect(typeof result).toBe('string');
            expect(result).toBe('Terms of service content.');
        });

        it('should throw when policy does not exist', async () => {
            await expect(appDriver.getTermsOfService()).rejects.toThrow();
        });
    });

    describe('getCookiePolicy', () => {
        it('should return cookie policy text as plain text', async () => {
            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Cookie Policy')
                    .withText('Cookie policy content.')
                    .build(),
                adminToken,
            );

            const result = await appDriver.getCookiePolicy();

            expect(typeof result).toBe('string');
            expect(result).toBe('Cookie policy content.');
        });

        it('should throw when policy does not exist', async () => {
            await expect(appDriver.getCookiePolicy()).rejects.toThrow();
        });
    });
});
