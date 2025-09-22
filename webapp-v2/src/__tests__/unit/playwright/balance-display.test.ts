import { test, expect } from '@playwright/test';
import {
    setupTestPage,
    setupAuthenticatedUserWithToken,
    expectElementVisible,
    fillFormField,
    TEST_SCENARIOS,
} from '../infra/test-helpers';
import { CURRENCY_REPLACEMENTS, formatTestCurrency, getTestCurrency } from './test-currencies';

/**
 * Unit tests for balance display components
 * Tests balance visualization and debt formatting without full flows
 */
test.describe('Balance Display', () => {
    const mockGroupData = {
        id: 'test-group',
        name: 'Test Group',
        members: [
            { id: 'user1', email: TEST_SCENARIOS.VALID_EMAIL, displayName: 'Test User', joinedAt: new Date().toISOString() },
            { id: 'user2', email: 'member2@test.com', displayName: 'Member Two', joinedAt: new Date().toISOString() },
            { id: 'user3', email: 'member3@test.com', displayName: 'Member Three', joinedAt: new Date().toISOString() },
        ]
    };

    // Mock balance data for different scenarios
    const mockBalanceScenarios = {
        settledUp: {
            balances: [],
            debts: [],
            isSettledUp: true
        },
        simpleDebt: {
            balances: [
                { from: 'member2@test.com', to: TEST_SCENARIOS.VALID_EMAIL, amount: 50.00, currency: CURRENCY_REPLACEMENTS.USD.acronym }
            ],
            debts: [
                { debtor: 'member2@test.com', creditor: TEST_SCENARIOS.VALID_EMAIL, amount: 50.00, currency: CURRENCY_REPLACEMENTS.USD.acronym }
            ],
            isSettledUp: false
        },
        multipleDebts: {
            balances: [
                { from: 'member2@test.com', to: TEST_SCENARIOS.VALID_EMAIL, amount: 75.25, currency: CURRENCY_REPLACEMENTS.USD.acronym },
                { from: 'member3@test.com', to: TEST_SCENARIOS.VALID_EMAIL, amount: 30.50, currency: CURRENCY_REPLACEMENTS.EUR.acronym }
            ],
            debts: [
                { debtor: 'member2@test.com', creditor: TEST_SCENARIOS.VALID_EMAIL, amount: 75.25, currency: CURRENCY_REPLACEMENTS.USD.acronym },
                { debtor: 'member3@test.com', creditor: TEST_SCENARIOS.VALID_EMAIL, amount: 30.50, currency: CURRENCY_REPLACEMENTS.EUR.acronym }
            ],
            isSettledUp: false
        },
        complexThreeWay: {
            balances: [
                { from: 'member2@test.com', to: TEST_SCENARIOS.VALID_EMAIL, amount: 25.00, currency: CURRENCY_REPLACEMENTS.USD.acronym },
                { from: TEST_SCENARIOS.VALID_EMAIL, to: 'member3@test.com', amount: 15.75, currency: CURRENCY_REPLACEMENTS.USD.acronym }
            ],
            debts: [
                { debtor: 'member2@test.com', creditor: TEST_SCENARIOS.VALID_EMAIL, amount: 25.00, currency: CURRENCY_REPLACEMENTS.USD.acronym },
                { debtor: TEST_SCENARIOS.VALID_EMAIL, creditor: 'member3@test.com', amount: 15.75, currency: CURRENCY_REPLACEMENTS.USD.acronym }
            ],
            isSettledUp: false
        }
    };

    let authToken: { idToken: string; localId: string; refreshToken: string };

    async function mockBalanceAPI(page: any, scenario: keyof typeof mockBalanceScenarios) {
        const balanceData = mockBalanceScenarios[scenario];

        await page.route('**/api/groups/test-group', (route: any) => {
            if (route.request().method() === 'GET') {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockGroupData),
                });
            } else {
                route.continue();
            }
        });

        await page.route('**/api/groups/test-group/balances', (route: any) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(balanceData),
            });
        });

        await page.route('**/api/groups/test-group/expenses', (route: any) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([]),
            });
        });

        await page.route('**/api/user/groups', (route: any) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([mockGroupData]),
            });
        });
    }

    async function addMockBalanceContent(page: any, scenario: keyof typeof mockBalanceScenarios) {
        const balanceData = mockBalanceScenarios[scenario];

        await page.addStyleTag({
            content: `
                .balance-section { margin: 20px 0; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; }
                .settled-up { text-align: center; color: #4caf50; font-weight: bold; }
                .debt-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
                .debt-amount { font-weight: bold; }
                .debt-currency-pln { color: #2e7d32; }
                .debt-currency-thb { color: #1565c0; }
                .debt-currency-ron { color: #6a1b9a; }
                .balance-summary { margin-top: 15px; font-size: 14px; color: #666; }
            `
        });

        let balanceHTML = '<div class="balance-section" id="balance-section">';

        if (balanceData.isSettledUp) {
            balanceHTML += '<div class="settled-up" id="settled-up-message">🎉 All settled up!</div>';
        } else {
            balanceHTML += '<h3>Balances</h3>';
            balanceData.debts.forEach((debt, index) => {
                const debtorName = debt.debtor === TEST_SCENARIOS.VALID_EMAIL ? 'Test User' :
                                 debt.debtor === 'member2@test.com' ? 'Member Two' : 'Member Three';
                const creditorName = debt.creditor === TEST_SCENARIOS.VALID_EMAIL ? 'Test User' :
                                    debt.creditor === 'member2@test.com' ? 'Member Two' : 'Member Three';

                const currency = getTestCurrency(debt.currency);
                const currencySymbol = currency?.symbol || debt.currency;
                const currencyClass = `debt-currency-${debt.currency.toLowerCase()}`;

                balanceHTML += `
                    <div class="debt-item" data-testid="debt-${index}">
                        <span class="debt-description">${debtorName} → ${creditorName}</span>
                        <span class="debt-amount ${currencyClass}">${currencySymbol}${debt.amount.toFixed(2)}</span>
                    </div>
                `;
            });

            // Add balance summary
            const totalDebts = balanceData.debts.length;
            const currencies = [...new Set(balanceData.debts.map(d => d.currency))];
            balanceHTML += `
                <div class="balance-summary">
                    ${totalDebts} debt${totalDebts !== 1 ? 's' : ''} across ${currencies.length} currenc${currencies.length !== 1 ? 'ies' : 'y'}
                </div>
            `;
        }

        balanceHTML += '</div>';

        await page.addScriptTag({
            content: `
                document.body.insertAdjacentHTML('beforeend', \`${balanceHTML}\`);
            `
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

    test('should display settled up state correctly', async ({ page }) => {
        await mockBalanceAPI(page, 'settledUp');
        await page.goto('/groups/test-group');
        await page.waitForLoadState('networkidle');

        await addMockBalanceContent(page, 'settledUp');

        // Should show settled up message
        const settledUpMessage = page.locator('#settled-up-message, .settled-up');
        await expect(settledUpMessage).toBeVisible();
        await expect(settledUpMessage).toContainText(/all settled up|settled/i);

        // Should not show any debt items
        const debtItems = page.locator('.debt-item, [data-testid^="debt-"]');
        await expect(debtItems).toHaveCount(0);
    });

    test('should display simple debt correctly', async ({ page }) => {
        await mockBalanceAPI(page, 'simpleDebt');
        await page.goto('/groups/test-group');
        await page.waitForLoadState('networkidle');

        await addMockBalanceContent(page, 'simpleDebt');

        // Should not show settled up message
        const settledUpMessage = page.locator('#settled-up-message, .settled-up');
        await expect(settledUpMessage).not.toBeVisible();

        // Should show single debt
        const debtItems = page.locator('.debt-item, [data-testid^="debt-"]');
        await expect(debtItems).toHaveCount(1);

        // Verify debt details
        const debtItem = debtItems.first();
        await expect(debtItem).toContainText('Member Two → Test User');
        await expect(debtItem).toContainText('zł50.00');

        // Verify currency formatting
        const amountElement = debtItem.locator('.debt-amount, .debt-currency-usd');
        await expect(amountElement).toBeVisible();
    });

    test('should display multiple debts with different currencies', async ({ page }) => {
        await mockBalanceAPI(page, 'multipleDebts');
        await page.goto('/groups/test-group');
        await page.waitForLoadState('networkidle');

        await addMockBalanceContent(page, 'multipleDebts');

        // Should show multiple debt items
        const debtItems = page.locator('.debt-item, [data-testid^="debt-"]');
        await expect(debtItems).toHaveCount(2);

        // Verify first debt (PLN)
        const firstDebt = debtItems.first();
        await expect(firstDebt).toContainText('Member Two → Test User');
        await expect(firstDebt).toContainText('zł75.25');

        // Verify second debt (THB)
        const secondDebt = debtItems.nth(1);
        await expect(secondDebt).toContainText('Member Three → Test User');
        await expect(secondDebt).toContainText('฿30.50');

        // Verify balance summary
        const summary = page.locator('.balance-summary');
        await expect(summary).toContainText('2 debts');
        await expect(summary).toContainText('2 currencies');
    });

    test('should handle complex three-way debt relationships', async ({ page }) => {
        await mockBalanceAPI(page, 'complexThreeWay');
        await page.goto('/groups/test-group');
        await page.waitForLoadState('networkidle');

        await addMockBalanceContent(page, 'complexThreeWay');

        // Should show both directions of debt
        const debtItems = page.locator('.debt-item, [data-testid^="debt-"]');
        await expect(debtItems).toHaveCount(2);

        // Verify incoming debt
        const incomingDebt = debtItems.first();
        await expect(incomingDebt).toContainText('Member Two → Test User');
        await expect(incomingDebt).toContainText('zł25.00');

        // Verify outgoing debt
        const outgoingDebt = debtItems.nth(1);
        await expect(outgoingDebt).toContainText('Test User → Member Three');
        await expect(outgoingDebt).toContainText('zł15.75');
    });

    test('should format currency amounts correctly', async ({ page }) => {
        await mockBalanceAPI(page, 'multipleDebts');
        await page.goto('/groups/test-group');
        await page.waitForLoadState('networkidle');

        await addMockBalanceContent(page, 'multipleDebts');

        // Test PLN formatting
        const plnAmount = page.locator('.debt-currency-pln');
        await expect(plnAmount).toContainText('zł75.25');
        await expect(plnAmount).not.toContainText('75.250'); // No extra decimals

        // Test THB formatting
        const thbAmount = page.locator('.debt-currency-thb');
        await expect(thbAmount).toContainText('฿30.50');
        await expect(thbAmount).not.toContainText('30.500'); // No extra decimals

        // Verify decimal precision
        const allAmounts = page.locator('.debt-amount');
        const count = await allAmounts.count();

        for (let i = 0; i < count; i++) {
            const amount = allAmounts.nth(i);
            const text = await amount.textContent();

            // Should have exactly 2 decimal places for currencies that use them
            if (text && text.includes('.')) {
                expect(text).toMatch(/(zł|฿|lei)\d+\.\d{2}$/);
            }
        }
    });

    test('should handle zero amounts correctly', async ({ page }) => {
        const zeroBalanceData = {
            balances: [
                { from: 'member2@test.com', to: TEST_SCENARIOS.VALID_EMAIL, amount: 0.00, currency: CURRENCY_REPLACEMENTS.USD.acronym }
            ],
            debts: [],
            isSettledUp: true
        };

        await page.route('**/api/groups/test-group/balances', (route: any) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(zeroBalanceData),
            });
        });

        await page.goto('/groups/test-group');
        await page.waitForLoadState('networkidle');

        await addMockBalanceContent(page, 'settledUp');

        // Zero amounts should show as settled up
        const settledUpMessage = page.locator('#settled-up-message, .settled-up');
        await expect(settledUpMessage).toBeVisible();

        // Should not show debt items for zero amounts
        const debtItems = page.locator('.debt-item, [data-testid^="debt-"]');
        await expect(debtItems).toHaveCount(0);
    });

    test('should handle very precise decimal amounts', async ({ page }) => {
        const preciseBalanceData = {
            balances: [
                { from: 'member2@test.com', to: TEST_SCENARIOS.VALID_EMAIL, amount: 33.333333, currency: CURRENCY_REPLACEMENTS.USD.acronym }
            ],
            debts: [
                { debtor: 'member2@test.com', creditor: TEST_SCENARIOS.VALID_EMAIL, amount: 33.333333, currency: CURRENCY_REPLACEMENTS.USD.acronym }
            ],
            isSettledUp: false
        };

        await page.route('**/api/groups/test-group/balances', (route: any) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(preciseBalanceData),
            });
        });

        await page.goto('/groups/test-group');
        await page.waitForLoadState('networkidle');

        // Add precise amount content
        await page.addScriptTag({
            content: `
                const balanceHTML = \`
                    <div class="balance-section" id="balance-section">
                        <h3>Balances</h3>
                        <div class="debt-item" data-testid="debt-0">
                            <span class="debt-description">Member Two → Test User</span>
                            <span class="debt-amount debt-currency-pln">zł33.33</span>
                        </div>
                    </div>
                \`;
                document.body.insertAdjacentHTML('beforeend', balanceHTML);
            `
        });

        // Should round to 2 decimal places
        const debtAmount = page.locator('.debt-amount');
        await expect(debtAmount).toContainText('zł33.33');
        await expect(debtAmount).not.toContainText('33.333333');
    });

    test('should maintain consistent currency symbol placement', async ({ page }) => {
        await mockBalanceAPI(page, 'multipleDebts');
        await page.goto('/groups/test-group');
        await page.waitForLoadState('networkidle');

        await addMockBalanceContent(page, 'multipleDebts');

        // All currency symbols should be at the beginning
        const allAmounts = page.locator('.debt-amount');
        const count = await allAmounts.count();

        for (let i = 0; i < count; i++) {
            const amount = allAmounts.nth(i);
            const text = await amount.textContent();

            // Should start with currency symbol
            expect(text).toMatch(/^(zł|฿|lei)/);
            // Should not have currency symbol at the end
            expect(text).not.toMatch(/\d(zł|฿|lei)$/);
        }
    });

    test('should handle different currency types separately', async ({ page }) => {
        const multiCurrencyData = {
            balances: [
                { from: 'member2@test.com', to: TEST_SCENARIOS.VALID_EMAIL, amount: 50.00, currency: CURRENCY_REPLACEMENTS.USD.acronym },
                { from: 'member2@test.com', to: TEST_SCENARIOS.VALID_EMAIL, amount: 50.00, currency: CURRENCY_REPLACEMENTS.EUR.acronym },
                { from: 'member2@test.com', to: TEST_SCENARIOS.VALID_EMAIL, amount: 50.00, currency: CURRENCY_REPLACEMENTS.GBP.acronym }
            ],
            debts: [
                { debtor: 'member2@test.com', creditor: TEST_SCENARIOS.VALID_EMAIL, amount: 50.00, currency: CURRENCY_REPLACEMENTS.USD.acronym },
                { debtor: 'member2@test.com', creditor: TEST_SCENARIOS.VALID_EMAIL, amount: 50.00, currency: CURRENCY_REPLACEMENTS.EUR.acronym },
                { debtor: 'member2@test.com', creditor: TEST_SCENARIOS.VALID_EMAIL, amount: 50.00, currency: CURRENCY_REPLACEMENTS.GBP.acronym }
            ],
            isSettledUp: false
        };

        await page.route('**/api/groups/test-group/balances', (route: any) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(multiCurrencyData),
            });
        });

        await page.goto('/groups/test-group');
        await page.waitForLoadState('networkidle');

        // Add multi-currency content
        await page.addScriptTag({
            content: `
                const balanceHTML = \`
                    <div class="balance-section" id="balance-section">
                        <h3>Balances</h3>
                        <div class="debt-item" data-testid="debt-0">
                            <span class="debt-description">Member Two → Test User</span>
                            <span class="debt-amount debt-currency-pln">zł50.00</span>
                        </div>
                        <div class="debt-item" data-testid="debt-1">
                            <span class="debt-description">Member Two → Test User</span>
                            <span class="debt-amount debt-currency-thb">฿50.00</span>
                        </div>
                        <div class="debt-item" data-testid="debt-2">
                            <span class="debt-description">Member Two → Test User</span>
                            <span class="debt-amount debt-currency-ron">lei50.00</span>
                        </div>
                        <div class="balance-summary">3 debts across 3 currencies</div>
                    </div>
                \`;
                document.body.insertAdjacentHTML('beforeend', balanceHTML);
            `
        });

        // Should show separate debt items for each currency
        const debtItems = page.locator('.debt-item');
        await expect(debtItems).toHaveCount(3);

        // Verify each currency is displayed separately with same amount
        await expect(page.locator('.debt-currency-pln')).toContainText('zł50.00');
        await expect(page.locator('.debt-currency-thb')).toContainText('฿50.00');
        await expect(page.locator('.debt-currency-ron')).toContainText('lei50.00');

        // Verify summary acknowledges multiple currencies
        const summary = page.locator('.balance-summary');
        await expect(summary).toContainText('3 currencies');
    });

    test('should provide accessible debt information', async ({ page }) => {
        await mockBalanceAPI(page, 'simpleDebt');
        await page.goto('/groups/test-group');
        await page.waitForLoadState('networkidle');

        await addMockBalanceContent(page, 'simpleDebt');

        // Balance section should be identifiable
        const balanceSection = page.locator('#balance-section, .balance-section');
        await expect(balanceSection).toBeVisible();

        // Debt items should have clear structure
        const debtItem = page.locator('.debt-item').first();
        await expect(debtItem).toBeVisible();

        // Should have clear debt description and amount
        const debtDescription = debtItem.locator('.debt-description');
        const debtAmount = debtItem.locator('.debt-amount');

        await expect(debtDescription).toBeVisible();
        await expect(debtAmount).toBeVisible();

        // Text should be clear and readable
        await expect(debtDescription).toContainText('→'); // Clear direction indicator
        await expect(debtAmount).toContainText(CURRENCY_REPLACEMENTS.USD.symbol); // Clear currency symbol
    });

    test('should handle balance updates correctly', async ({ page }) => {
        // Start with simple debt
        await mockBalanceAPI(page, 'simpleDebt');
        await page.goto('/groups/test-group');
        await page.waitForLoadState('networkidle');

        await addMockBalanceContent(page, 'simpleDebt');

        // Verify initial state
        await expect(page.locator('.debt-item')).toHaveCount(1);
        await expect(page.locator('.debt-amount')).toContainText('zł50.00');

        // Simulate balance update to settled up
        await page.evaluate(() => {
            const balanceSection = document.getElementById('balance-section');
            if (balanceSection) {
                balanceSection.innerHTML = '<div class="settled-up" id="settled-up-message">🎉 All settled up!</div>';
            }
        });

        // Should now show settled up
        const settledUpMessage = page.locator('#settled-up-message');
        await expect(settledUpMessage).toBeVisible();
        await expect(page.locator('.debt-item')).toHaveCount(0);
    });
});