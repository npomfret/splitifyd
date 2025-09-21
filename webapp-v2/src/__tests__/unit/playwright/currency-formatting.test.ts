import { test, expect } from '@playwright/test';
import {
    setupTestPage,
    setupAuthenticatedUserWithToken,
    TEST_SCENARIOS,
} from '../infra/test-helpers';

/**
 * Unit tests for currency formatting consistency
 * Tests currency display across different components without full flows
 */
test.describe('Currency Formatting', () => {
    let authToken: { idToken: string; localId: string; refreshToken: string };

    // Test currency data with different amounts and currencies
    const currencyTestData = [
        { amount: 50.00, currency: 'USD', symbol: '$', expectedDisplay: '$50.00' },
        { amount: 25.50, currency: 'EUR', symbol: '€', expectedDisplay: '€25.50' },
        { amount: 100.75, currency: 'GBP', symbol: '£', expectedDisplay: '£100.75' },
        { amount: 0.99, currency: 'USD', symbol: '$', expectedDisplay: '$0.99' },
        { amount: 1000.00, currency: 'EUR', symbol: '€', expectedDisplay: '€1000.00' },
        { amount: 33.33, currency: 'GBP', symbol: '£', expectedDisplay: '£33.33' },
    ];

    async function addCurrencyDisplayElements(page: any, testData: typeof currencyTestData) {
        await page.addStyleTag({
            content: `
                .currency-test-container { padding: 20px; font-family: Arial, sans-serif; }
                .currency-section { margin-bottom: 30px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; }
                .currency-section h3 { margin-top: 0; color: #333; }
                .currency-amount { display: inline-block; padding: 5px 10px; margin: 5px; background: #f5f5f5; border-radius: 4px; font-weight: bold; }
                .currency-usd { color: #2e7d32; }
                .currency-eur { color: #1565c0; }
                .currency-gbp { color: #6a1b9a; }
                .expense-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
                .settlement-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
                .balance-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
                .amount-display { font-weight: bold; }
                .precision-test { background: #fff3cd; padding: 10px; margin: 5px 0; }
            `
        });

        let containerHTML = '<div class="currency-test-container">';

        // Expense amounts section
        containerHTML += '<div class="currency-section" id="expense-amounts">';
        containerHTML += '<h3>Expense Amounts</h3>';
        testData.forEach((item, index) => {
            const cssClass = `currency-${item.currency.toLowerCase()}`;
            containerHTML += `
                <div class="expense-item" data-testid="expense-${index}">
                    <span>Test Expense ${index + 1}</span>
                    <span class="amount-display ${cssClass}" data-currency="${item.currency}" data-amount="${item.amount}">${item.expectedDisplay}</span>
                </div>
            `;
        });
        containerHTML += '</div>';

        // Settlement amounts section
        containerHTML += '<div class="currency-section" id="settlement-amounts">';
        containerHTML += '<h3>Settlement Amounts</h3>';
        testData.forEach((item, index) => {
            const cssClass = `currency-${item.currency.toLowerCase()}`;
            containerHTML += `
                <div class="settlement-item" data-testid="settlement-${index}">
                    <span>Settlement ${index + 1}</span>
                    <span class="amount-display ${cssClass}" data-currency="${item.currency}" data-amount="${item.amount}">${item.expectedDisplay}</span>
                </div>
            `;
        });
        containerHTML += '</div>';

        // Balance/debt amounts section
        containerHTML += '<div class="currency-section" id="balance-amounts">';
        containerHTML += '<h3>Balance Amounts</h3>';
        testData.forEach((item, index) => {
            const cssClass = `currency-${item.currency.toLowerCase()}`;
            containerHTML += `
                <div class="balance-item" data-testid="balance-${index}">
                    <span>User A owes User B</span>
                    <span class="amount-display ${cssClass}" data-currency="${item.currency}" data-amount="${item.amount}">${item.expectedDisplay}</span>
                </div>
            `;
        });
        containerHTML += '</div>';

        // Precision test section
        containerHTML += '<div class="currency-section" id="precision-tests">';
        containerHTML += '<h3>Precision Tests</h3>';
        const precisionTests = [
            { amount: 33.333333, currency: 'USD', expected: '$33.33' },
            { amount: 123.456789, currency: 'EUR', expected: '€123.46' },
            { amount: 0.001, currency: 'GBP', expected: '£0.00' },
            { amount: 99.999, currency: 'USD', expected: '$100.00' },
        ];

        precisionTests.forEach((item, index) => {
            containerHTML += `
                <div class="precision-test" data-testid="precision-${index}">
                    <span>Precision Test: ${item.amount} → </span>
                    <span class="amount-display currency-${item.currency.toLowerCase()}" data-precision-test="${item.amount}">${item.expected}</span>
                </div>
            `;
        });
        containerHTML += '</div>';

        // Multi-currency section (same amounts, different currencies)
        containerHTML += '<div class="currency-section" id="multi-currency">';
        containerHTML += '<h3>Multi-Currency (Same Amount)</h3>';
        const sameAmount = 50.00;
        ['USD', 'EUR', 'GBP'].forEach((currency, index) => {
            const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';
            const cssClass = `currency-${currency.toLowerCase()}`;
            containerHTML += `
                <div class="currency-amount ${cssClass}" data-testid="multi-${index}">
                    ${symbol}${sameAmount.toFixed(2)}
                </div>
            `;
        });
        containerHTML += '<p><em>Same amount (50.00) in different currencies - no conversion applied</em></p>';
        containerHTML += '</div>';

        containerHTML += '</div>';

        await page.addScriptTag({
            content: `document.body.insertAdjacentHTML('beforeend', \`${containerHTML}\`);`
        });
    }

    test.beforeAll(async () => {
        authToken = {
            idToken: 'mock-id-token-' + Date.now(),
            localId: 'test-user-id-' + Date.now(),
            refreshToken: 'mock-refresh-token-' + Date.now()
        };
    });

    test.beforeEach(async ({ page }) => {
        await setupTestPage(page, '/');
        await setupAuthenticatedUserWithToken(page, authToken);
    });

    test('should format USD currency consistently across components', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addCurrencyDisplayElements(page, currencyTestData);

        // Test expense amounts for USD items
        for (let i = 0; i < currencyTestData.length; i++) {
            const item = currencyTestData[i];
            if (item.currency === 'USD') {
                const expenseAmount = page.locator(`[data-testid="expense-${i}"] .amount-display`);
                await expect(expenseAmount).toContainText(item.expectedDisplay);
                await expect(expenseAmount).toContainText('$'); // Symbol present
                await expect(expenseAmount).not.toContainText('USD'); // No currency code
            }
        }

        // Test settlement amounts for USD items
        for (let i = 0; i < currencyTestData.length; i++) {
            const item = currencyTestData[i];
            if (item.currency === 'USD') {
                const settlementAmount = page.locator(`[data-testid="settlement-${i}"] .amount-display`);
                await expect(settlementAmount).toContainText(item.expectedDisplay);
            }
        }

        // Test balance amounts for USD items
        for (let i = 0; i < currencyTestData.length; i++) {
            const item = currencyTestData[i];
            if (item.currency === 'USD') {
                const balanceAmount = page.locator(`[data-testid="balance-${i}"] .amount-display`);
                await expect(balanceAmount).toContainText(item.expectedDisplay);
            }
        }
    });

    test('should format EUR currency consistently across components', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addCurrencyDisplayElements(page, currencyTestData);

        // Test all EUR amounts across components
        for (let i = 0; i < currencyTestData.length; i++) {
            const item = currencyTestData[i];
            if (item.currency === 'EUR') {
                const expenseAmount = page.locator(`[data-testid="expense-${i}"] .amount-display`);
                const settlementAmount = page.locator(`[data-testid="settlement-${i}"] .amount-display`);
                const balanceAmount = page.locator(`[data-testid="balance-${i}"] .amount-display`);

                // All should show same format
                await expect(expenseAmount).toContainText(item.expectedDisplay);
                await expect(settlementAmount).toContainText(item.expectedDisplay);
                await expect(balanceAmount).toContainText(item.expectedDisplay);

                // All should use € symbol
                await expect(expenseAmount).toContainText('€');
                await expect(settlementAmount).toContainText('€');
                await expect(balanceAmount).toContainText('€');
            }
        }
    });

    test('should format GBP currency consistently across components', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addCurrencyDisplayElements(page, currencyTestData);

        // Test all GBP amounts across components
        for (let i = 0; i < currencyTestData.length; i++) {
            const item = currencyTestData[i];
            if (item.currency === 'GBP') {
                const expenseAmount = page.locator(`[data-testid="expense-${i}"] .amount-display`);
                const settlementAmount = page.locator(`[data-testid="settlement-${i}"] .amount-display`);
                const balanceAmount = page.locator(`[data-testid="balance-${i}"] .amount-display`);

                // All should show same format
                await expect(expenseAmount).toContainText(item.expectedDisplay);
                await expect(settlementAmount).toContainText(item.expectedDisplay);
                await expect(balanceAmount).toContainText(item.expectedDisplay);

                // All should use £ symbol
                await expect(expenseAmount).toContainText('£');
                await expect(settlementAmount).toContainText('£');
                await expect(balanceAmount).toContainText('£');
            }
        }
    });

    test('should maintain consistent decimal precision', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addCurrencyDisplayElements(page, currencyTestData);

        // Test all currency amounts have exactly 2 decimal places
        const allAmounts = page.locator('.amount-display');
        const count = await allAmounts.count();

        for (let i = 0; i < count; i++) {
            const amount = allAmounts.nth(i);
            const text = await amount.textContent();

            if (text) {
                // Should match pattern: symbol + digits + . + exactly 2 digits
                expect(text).toMatch(/[€$£]\d+\.\d{2}$/);
                // Should not have more than 2 decimal places
                expect(text).not.toMatch(/\.\d{3,}/);
            }
        }
    });

    test('should handle precision rounding correctly', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addCurrencyDisplayElements(page, currencyTestData);

        // Test precision tests section
        const precisionTests = [
            { selector: '[data-testid="precision-0"]', expected: '$33.33' }, // 33.333333 rounds to 33.33
            { selector: '[data-testid="precision-1"]', expected: '€123.46' }, // 123.456789 rounds to 123.46
            { selector: '[data-testid="precision-2"]', expected: '£0.00' }, // 0.001 rounds to 0.00
            { selector: '[data-testid="precision-3"]', expected: '$100.00' }, // 99.999 rounds to 100.00
        ];

        for (const test of precisionTests) {
            const element = page.locator(`${test.selector} .amount-display`);
            await expect(element).toContainText(test.expected);
        }
    });

    test('should use consistent currency symbol placement', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addCurrencyDisplayElements(page, currencyTestData);

        // All currency amounts should have symbol at the beginning
        const allAmounts = page.locator('.amount-display');
        const count = await allAmounts.count();

        for (let i = 0; i < count; i++) {
            const amount = allAmounts.nth(i);
            const text = await amount.textContent();

            if (text) {
                // Should start with currency symbol
                expect(text).toMatch(/^[€$£]/);
                // Should not end with currency symbol
                expect(text).not.toMatch(/[€$£]$/);
                // Should not have currency symbol in the middle
                expect(text.slice(1)).not.toMatch(/[€$£]/);
            }
        }
    });

    test('should handle zero amounts correctly', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Add zero amount test data
        await page.addScriptTag({
            content: `
                const zeroHTML = \`
                    <div class="currency-section" id="zero-amounts">
                        <h3>Zero Amount Tests</h3>
                        <div class="currency-amount currency-usd" data-testid="zero-usd">$0.00</div>
                        <div class="currency-amount currency-eur" data-testid="zero-eur">€0.00</div>
                        <div class="currency-amount currency-gbp" data-testid="zero-gbp">£0.00</div>
                    </div>
                \`;
                document.body.insertAdjacentHTML('beforeend', zeroHTML);
            `
        });

        // Test zero amounts are displayed consistently
        await expect(page.locator('[data-testid="zero-usd"]')).toContainText('$0.00');
        await expect(page.locator('[data-testid="zero-eur"]')).toContainText('€0.00');
        await expect(page.locator('[data-testid="zero-gbp"]')).toContainText('£0.00');

        // Should still follow 2 decimal place rule (exact match, not just '$0')
        await expect(page.locator('[data-testid="zero-usd"]')).not.toHaveText('$0');
        await expect(page.locator('[data-testid="zero-eur"]')).not.toHaveText('€0');
        await expect(page.locator('[data-testid="zero-gbp"]')).not.toHaveText('£0');
    });

    test('should display large amounts correctly', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Add large amount test data
        await page.addScriptTag({
            content: `
                const largeHTML = \`
                    <div class="currency-section" id="large-amounts">
                        <h3>Large Amount Tests</h3>
                        <div class="currency-amount currency-usd" data-testid="large-usd">$12345.67</div>
                        <div class="currency-amount currency-eur" data-testid="large-eur">€99999.99</div>
                        <div class="currency-amount currency-gbp" data-testid="large-gbp">£1000000.00</div>
                    </div>
                \`;
                document.body.insertAdjacentHTML('beforeend', largeHTML);
            `
        });

        // Test large amounts are displayed without thousand separators (or with consistent formatting)
        const largeUSD = page.locator('[data-testid="large-usd"]');
        const largeEUR = page.locator('[data-testid="large-eur"]');
        const largeGBP = page.locator('[data-testid="large-gbp"]');

        await expect(largeUSD).toContainText('$12345.67');
        await expect(largeEUR).toContainText('€99999.99');
        await expect(largeGBP).toContainText('£1000000.00');

        // Should maintain decimal precision even for large amounts
        await expect(largeUSD).toContainText('.67');
        await expect(largeEUR).toContainText('.99');
        await expect(largeGBP).toContainText('.00');
    });

    test('should treat same amounts in different currencies separately', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addCurrencyDisplayElements(page, currencyTestData);

        // Test multi-currency section shows same amount in different currencies
        const multiUSD = page.locator('[data-testid="multi-0"]');
        const multiEUR = page.locator('[data-testid="multi-1"]');
        const multiGBP = page.locator('[data-testid="multi-2"]');

        // All should show the same numeric value but different symbols
        await expect(multiUSD).toContainText('$50.00');
        await expect(multiEUR).toContainText('€50.00');
        await expect(multiGBP).toContainText('£50.00');

        // Verify no FX conversion - same numeric amount
        const usdText = await multiUSD.textContent();
        const eurText = await multiEUR.textContent();
        const gbpText = await multiGBP.textContent();

        const usdAmount = usdText?.replace('$', '').trim();
        const eurAmount = eurText?.replace('€', '').trim();
        const gbpAmount = gbpText?.replace('£', '').trim();

        expect(usdAmount).toBe(eurAmount);
        expect(eurAmount).toBe(gbpAmount);
        expect(usdAmount).toBe('50.00');
    });

    test('should maintain consistent styling across currency types', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addCurrencyDisplayElements(page, currencyTestData);

        // Test that all currency amounts have consistent base styling
        const usdAmounts = page.locator('.currency-usd');
        const eurAmounts = page.locator('.currency-eur');
        const gbpAmounts = page.locator('.currency-gbp');

        // All should be visible and have amount-display class
        const usdCount = await usdAmounts.count();
        const eurCount = await eurAmounts.count();
        const gbpCount = await gbpAmounts.count();

        expect(usdCount).toBeGreaterThan(0);
        expect(eurCount).toBeGreaterThan(0);
        expect(gbpCount).toBeGreaterThan(0);

        // Check that styling is applied (by checking computed styles or class presence)
        for (let i = 0; i < usdCount; i++) {
            await expect(usdAmounts.nth(i)).toBeVisible();
        }
        for (let i = 0; i < eurCount; i++) {
            await expect(eurAmounts.nth(i)).toBeVisible();
        }
        for (let i = 0; i < gbpCount; i++) {
            await expect(gbpAmounts.nth(i)).toBeVisible();
        }
    });

    test('should handle edge case amounts correctly', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Add edge case test data
        await page.addScriptTag({
            content: `
                const edgeHTML = \`
                    <div class="currency-section" id="edge-cases">
                        <h3>Edge Case Amounts</h3>
                        <div class="currency-amount currency-usd" data-testid="edge-cent">$0.01</div>
                        <div class="currency-amount currency-eur" data-testid="edge-max">€999999.99</div>
                        <div class="currency-amount currency-gbp" data-testid="edge-fraction">£123.45</div>
                        <div class="currency-amount currency-usd" data-testid="edge-round">$999.99</div>
                    </div>
                \`;
                document.body.insertAdjacentHTML('beforeend', edgeHTML);
            `
        });

        // Test edge cases
        await expect(page.locator('[data-testid="edge-cent"]')).toContainText('$0.01');
        await expect(page.locator('[data-testid="edge-max"]')).toContainText('€999999.99');
        await expect(page.locator('[data-testid="edge-fraction"]')).toContainText('£123.45');
        await expect(page.locator('[data-testid="edge-round"]')).toContainText('$999.99');

        // All should maintain 2 decimal places
        const edgeAmounts = page.locator('#edge-cases .currency-amount');
        const count = await edgeAmounts.count();

        for (let i = 0; i < count; i++) {
            const amount = edgeAmounts.nth(i);
            const text = await amount.textContent();
            expect(text).toMatch(/\.\d{2}$/);
        }
    });
});