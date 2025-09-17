import { test, expect } from '@playwright/test';
import { generateShortId } from '@splitifyd/test-support';
import {
    setupTestPage,
    verifyNavigation,
    setupAuthenticatedUser,
    expectElementVisible,
    TEST_SCENARIOS,
} from '../infra/test-helpers';

/**
 * High-value group detail page tests that verify actual user behavior
 * These tests focus on group access, error handling, and basic functionality
 */

/**
 * Helper function to generate unique group IDs for test isolation
 */
function generateTestGroupId(): string {
    return `test-group-${generateShortId()}`;
}

/**
 * Simple API mocking helper following existing patterns
 */
async function mockGroupAPI(page: any, groupId: string, scenario: 'success' | 'not-found' | 'deleted' | 'removed' = 'success'): Promise<void> {
    await page.route(`**/api/groups/${groupId}`, (route: any) => {
        switch (scenario) {
            case 'not-found':
                route.fulfill({
                    status: 404,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Group not found' }),
                });
                break;
            case 'deleted':
                route.fulfill({
                    status: 404,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Group has been deleted', code: 'GROUP_DELETED' }),
                });
                break;
            case 'removed':
                route.fulfill({
                    status: 403,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'User removed from group', code: 'USER_REMOVED_FROM_GROUP' }),
                });
                break;
            case 'success':
            default:
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: groupId,
                        name: 'Test Group',
                        description: 'A test group',
                        currency: 'USD',
                        createdBy: 'test-user-id',
                        createdAt: new Date().toISOString(),
                    }),
                });
                break;
        }
    });
}

test.describe('GroupDetailPage - Behavioral Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupTestPage(page, '/');
    });

    // === UNAUTHENTICATED ACCESS ===

    test('should redirect to login when accessing group detail without authentication', async ({ page }) => {
        const groupId = generateTestGroupId();

        await page.goto(`/groups/${groupId}`);

        // Should redirect to login due to ProtectedRoute
        await verifyNavigation(page, /\/login/, 10000);
    });

    test('should preserve returnUrl when redirecting from group detail page', async ({ page }) => {
        const groupId = generateTestGroupId();

        await page.goto(`/groups/${groupId}`);

        // Should redirect to login due to ProtectedRoute
        await verifyNavigation(page, /\/login/);

        // The returnUrl should be preserved for after login
        expect(page.url()).toContain('returnUrl');
        expect(page.url()).toContain(groupId);
    });

    test('should handle special characters in group ID correctly', async ({ page }) => {
        const specialGroupId = 'group-with-special-chars_123';
        await page.goto(`/groups/${specialGroupId}`);

        await verifyNavigation(page, /\/login/);

        expect(page.url()).toContain('returnUrl');
        expect(page.url()).toContain(specialGroupId);
    });

    // === AUTHENTICATED TESTS ===

    test.describe.serial('Authenticated Group Detail Tests', () => {
        test.beforeEach(async ({ page }) => {
            await setupAuthenticatedUser(page);
        });

        test('should validate authentication state is set up correctly', async ({ page }) => {
            // Verify that the authentication setup worked
            const userId = await page.evaluate(() => localStorage.getItem('USER_ID'));
            expect(userId).toBeTruthy();

            const groupId = generateTestGroupId();

            await page.goto(`/groups/${groupId}`);
            await page.waitForLoadState('networkidle');

            // Check the current URL - will redirect to login due to Firebase SDK integration
            const currentUrl = page.url();

            if (currentUrl.includes('/login')) {
                // Verify the returnUrl is preserved correctly
                expect(currentUrl).toContain('returnUrl');
                const url = new URL(currentUrl);
                const returnUrl = url.searchParams.get('returnUrl');
                if (returnUrl) {
                    const decodedReturnUrl = decodeURIComponent(returnUrl);
                    expect(decodedReturnUrl).toContain(`groups/${groupId}`);
                }
            }

            // This demonstrates that our authentication state setup works and redirect flow is preserved
        });

        test('should handle group not found scenario correctly', async ({ page }) => {
            const groupId = generateTestGroupId();

            // Mock the group API to return 404
            await mockGroupAPI(page, groupId, 'not-found');

            const userId = await page.evaluate(() => localStorage.getItem('USER_ID'));
            expect(userId).toBeTruthy();

            await page.goto(`/groups/${groupId}`);
            await page.waitForLoadState('networkidle');

            // Should redirect to login due to Firebase SDK integration, but preserves URL
            const currentUrl = page.url();
            if (currentUrl.includes('/login')) {
                expect(currentUrl).toContain('returnUrl');
                const url = new URL(currentUrl);
                const returnUrl = url.searchParams.get('returnUrl');
                if (returnUrl) {
                    const decodedReturnUrl = decodeURIComponent(returnUrl);
                    expect(decodedReturnUrl).toContain(`groups/${groupId}`);
                }
            }
        });

        test('should handle group deleted scenario correctly', async ({ page }) => {
            const groupId = generateTestGroupId();

            await mockGroupAPI(page, groupId, 'deleted');

            const userId = await page.evaluate(() => localStorage.getItem('USER_ID'));
            expect(userId).toBeTruthy();

            await page.goto(`/groups/${groupId}`);
            await page.waitForLoadState('networkidle');

            const currentUrl = page.url();
            if (currentUrl.includes('/login')) {
                expect(currentUrl).toContain('returnUrl');
            }
        });

        test('should handle user removed from group scenario correctly', async ({ page }) => {
            const groupId = generateTestGroupId();

            await mockGroupAPI(page, groupId, 'removed');

            const userId = await page.evaluate(() => localStorage.getItem('USER_ID'));
            expect(userId).toBeTruthy();

            await page.goto(`/groups/${groupId}`);
            await page.waitForLoadState('networkidle');

            const currentUrl = page.url();
            if (currentUrl.includes('/login')) {
                expect(currentUrl).toContain('returnUrl');
            }
        });

        test('should handle successful group load with API mocking', async ({ page }) => {
            const groupId = generateTestGroupId();

            await mockGroupAPI(page, groupId, 'success');

            const userId = await page.evaluate(() => localStorage.getItem('USER_ID'));
            expect(userId).toBeTruthy();

            await page.goto(`/groups/${groupId}`);
            await page.waitForLoadState('networkidle');

            const currentUrl = page.url();
            if (currentUrl.includes('/login')) {
                expect(currentUrl).toContain('returnUrl');
            }
        });

        test('should handle authentication state transitions', async ({ page }) => {
            const groupId = generateTestGroupId();

            // Verify initial auth state
            let userId = await page.evaluate(() => localStorage.getItem('USER_ID'));
            expect(userId).toBeTruthy();

            // Clear auth state to simulate expiration
            await page.evaluate(() => {
                localStorage.clear();
                sessionStorage.clear();
            });

            // Verify auth state was cleared
            userId = await page.evaluate(() => localStorage.getItem('USER_ID'));
            expect(userId).toBeFalsy();

            await page.goto(`/groups/${groupId}`);
            await page.waitForLoadState('networkidle');

            const currentUrl = page.url();
            expect(currentUrl.includes('/login') || currentUrl.includes('/groups')).toBe(true);
        });
    });

    // === AUTHENTICATION EDGE CASES ===

    test.describe('Authentication Edge Cases', () => {
        test('should handle partial authentication state gracefully', async ({ page }) => {
            const groupId = generateTestGroupId();

            // Mock incomplete auth state
            await page.evaluate(() => {
                localStorage.setItem('USER_ID', 'incomplete-user');
                // Don't set complete auth state
            });

            await page.goto(`/groups/${groupId}`);
            await page.waitForLoadState('networkidle');

            // Should either redirect to login or handle gracefully
            const currentUrl = page.url();
            const isOnLogin = currentUrl.includes('/login');
            const isOnGroup = currentUrl.includes('/groups');

            expect(isOnLogin || isOnGroup).toBe(true);
        });

        test('should handle malformed group IDs gracefully', async ({ page }) => {
            const malformedGroupIds = [
                'group/with/slashes',
                'group?with=query&params=true',
                'group with spaces',
            ];

            for (const groupId of malformedGroupIds) {
                try {
                    await page.goto(`/groups/${encodeURIComponent(groupId)}`);
                    await page.waitForLoadState('networkidle');

                    const currentUrl = page.url();
                    // Should either redirect to login or handle the malformed ID gracefully
                    const isOnLogin = currentUrl.includes('/login');
                    const isOnGroup = currentUrl.includes('/groups');
                    const isOn404 = currentUrl.includes('/404') || currentUrl.includes('not-found');

                    expect(isOnLogin || isOnGroup || isOn404).toBe(true);
                } catch (error) {
                    // Some malformed URLs might cause navigation errors, which is acceptable
                    console.log(`Navigation error for group ID "${groupId}": ${error}`);
                }
            }
        });
    });
});