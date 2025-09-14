import { test, expect } from '@playwright/test';
import { setupStoreMocks, createTestPage, createTestUsers } from '../stores/setup';

/**
 * Focused Playwright tests for settlement form functionality
 * 
 * Tests payment recording, form validation, real-time balance updates,
 * multi-currency settlements, and complex form state management.
 */

test.describe('Settlement Form - Payment Recording', () => {
    const testUsers = createTestUsers();
    
    const mockSettlementData = {
        outstandingDebts: [
            { id: '1', fromUserId: 'admin-user-123', toUserId: 'member-user-456', amount: 25.50, currency: 'USD', description: 'Lunch expenses' },
            { id: '2', fromUserId: 'viewer-user-789', toUserId: 'admin-user-123', amount: 15.25, currency: 'USD', description: 'Coffee meetup' },
            { id: '3', fromUserId: 'member-user-456', toUserId: 'viewer-user-789', amount: 30.00, currency: 'EUR', description: 'Movie tickets' }
        ]
    };
    
    test.beforeEach(async ({ page }) => {
        await setupStoreMocks(page);
    });

    test('should record settlements with proper validation', async ({ page }) => {
        await createTestPage(page, `
            <div class="settlement-form">
                <h3 data-testid="form-title">Record Settlement</h3>
                
                <form id="settlement-form" data-testid="settlement-form">
                    <div class="form-group">
                        <label for="debt-select">Outstanding Debt:</label>
                        <select id="debt-select" data-testid="debt-select" required>
                            <option value="">Select a debt to settle...</option>
                        </select>
                    </div>
                    
                    <div class="form-group" id="debt-details" data-testid="debt-details" style="display: none;">
                        <div class="debt-info" data-testid="debt-info">
                            <div id="debt-description" data-testid="debt-description"></div>
                            <div id="debt-amount" data-testid="debt-amount"></div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="settlement-amount">Settlement Amount:</label>
                        <div class="amount-input-group">
                            <span id="currency-symbol" class="currency-symbol">$</span>
                            <input 
                                type="number" 
                                id="settlement-amount" 
                                data-testid="settlement-amount"
                                step="0.01" 
                                min="0" 
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div id="amount-validation" data-testid="amount-validation" class="validation-message"></div>
                    </div>
                    
                    <div class="form-group">
                        <label for="settlement-method">Payment Method:</label>
                        <select id="settlement-method" data-testid="settlement-method" required>
                            <option value="">Select method...</option>
                            <option value="cash">Cash</option>
                            <option value="venmo">Venmo</option>
                            <option value="paypal">PayPal</option>
                            <option value="bank-transfer">Bank Transfer</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="settlement-notes">Notes (optional):</label>
                        <textarea 
                            id="settlement-notes" 
                            data-testid="settlement-notes"
                            rows="3" 
                            placeholder="Add any notes about this settlement..."
                        ></textarea>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" id="cancel-btn" data-testid="cancel-btn">Cancel</button>
                        <button type="submit" id="submit-btn" data-testid="submit-btn" disabled>Record Settlement</button>
                    </div>
                </form>
                
                <div id="settlement-result" data-testid="settlement-result">No settlements recorded</div>
                <div id="balance-updates" data-testid="balance-updates">Balance updates: 0</div>
            </div>

            <style>
                .settlement-form {
                    padding: 20px;
                    max-width: 500px;
                    background: #f9f9f9;
                    border-radius: 8px;
                    margin: 20px;
                }
                .form-group {
                    margin: 16px 0;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 6px;
                    font-weight: 500;
                    color: #333;
                }
                .form-group input, .form-group select, .form-group textarea {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 14px;
                    box-sizing: border-box;
                }
                .amount-input-group {
                    position: relative;
                }
                .currency-symbol {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #666;
                    font-weight: 500;
                }
                .amount-input-group input {
                    padding-left: 28px;
                }
                .debt-info {
                    background: white;
                    padding: 12px;
                    border-radius: 4px;
                    border: 1px solid #e0e0e0;
                }
                .form-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 24px;
                }
                button {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                #cancel-btn {
                    background: #6c757d;
                    color: white;
                }
                #submit-btn {
                    background: #28a745;
                    color: white;
                }
                #submit-btn:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                }
                .validation-message {
                    font-size: 12px;
                    margin-top: 4px;
                }
                .validation-message.error {
                    color: #dc3545;
                }
                .validation-message.success {
                    color: #28a745;
                }
                input:focus, select:focus, textarea:focus {
                    border-color: #007bff;
                    outline: none;
                }
            </style>

            <script>
                const users = ${JSON.stringify(testUsers)};
                const debts = ${JSON.stringify(mockSettlementData.outstandingDebts)};
                
                let balanceUpdates = 0;
                
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
                
                function getCurrencySymbol(currency) {
                    const symbols = { 'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥' };
                    return symbols[currency] || currency;
                }
                
                class SettlementForm {
                    constructor() {
                        this.debtSelect = document.getElementById('debt-select');
                        this.debtDetails = document.getElementById('debt-details');
                        this.debtDescription = document.getElementById('debt-description');
                        this.debtAmount = document.getElementById('debt-amount');
                        this.settlementAmount = document.getElementById('settlement-amount');
                        this.settlementMethod = document.getElementById('settlement-method');
                        this.settlementNotes = document.getElementById('settlement-notes');
                        this.currencySymbol = document.getElementById('currency-symbol');
                        this.amountValidation = document.getElementById('amount-validation');
                        this.submitBtn = document.getElementById('submit-btn');
                        this.form = document.getElementById('settlement-form');
                        this.result = document.getElementById('settlement-result');
                        
                        this.selectedDebt = null;
                        
                        this.populateDebts();
                        this.setupEventListeners();
                        this.validateForm();
                    }
                    
                    populateDebts() {
                        debts.forEach(debt => {
                            const option = document.createElement('option');
                            option.value = debt.id;
                            option.textContent = \`\${getUserName(debt.fromUserId)} owes \${getUserName(debt.toUserId)} \${formatCurrency(debt.amount, debt.currency)}\`;
                            this.debtSelect.appendChild(option);
                        });
                    }
                    
                    setupEventListeners() {
                        this.debtSelect.addEventListener('change', () => {
                            this.handleDebtSelection();
                        });
                        
                        this.settlementAmount.addEventListener('input', () => {
                            this.validateAmount();
                            this.validateForm();
                        });
                        
                        this.settlementMethod.addEventListener('change', () => {
                            this.validateForm();
                        });
                        
                        this.form.addEventListener('submit', (e) => {
                            e.preventDefault();
                            this.handleSubmit();
                        });
                        
                        document.getElementById('cancel-btn').addEventListener('click', () => {
                            this.resetForm();
                        });
                    }
                    
                    handleDebtSelection() {
                        const selectedId = this.debtSelect.value;
                        
                        if (!selectedId) {
                            this.selectedDebt = null;
                            this.debtDetails.style.display = 'none';
                            this.currencySymbol.textContent = '$';
                            this.settlementAmount.value = '';
                            this.validateForm();
                            return;
                        }
                        
                        this.selectedDebt = debts.find(debt => debt.id === selectedId);
                        
                        if (this.selectedDebt) {
                            this.debtDescription.textContent = \`\${getUserName(this.selectedDebt.fromUserId)} owes \${getUserName(this.selectedDebt.toUserId)} for "\${this.selectedDebt.description}"\`;
                            this.debtAmount.textContent = \`Amount: \${formatCurrency(this.selectedDebt.amount, this.selectedDebt.currency)}\`;
                            this.currencySymbol.textContent = getCurrencySymbol(this.selectedDebt.currency);
                            this.settlementAmount.setAttribute('max', this.selectedDebt.amount);
                            this.settlementAmount.value = this.selectedDebt.amount; // Default to full amount
                            
                            this.debtDetails.style.display = 'block';
                            this.validateAmount();
                            this.validateForm();
                        }
                    }
                    
                    validateAmount() {
                        if (!this.selectedDebt) {
                            this.amountValidation.textContent = '';
                            return true;
                        }
                        
                        const amount = parseFloat(this.settlementAmount.value) || 0;
                        const maxAmount = this.selectedDebt.amount;
                        
                        if (amount <= 0) {
                            this.amountValidation.textContent = 'Amount must be greater than 0';
                            this.amountValidation.className = 'validation-message error';
                            return false;
                        } else if (amount > maxAmount) {
                            this.amountValidation.textContent = \`Amount cannot exceed \${formatCurrency(maxAmount, this.selectedDebt.currency)}\`;
                            this.amountValidation.className = 'validation-message error';
                            return false;
                        } else {
                            const remaining = maxAmount - amount;
                            if (remaining > 0.01) {
                                this.amountValidation.textContent = \`Remaining balance: \${formatCurrency(remaining, this.selectedDebt.currency)}\`;
                                this.amountValidation.className = 'validation-message';
                            } else {
                                this.amountValidation.textContent = 'This will fully settle the debt';
                                this.amountValidation.className = 'validation-message success';
                            }
                            return true;
                        }
                    }
                    
                    validateForm() {
                        const isValid = this.selectedDebt && 
                                       this.settlementAmount.value && 
                                       this.validateAmount() &&
                                       this.settlementMethod.value;
                        
                        this.submitBtn.disabled = !isValid;
                    }
                    
                    handleSubmit() {
                        const amount = parseFloat(this.settlementAmount.value);
                        const method = this.settlementMethod.value;
                        const notes = this.settlementNotes.value.trim();
                        
                        // Simulate settlement processing
                        balanceUpdates++;
                        document.getElementById('balance-updates').textContent = \`Balance updates: \${balanceUpdates}\`;
                        
                        const settlement = {
                            debtId: this.selectedDebt.id,
                            from: getUserName(this.selectedDebt.fromUserId),
                            to: getUserName(this.selectedDebt.toUserId),
                            amount: formatCurrency(amount, this.selectedDebt.currency),
                            method: method,
                            notes: notes,
                            timestamp: new Date().toLocaleString()
                        };
                        
                        this.result.innerHTML = \`
                            <div class="settlement-record" data-testid="settlement-record">
                                <strong>Settlement Recorded:</strong><br>
                                \${settlement.from} paid \${settlement.to} \${settlement.amount}<br>
                                <small>Method: \${settlement.method} | \${settlement.timestamp}</small>
                                \${settlement.notes ? \`<br><em>Notes: \${settlement.notes}</em>\` : ''}
                            </div>
                        \`;
                        
                        // Remove settled debt from list (partial settlements would reduce amount)
                        const debtIndex = debts.findIndex(debt => debt.id === this.selectedDebt.id);
                        if (debtIndex !== -1 && Math.abs(amount - this.selectedDebt.amount) < 0.01) {
                            // Full settlement - remove debt
                            debts.splice(debtIndex, 1);
                            const option = this.debtSelect.querySelector(\`option[value="\${this.selectedDebt.id}"]\`);
                            if (option) option.remove();
                        } else if (debtIndex !== -1) {
                            // Partial settlement - reduce amount
                            debts[debtIndex].amount -= amount;
                            const option = this.debtSelect.querySelector(\`option[value="\${this.selectedDebt.id}"]\`);
                            if (option) {
                                option.textContent = \`\${getUserName(debts[debtIndex].fromUserId)} owes \${getUserName(debts[debtIndex].toUserId)} \${formatCurrency(debts[debtIndex].amount, debts[debtIndex].currency)}\`;
                            }
                        }
                        
                        this.resetForm();
                    }
                    
                    resetForm() {
                        this.form.reset();
                        this.selectedDebt = null;
                        this.debtDetails.style.display = 'none';
                        this.currencySymbol.textContent = '$';
                        this.amountValidation.textContent = '';
                        this.validateForm();
                    }
                }
                
                window.settlementForm = new SettlementForm();
            </script>
        `);

        // Initially form should be invalid
        await expect(page.getByTestId('submit-btn')).toBeDisabled();
        await expect(page.getByTestId('debt-details')).toBeHidden();

        // Select a debt
        await page.getByTestId('debt-select').selectOption('1');
        
        // Should show debt details
        await expect(page.getByTestId('debt-details')).toBeVisible();
        await expect(page.getByTestId('debt-description')).toHaveText('Admin User owes Member User for "Lunch expenses"');
        await expect(page.getByTestId('debt-amount')).toHaveText('Amount: $25.50');
        await expect(page.getByTestId('settlement-amount')).toHaveValue('25.5');
        await expect(page.getByTestId('amount-validation')).toHaveText('This will fully settle the debt');

        // Select payment method
        await page.getByTestId('settlement-method').selectOption('venmo');
        
        // Form should now be valid
        await expect(page.getByTestId('submit-btn')).toBeEnabled();

        // Add notes
        await page.getByTestId('settlement-notes').fill('Paid via Venmo @john_doe');

        // Submit form
        await page.getByTestId('submit-btn').click();

        // Should show settlement record
        await expect(page.getByTestId('settlement-record')).toBeVisible();
        await expect(page.getByTestId('settlement-record')).toContainText('Admin User paid Member User $25.50');
        await expect(page.getByTestId('settlement-record')).toContainText('Method: venmo');
        await expect(page.getByTestId('settlement-record')).toContainText('Notes: Paid via Venmo @john_doe');
        await expect(page.getByTestId('balance-updates')).toHaveText('Balance updates: 1');

        // Form should be reset
        await expect(page.getByTestId('debt-select')).toHaveValue('');
        await expect(page.getByTestId('debt-details')).toBeHidden();
        await expect(page.getByTestId('settlement-amount')).toHaveValue('');
        await expect(page.getByTestId('settlement-method')).toHaveValue('');
        await expect(page.getByTestId('settlement-notes')).toHaveValue('');
    });

    test('should validate settlement amounts correctly', async ({ page }) => {
        await createTestPage(page, `
            <div class="settlement-form">
                <form id="settlement-form">
                    <select id="debt-select" data-testid="debt-select">
                        <option value="">Select debt...</option>
                        <option value="2">Viewer owes Admin $15.25</option>
                    </select>
                    
                    <div id="debt-details" data-testid="debt-details" style="display: none;">
                        <div id="debt-amount" data-testid="debt-amount"></div>
                    </div>
                    
                    <div class="amount-input-group">
                        <span id="currency-symbol">$</span>
                        <input type="number" id="settlement-amount" data-testid="settlement-amount" step="0.01" min="0" />
                    </div>
                    <div id="amount-validation" data-testid="amount-validation" class="validation-message"></div>
                    
                    <select id="settlement-method" data-testid="settlement-method">
                        <option value="">Select method...</option>
                        <option value="cash">Cash</option>
                    </select>
                    
                    <button type="submit" id="submit-btn" data-testid="submit-btn">Submit</button>
                </form>
            </div>

            <style>
                .validation-message.error { color: red; }
                .validation-message.success { color: green; }
                .amount-input-group { position: relative; }
                #currency-symbol { position: absolute; left: 12px; top: 8px; }
                input { padding-left: 28px; width: 200px; }
                #debt-details { background: #f0f0f0; padding: 10px; margin: 10px 0; }
                button:disabled { opacity: 0.5; cursor: not-allowed; }
            </style>

            <script>
                const users = ${JSON.stringify(testUsers)};
                const selectedDebt = {
                    id: '2',
                    fromUserId: 'viewer-user-789',
                    toUserId: 'admin-user-123',
                    amount: 15.25,
                    currency: 'USD'
                };
                
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
                
                class SettlementValidator {
                    constructor() {
                        this.debtSelect = document.getElementById('debt-select');
                        this.debtDetails = document.getElementById('debt-details');
                        this.debtAmount = document.getElementById('debt-amount');
                        this.settlementAmount = document.getElementById('settlement-amount');
                        this.amountValidation = document.getElementById('amount-validation');
                        this.submitBtn = document.getElementById('submit-btn');
                        this.settlementMethod = document.getElementById('settlement-method');
                        
                        this.currentDebt = null;
                        this.setupEventListeners();
                    }
                    
                    setupEventListeners() {
                        this.debtSelect.addEventListener('change', () => {
                            if (this.debtSelect.value === '2') {
                                this.currentDebt = selectedDebt;
                                this.debtAmount.textContent = \`Max amount: \${formatCurrency(selectedDebt.amount, selectedDebt.currency)}\`;
                                this.debtDetails.style.display = 'block';
                            } else {
                                this.currentDebt = null;
                                this.debtDetails.style.display = 'none';
                            }
                            this.validateAmount();
                        });
                        
                        this.settlementAmount.addEventListener('input', () => {
                            this.validateAmount();
                        });
                        
                        this.settlementMethod.addEventListener('change', () => {
                            this.validateForm();
                        });
                    }
                    
                    validateAmount() {
                        if (!this.currentDebt) {
                            this.amountValidation.textContent = '';
                            this.validateForm();
                            return true;
                        }
                        
                        const amount = parseFloat(this.settlementAmount.value) || 0;
                        const maxAmount = this.currentDebt.amount;
                        
                        if (amount <= 0) {
                            this.amountValidation.textContent = 'Amount must be greater than 0';
                            this.amountValidation.className = 'validation-message error';
                            this.validateForm();
                            return false;
                        } else if (amount > maxAmount) {
                            this.amountValidation.textContent = \`Amount cannot exceed \${formatCurrency(maxAmount, this.currentDebt.currency)}\`;
                            this.amountValidation.className = 'validation-message error';
                            this.validateForm();
                            return false;
                        } else {
                            const remaining = Math.round((maxAmount - amount) * 100) / 100;
                            if (remaining >= 0.01) {
                                this.amountValidation.textContent = \`Partial settlement. Remaining: \${formatCurrency(remaining, this.currentDebt.currency)}\`;
                                this.amountValidation.className = 'validation-message';
                            } else {
                                this.amountValidation.textContent = 'Full settlement - debt will be closed';
                                this.amountValidation.className = 'validation-message success';
                            }
                            this.validateForm();
                            return true;
                        }
                    }
                    
                    validateForm() {
                        const isValid = this.currentDebt && 
                                       this.settlementAmount.value && 
                                       parseFloat(this.settlementAmount.value) > 0 &&
                                       parseFloat(this.settlementAmount.value) <= this.currentDebt.amount &&
                                       this.settlementMethod.value;
                        
                        this.submitBtn.disabled = !isValid;
                    }
                }
                
                window.validator = new SettlementValidator();
            </script>
        `);

        // Select debt first
        await page.getByTestId('debt-select').selectOption('2');
        await expect(page.getByTestId('debt-details')).toBeVisible();
        await expect(page.getByTestId('debt-amount')).toHaveText('Max amount: $15.25');

        // Test zero amount
        await page.getByTestId('settlement-amount').fill('0');
        await expect(page.getByTestId('amount-validation')).toHaveText('Amount must be greater than 0');
        await expect(page.getByTestId('amount-validation')).toHaveClass(/error/);

        // Test negative amount
        await page.getByTestId('settlement-amount').fill('-5');
        await expect(page.getByTestId('amount-validation')).toHaveText('Amount must be greater than 0');

        // Test amount exceeding debt
        await page.getByTestId('settlement-amount').fill('20');
        await expect(page.getByTestId('amount-validation')).toHaveText('Amount cannot exceed $15.25');
        await expect(page.getByTestId('amount-validation')).toHaveClass(/error/);

        // Test partial settlement
        await page.getByTestId('settlement-amount').fill('10.00');
        await expect(page.getByTestId('amount-validation')).toHaveText('Partial settlement. Remaining: $5.25');
        await expect(page.getByTestId('amount-validation')).not.toHaveClass(/error/);

        // Test full settlement
        await page.getByTestId('settlement-amount').fill('15.25');
        await expect(page.getByTestId('amount-validation')).toHaveText('Full settlement - debt will be closed');
        await expect(page.getByTestId('amount-validation')).toHaveClass(/success/);

        // Test very close to full amount (within penny)
        await page.getByTestId('settlement-amount').fill('15.24');
        await expect(page.getByTestId('amount-validation')).toHaveText('Partial settlement. Remaining: $0.01');

        // Test exact full amount with decimals
        await page.getByTestId('settlement-amount').fill('15.250');
        await expect(page.getByTestId('amount-validation')).toHaveText('Full settlement - debt will be closed');

        // Form should be disabled until payment method selected
        await expect(page.getByTestId('submit-btn')).toBeDisabled();
        
        await page.getByTestId('settlement-method').selectOption('cash');
        await expect(page.getByTestId('submit-btn')).toBeEnabled();
    });

    test('should handle multi-currency settlements', async ({ page }) => {
        await createTestPage(page, `
            <div class="settlement-form">
                <select id="debt-select" data-testid="debt-select">
                    <option value="">Select debt...</option>
                    <option value="usd">USD Debt - $25.50</option>
                    <option value="eur">EUR Debt - €30.00</option>
                    <option value="jpy">JPY Debt - ¥2500</option>
                </select>
                
                <div id="debt-details" data-testid="debt-details" style="display: none;">
                    <div id="currency-info" data-testid="currency-info"></div>
                </div>
                
                <div class="amount-input-group">
                    <span id="currency-symbol" data-testid="currency-symbol">$</span>
                    <input type="number" id="settlement-amount" data-testid="settlement-amount" step="0.01" />
                </div>
                
                <div id="formatting-test" data-testid="formatting-test">No currency selected</div>
            </div>

            <style>
                .amount-input-group { position: relative; margin: 10px 0; }
                #currency-symbol { 
                    position: absolute; 
                    left: 12px; 
                    top: 8px; 
                    font-weight: bold;
                    color: #333;
                }
                input { padding-left: 32px; width: 150px; }
                #debt-details { 
                    background: #f5f5f5; 
                    padding: 12px; 
                    margin: 10px 0; 
                    border-radius: 4px;
                }
            </style>

            <script>
                const currencies = {
                    usd: { symbol: '$', amount: 25.50, currency: 'USD', name: 'US Dollars' },
                    eur: { symbol: '€', amount: 30.00, currency: 'EUR', name: 'Euros' },
                    jpy: { symbol: '¥', amount: 2500, currency: 'JPY', name: 'Japanese Yen' }
                };
                
                function formatCurrency(amount, currency) {
                    const formatter = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: currency,
                        minimumFractionDigits: currency === 'JPY' ? 0 : 2
                    });
                    return formatter.format(amount);
                }
                
                class MultiCurrencySettlement {
                    constructor() {
                        this.debtSelect = document.getElementById('debt-select');
                        this.debtDetails = document.getElementById('debt-details');
                        this.currencyInfo = document.getElementById('currency-info');
                        this.currencySymbol = document.getElementById('currency-symbol');
                        this.settlementAmount = document.getElementById('settlement-amount');
                        this.formattingTest = document.getElementById('formatting-test');
                        
                        this.currentCurrency = null;
                        this.setupEventListeners();
                    }
                    
                    setupEventListeners() {
                        this.debtSelect.addEventListener('change', () => {
                            this.handleCurrencyChange();
                        });
                        
                        this.settlementAmount.addEventListener('input', () => {
                            this.updateFormatting();
                        });
                    }
                    
                    handleCurrencyChange() {
                        const selectedKey = this.debtSelect.value;
                        
                        if (!selectedKey || !currencies[selectedKey]) {
                            this.currentCurrency = null;
                            this.debtDetails.style.display = 'none';
                            this.currencySymbol.textContent = '$';
                            this.formattingTest.textContent = 'No currency selected';
                            return;
                        }
                        
                        this.currentCurrency = currencies[selectedKey];
                        this.currencySymbol.textContent = this.currentCurrency.symbol;
                        this.currencyInfo.textContent = \`Currency: \${this.currentCurrency.name} (\${this.currentCurrency.currency}) - Max: \${formatCurrency(this.currentCurrency.amount, this.currentCurrency.currency)}\`;
                        this.debtDetails.style.display = 'block';
                        
                        // Set appropriate step for currency
                        const step = this.currentCurrency.currency === 'JPY' ? '1' : '0.01';
                        this.settlementAmount.setAttribute('step', step);
                        
                        // Set default amount
                        this.settlementAmount.value = this.currentCurrency.amount.toString();
                        this.updateFormatting();
                    }
                    
                    updateFormatting() {
                        if (!this.currentCurrency) return;
                        
                        const amount = parseFloat(this.settlementAmount.value) || 0;
                        if (amount > 0) {
                            this.formattingTest.textContent = \`Formatted: \${formatCurrency(amount, this.currentCurrency.currency)}\`;
                        } else {
                            this.formattingTest.textContent = \`Currency: \${this.currentCurrency.currency}\`;
                        }
                    }
                }
                
                window.multiCurrencyForm = new MultiCurrencySettlement();
            </script>
        `);

        // Test USD currency
        await page.getByTestId('debt-select').selectOption('usd');
        await expect(page.getByTestId('currency-symbol')).toHaveText('$');
        await expect(page.getByTestId('currency-info')).toHaveText('Currency: US Dollars (USD) - Max: $25.50');
        await expect(page.getByTestId('settlement-amount')).toHaveValue('25.5');
        await expect(page.getByTestId('formatting-test')).toHaveText('Formatted: $25.50');

        // Test EUR currency
        await page.getByTestId('debt-select').selectOption('eur');
        await expect(page.getByTestId('currency-symbol')).toHaveText('€');
        await expect(page.getByTestId('currency-info')).toHaveText('Currency: Euros (EUR) - Max: €30.00');
        await expect(page.getByTestId('settlement-amount')).toHaveValue('30');
        await expect(page.getByTestId('formatting-test')).toHaveText('Formatted: €30.00');

        // Test JPY currency (no decimal places)
        await page.getByTestId('debt-select').selectOption('jpy');
        await expect(page.getByTestId('currency-symbol')).toHaveText('¥');
        await expect(page.getByTestId('currency-info')).toHaveText('Currency: Japanese Yen (JPY) - Max: ¥2,500');
        await expect(page.getByTestId('settlement-amount')).toHaveValue('2500');
        await expect(page.getByTestId('settlement-amount')).toHaveAttribute('step', '1'); // No decimals for JPY
        await expect(page.getByTestId('formatting-test')).toHaveText('Formatted: ¥2,500');

        // Test custom amounts
        await page.getByTestId('settlement-amount').fill('1000');
        await expect(page.getByTestId('formatting-test')).toHaveText('Formatted: ¥1,000');

        // Switch back to EUR and test custom amount
        await page.getByTestId('debt-select').selectOption('eur');
        await page.getByTestId('settlement-amount').fill('15.75');
        await expect(page.getByTestId('formatting-test')).toHaveText('Formatted: €15.75');
        await expect(page.getByTestId('settlement-amount')).toHaveAttribute('step', '0.01'); // Decimals for EUR
    });
});