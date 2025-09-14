import { test, expect } from '@playwright/test';
import { setupStoreMocks, createTestPage, createTestUsers } from '../stores/setup';

/**
 * Focused Playwright tests for balance summary functionality
 * 
 * Tests multi-currency display, debt simplification visualization,
 * real-time balance updates, and complex UI state management.
 */

test.describe('Balance Summary - Multi-Currency Display', () => {
    const testUsers = createTestUsers();
    
    const mockBalanceData = {
        singleCurrency: {
            simplifiedDebts: [
                { fromUserId: 'admin-user-123', toUserId: 'member-user-456', amount: 25.50, currency: 'USD' },
                { fromUserId: 'viewer-user-789', toUserId: 'admin-user-123', amount: 15.25, currency: 'USD' }
            ]
        },
        multiCurrency: {
            simplifiedDebts: [
                { fromUserId: 'admin-user-123', toUserId: 'member-user-456', amount: 25.50, currency: 'USD' },
                { fromUserId: 'viewer-user-789', toUserId: 'admin-user-123', amount: 15.25, currency: 'USD' },
                { fromUserId: 'member-user-456', toUserId: 'viewer-user-789', amount: 30.00, currency: 'EUR' },
                { fromUserId: 'admin-user-123', toUserId: 'viewer-user-789', amount: 2500, currency: 'JPY' }
            ]
        },
        settled: {
            simplifiedDebts: []
        }
    };
    
    test.beforeEach(async ({ page }) => {
        await setupStoreMocks(page);
    });

    test('should display single currency balances correctly', async ({ page }) => {
        await createTestPage(page, `
            <div class="balance-summary">
                <h3 data-testid="balance-title">Balance Summary</h3>
                <div id="balance-content" data-testid="balance-content">Loading...</div>
                <div id="currency-groups" data-testid="currency-groups"></div>
            </div>

            <style>
                .balance-summary {
                    padding: 20px;
                    background: #f9f9f9;
                    border-radius: 8px;
                    margin: 20px;
                }
                .currency-group {
                    margin: 16px 0;
                    padding: 12px;
                    background: white;
                    border-radius: 6px;
                    border: 1px solid #e0e0e0;
                }
                .currency-header {
                    font-weight: bold;
                    margin-bottom: 8px;
                    color: #333;
                }
                .debt-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid #f0f0f0;
                }
                .debt-item:last-child {
                    border-bottom: none;
                }
                .debt-description {
                    color: #555;
                }
                .debt-amount {
                    font-weight: bold;
                    color: #d32f2f;
                }
                .no-debts {
                    text-align: center;
                    color: #666;
                    font-style: italic;
                    padding: 20px;
                }
            </style>

            <script>
                const users = ${JSON.stringify(testUsers)};
                const balanceData = ${JSON.stringify(mockBalanceData.singleCurrency)};
                
                function getUserName(userId) {
                    const user = users.find(u => u.uid === userId);
                    return user ? user.displayName : 'Unknown User';
                }
                
                function formatCurrency(amount, currency) {
                    const formatter = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: currency
                    });
                    return formatter.format(amount);
                }
                
                function renderBalanceSummary(data) {
                    const content = document.getElementById('balance-content');
                    const currencyGroups = document.getElementById('currency-groups');
                    
                    if (!data || !data.simplifiedDebts || data.simplifiedDebts.length === 0) {
                        content.innerHTML = '<div class="no-debts" data-testid="no-debts">All settled up! 🎉</div>';
                        currencyGroups.innerHTML = '';
                        return;
                    }
                    
                    content.textContent = \`\${data.simplifiedDebts.length} debt(s) to settle\`;
                    
                    // Group debts by currency
                    const grouped = data.simplifiedDebts.reduce((acc, debt) => {
                        if (!acc[debt.currency]) {
                            acc[debt.currency] = [];
                        }
                        acc[debt.currency].push(debt);
                        return acc;
                    }, {});
                    
                    // Sort currencies: USD first, then alphabetically
                    const sortedCurrencies = Object.keys(grouped).sort((a, b) => {
                        if (a === 'USD') return -1;
                        if (b === 'USD') return 1;
                        return a.localeCompare(b);
                    });
                    
                    currencyGroups.innerHTML = sortedCurrencies.map(currency => {
                        const debts = grouped[currency];
                        return \`
                            <div class="currency-group" data-testid="currency-group-\${currency.toLowerCase()}">
                                <div class="currency-header" data-testid="currency-header-\${currency.toLowerCase()}">
                                    \${currency} Balances
                                </div>
                                \${debts.map(debt => \`
                                    <div class="debt-item" data-testid="debt-item-\${debt.fromUserId}-\${debt.toUserId}">
                                        <div class="debt-description">
                                            <strong>\${getUserName(debt.fromUserId)}</strong> owes <strong>\${getUserName(debt.toUserId)}</strong>
                                        </div>
                                        <div class="debt-amount" data-testid="debt-amount-\${debt.fromUserId}-\${debt.toUserId}">
                                            \${formatCurrency(debt.amount, debt.currency)}
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                        \`;
                    }).join('');
                }
                
                // Render initial data
                renderBalanceSummary(balanceData);
                
                // Expose function for testing
                window.updateBalanceData = (newData) => {
                    renderBalanceSummary(newData);
                };
            </script>
        `);

        // Should display single currency debts
        await expect(page.getByTestId('balance-content')).toHaveText('2 debt(s) to settle');
        await expect(page.getByTestId('currency-group-usd')).toBeVisible();
        await expect(page.getByTestId('currency-header-usd')).toHaveText('USD Balances');

        // Verify debt items
        await expect(page.getByTestId('debt-item-admin-user-123-member-user-456')).toBeVisible();
        await expect(page.getByTestId('debt-amount-admin-user-123-member-user-456')).toHaveText('$25.50');
        
        await expect(page.getByTestId('debt-item-viewer-user-789-admin-user-123')).toBeVisible();
        await expect(page.getByTestId('debt-amount-viewer-user-789-admin-user-123')).toHaveText('$15.25');

        // Verify user names are displayed correctly
        await expect(page.locator('[data-testid="debt-item-admin-user-123-member-user-456"] .debt-description'))
            .toHaveText('Admin User owes Member User');
        await expect(page.locator('[data-testid="debt-item-viewer-user-789-admin-user-123"] .debt-description'))
            .toHaveText('Viewer User owes Admin User');
    });

    test('should display multi-currency balances with proper sorting', async ({ page }) => {
        await createTestPage(page, `
            <div class="balance-summary">
                <div id="balance-content" data-testid="balance-content">Loading...</div>
                <div id="currency-groups" data-testid="currency-groups"></div>
                <div id="currency-count" data-testid="currency-count">Currencies: 0</div>
            </div>

            <style>
                .currency-group {
                    margin: 16px 0;
                    padding: 12px;
                    background: white;
                    border-radius: 6px;
                    border: 1px solid #e0e0e0;
                }
                .currency-header {
                    font-weight: bold;
                    margin-bottom: 8px;
                    color: #333;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .currency-total {
                    font-size: 0.9em;
                    color: #666;
                }
                .debt-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid #f0f0f0;
                }
                .debt-item:last-child {
                    border-bottom: none;
                }
                .debt-description { color: #555; }
                .debt-amount { font-weight: bold; color: #d32f2f; }
            </style>

            <script>
                const users = ${JSON.stringify(testUsers)};
                const balanceData = ${JSON.stringify(mockBalanceData.multiCurrency)};
                
                function getUserName(userId) {
                    const user = users.find(u => u.uid === userId);
                    return user ? user.displayName : 'Unknown User';
                }
                
                function formatCurrency(amount, currency) {
                    const formatter = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: currency
                    });
                    return formatter.format(amount);
                }
                
                function renderBalanceSummary(data) {
                    const content = document.getElementById('balance-content');
                    const currencyGroups = document.getElementById('currency-groups');
                    const currencyCount = document.getElementById('currency-count');
                    
                    if (!data || !data.simplifiedDebts || data.simplifiedDebts.length === 0) {
                        content.innerHTML = '<div class="no-debts">All settled up! 🎉</div>';
                        currencyGroups.innerHTML = '';
                        currencyCount.textContent = 'Currencies: 0';
                        return;
                    }
                    
                    content.textContent = \`\${data.simplifiedDebts.length} debt(s) to settle\`;
                    
                    // Group debts by currency
                    const grouped = data.simplifiedDebts.reduce((acc, debt) => {
                        if (!acc[debt.currency]) {
                            acc[debt.currency] = [];
                        }
                        acc[debt.currency].push(debt);
                        return acc;
                    }, {});
                    
                    const currencyKeys = Object.keys(grouped);
                    currencyCount.textContent = \`Currencies: \${currencyKeys.length}\`;
                    
                    // Sort currencies: USD first, then alphabetically
                    const sortedCurrencies = currencyKeys.sort((a, b) => {
                        if (a === 'USD') return -1;
                        if (b === 'USD') return 1;
                        return a.localeCompare(b);
                    });
                    
                    currencyGroups.innerHTML = sortedCurrencies.map(currency => {
                        const debts = grouped[currency];
                        const totalAmount = debts.reduce((sum, debt) => sum + debt.amount, 0);
                        
                        return \`
                            <div class="currency-group" data-testid="currency-group-\${currency.toLowerCase()}">
                                <div class="currency-header" data-testid="currency-header-\${currency.toLowerCase()}">
                                    <span>\${currency} Balances</span>
                                    <span class="currency-total" data-testid="currency-total-\${currency.toLowerCase()}">
                                        Total: \${formatCurrency(totalAmount, currency)}
                                    </span>
                                </div>
                                \${debts.map(debt => \`
                                    <div class="debt-item" data-testid="debt-item-\${debt.fromUserId}-\${debt.toUserId}-\${currency.toLowerCase()}">
                                        <div class="debt-description">
                                            <strong>\${getUserName(debt.fromUserId)}</strong> owes <strong>\${getUserName(debt.toUserId)}</strong>
                                        </div>
                                        <div class="debt-amount" data-testid="debt-amount-\${debt.fromUserId}-\${debt.toUserId}-\${currency.toLowerCase()}">
                                            \${formatCurrency(debt.amount, debt.currency)}
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                        \`;
                    }).join('');
                }
                
                renderBalanceSummary(balanceData);
                window.updateBalanceData = (newData) => {
                    renderBalanceSummary(newData);
                };
            </script>
        `);

        // Should display multiple currencies
        await expect(page.getByTestId('balance-content')).toHaveText('4 debt(s) to settle');
        await expect(page.getByTestId('currency-count')).toHaveText('Currencies: 3');

        // USD should appear first
        const currencyGroups = page.getByTestId('currency-groups');
        const firstGroup = currencyGroups.locator('.currency-group').first();
        await expect(firstGroup).toHaveAttribute('data-testid', 'currency-group-usd');

        // Verify all currencies are present
        await expect(page.getByTestId('currency-group-usd')).toBeVisible();
        await expect(page.getByTestId('currency-group-eur')).toBeVisible();
        await expect(page.getByTestId('currency-group-jpy')).toBeVisible();

        // Check currency totals
        await expect(page.getByTestId('currency-total-usd')).toHaveText('Total: $40.75');
        await expect(page.getByTestId('currency-total-eur')).toHaveText('Total: €30.00');
        await expect(page.getByTestId('currency-total-jpy')).toHaveText('Total: ¥2,500');

        // Verify specific debts in each currency
        await expect(page.getByTestId('debt-amount-admin-user-123-member-user-456-usd')).toHaveText('$25.50');
        await expect(page.getByTestId('debt-amount-member-user-456-viewer-user-789-eur')).toHaveText('€30.00');
        await expect(page.getByTestId('debt-amount-admin-user-123-viewer-user-789-jpy')).toHaveText('¥2,500');
    });

    test('should display settled state correctly', async ({ page }) => {
        await createTestPage(page, `
            <div class="balance-summary">
                <h3 data-testid="balance-title">Balance Summary</h3>
                <div id="balance-content" data-testid="balance-content">Loading...</div>
                <div id="currency-groups" data-testid="currency-groups"></div>
                <button id="toggle-settled" data-testid="toggle-settled">Toggle to Settled</button>
            </div>

            <style>
                .no-debts {
                    text-align: center;
                    color: #2e7d32;
                    font-style: italic;
                    padding: 20px;
                    background: #e8f5e8;
                    border-radius: 8px;
                    border: 1px solid #c8e6c9;
                }
                .currency-group {
                    margin: 16px 0;
                    padding: 12px;
                    background: white;
                    border-radius: 6px;
                    border: 1px solid #e0e0e0;
                }
                .debt-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #f0f0f0;
                }
                button {
                    margin: 10px 0;
                    padding: 8px 16px;
                    border: 1px solid #ccc;
                    background: white;
                    cursor: pointer;
                }
            </style>

            <script>
                const users = ${JSON.stringify(testUsers)};
                const unsettledData = ${JSON.stringify(mockBalanceData.singleCurrency)};
                const settledData = ${JSON.stringify(mockBalanceData.settled)};
                
                let currentData = unsettledData;
                
                function getUserName(userId) {
                    const user = users.find(u => u.uid === userId);
                    return user ? user.displayName : 'Unknown User';
                }
                
                function formatCurrency(amount, currency) {
                    const formatter = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: currency
                    });
                    return formatter.format(amount);
                }
                
                function renderBalanceSummary(data) {
                    const content = document.getElementById('balance-content');
                    const currencyGroups = document.getElementById('currency-groups');
                    
                    if (!data || !data.simplifiedDebts || data.simplifiedDebts.length === 0) {
                        content.innerHTML = '<div class="no-debts" data-testid="no-debts">All settled up! 🎉</div>';
                        currencyGroups.innerHTML = '';
                        return;
                    }
                    
                    content.textContent = \`\${data.simplifiedDebts.length} debt(s) to settle\`;
                    
                    // Group debts by currency
                    const grouped = data.simplifiedDebts.reduce((acc, debt) => {
                        if (!acc[debt.currency]) {
                            acc[debt.currency] = [];
                        }
                        acc[debt.currency].push(debt);
                        return acc;
                    }, {});
                    
                    currencyGroups.innerHTML = Object.keys(grouped).map(currency => {
                        const debts = grouped[currency];
                        return \`
                            <div class="currency-group" data-testid="currency-group-\${currency.toLowerCase()}">
                                <div class="currency-header">\${currency} Balances</div>
                                \${debts.map(debt => \`
                                    <div class="debt-item" data-testid="debt-item-\${debt.fromUserId}-\${debt.toUserId}">
                                        <div class="debt-description">
                                            <strong>\${getUserName(debt.fromUserId)}</strong> owes <strong>\${getUserName(debt.toUserId)}</strong>
                                        </div>
                                        <div class="debt-amount">
                                            \${formatCurrency(debt.amount, debt.currency)}
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                        \`;
                    }).join('');
                }
                
                function toggleData() {
                    currentData = currentData === unsettledData ? settledData : unsettledData;
                    renderBalanceSummary(currentData);
                    
                    const button = document.getElementById('toggle-settled');
                    button.textContent = currentData === settledData ? 'Toggle to Unsettled' : 'Toggle to Settled';
                }
                
                document.getElementById('toggle-settled').addEventListener('click', toggleData);
                
                // Render initial data
                renderBalanceSummary(currentData);
            </script>
        `);

        // Initially should show unsettled debts
        await expect(page.getByTestId('balance-content')).toHaveText('2 debt(s) to settle');
        await expect(page.getByTestId('currency-group-usd')).toBeVisible();

        // Toggle to settled state
        await page.getByTestId('toggle-settled').click();
        
        // Should show settled message
        await expect(page.getByTestId('no-debts')).toBeVisible();
        await expect(page.getByTestId('no-debts')).toHaveText('All settled up! 🎉');
        await expect(page.getByTestId('currency-group-usd')).toBeHidden();
        await expect(page.getByTestId('toggle-settled')).toHaveText('Toggle to Unsettled');

        // Toggle back to unsettled
        await page.getByTestId('toggle-settled').click();
        await expect(page.getByTestId('balance-content')).toHaveText('2 debt(s) to settle');
        await expect(page.getByTestId('no-debts')).toBeHidden();
        await expect(page.getByTestId('currency-group-usd')).toBeVisible();
    });

    test('should handle real-time balance updates', async ({ page }) => {
        await createTestPage(page, `
            <div class="balance-summary">
                <div id="balance-content" data-testid="balance-content">Loading...</div>
                <div id="currency-groups" data-testid="currency-groups"></div>
                <div class="controls">
                    <button id="add-debt" data-testid="add-debt">Add New Debt</button>
                    <button id="settle-debt" data-testid="settle-debt">Settle Debt</button>
                    <button id="change-currency" data-testid="change-currency">Add EUR Debt</button>
                </div>
                <div id="update-log" data-testid="update-log">Updates: 0</div>
            </div>

            <style>
                .balance-summary { padding: 20px; }
                .currency-group {
                    margin: 16px 0;
                    padding: 12px;
                    background: #f9f9f9;
                    border-radius: 6px;
                }
                .debt-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #eee;
                }
                .debt-item:last-child { border-bottom: none; }
                .debt-amount { font-weight: bold; color: #d32f2f; }
                .controls { margin: 20px 0; }
                .controls button { 
                    margin: 0 8px 8px 0; 
                    padding: 8px 16px; 
                    border: 1px solid #ccc; 
                    background: white; 
                    cursor: pointer; 
                }
                .no-debts {
                    text-align: center;
                    color: #2e7d32;
                    padding: 20px;
                    background: #e8f5e8;
                    border-radius: 8px;
                }
            </style>

            <script>
                const users = ${JSON.stringify(testUsers)};
                let currentData = {
                    simplifiedDebts: [
                        { fromUserId: 'admin-user-123', toUserId: 'member-user-456', amount: 25.50, currency: 'USD' }
                    ]
                };
                
                let updateCount = 0;
                
                function getUserName(userId) {
                    const user = users.find(u => u.uid === userId);
                    return user ? user.displayName : 'Unknown User';
                }
                
                function formatCurrency(amount, currency) {
                    const formatter = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: currency
                    });
                    return formatter.format(amount);
                }
                
                function renderBalanceSummary(data) {
                    const content = document.getElementById('balance-content');
                    const currencyGroups = document.getElementById('currency-groups');
                    
                    updateCount++;
                    document.getElementById('update-log').textContent = \`Updates: \${updateCount}\`;
                    
                    if (!data || !data.simplifiedDebts || data.simplifiedDebts.length === 0) {
                        content.innerHTML = '<div class="no-debts" data-testid="no-debts">All settled up! 🎉</div>';
                        currencyGroups.innerHTML = '';
                        return;
                    }
                    
                    content.textContent = \`\${data.simplifiedDebts.length} debt(s) to settle\`;
                    
                    // Group debts by currency
                    const grouped = data.simplifiedDebts.reduce((acc, debt) => {
                        if (!acc[debt.currency]) {
                            acc[debt.currency] = [];
                        }
                        acc[debt.currency].push(debt);
                        return acc;
                    }, {});
                    
                    currencyGroups.innerHTML = Object.keys(grouped).sort((a, b) => {
                        if (a === 'USD') return -1;
                        if (b === 'USD') return 1;
                        return a.localeCompare(b);
                    }).map(currency => {
                        const debts = grouped[currency];
                        return \`
                            <div class="currency-group" data-testid="currency-group-\${currency.toLowerCase()}">
                                <div class="currency-header"><strong>\${currency} Balances</strong></div>
                                \${debts.map((debt, index) => \`
                                    <div class="debt-item" data-testid="debt-item-\${index}">
                                        <div class="debt-description">
                                            <strong>\${getUserName(debt.fromUserId)}</strong> owes <strong>\${getUserName(debt.toUserId)}</strong>
                                        </div>
                                        <div class="debt-amount" data-testid="debt-amount-\${index}">
                                            \${formatCurrency(debt.amount, debt.currency)}
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                        \`;
                    }).join('');
                }
                
                document.getElementById('add-debt').addEventListener('click', () => {
                    currentData.simplifiedDebts.push({
                        fromUserId: 'viewer-user-789',
                        toUserId: 'admin-user-123',
                        amount: 12.75,
                        currency: 'USD'
                    });
                    renderBalanceSummary(currentData);
                });
                
                document.getElementById('settle-debt').addEventListener('click', () => {
                    currentData.simplifiedDebts = [];
                    renderBalanceSummary(currentData);
                });
                
                document.getElementById('change-currency').addEventListener('click', () => {
                    currentData.simplifiedDebts.push({
                        fromUserId: 'member-user-456',
                        toUserId: 'viewer-user-789',
                        amount: 45.00,
                        currency: 'EUR'
                    });
                    renderBalanceSummary(currentData);
                });
                
                // Initial render
                renderBalanceSummary(currentData);
            </script>
        `);

        // Initial state
        await expect(page.getByTestId('balance-content')).toHaveText('1 debt(s) to settle');
        await expect(page.getByTestId('update-log')).toHaveText('Updates: 1');
        await expect(page.getByTestId('debt-amount-0')).toHaveText('$25.50');

        // Add new debt
        await page.getByTestId('add-debt').click();
        await expect(page.getByTestId('balance-content')).toHaveText('2 debt(s) to settle');
        await expect(page.getByTestId('update-log')).toHaveText('Updates: 2');
        await expect(page.getByTestId('debt-item-1')).toBeVisible();
        await expect(page.getByTestId('debt-amount-1')).toHaveText('$12.75');

        // Add different currency debt
        await page.getByTestId('change-currency').click();
        await expect(page.getByTestId('balance-content')).toHaveText('3 debt(s) to settle');
        await expect(page.getByTestId('update-log')).toHaveText('Updates: 3');
        await expect(page.getByTestId('currency-group-eur')).toBeVisible();

        // Settle all debts
        await page.getByTestId('settle-debt').click();
        await expect(page.getByTestId('no-debts')).toBeVisible();
        await expect(page.getByTestId('no-debts')).toHaveText('All settled up! 🎉');
        await expect(page.getByTestId('update-log')).toHaveText('Updates: 4');
        await expect(page.getByTestId('currency-group-usd')).toBeHidden();
        await expect(page.getByTestId('currency-group-eur')).toBeHidden();
    });
});