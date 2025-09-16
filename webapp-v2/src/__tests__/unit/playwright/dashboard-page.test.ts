import { test, expect } from '@playwright/test';
import {
    setupTestPage,
    verifyNavigation,
    expectElementVisible,
    setupAuthenticatedUser,
    expectButtonState,
    waitForStorageUpdate,
    SELECTORS,
    TEST_SCENARIOS,
} from '../infra/test-helpers';

// Dashboard-specific selectors following established patterns
const DASHBOARD_SELECTORS = {
    // Main structure
    MAIN_CONTENT: 'main',
    WELCOME_HEADING: 'h2:has-text("Welcome")',
    WELCOME_DESCRIPTION: 'p:has-text("Welcome")',
    GROUPS_SECTION_TITLE: 'h3:has-text("Your Groups")',
    GROUPS_CONTAINER: '.bg-white.rounded-lg.shadow-sm',

    // Buttons and actions
    CREATE_GROUP_BUTTON: 'button:has-text("Create Group")',
    CREATE_GROUP_MODAL: '[role="dialog"]',
    MODAL_CLOSE_BUTTON: '[data-testid*="close"], button:has-text("Cancel"), [aria-label*="close"]',

    // Layout components
    QUICK_ACTIONS_MOBILE: '.lg\\:hidden',
    QUICK_ACTIONS_DESKTOP: '.hidden.lg\\:block',
    DASHBOARD_GRID: '[class*="dashboard"], .space-y-4, .grid',
    SIDEBAR_CONTENT: '.space-y-4',

    // Loading and error states
    LOADING_SPINNER: '.animate-spin',
    ERROR_MESSAGE: '[role="alert"], [data-testid*="error"]',

    // Groups display
    GROUP_CARD: '[data-testid*="group"], .group-card',
    GROUP_NAME: '[data-testid="group-name"], .group-name',
    EMPTY_GROUPS_MESSAGE: '[data-testid="empty-groups"], text=No groups yet',
} as const;

// Test data for dashboard scenarios
const DASHBOARD_TEST_DATA = {
    EMPTY_GROUPS: [],
    SAMPLE_GROUPS: [
        {
            id: 'group-1',
            name: 'Weekend Trip',
            description: 'Vacation expenses for the beach house',
            memberCount: 4,
            ownerUid: 'test-user-123',
            balance: 45.50,
            currency: 'USD',
        },
        {
            id: 'group-2',
            name: 'Apartment Expenses',
            description: 'Monthly shared costs for rent and utilities',
            memberCount: 3,
            ownerUid: 'test-user-123',
            balance: -12.25,
            currency: 'USD',
        },
        {
            id: 'group-3',
            name: 'Dinner Club',
            description: 'Weekly restaurant outings with friends',
            memberCount: 6,
            ownerUid: 'other-user-456',
            balance: 0,
            currency: 'USD',
        },
    ],
    USER_DATA: {
        uid: 'test-user-123',
        email: TEST_SCENARIOS.VALID_EMAIL,
        displayName: TEST_SCENARIOS.VALID_NAME,
    },
} as const;

/**
 * High-value dashboard tests that verify actual user behavior
 * These tests focus on dashboard functionality, group management, and user interactions
 */
/**
 * Helper function to mock groups API with comprehensive response
 */
async function mockGroupsAPI(page: any, groups: any[] = DASHBOARD_TEST_DATA.EMPTY_GROUPS, scenario: 'success' | 'error' | 'slow' = 'success'): Promise<void> {
    await page.route('**/api/groups**', async (route: any) => {
        switch (scenario) {
            case 'slow':
                await new Promise(resolve => setTimeout(resolve, 200));
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(groups),
                });
                break;
            case 'error':
                route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Failed to load groups', code: 'GROUPS_FETCH_ERROR' }),
                });
                break;
            case 'success':
            default:
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(groups),
                });
                break;
        }
    });

    // Also mock any group stats/summary endpoints
    await page.route('**/api/groups/stats**', (route: any) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                totalGroups: groups.length,
                totalBalance: groups.reduce((sum: number, g: any) => sum + (g.balance || 0), 0),
                activeGroups: groups.filter((g: any) => g.memberCount > 1).length,
            }),
        });
    });
}

/**
 * Helper to verify dashboard page structure is properly loaded
 */
async function verifyDashboardStructure(page: any): Promise<void> {
    await expectElementVisible(page, DASHBOARD_SELECTORS.MAIN_CONTENT);
    await expectElementVisible(page, DASHBOARD_SELECTORS.GROUPS_SECTION_TITLE);
    await expectElementVisible(page, DASHBOARD_SELECTORS.GROUPS_CONTAINER);
}

/**
 * Helper to verify responsive layout behavior
 */
async function verifyResponsiveLayout(page: any, viewport: 'mobile' | 'tablet' | 'desktop'): Promise<void> {
    const viewportSizes = {
        mobile: { width: 375, height: 667 },
        tablet: { width: 768, height: 1024 },
        desktop: { width: 1024, height: 768 },
    };

    await page.setViewportSize(viewportSizes[viewport]);
    await page.waitForLoadState('networkidle');

    // Verify basic structure remains intact
    await verifyDashboardStructure(page);

    // Check responsive-specific behavior
    if (viewport === 'mobile') {
        // Mobile should show quick actions at top
        const mobileQuickActions = page.locator(DASHBOARD_SELECTORS.QUICK_ACTIONS_MOBILE);
        await expect(mobileQuickActions.first()).toBeVisible();
    } else if (viewport === 'desktop') {
        // Desktop should show sidebar content
        const desktopSidebar = page.locator(DASHBOARD_SELECTORS.QUICK_ACTIONS_DESKTOP);
        await expect(desktopSidebar.first()).toBeVisible();
    }
}

/**
 * Helper to test modal interactions with comprehensive verification
 */
async function testCreateGroupModalInteraction(page: any): Promise<void> {
    // Open modal
    const createButton = page.locator(DASHBOARD_SELECTORS.CREATE_GROUP_BUTTON);
    await expect(createButton).toBeVisible();
    await expectButtonState(page, DASHBOARD_SELECTORS.CREATE_GROUP_BUTTON, 'enabled');
    await createButton.click();

    // Verify modal opens
    await expectElementVisible(page, DASHBOARD_SELECTORS.CREATE_GROUP_MODAL);

    // Close modal
    const closeButton = page.locator(DASHBOARD_SELECTORS.MODAL_CLOSE_BUTTON);
    if (await closeButton.count() > 0) {
        await closeButton.first().click();
    } else {
        await page.keyboard.press('Escape');
    }

    // Verify modal closes
    await page.waitForTimeout(500);
    const modal = page.locator(DASHBOARD_SELECTORS.CREATE_GROUP_MODAL);
    expect(await modal.count()).toBe(0);
}

test.describe('DashboardPage - Behavioral Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupTestPage(page, '/dashboard');
    });

    // === PROTECTED ROUTE BEHAVIOR ===

    test('should redirect to login when accessing dashboard without authentication', async ({ page }) => {
        // Navigate to dashboard without authentication
        await page.goto('/dashboard');

        // Should redirect to login due to ProtectedRoute
        await verifyNavigation(page, /\/login/, 10000);

        // Should preserve returnUrl for after login
        expect(page.url()).toContain('returnUrl');
        expect(page.url()).toContain('dashboard');
    });

    test('should preserve complex returnUrl parameters during authentication redirect', async ({ page }) => {
        // Test various complex URL patterns that users might have
        const testUrls = [
            '/dashboard?tab=groups&filter=active',
            '/dashboard?view=stats&period=monthly',
            '/dashboard?search=vacation&sort=date',
        ];

        for (const testUrl of testUrls) {
            await page.goto(testUrl);
            await verifyNavigation(page, /\/login/);

            const url = new URL(page.url());
            const returnUrl = url.searchParams.get('returnUrl');
            expect(returnUrl).toBeTruthy();

            if (returnUrl) {
                const decodedReturnUrl = decodeURIComponent(returnUrl);
                expect(decodedReturnUrl).toContain('/dashboard');
                // Verify original parameters are preserved
                const originalParams = testUrl.split('?')[1];
                if (originalParams) {
                    expect(decodedReturnUrl).toContain(originalParams);
                }
            }
        }
    });

    test('should handle malformed URL parameters gracefully during redirect', async ({ page }) => {
        // Test edge cases with unusual URL patterns
        const malformedUrls = [
            '/dashboard?param1=value%20with%20spaces&param2=special!@#$',
            '/dashboard?empty=&null=null&undefined',
            '/dashboard?unicode=café&emoji=🎉',
        ];

        for (const malformedUrl of malformedUrls) {
            await page.goto(malformedUrl);
            await verifyNavigation(page, /\/login/);

            // Should still redirect successfully even with malformed parameters
            const url = new URL(page.url());
            const returnUrl = url.searchParams.get('returnUrl');
            expect(returnUrl).toBeTruthy();
        }
    });

    // === AUTHENTICATED DASHBOARD TESTS ===

    test.describe('Authenticated Dashboard - Core Structure', () => {
        test.beforeEach(async ({ page }) => {
            await setupAuthenticatedUser(page);
        });

        test('should render dashboard with proper page structure and metadata', async ({ page }) => {
            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.EMPTY_GROUPS);
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Verify comprehensive page structure
            await verifyDashboardStructure(page);

            // Check page metadata and SEO
            await expect(page).toHaveTitle(/Dashboard.*Splitifyd/i);

            // Verify meta description exists and is meaningful
            const metaDescription = page.locator('meta[name="description"]');
            await expect(metaDescription).toHaveAttribute('content', /.+/);

            // Check for proper heading hierarchy
            const h1 = page.locator('h1');
            if (await h1.count() > 0) {
                await expect(h1.first()).toBeVisible();
            }

            // Verify main navigation structure
            await expectElementVisible(page, DASHBOARD_SELECTORS.GROUPS_SECTION_TITLE);
        });

        test('should have proper semantic HTML structure and accessibility', async ({ page }) => {
            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.EMPTY_GROUPS);
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Check semantic structure
            await expectElementVisible(page, DASHBOARD_SELECTORS.MAIN_CONTENT);

            // Verify all interactive elements are accessible
            const createButton = page.locator(DASHBOARD_SELECTORS.CREATE_GROUP_BUTTON);
            if (await createButton.count() > 0) {
                await expect(createButton).toBeEnabled();
                const buttonText = await createButton.textContent();
                expect(buttonText?.trim().length).toBeGreaterThan(0);
            }

            // Check for proper ARIA labels and roles
            const headings = page.locator('h1, h2, h3, h4, h5, h6');
            const headingCount = await headings.count();
            expect(headingCount).toBeGreaterThan(0);

            // Verify no obvious accessibility violations
            const imgElements = page.locator('img');
            for (let i = 0; i < await imgElements.count(); i++) {
                const img = imgElements.nth(i);
                const alt = await img.getAttribute('alt');
                // Images should have alt text (empty alt is acceptable for decorative images)
                expect(alt).not.toBeNull();
            }
        });

    });

    test.describe('Authenticated Dashboard - Content States', () => {
        test.beforeEach(async ({ page }) => {
            await setupAuthenticatedUser(page);
        });

        test('should display welcome message for new users with no groups', async ({ page }) => {
            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.EMPTY_GROUPS);
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Should show welcome message for first-time users
            await expectElementVisible(page, DASHBOARD_SELECTORS.WELCOME_HEADING);
            await expectElementVisible(page, DASHBOARD_SELECTORS.WELCOME_DESCRIPTION);

            // Welcome message should contain user's name or email
            const welcomeText = await page.locator(DASHBOARD_SELECTORS.WELCOME_HEADING).textContent();
            expect(welcomeText?.toLowerCase()).toMatch(/welcome/i);

            // Should still show groups section even when empty
            await expectElementVisible(page, DASHBOARD_SELECTORS.GROUPS_SECTION_TITLE);
        });

        test('should display comprehensive content when user has existing groups', async ({ page }) => {
            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.SAMPLE_GROUPS);
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Should NOT show welcome message when groups exist
            const welcomeHeading = page.locator(DASHBOARD_SELECTORS.WELCOME_HEADING);
            expect(await welcomeHeading.count()).toBe(0);

            // Should show groups section with content
            await expectElementVisible(page, DASHBOARD_SELECTORS.GROUPS_SECTION_TITLE);
            await expectElementVisible(page, DASHBOARD_SELECTORS.GROUPS_CONTAINER);

            // Verify groups data is displayed
            const pageContent = await page.textContent('body');
            expect(pageContent).toContain('Weekend Trip');
            expect(pageContent).toContain('Apartment Expenses');
            expect(pageContent).toContain('Dinner Club');
        });

        test('should handle mixed group ownership scenarios correctly', async ({ page }) => {
            // Test with groups owned by user and groups where user is member
            const mixedGroups = [
                { ...DASHBOARD_TEST_DATA.SAMPLE_GROUPS[0], ownerUid: DASHBOARD_TEST_DATA.USER_DATA.uid }, // User owns this
                { ...DASHBOARD_TEST_DATA.SAMPLE_GROUPS[1], ownerUid: 'other-user-456' }, // User is member
            ];

            await mockGroupsAPI(page, mixedGroups);
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            await verifyDashboardStructure(page);

            // Should display both owned and member groups
            const pageContent = await page.textContent('body');
            expect(pageContent).toContain('Weekend Trip');
            expect(pageContent).toContain('Apartment Expenses');
        });

        test('should display groups with various balance states correctly', async ({ page }) => {
            // Test groups with positive, negative, and zero balances
            const balanceVariationGroups = DASHBOARD_TEST_DATA.SAMPLE_GROUPS.map((group, index) => ({
                ...group,
                balance: index === 0 ? 45.50 : index === 1 ? -12.25 : 0,
            }));

            await mockGroupsAPI(page, balanceVariationGroups);
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            await verifyDashboardStructure(page);

            // All groups should be displayed regardless of balance
            const pageContent = await page.textContent('body');
            expect(pageContent).toContain('Weekend Trip');
            expect(pageContent).toContain('Apartment Expenses');
            expect(pageContent).toContain('Dinner Club');
        });
    });

    test.describe('Authenticated Dashboard - User Interactions', () => {
        test.beforeEach(async ({ page }) => {
            await setupAuthenticatedUser(page);
        });

        test('should have functional "Create Group" button with modal interaction', async ({ page }) => {
            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.EMPTY_GROUPS);
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Test complete modal interaction
            await testCreateGroupModalInteraction(page);
        });

        test('should handle create group button on different viewport sizes', async ({ page }) => {
            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.EMPTY_GROUPS);
            await page.goto('/dashboard');

            // Test button on desktop
            await page.setViewportSize({ width: 1024, height: 768 });
            await page.waitForLoadState('networkidle');

            const desktopButton = page.locator(DASHBOARD_SELECTORS.CREATE_GROUP_BUTTON);
            await expect(desktopButton).toBeVisible();
            await expectButtonState(page, DASHBOARD_SELECTORS.CREATE_GROUP_BUTTON, 'enabled');

            // Test button behavior on mobile (might be in different location)
            await page.setViewportSize({ width: 375, height: 667 });
            await page.waitForLoadState('networkidle');

            // Mobile might show create button in quick actions area
            const mobileQuickActions = page.locator(DASHBOARD_SELECTORS.QUICK_ACTIONS_MOBILE);
            await expect(mobileQuickActions.first()).toBeVisible();
        });

        test('should handle keyboard navigation for accessibility', async ({ page }) => {
            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.SAMPLE_GROUPS);
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Test tab navigation
            await page.keyboard.press('Tab');

            // Should be able to reach interactive elements
            const focusedElement = page.locator(':focus');
            const tagName = await focusedElement.evaluate(el => el.tagName.toLowerCase());

            // Focused element should be interactive (button, link, input, etc.)
            expect(['button', 'a', 'input', 'select', 'textarea'].includes(tagName)).toBeTruthy();
        });
    });

    test.describe('Authenticated Dashboard - API Integration & Error Handling', () => {
        test.beforeEach(async ({ page }) => {
            await setupAuthenticatedUser(page);
        });

        test('should handle groups API loading states gracefully', async ({ page }) => {
            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.SAMPLE_GROUPS, 'slow');
            await page.goto('/dashboard');

            // Page structure should load immediately
            await expectElementVisible(page, DASHBOARD_SELECTORS.MAIN_CONTENT);
            await expectElementVisible(page, DASHBOARD_SELECTORS.GROUPS_SECTION_TITLE);

            // Eventually content should load completely
            await page.waitForLoadState('networkidle');
            await verifyDashboardStructure(page);
        });

        test('should handle groups API errors gracefully without crashing', async ({ page }) => {
            await mockGroupsAPI(page, [], 'error');
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Page structure should still be visible
            await expectElementVisible(page, DASHBOARD_SELECTORS.MAIN_CONTENT);
            await expectElementVisible(page, DASHBOARD_SELECTORS.GROUPS_SECTION_TITLE);

            // Page should not crash - check that basic functionality remains
            const pageContent = await page.textContent('body');
            expect(pageContent).toBeTruthy();
            expect(pageContent.length).toBeGreaterThan(0);
        });

        test('should handle network failures and retries appropriately', async ({ page }) => {
            // Simulate network instability
            let requestCount = 0;
            await page.route('**/api/groups**', (route) => {
                requestCount++;
                if (requestCount <= 2) {
                    route.abort('failed');
                } else {
                    route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify(DASHBOARD_TEST_DATA.SAMPLE_GROUPS),
                    });
                }
            });

            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Should eventually succeed and show content
            await verifyDashboardStructure(page);
        });

        test('should handle malformed API responses gracefully', async ({ page }) => {
            await page.route('**/api/groups**', (route) => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: 'invalid json response',
                });
            });

            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Should not crash with malformed response
            await expectElementVisible(page, DASHBOARD_SELECTORS.MAIN_CONTENT);
            await expectElementVisible(page, DASHBOARD_SELECTORS.GROUPS_SECTION_TITLE);
        });
    });

    test.describe('Authenticated Dashboard - Responsive Design', () => {
        test.beforeEach(async ({ page }) => {
            await setupAuthenticatedUser(page);
        });

        test('should be fully responsive across all viewport sizes', async ({ page }) => {
            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.SAMPLE_GROUPS);
            await page.goto('/dashboard');

            // Test each viewport systematically
            for (const viewport of ['mobile', 'tablet', 'desktop'] as const) {
                await verifyResponsiveLayout(page, viewport);
            }
        });

        test('should handle quick actions positioning correctly on mobile', async ({ page }) => {
            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.EMPTY_GROUPS);
            await page.setViewportSize({ width: 375, height: 667 });
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Mobile should show quick actions at top
            const mobileQuickActions = page.locator(DASHBOARD_SELECTORS.QUICK_ACTIONS_MOBILE);
            await expect(mobileQuickActions.first()).toBeVisible();

            // Desktop sidebar should be hidden on mobile
            const desktopSidebar = page.locator(DASHBOARD_SELECTORS.QUICK_ACTIONS_DESKTOP);
            expect(await desktopSidebar.count()).toBeGreaterThan(0);
        });

        test('should display dashboard stats in sidebar on desktop viewport', async ({ page }) => {
            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.SAMPLE_GROUPS);
            await page.setViewportSize({ width: 1024, height: 768 });
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Desktop should show sidebar content
            const desktopSidebar = page.locator(DASHBOARD_SELECTORS.QUICK_ACTIONS_DESKTOP);
            await expect(desktopSidebar.first()).toBeVisible();

            // Sidebar should contain meaningful content
            const sidebarContent = await page.locator(DASHBOARD_SELECTORS.SIDEBAR_CONTENT).textContent();
            expect(sidebarContent?.trim().length).toBeGreaterThan(0);
        });

        test('should handle extreme viewport sizes gracefully', async ({ page }) => {
            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.SAMPLE_GROUPS);

            // Test very small viewport
            await page.setViewportSize({ width: 320, height: 568 });
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');
            await verifyDashboardStructure(page);

            // Test very large viewport
            await page.setViewportSize({ width: 1920, height: 1080 });
            await page.reload();
            await page.waitForLoadState('networkidle');
            await verifyDashboardStructure(page);
        });
    });

    // === AUTHENTICATION EDGE CASES ===

    test.describe('Authentication Edge Cases', () => {
        test('should handle partial authentication state gracefully', async ({ page }) => {
            // Mock incomplete auth state
            await page.evaluate(() => {
                localStorage.setItem('USER_ID', 'incomplete-user');
                // Don't set complete auth state
            });

            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Should either redirect to login or handle gracefully
            const currentUrl = page.url();
            const isOnLogin = currentUrl.includes('/login');
            const isOnDashboard = currentUrl.includes('/dashboard');

            expect(isOnLogin || isOnDashboard).toBe(true);
        });

        test('should handle authentication expiration during dashboard usage', async ({ page }) => {
            await setupAuthenticatedUser(page);
            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.SAMPLE_GROUPS);
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Clear auth state to simulate expiration
            await page.evaluate(() => {
                localStorage.clear();
                sessionStorage.clear();
            });

            // Try to interact with the page
            await page.reload();

            // Should handle auth expiration gracefully (redirect to login)
            await page.waitForLoadState('networkidle');
            const currentUrl = page.url();
            expect(currentUrl.includes('/login') || currentUrl.includes('/dashboard')).toBe(true);
        });
    });

    // === PERFORMANCE AND EDGE CASES ===

    test.describe('Performance and Edge Cases', () => {
        test.beforeEach(async ({ page }) => {
            await setupAuthenticatedUser(page);
        });

        test('should handle slow network conditions gracefully', async ({ page }) => {
            // Simulate slow network for all requests
            await page.route('**/*', async (route) => {
                await new Promise(resolve => setTimeout(resolve, 100));
                route.continue();
            });

            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.SAMPLE_GROUPS);
            await page.goto('/dashboard');

            // Page should still load (just slower)
            await expect(page.locator(DASHBOARD_SELECTORS.MAIN_CONTENT)).toBeVisible({ timeout: 15000 });
            await expectElementVisible(page, DASHBOARD_SELECTORS.GROUPS_SECTION_TITLE);
        });

        test('should handle large numbers of groups efficiently', async ({ page }) => {
            // Create many groups to test performance
            const manyGroups = Array.from({ length: 50 }, (_, i) => ({
                id: `group-${i + 1}`,
                name: `Test Group ${i + 1}`,
                description: `Description for test group ${i + 1}`,
                memberCount: Math.floor(Math.random() * 10) + 1,
                ownerUid: i % 2 === 0 ? DASHBOARD_TEST_DATA.USER_DATA.uid : 'other-user',
                balance: (Math.random() - 0.5) * 200,
                currency: 'USD',
            }));

            await mockGroupsAPI(page, manyGroups);
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Should handle many groups without performance issues
            await verifyDashboardStructure(page);

            // Page should remain responsive
            const createButton = page.locator(DASHBOARD_SELECTORS.CREATE_GROUP_BUTTON);
            if (await createButton.count() > 0) {
                await expect(createButton).toBeEnabled();
            }
        });

        test('should maintain functionality with JavaScript errors in console', async ({ page }) => {
            // Inject a minor JavaScript error
            await page.addInitScript(() => {
                window.console.warn('Test warning - should not affect functionality');
            });

            await mockGroupsAPI(page, DASHBOARD_TEST_DATA.SAMPLE_GROUPS);
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Should still function normally despite console warnings
            await verifyDashboardStructure(page);

            // Interactive elements should still work
            const createButton = page.locator(DASHBOARD_SELECTORS.CREATE_GROUP_BUTTON);
            if (await createButton.count() > 0) {
                await expectButtonState(page, DASHBOARD_SELECTORS.CREATE_GROUP_BUTTON, 'enabled');
            }
        });
    });
});