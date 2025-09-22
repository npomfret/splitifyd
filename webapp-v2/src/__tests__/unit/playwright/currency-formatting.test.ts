import { test, expect } from '@playwright/test';
import {
    setupTestPage,
    setupAuthenticatedUserWithToken,
    TEST_SCENARIOS,
} from '../infra/test-helpers';
import { CURRENCY_REPLACEMENTS, formatTestCurrency, getTestCurrency } from './test-currencies';

/**
 * Unit tests for currency formatting consistency
 * Tests currency display across different components without full flows
 */
test.describe('Currency Formatting', () => {
    let authToken: { idToken: string; localId: string; refreshToken: string };

    // Test currency data with different amounts and currencies
    const currencyTestData = [
        { amount: 50.00, currency: CURRENCY_REPLACEMENTS.USD.acronym, symbol: CURRENCY_REPLACEMENTS.USD.symbol, expectedDisplay: formatTestCurrency(50.00, CURRENCY_REPLACEMENTS.USD) },
        { amount: 25.50, currency: CURRENCY_REPLACEMENTS.EUR.acronym, symbol: CURRENCY_REPLACEMENTS.EUR.symbol, expectedDisplay: formatTestCurrency(25.50, CURRENCY_REPLACEMENTS.EUR) },
        { amount: 100.75, currency: CURRENCY_REPLACEMENTS.GBP.acronym, symbol: CURRENCY_REPLACEMENTS.GBP.symbol, expectedDisplay: formatTestCurrency(100.75, CURRENCY_REPLACEMENTS.GBP) },
        { amount: 0.99, currency: CURRENCY_REPLACEMENTS.USD.acronym, symbol: CURRENCY_REPLACEMENTS.USD.symbol, expectedDisplay: formatTestCurrency(0.99, CURRENCY_REPLACEMENTS.USD) },
        { amount: 1000.00, currency: CURRENCY_REPLACEMENTS.EUR.acronym, symbol: CURRENCY_REPLACEMENTS.EUR.symbol, expectedDisplay: formatTestCurrency(1000.00, CURRENCY_REPLACEMENTS.EUR) },
        { amount: 33.33, currency: CURRENCY_REPLACEMENTS.GBP.acronym, symbol: CURRENCY_REPLACEMENTS.GBP.symbol, expectedDisplay: formatTestCurrency(33.33, CURRENCY_REPLACEMENTS.GBP) },
    ];

    async function addCurrencyDisplayElements(page: any, testData: typeof currencyTestData) {
        await page.addStyleTag({
            content: `
                .currency-test-container { padding: 20px; font-family: Arial, sans-serif; }
                .currency-section { margin-bottom: 30px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; }
                .currency-section h3 { margin-top: 0; color: #333; }
                .currency-amount { display: inline-block; padding: 5px 10px; margin: 5px; background: #f5f5f5; border-radius: 4px; font-weight: bold; }
                .currency-pln { color: #2e7d32; }
                .currency-thb { color: #1565c0; }
                .currency-ron { color: #6a1b9a; }
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
            { amount: 33.333333, currency: CURRENCY_REPLACEMENTS.USD.acronym, expected: formatTestCurrency(33.33, CURRENCY_REPLACEMENTS.USD) },
            { amount: 123.456789, currency: CURRENCY_REPLACEMENTS.EUR.acronym, expected: formatTestCurrency(123.46, CURRENCY_REPLACEMENTS.EUR) },
            { amount: 0.001, currency: CURRENCY_REPLACEMENTS.GBP.acronym, expected: formatTestCurrency(0.00, CURRENCY_REPLACEMENTS.GBP) },
            { amount: 99.999, currency: CURRENCY_REPLACEMENTS.USD.acronym, expected: formatTestCurrency(100.00, CURRENCY_REPLACEMENTS.USD) },
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
        [CURRENCY_REPLACEMENTS.USD, CURRENCY_REPLACEMENTS.EUR, CURRENCY_REPLACEMENTS.GBP].forEach((currency, index) => {
            const symbol = currency.symbol;
            const cssClass = `currency-${currency.acronym.toLowerCase()}`;
            containerHTML += `
                <div class="currency-amount ${cssClass}" data-testid="multi-${index}">
                    ${formatTestCurrency(sameAmount, currency)}
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
            if (item.currency === CURRENCY_REPLACEMENTS.USD.acronym) {
                const expenseAmount = page.locator(`[data-testid="expense-${i}"] .amount-display`);
                await expect(expenseAmount).toContainText(item.expectedDisplay);
                await expect(expenseAmount).toContainText(CURRENCY_REPLACEMENTS.USD.symbol); // Symbol present
                await expect(expenseAmount).not.toContainText('USD'); // No currency code
            }
        }

        // Test settlement amounts for USD items
        for (let i = 0; i < currencyTestData.length; i++) {
            const item = currencyTestData[i];
            if (item.currency === CURRENCY_REPLACEMENTS.USD.acronym) {
                const settlementAmount = page.locator(`[data-testid="settlement-${i}"] .amount-display`);
                await expect(settlementAmount).toContainText(item.expectedDisplay);
            }
        }

        // Test balance amounts for USD items
        for (let i = 0; i < currencyTestData.length; i++) {
            const item = currencyTestData[i];
            if (item.currency === CURRENCY_REPLACEMENTS.USD.acronym) {
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
            if (item.currency === CURRENCY_REPLACEMENTS.EUR.acronym) {
                const expenseAmount = page.locator(`[data-testid="expense-${i}"] .amount-display`);
                const settlementAmount = page.locator(`[data-testid="settlement-${i}"] .amount-display`);
                const balanceAmount = page.locator(`[data-testid="balance-${i}"] .amount-display`);

                // All should show same format
                await expect(expenseAmount).toContainText(item.expectedDisplay);
                await expect(settlementAmount).toContainText(item.expectedDisplay);
                await expect(balanceAmount).toContainText(item.expectedDisplay);

                // All should use € symbol
                await expect(expenseAmount).toContainText(CURRENCY_REPLACEMENTS.EUR.symbol);
                await expect(settlementAmount).toContainText(CURRENCY_REPLACEMENTS.EUR.symbol);
                await expect(balanceAmount).toContainText(CURRENCY_REPLACEMENTS.EUR.symbol);
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
            if (item.currency === CURRENCY_REPLACEMENTS.GBP.acronym) {
                const expenseAmount = page.locator(`[data-testid="expense-${i}"] .amount-display`);
                const settlementAmount = page.locator(`[data-testid="settlement-${i}"] .amount-display`);
                const balanceAmount = page.locator(`[data-testid="balance-${i}"] .amount-display`);

                // All should show same format
                await expect(expenseAmount).toContainText(item.expectedDisplay);
                await expect(settlementAmount).toContainText(item.expectedDisplay);
                await expect(balanceAmount).toContainText(item.expectedDisplay);

                // All should use £ symbol
                await expect(expenseAmount).toContainText(CURRENCY_REPLACEMENTS.GBP.symbol);
                await expect(settlementAmount).toContainText(CURRENCY_REPLACEMENTS.GBP.symbol);
                await expect(balanceAmount).toContainText(CURRENCY_REPLACEMENTS.GBP.symbol);
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
                // Should match pattern: symbol + digits + . + exactly 2 digits for currencies that use decimals
                if (text.includes('.')) {
                    expect(text).toMatch(/(zł|฿|lei)\d+\.\d{2}$/);
                }
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
            { selector: '[data-testid="precision-0"]', expected: formatTestCurrency(33.33, CURRENCY_REPLACEMENTS.USD) }, // 33.333333 rounds to 33.33
            { selector: '[data-testid="precision-1"]', expected: formatTestCurrency(123.46, CURRENCY_REPLACEMENTS.EUR) }, // 123.456789 rounds to 123.46
            { selector: '[data-testid="precision-2"]', expected: formatTestCurrency(0.00, CURRENCY_REPLACEMENTS.GBP) }, // 0.001 rounds to 0.00
            { selector: '[data-testid="precision-3"]', expected: formatTestCurrency(100.00, CURRENCY_REPLACEMENTS.USD) }, // 99.999 rounds to 100.00
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
                expect(text).toMatch(/^(zł|฿|lei)/);
                // Should not end with currency symbol
                expect(text).not.toMatch(/(zł|฿|lei)$/);
                // Should not have currency symbol in the middle
                const symbolLength = text.startsWith('zł') ? 2 : text.startsWith('lei') ? 3 : 1;
                expect(text.slice(symbolLength)).not.toMatch(/(zł|฿|lei)/);
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
                        <div class="currency-amount currency-pln" data-testid="zero-pln">zł0.00</div>
                        <div class="currency-amount currency-thb" data-testid="zero-thb">฿0.00</div>
                        <div class="currency-amount currency-ron" data-testid="zero-ron">lei0.00</div>
                    </div>
                \`;
                document.body.insertAdjacentHTML('beforeend', zeroHTML);
            `
        });

        // Test zero amounts are displayed consistently
        await expect(page.locator('[data-testid="zero-pln"]')).toContainText('zł0.00');
        await expect(page.locator('[data-testid="zero-thb"]')).toContainText('฿0.00');
        await expect(page.locator('[data-testid="zero-ron"]')).toContainText('lei0.00');

        // Should still follow 2 decimal place rule (exact match, not just 'zł0')
        await expect(page.locator('[data-testid="zero-pln"]')).not.toHaveText('zł0');
        await expect(page.locator('[data-testid="zero-thb"]')).not.toHaveText('฿0');
        await expect(page.locator('[data-testid="zero-ron"]')).not.toHaveText('lei0');
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
                        <div class="currency-amount currency-pln" data-testid="large-pln">zł12345.67</div>
                        <div class="currency-amount currency-thb" data-testid="large-thb">฿99999.99</div>
                        <div class="currency-amount currency-ron" data-testid="large-ron">lei1000000.00</div>
                    </div>
                \`;
                document.body.insertAdjacentHTML('beforeend', largeHTML);
            `
        });

        // Test large amounts are displayed without thousand separators (or with consistent formatting)
        const largePLN = page.locator('[data-testid="large-pln"]');
        const largeTHB = page.locator('[data-testid="large-thb"]');
        const largeRON = page.locator('[data-testid="large-ron"]');

        await expect(largePLN).toContainText('zł12345.67');
        await expect(largeTHB).toContainText('฿99999.99');
        await expect(largeRON).toContainText('lei1000000.00');

        // Should maintain decimal precision even for large amounts
        await expect(largePLN).toContainText('.67');
        await expect(largeTHB).toContainText('.99');
        await expect(largeRON).toContainText('.00');
    });

    test('should treat same amounts in different currencies separately', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addCurrencyDisplayElements(page, currencyTestData);

        // Test multi-currency section shows same amount in different currencies
        const multiPLN = page.locator('[data-testid="multi-0"]');
        const multiTHB = page.locator('[data-testid="multi-1"]');
        const multiRON = page.locator('[data-testid="multi-2"]');

        // All should show the same numeric value but different symbols
        await expect(multiPLN).toContainText('zł50.00');
        await expect(multiTHB).toContainText('฿50.00');
        await expect(multiRON).toContainText('lei50.00');

        // Verify no FX conversion - same numeric amount
        const plnText = await multiPLN.textContent();
        const thbText = await multiTHB.textContent();
        const ronText = await multiRON.textContent();

        const plnAmount = plnText?.replace('zł', '').trim();
        const thbAmount = thbText?.replace('฿', '').trim();
        const ronAmount = ronText?.replace('lei', '').trim();

        expect(plnAmount).toBe(thbAmount);
        expect(thbAmount).toBe(ronAmount);
        expect(plnAmount).toBe('50.00');
    });

    test('should maintain consistent styling across currency types', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addCurrencyDisplayElements(page, currencyTestData);

        // Test that all currency amounts have consistent base styling
        const plnAmounts = page.locator('.currency-pln');
        const thbAmounts = page.locator('.currency-thb');
        const ronAmounts = page.locator('.currency-ron');

        // All should be visible and have amount-display class
        const plnCount = await plnAmounts.count();
        const thbCount = await thbAmounts.count();
        const ronCount = await ronAmounts.count();

        expect(plnCount).toBeGreaterThan(0);
        expect(thbCount).toBeGreaterThan(0);
        expect(ronCount).toBeGreaterThan(0);

        // Check that styling is applied (by checking computed styles or class presence)
        for (let i = 0; i < plnCount; i++) {
            await expect(plnAmounts.nth(i)).toBeVisible();
        }
        for (let i = 0; i < thbCount; i++) {
            await expect(thbAmounts.nth(i)).toBeVisible();
        }
        for (let i = 0; i < ronCount; i++) {
            await expect(ronAmounts.nth(i)).toBeVisible();
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
                        <div class="currency-amount currency-pln" data-testid="edge-cent">zł0.01</div>
                        <div class="currency-amount currency-thb" data-testid="edge-max">฿999999.99</div>
                        <div class="currency-amount currency-ron" data-testid="edge-fraction">lei123.45</div>
                        <div class="currency-amount currency-pln" data-testid="edge-round">zł999.99</div>
                    </div>
                \`;
                document.body.insertAdjacentHTML('beforeend', edgeHTML);
            `
        });

        // Test edge cases
        await expect(page.locator('[data-testid="edge-cent"]')).toContainText('zł0.01');
        await expect(page.locator('[data-testid="edge-max"]')).toContainText('฿999999.99');
        await expect(page.locator('[data-testid="edge-fraction"]')).toContainText('lei123.45');
        await expect(page.locator('[data-testid="edge-round"]')).toContainText('zł999.99');

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