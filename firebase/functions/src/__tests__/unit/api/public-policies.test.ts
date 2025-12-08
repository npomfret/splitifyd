import type { UserId } from '@billsplit-wl/shared';
import { CreatePolicyRequestBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../../errors';
import { AppDriver } from '../AppDriver';

/**
 * Tests for the public policy convenience methods.
 *
 * These methods wrap getCurrentPolicy with specific policy IDs
 * for common policy types (privacy, terms, cookies).
 */
describe('public policy convenience methods', () => {
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
        it('should return privacy policy', async () => {
            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Privacy Policy')
                    .withText('Privacy policy content.')
                    .build(),
                adminToken,
            );

            const result = await appDriver.getPrivacyPolicy();

            expect(result.id).toBe('privacy-policy');
            expect(result.policyName).toBe('Privacy Policy');
            expect(result.text).toBe('Privacy policy content.');
        });

        it('should return NOT_FOUND when policy does not exist', async () => {
            const result = await appDriver.getPrivacyPolicy() as any;
            expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
        });
    });

    describe('getTermsOfService', () => {
        it('should return terms of service', async () => {
            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Terms Of Service')
                    .withText('Terms of service content.')
                    .build(),
                adminToken,
            );

            const result = await appDriver.getTermsOfService();

            expect(result.id).toBe('terms-of-service');
            expect(result.policyName).toBe('Terms Of Service');
            expect(result.text).toBe('Terms of service content.');
        });

        it('should return NOT_FOUND when policy does not exist', async () => {
            const result = await appDriver.getTermsOfService() as any;
            expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
        });
    });

    describe('getCookiePolicy', () => {
        it('should return cookie policy', async () => {
            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Cookie Policy')
                    .withText('Cookie policy content.')
                    .build(),
                adminToken,
            );

            const result = await appDriver.getCookiePolicy();

            expect(result.id).toBe('cookie-policy');
            expect(result.policyName).toBe('Cookie Policy');
            expect(result.text).toBe('Cookie policy content.');
        });

        it('should return NOT_FOUND when policy does not exist', async () => {
            const result = await appDriver.getCookiePolicy() as any;
            expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
        });
    });
});
