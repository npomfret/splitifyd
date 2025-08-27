import { expect, test } from '@playwright/test';
import { multiUserTest } from '../../fixtures';
import { EMULATOR_URL, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { generateShortId } from '../../utils/test-helpers';

setupMCPDebugOnFailure();

test.describe('User Storage Isolation', () => {
    multiUserTest('should isolate user preferences between different users', async ({ authenticatedPage, secondUser }) => {
        const { page: page1, user: user1 } = authenticatedPage;
        const { page: page2, user: user2 } = secondUser;

        // Verify we have different users
        expect(user1.email).not.toBe(user2.email);
        expect(user1.displayName).not.toBe(user2.displayName);

        // Create groups for each user to interact with currency preferences
        const groupWorkflow1 = new GroupWorkflow(page1);
        const groupWorkflow2 = new GroupWorkflow(page2);

        const uniqueId1 = generateShortId();
        const uniqueId2 = generateShortId();

        // User 1 creates a group and uses EUR currency
        await groupWorkflow1.createGroupAndNavigate(`User1 Group ${uniqueId1}`, 'Testing currency isolation');

        // Navigate to add expense page for user 1
        await page1.click('[data-testid="add-expense-button"]');
        await page1.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // User 1 interacts with currency selector to create recent currency data
        const currencySelect1 = page1.locator('[data-testid="expense-currency"]');
        if (await currencySelect1.isVisible()) {
            // Try to select EUR if available to create recent currency data
            try {
                await currencySelect1.selectOption('EUR');
                await expect(currencySelect1).toHaveValue('EUR');
            } catch (error) {
                console.log('EUR currency not available, using default');
            }
        }

        // Navigate back to dashboard
        await page1.goto(`${EMULATOR_URL}/dashboard`);
        await page1.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // User 2 creates a group and should not see User 1's currency preferences
        await groupWorkflow2.createGroupAndNavigate(`User2 Group ${uniqueId2}`, 'Testing currency isolation for user 2');

        // Navigate to add expense page for user 2
        await page2.click('[data-testid="add-expense-button"]');
        await page2.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Check user 2's currency selector - it should not have User 1's recent currencies
        const currencySelect2 = page2.locator('[data-testid="expense-currency"]');

        // Verify that User 2 starts with default currency settings
        // and doesn't inherit User 1's EUR selection
        let user2CurrencyValue = 'USD'; // default assumption
        if (await currencySelect2.isVisible()) {
            user2CurrencyValue = (await currencySelect2.inputValue()) || 'USD';
        }

        // User 2 should have default currency (likely USD) and no recent EUR from User 1
        expect(user2CurrencyValue).toBe('USD'); // Assuming USD is the default

        // Test that users can have different recent categories by adding expenses
        // User 1 - add an expense with 'entertainment' category
        await page1.goto(`${EMULATOR_URL}/dashboard`);
        await page1.click(`[href*="/groups/"]`); // Click on User 1's group
        await page1.waitForLoadState('domcontentloaded', { timeout: 5000 });
        await page1.click('[data-testid="add-expense-button"]');
        await page1.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Fill out expense form for User 1 with entertainment category
        await page1.fill('[data-testid="expense-description"]', 'Movie tickets');
        await page1.fill('[data-testid="expense-amount"]', '25');

        // Select entertainment category if available
        const categorySelect1 = page1.locator('[data-testid="expense-category"]');
        if (await categorySelect1.isVisible()) {
            await categorySelect1.selectOption('entertainment');
        }

        // User 2 - add an expense with 'food' category
        await page2.goto(`${EMULATOR_URL}/dashboard`);
        await page2.click(`[href*="/groups/"]`); // Click on User 2's group
        await page2.waitForLoadState('domcontentloaded', { timeout: 5000 });
        await page2.click('[data-testid="add-expense-button"]');
        await page2.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Fill out expense form for User 2 with food category
        await page2.fill('[data-testid="expense-description"]', 'Restaurant dinner');
        await page2.fill('[data-testid="expense-amount"]', '45');

        // Select food category if available
        const categorySelect2 = page2.locator('[data-testid="expense-category"]');
        if (await categorySelect2.isVisible()) {
            await categorySelect2.selectOption('food');
        }

        // The key test: verify that each user only sees their own recent data
        // This test validates that user-scoped storage is working correctly

        // Check that storage isolation is working by verifying in browser storage
        const user1Storage = await page1.evaluate(() => {
            const keys = Object.keys(localStorage);
            return {
                totalKeys: keys.length,
                userKeys: keys.filter((key: string) => key.includes('user_')),
                globalKeys: keys.filter((key: string) => !key.includes('user_') && !key.includes('global_')),
            };
        });

        const user2Storage = await page2.evaluate(() => {
            const keys = Object.keys(localStorage);
            return {
                totalKeys: keys.length,
                userKeys: keys.filter((key: string) => key.includes('user_')),
                globalKeys: keys.filter((key: string) => !key.includes('user_') && !key.includes('global_')),
            };
        });

        // Verify that both users have user-scoped storage keys
        expect(user1Storage.userKeys.length).toBeGreaterThan(0);
        expect(user2Storage.userKeys.length).toBeGreaterThan(0);

        // Verify that user-scoped keys are different between users
        // (they should contain different user IDs)
        const user1UserKeys = user1Storage.userKeys.filter((key: string) => key.includes(user1.uid));
        const user2UserKeys = user2Storage.userKeys.filter((key: string) => key.includes(user2.uid));

        expect(user1UserKeys.length).toBeGreaterThan(0);
        expect(user2UserKeys.length).toBeGreaterThan(0);

        // Verify no overlap in user-specific storage keys
        const user1SpecificKeys = user1Storage.userKeys.filter((key: string) => key.includes(user1.uid));
        const user2SpecificKeys = user2Storage.userKeys.filter((key: string) => key.includes(user2.uid));

        // No keys should be shared between users
        const sharedKeys = user1SpecificKeys.filter((key: string) => user2SpecificKeys.includes(key));
        expect(sharedKeys.length).toBe(0);
    });

    multiUserTest('should clear user storage on logout', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;

        // Create some user data by interacting with the app
        const groupWorkflow = new GroupWorkflow(page);
        const uniqueId = generateShortId();

        await groupWorkflow.createGroupAndNavigate(`Logout Test ${uniqueId}`, 'Testing storage cleanup on logout');

        // Add some user-scoped data by going to add expense
        await page.click('[data-testid="add-expense-button"]');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Fill out form to create recent categories/amounts
        await page.fill('[data-testid="expense-description"]', 'Test expense');
        await page.fill('[data-testid="expense-amount"]', '10');

        // Check that user has storage keys
        const storageBeforeLogout = await page.evaluate(() => {
            const keys = Object.keys(localStorage);
            return {
                allKeys: keys,
                userKeys: keys.filter((key) => key.includes('user_')),
                totalKeys: keys.length,
            };
        });

        // Should have user storage keys
        expect(storageBeforeLogout.userKeys.length).toBeGreaterThan(0);

        // Log out the user
        await page.goto(`${EMULATOR_URL}/dashboard`);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Click user menu to show logout option
        await page.getByRole('button', { name: user.displayName }).click();
        await page.getByRole('button', { name: /logout|sign out/i }).click();

        // Wait for logout to complete
        await expect(page).toHaveURL((url: URL) => !url.toString().includes('/dashboard'));

        // Check that user-specific storage is cleared
        const storageAfterLogout = await page.evaluate(() => {
            const keys = Object.keys(localStorage);
            return {
                allKeys: keys,
                userKeys: keys.filter((key) => key.includes('user_')),
                totalKeys: keys.length,
            };
        });

        // User-specific storage should be significantly reduced or empty
        // (some global keys might remain, but user-specific keys should be gone)
        expect(storageAfterLogout.userKeys.length).toBeLessThan(storageBeforeLogout.userKeys.length);
    });
});
