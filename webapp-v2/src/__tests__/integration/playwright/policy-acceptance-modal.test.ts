import { createJsonHandler, policiesStatusHandler } from '@/test/msw/handlers.ts';
import { toPolicyId, toPolicyName, toVersionHash } from '@billsplit-wl/shared';
import { ClientUserBuilder, LoginPage, PolicyAcceptanceModalPage, PolicyAcceptanceStatusDTOBuilder, UserPolicyStatusResponseBuilder } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockGroupsApi } from '../../utils/mock-firebase-service';

test.describe('Policy Acceptance Modal', () => {
    test('prompts for pending policies and submits acceptance', async ({ pageWithLogging: page, mockFirebase, msw }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .withDisplayName('Policy Tester')
            .build();

        mockFirebase.mockLoginSuccess(testUser);

        await mockGroupsApi(page, {
            groups: [],
            count: 0,
            hasMore: false,
            pagination: { limit: 20, order: 'desc' },
            metadata: {
                serverTime: Date.now(),
                lastChangeTimestamp: Date.now(),
                changeCount: 0,
            },
        });

        const tosPolicy = new PolicyAcceptanceStatusDTOBuilder()
            .withPolicyId('terms-of-service')
            .withPolicyName('Terms of Service')
            .withCurrentVersionHash('tos-hash-v2')
            .withUserAcceptedHash('tos-hash-v1')
            .withNeedsAcceptance(true)
            .build();

        const privacyPolicy = new PolicyAcceptanceStatusDTOBuilder()
            .withPolicyId('privacy-policy')
            .withPolicyName('Privacy Policy')
            .withCurrentVersionHash('privacy-hash-v3')
            .withUserAcceptedHash('privacy-hash-v2')
            .withNeedsAcceptance(true)
            .build();

        const pendingPolicies = [tosPolicy, privacyPolicy];

        const acceptedTosPolicy = new PolicyAcceptanceStatusDTOBuilder()
            .withPolicyId('terms-of-service')
            .withPolicyName('Terms of Service')
            .withCurrentVersionHash('tos-hash-v2')
            .withUserAcceptedHash('tos-hash-v2')
            .withNeedsAcceptance(false)
            .build();

        const acceptedPrivacyPolicy = new PolicyAcceptanceStatusDTOBuilder()
            .withPolicyId('privacy-policy')
            .withPolicyName('Privacy Policy')
            .withCurrentVersionHash('privacy-hash-v3')
            .withUserAcceptedHash('privacy-hash-v3')
            .withNeedsAcceptance(false)
            .build();

        const pendingResponse = new UserPolicyStatusResponseBuilder()
            .withPolicies(pendingPolicies)
            .hasPending()
            .build();

        const acceptedResponse = new UserPolicyStatusResponseBuilder()
            .withPolicies([acceptedTosPolicy, acceptedPrivacyPolicy])
            .allAccepted()
            .build();

        await msw.use(policiesStatusHandler(acceptedResponse));
        await msw.use(policiesStatusHandler(pendingResponse, { once: true }));

        for (const policy of pendingPolicies) {
            await msw.use(
                createJsonHandler(
                    'GET',
                    `/api/policies/${policy.policyId}/current`,
                    {
                        id: policy.policyId,
                        policyName: policy.policyName,
                        currentVersionHash: policy.currentVersionHash,
                        text: `${policy.policyName} content - updated version`,
                        createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
                    },
                ),
            );
        }

        const acceptanceResponseTimestamp = new Date('2024-02-02T12:00:00.000Z').toISOString();

        await msw.use(
            createJsonHandler(
                'POST',
                '/api/user/policies/accept-multiple',
                {
                    success: true,
                    message: 'Policies accepted',
                    acceptedPolicies: pendingPolicies.map((policy) => ({
                        policyId: policy.policyId,
                        versionHash: policy.currentVersionHash,
                        acceptedAt: acceptanceResponseTimestamp,
                    })),
                },
                { once: true },
            ),
        );

        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        await loginPage.login(testUser.email, 'password123');
        await page.waitForURL(/\/dashboard/, { timeout: 5000 });

        const policyModal = new PolicyAcceptanceModalPage(page);
        await policyModal.waitForModalToAppear();
        await policyModal.waitForPolicyContentToLoad();
        await policyModal.verifyPolicyNameHasContent();

        // Accept all policies and get the request for verification
        const acceptanceRequest = await policyModal.acceptMultiplePoliciesSequentially();

        expect(acceptanceRequest.postDataJSON()).toEqual({
            acceptances: pendingPolicies.map((policy) => ({
                policyId: policy.policyId,
                versionHash: policy.currentVersionHash,
            })),
        });

        await expect(policyModal.getModalContainerLocator()).not.toBeVisible();
    });
});
