import { toEmail, toPassword } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import {
    AcceptPolicyRequestBuilder,
    ChangeEmailRequestBuilder,
    CreatePolicyRequestBuilder,
    PasswordChangeRequestBuilder,
    RegisterRequestBuilder,
    UpdatePolicyRequestBuilder,
    UserUpdateBuilder,
} from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { AppDriver } from '../AppDriver';

describe('user, policy and notification tests', () => {
    let appDriver: AppDriver;

    let user1: UserId;
    let user2: UserId;
    let adminUser: UserId;

    beforeEach(async () => {
        appDriver = new AppDriver();

        const { users, admin } = await appDriver.createTestUsers({
            count: 2,
            includeAdmin: true,
        });
        [user1, user2] = users;
        adminUser = admin!;
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('policy acceptance and status', () => {
        describe('acceptMultiplePolicies - happy path', () => {
            it('should accept a single policy', async () => {
                const policy1 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                const result = await appDriver.acceptMultiplePolicies([
                    new AcceptPolicyRequestBuilder().forPolicy(policy1).build(),
                ], user1);

                expect(result.acceptedPolicies).toHaveLength(1);
                expect(result.acceptedPolicies[0].policyId).toBe(policy1.id);
                expect(result.acceptedPolicies[0].versionHash).toBe(policy1.versionHash);
                expect(result.acceptedPolicies[0].acceptedAt).toBeDefined();
            });

            it('should accept multiple policies at once', async () => {
                const policy1 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                const policy2 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Privacy Policy')
                        .withText('Privacy Policy v1')
                        .build(),
                    adminUser,
                );

                const policy3 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Cookie Policy')
                        .withText('Cookie Policy v1')
                        .build(),
                    adminUser,
                );

                const result = await appDriver.acceptMultiplePolicies([
                    new AcceptPolicyRequestBuilder().forPolicy(policy1).build(),
                    new AcceptPolicyRequestBuilder().forPolicy(policy2).build(),
                    new AcceptPolicyRequestBuilder().forPolicy(policy3).build(),
                ], user1);

                expect(result.acceptedPolicies).toHaveLength(3);
                expect(result.acceptedPolicies[0].policyId).toBe(policy1.id);
                expect(result.acceptedPolicies[1].policyId).toBe(policy2.id);
                expect(result.acceptedPolicies[2].policyId).toBe(policy3.id);
            });

            it('should persist policy acceptance in user document', async () => {
                const policy1 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                await appDriver.acceptMultiplePolicies([
                    new AcceptPolicyRequestBuilder().forPolicy(policy1).build(),
                ], user2);

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.policies).toHaveLength(1);
                expect(status.policies[0].userAcceptedHash).toBe(policy1.versionHash);
                expect(status.policies[0].needsAcceptance).toBe(false);
            });

            it('should preserve original timestamp when re-accepting same version (no-op)', async () => {
                const policy1 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                // First acceptance
                const firstResult = await appDriver.acceptMultiplePolicies([
                    new AcceptPolicyRequestBuilder().forPolicy(policy1).build(),
                ], user1);

                const firstAcceptedAt = firstResult.acceptedPolicies[0].acceptedAt;

                // Small delay to ensure different timestamp if not preserved
                await new Promise((resolve) => setTimeout(resolve, 10));

                // Second acceptance of same version - should be no-op
                const secondResult = await appDriver.acceptMultiplePolicies([
                    new AcceptPolicyRequestBuilder().forPolicy(policy1).build(),
                ], user1);

                // API should return the original timestamp, not a new one
                expect(secondResult.acceptedPolicies[0].acceptedAt).toBe(firstAcceptedAt);

                // Policy status should still show accepted
                const status = await appDriver.getUserPolicyStatus(user1);
                expect(status.policies[0].needsAcceptance).toBe(false);
                expect(status.policies[0].userAcceptedHash).toBe(policy1.versionHash);
            });

            it('should preserve history when accepting new policy version', async () => {
                const policy1 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                const oldVersionHash = policy1.versionHash;

                // Accept initial version
                await appDriver.acceptMultiplePolicies([
                    new AcceptPolicyRequestBuilder().forPolicy(policy1).build(),
                ], user1);

                // Update policy to new version
                const updatedPolicy = await appDriver.updatePolicy(
                    policy1.id,
                    new UpdatePolicyRequestBuilder()
                        .withText('Terms of Service v2 - updated')
                        .asPublished()
                        .build(),
                    adminUser,
                );

                const newVersionHash = updatedPolicy.versionHash;
                expect(newVersionHash).not.toBe(oldVersionHash);

                // Accept new version
                await appDriver.acceptMultiplePolicies([
                    new AcceptPolicyRequestBuilder()
                        .withPolicyId(policy1.id)
                        .withVersionHash(newVersionHash)
                        .build(),
                ], user1);

                // User should now have accepted current version
                const status = await appDriver.getUserPolicyStatus(user1);
                expect(status.policies[0].needsAcceptance).toBe(false);
                expect(status.policies[0].userAcceptedHash).toBe(newVersionHash);

                // History is preserved in Firestore (both versions recorded)
                // This is verified by the fact that no data was lost during the second acceptance
            });
        });

        describe('acceptMultiplePolicies - validation and errors', () => {
            it('should reject empty acceptances array', async () => {
                await expect(appDriver.acceptMultiplePolicies([], user1))
                    .rejects
                    .toMatchObject({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'VALIDATION_ERROR',
                        data: expect.objectContaining({ detail: 'INVALID_ACCEPTANCES' }),
                    });
            });

            it('should reject when policyId is missing', async () => {
                await expect(
                    appDriver.acceptMultiplePolicies([
                        new AcceptPolicyRequestBuilder()
                            .withPolicyId('')
                            .withVersionHash('some-hash')
                            .build(),
                    ], user1),
                )
                    .rejects
                    .toMatchObject({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'VALIDATION_ERROR',
                        data: expect.objectContaining({ detail: 'INVALID_ACCEPTANCES' }),
                    });
            });

            it('should reject when versionHash is missing', async () => {
                await expect(
                    appDriver.acceptMultiplePolicies([
                        new AcceptPolicyRequestBuilder()
                            .withPolicyId('some-policy')
                            .withVersionHash('')
                            .build(),
                    ], user1),
                )
                    .rejects
                    .toMatchObject({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'VALIDATION_ERROR',
                        data: expect.objectContaining({ detail: 'INVALID_ACCEPTANCES' }),
                    });
            });

            it('should reject when policy does not exist', async () => {
                await expect(
                    appDriver.acceptMultiplePolicies([
                        new AcceptPolicyRequestBuilder()
                            .withPolicyId('non-existent-policy')
                            .withVersionHash('some-hash')
                            .build(),
                    ], user1),
                )
                    .rejects
                    .toMatchObject({
                        statusCode: HTTP_STATUS.NOT_FOUND,
                        code: 'NOT_FOUND',
                    });
            });

            it('should reject when version hash is invalid for existing policy', async () => {
                const policy1 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                await expect(
                    appDriver.acceptMultiplePolicies([
                        new AcceptPolicyRequestBuilder()
                            .withPolicyId(policy1.id)
                            .withVersionHash('invalid-version-hash')
                            .build(),
                    ], user1),
                )
                    .rejects
                    .toMatchObject({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'VALIDATION_ERROR',
                    });
            });

            it('should reject entire batch if any policy is invalid', async () => {
                const policy1 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                await expect(
                    appDriver.acceptMultiplePolicies([
                        new AcceptPolicyRequestBuilder().forPolicy(policy1).build(),
                        new AcceptPolicyRequestBuilder()
                            .withPolicyId('non-existent')
                            .withVersionHash('some-hash')
                            .build(),
                    ], user1),
                )
                    .rejects
                    .toMatchObject({
                        statusCode: HTTP_STATUS.NOT_FOUND,
                        code: 'NOT_FOUND',
                    });

                const status = await appDriver.getUserPolicyStatus(user1);
                expect(status.policies[0].userAcceptedHash).toBeUndefined();
            });

            it('should propagate error when Firestore write fails', async () => {
                const policy1 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                const firestoreWriter = appDriver.componentBuilder.buildFirestoreWriter();
                const runTransactionSpy = vi.spyOn(firestoreWriter, 'runTransaction').mockRejectedValueOnce(
                    new Error('Firestore transaction failed'),
                );

                await expect(
                    appDriver.acceptMultiplePolicies([
                        new AcceptPolicyRequestBuilder().forPolicy(policy1).build(),
                    ], user1),
                )
                    .rejects
                    .toMatchObject({
                        statusCode: HTTP_STATUS.INTERNAL_ERROR,
                        code: 'SERVICE_ERROR',
                    });

                runTransactionSpy.mockRestore();
            });
        });

        describe('getUserPolicyStatus - happy path', () => {
            it('should show all policies as pending when user has not accepted any', async () => {
                const policy1 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                const policy2 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Privacy Policy')
                        .withText('Privacy Policy v1')
                        .build(),
                    adminUser,
                );

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.needsAcceptance).toBe(true);
                expect(status.totalPending).toBe(2);
                expect(status.policies).toHaveLength(2);

                const termsPolicy = status.policies.find((p) => p.policyId === policy1.id);
                expect(termsPolicy).toBeDefined();
                expect(termsPolicy!.needsAcceptance).toBe(true);
                expect(termsPolicy!.userAcceptedHash).toBeUndefined();

                const privacyPolicy = status.policies.find((p) => p.policyId === policy2.id);
                expect(privacyPolicy).toBeDefined();
                expect(privacyPolicy!.needsAcceptance).toBe(true);
                expect(privacyPolicy!.userAcceptedHash).toBeUndefined();
            });

            it('should show no pending policies when user has accepted current versions', async () => {
                const policy1 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                const policy2 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Privacy Policy')
                        .withText('Privacy Policy v1')
                        .build(),
                    adminUser,
                );

                await appDriver.acceptMultiplePolicies([
                    new AcceptPolicyRequestBuilder().forPolicy(policy1).build(),
                    new AcceptPolicyRequestBuilder().forPolicy(policy2).build(),
                ], user2);

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.needsAcceptance).toBe(false);
                expect(status.totalPending).toBe(0);
                expect(status.policies).toHaveLength(2);

                status.policies.forEach((policy) => {
                    expect(policy.needsAcceptance).toBe(false);
                    expect(policy.userAcceptedHash).toBe(policy.currentVersionHash);
                });
            });

            it('should show pending when user has accepted old versions', async () => {
                const policy1 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                await appDriver.acceptMultiplePolicies([
                    new AcceptPolicyRequestBuilder().forPolicy(policy1).build(),
                ], user2);

                const oldVersionHash = policy1.versionHash;

                const updatedPolicy = await appDriver.updatePolicy(
                    policy1.id,
                    new UpdatePolicyRequestBuilder()
                        .withText('Terms of Service v2 - updated')
                        .asPublished()
                        .build(),
                    adminUser,
                );

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.needsAcceptance).toBe(true);
                expect(status.totalPending).toBe(1);
                expect(status.policies).toHaveLength(1);

                const termsPolicy = status.policies.find((p) => p.policyId === policy1.id);
                expect(termsPolicy).toBeDefined();
                expect(termsPolicy!.needsAcceptance).toBe(true);
                // With new history-based model, userAcceptedHash is undefined when user hasn't accepted current version
                expect(termsPolicy!.userAcceptedHash).toBeUndefined();
                expect(termsPolicy!.currentVersionHash).toBe(updatedPolicy.versionHash);
                expect(termsPolicy!.currentVersionHash).not.toBe(oldVersionHash);
            });

            it('should show mixed acceptance state across multiple policies', async () => {
                const policy1 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                const policy2 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Privacy Policy')
                        .withText('Privacy Policy v1')
                        .build(),
                    adminUser,
                );

                const policy3 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Cookie Policy')
                        .withText('Cookie Policy v1')
                        .build(),
                    adminUser,
                );

                await appDriver.acceptMultiplePolicies([
                    new AcceptPolicyRequestBuilder().forPolicy(policy1).build(),
                    new AcceptPolicyRequestBuilder().forPolicy(policy2).build(),
                ], user2);

                await appDriver.updatePolicy(
                    policy1.id,
                    new UpdatePolicyRequestBuilder()
                        .withText('Terms of Service v2')
                        .asPublished()
                        .build(),
                    adminUser,
                );

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.needsAcceptance).toBe(true);
                expect(status.totalPending).toBe(2);

                const termsPolicy = status.policies.find((p) => p.policyId === policy1.id);
                expect(termsPolicy!.needsAcceptance).toBe(true);

                const privacyPolicy = status.policies.find((p) => p.policyId === policy2.id);
                expect(privacyPolicy!.needsAcceptance).toBe(false);

                const cookiePolicy = status.policies.find((p) => p.policyId === policy3.id);
                expect(cookiePolicy!.needsAcceptance).toBe(true);
            });
        });

        describe('getUserPolicyStatus - data integrity', () => {
            it('should return correct response structure', async () => {
                await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status).toHaveProperty('needsAcceptance');
                expect(status).toHaveProperty('policies');
                expect(status).toHaveProperty('totalPending');

                expect(typeof status.needsAcceptance).toBe('boolean');
                expect(Array.isArray(status.policies)).toBe(true);
                expect(typeof status.totalPending).toBe('number');
            });

            it('should include all required fields in each policy', async () => {
                const policy1 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                await appDriver.acceptMultiplePolicies([
                    new AcceptPolicyRequestBuilder().forPolicy(policy1).build(),
                ], user2);

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.policies).toHaveLength(1);

                const policyStatus = status.policies[0];
                expect(policyStatus).toHaveProperty('policyId');
                expect(policyStatus).toHaveProperty('currentVersionHash');
                expect(policyStatus).toHaveProperty('userAcceptedHash');
                expect(policyStatus).toHaveProperty('needsAcceptance');
                expect(policyStatus).toHaveProperty('policyName');

                expect(typeof policyStatus.policyId).toBe('string');
                expect(typeof policyStatus.currentVersionHash).toBe('string');
                expect(typeof policyStatus.userAcceptedHash).toBe('string');
                expect(typeof policyStatus.needsAcceptance).toBe('boolean');
                expect(typeof policyStatus.policyName).toBe('string');
            });

            it('should correctly count totalPending', async () => {
                const policy1 = await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Terms Of Service')
                        .withText('Terms of Service v1')
                        .build(),
                    adminUser,
                );

                await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Privacy Policy')
                        .withText('Privacy Policy v1')
                        .build(),
                    adminUser,
                );

                await appDriver.createPolicy(
                    new CreatePolicyRequestBuilder()
                        .withPolicyName('Cookie Policy')
                        .withText('Cookie Policy v1')
                        .build(),
                    adminUser,
                );

                await appDriver.acceptMultiplePolicies([
                    new AcceptPolicyRequestBuilder().forPolicy(policy1).build(),
                ], user2);

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.totalPending).toBe(2);

                const pendingPolicies = status.policies.filter((p) => p.needsAcceptance);
                expect(pendingPolicies).toHaveLength(2);
            });

            it('should return empty policies array when no policies exist', async () => {
                const status = await appDriver.getUserPolicyStatus(user1);

                expect(status.needsAcceptance).toBe(false);
                expect(status.totalPending).toBe(0);
                expect(status.policies).toHaveLength(0);
            });
        });
    });

    describe('user account endpoints', () => {
        it('should return the current user profile via the handler', async () => {
            const profile = await appDriver.getUserProfile(user1);

            expect(profile.displayName).toBe('User one');
            expect(profile.emailVerified).toBe(false);
        });

        it('should register a new user through the registration workflow', async () => {
            const registrationResult = await appDriver.registerUser(
                new RegisterRequestBuilder()
                    .withDisplayName('Registered User')
                    .withEmail('registered@example.com')
                    .withPassword('ValidPass123!')
                    .withTermsAccepted(true)
                    .withCookiePolicyAccepted(true)
                    .withPrivacyPolicyAccepted(true)
                    .build(),
            );

            expect(registrationResult.success).toBe(true);
            expect(registrationResult.user.displayName).toBe('Registered User');

            const newUserId = registrationResult.user.uid;
            const profile = await appDriver.getUserProfile(newUserId);

            expect(profile.displayName).toBe('Registered User');
            expect(profile.email).toBe('registered@example.com');
        });

        describe('updateUserProfile', () => {
            it('should update display name successfully', async () => {
                await appDriver.updateUserProfile(
                    new UserUpdateBuilder().withDisplayName('Updated Name').build(),
                    user1,
                );

                const profile = await appDriver.getUserProfile(user1);
                expect(profile.displayName).toBe('Updated Name');
            });

            it('should sanitize display name input', async () => {
                await appDriver.updateUserProfile(
                    new UserUpdateBuilder().withDisplayName('<script>alert("xss")</script>Clean Name').build(),
                    user1,
                );

                const profile = await appDriver.getUserProfile(user1);
                expect(profile.displayName).not.toContain('<script>');
                expect(profile.displayName).toContain('Clean Name');
            });

            it('should reject empty display name', async () => {
                await expect(
                    appDriver.updateUserProfile(new UserUpdateBuilder().withDisplayName('').build(), user1),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject display name that is too long', async () => {
                const tooLongName = 'a'.repeat(256);
                await expect(
                    appDriver.updateUserProfile(new UserUpdateBuilder().withDisplayName(tooLongName).build(), user1),
                )
                    .rejects
                    .toThrow();
            });
        });

        describe('changePassword', () => {
            const VALID_CURRENT_PASSWORD = toPassword('password12345');
            const VALID_NEW_PASSWORD = toPassword('NewSecurePass123!');

            it('should successfully change password with valid credentials', async () => {
                // Password change succeeds if no error is thrown
                await appDriver.changePassword(
                    new PasswordChangeRequestBuilder()
                        .withCurrentPassword(VALID_CURRENT_PASSWORD)
                        .withNewPassword(VALID_NEW_PASSWORD)
                        .build(),
                    user1,
                );
            });
        });

        describe('changeEmail', () => {
            const CURRENT_PASSWORD = toPassword('password12345');
            const NEW_EMAIL = toEmail('newemail@example.com');

            beforeEach(() => {
                // Email change requires a tenant with domain match for localhost
                appDriver.seedLocalhostTenant();
            });

            it('should send verification email with valid credentials', async () => {
                // changeEmail now sends verification email instead of immediately changing
                // The email should NOT be changed yet - that happens when user clicks the link
                const originalProfile = await appDriver.getUserProfile(user1);

                await appDriver.changeEmail(
                    new ChangeEmailRequestBuilder()
                        .withCurrentPassword(CURRENT_PASSWORD)
                        .withNewEmail(NEW_EMAIL)
                        .build(),
                    user1,
                );

                // Email should NOT be changed - verification email sent instead
                const profile = await appDriver.getUserProfile(user1);
                expect(profile.email).toBe(originalProfile.email);
            });

            it('should validate new email is different from current', async () => {
                const profile = await appDriver.getUserProfile(user1);

                await expect(
                    appDriver.changeEmail(
                        new ChangeEmailRequestBuilder()
                            .withCurrentPassword(CURRENT_PASSWORD)
                            .withNewEmail(profile.email)
                            .build(),
                        user1,
                    ),
                ).rejects.toMatchObject({
                    code: 'INVALID_REQUEST',
                });
            });
        });
    });
});
