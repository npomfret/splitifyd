import { createJsonHandler, policiesStatusHandler } from '@/test/msw/handlers.ts';
import { toPolicyId } from '@billsplit-wl/shared';
import { ClientUserBuilder, LoginPage, PolicyAcceptanceModalPage } from '@billsplit-wl/test-support';
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

        const pendingPolicies = [
            {
                policyId: toPolicyId('terms-of-service'),
                policyName: 'Terms of Service',
                currentVersionHash: 'tos-hash-v2',
                userAcceptedHash: 'tos-hash-v1',
                needsAcceptance: true,
            },
            {
                policyId: toPolicyId('privacy-policy'),
                policyName: 'Privacy Policy',
                currentVersionHash: 'privacy-hash-v3',
                userAcceptedHash: 'privacy-hash-v2',
                needsAcceptance: true,
            },
        ];

        const pendingResponse = {
            needsAcceptance: true,
            policies: pendingPolicies,
            totalPending: pendingPolicies.length,
        };

        const acceptedResponse = {
            needsAcceptance: false,
            policies: pendingPolicies.map((policy) => ({
                ...policy,
                needsAcceptance: false,
                userAcceptedHash: policy.currentVersionHash,
            })),
            totalPending: 0,
        };

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
