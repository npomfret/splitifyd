import { test, expect } from '@playwright/test';
import { setupStoreMocks, createTestPage, createTestUsers } from '../stores/setup';

/**
 * Focused Playwright tests for split amount inputs functionality
 * 
 * Tests complex split calculations, transitions between split types,
 * real-time validation, and keyboard navigation that require real browser behavior.
 */

test.describe('Split Amount Inputs - Complex Form Interactions', () => {
    const testUsers = createTestUsers().slice(0, 3);
    
    test.beforeEach(async ({ page }) => {
        await setupStoreMocks(page);
    });

    test('should handle equal to exact split transitions with preserved values', async ({ page }) => {
        await createTestPage(page, `
            <div class="split-form">
                <div class="form-group">
                    <label>Total Amount:</label>
                    <input id="total-amount" type="number" step="0.01" value="120" data-testid="total-amount" />
                </div>
                
                <div class="form-group">
                    <label>Split Type:</label>
                    <select id="split-type" data-testid="split-type">
                        <option value="equal">Equal Split</option>
                        <option value="exact">Exact Amounts</option>
                        <option value="percentage">Percentage</option>
                    </select>
                </div>
                
                <div id="participants-container" data-testid="participants">
                    ${testUsers.map(user => `
                        <label>
                            <input type="checkbox" class="participant-checkbox" value="${user.uid}" 
                                   data-testid="participant-${user.uid}" checked />
                            ${user.displayName}
                        </label>
                    `).join('')}
                </div>
                
                <div id="split-inputs-container" data-testid="split-inputs">
                    <div id="split-amounts"></div>
                    <div id="total-validation" data-testid="total-validation" class="validation"></div>
                    <div id="calculated-total" data-testid="calculated-total">Total: $0.00</div>
                </div>
            </div>

            <style>
                .validation.error { color: red; }
                .validation.success { color: green; }
                .split-item { 
                    display: flex; 
                    align-items: center; 
                    gap: 8px; 
                    margin: 4px 0; 
                    padding: 8px;
                    background: #f9f9f9;
                    border-radius: 4px;
                }
                .split-input {
                    padding: 4px 8px;
                    border: 1px solid #ccc;
                    border-radius: 3px;
                    width: 80px;
                }
                .split-input:focus {
                    border-color: #007bff;
                    outline: none;
                }
            </style>

            <script>
                const users = ${JSON.stringify(testUsers)};
                
                class SplitCalculator {
                    constructor() {
                        this.totalAmount = 120;
                        this.splitType = 'equal';
                        this.participants = users.map(u => u.uid);
                        this.splits = new Map();
                        
                        this.setupEventListeners();
                        this.calculateSplits();
                    }
                    
                    setupEventListeners() {
                        document.getElementById('total-amount').addEventListener('input', (e) => {
                            this.totalAmount = parseFloat(e.target.value) || 0;
                            this.calculateSplits();
                        });
                        
                        document.getElementById('split-type').addEventListener('change', (e) => {
                            this.splitType = e.target.value;
                            this.calculateSplits();
                            this.renderSplitInputs();
                        });
                        
                        document.querySelectorAll('.participant-checkbox').forEach(checkbox => {
                            checkbox.addEventListener('change', () => {
                                this.updateParticipants();
                                this.calculateSplits();
                            });
                        });
                    }
                    
                    updateParticipants() {
                        this.participants = Array.from(document.querySelectorAll('.participant-checkbox:checked'))
                            .map(cb => cb.value);
                    }
                    
                    calculateSplits() {
                        if (this.participants.length === 0 || this.totalAmount <= 0) {
                            this.splits.clear();
                            this.renderSplitInputs();
                            return;
                        }
                        
                        if (this.splitType === 'equal') {
                            const equalAmount = this.totalAmount / this.participants.length;
                            this.participants.forEach(userId => {
                                this.splits.set(userId, equalAmount);
                            });
                        } else if (this.splitType === 'percentage') {
                            const equalPercentage = 100 / this.participants.length;
                            this.participants.forEach(userId => {
                                const amount = (this.totalAmount * equalPercentage) / 100;
                                this.splits.set(userId, amount);
                            });
                        }
                        
                        this.renderSplitInputs();
                        this.validateTotal();
                    }
                    
                    renderSplitInputs() {
                        const container = document.getElementById('split-amounts');
                        
                        if (this.participants.length === 0) {
                            container.innerHTML = '<p>Select participants</p>';
                            return;
                        }
                        
                        container.innerHTML = this.participants.map(userId => {
                            const user = users.find(u => u.uid === userId);
                            const amount = this.splits.get(userId) || 0;
                            
                            if (this.splitType === 'equal') {
                                return \`
                                    <div class="split-item" data-testid="split-item-\${userId}">
                                        <span>\${user.displayName}:</span>
                                        <span class="amount" data-testid="split-amount-\${userId}">$\${amount.toFixed(2)}</span>
                                    </div>
                                \`;
                            } else if (this.splitType === 'exact') {
                                return \`
                                    <div class="split-item" data-testid="split-item-\${userId}">
                                        <span>\${user.displayName}:</span>
                                        <span>$</span>
                                        <input type="number" step="0.01" min="0" 
                                               class="split-input" 
                                               value="\${amount.toFixed(2)}" 
                                               data-testid="exact-input-\${userId}"
                                               data-user-id="\${userId}" />
                                    </div>
                                \`;
                            } else if (this.splitType === 'percentage') {
                                const percentage = this.totalAmount > 0 ? (amount / this.totalAmount * 100) : 0;
                                return \`
                                    <div class="split-item" data-testid="split-item-\${userId}">
                                        <span>\${user.displayName}:</span>
                                        <input type="number" step="0.1" min="0" max="100"
                                               class="split-input" 
                                               value="\${percentage.toFixed(1)}" 
                                               data-testid="percentage-input-\${userId}"
                                               data-user-id="\${userId}" />
                                        <span>% = $\${amount.toFixed(2)}</span>
                                    </div>
                                \`;
                            }
                        }).join('');
                        
                        // Add event listeners for input fields
                        if (this.splitType === 'exact') {
                            container.querySelectorAll('input[data-testid^="exact-input-"]').forEach(input => {
                                input.addEventListener('input', (e) => {
                                    const userId = e.target.getAttribute('data-user-id');
                                    const value = parseFloat(e.target.value) || 0;
                                    this.splits.set(userId, value);
                                    this.validateTotal();
                                });
                            });
                        } else if (this.splitType === 'percentage') {
                            container.querySelectorAll('input[data-testid^="percentage-input-"]').forEach(input => {
                                input.addEventListener('input', (e) => {
                                    const userId = e.target.getAttribute('data-user-id');
                                    const percentage = parseFloat(e.target.value) || 0;
                                    const amount = (this.totalAmount * percentage) / 100;
                                    this.splits.set(userId, amount);
                                    this.updatePercentageDisplay();
                                    this.validateTotal();
                                });
                            });
                        }
                    }
                    
                    updatePercentageDisplay() {
                        this.participants.forEach(userId => {
                            const amount = this.splits.get(userId) || 0;
                            const item = document.querySelector(\`[data-testid="split-item-\${userId}"] span:last-child\`);
                            if (item) {
                                item.textContent = \`% = $\${amount.toFixed(2)}\`;
                            }
                        });
                    }
                    
                    validateTotal() {
                        const calculatedTotal = Array.from(this.splits.values()).reduce((sum, amount) => sum + amount, 0);
                        const validation = document.getElementById('total-validation');
                        const totalDisplay = document.getElementById('calculated-total');
                        
                        totalDisplay.textContent = \`Total: $\${calculatedTotal.toFixed(2)}\`;
                        
                        const difference = Math.abs(calculatedTotal - this.totalAmount);
                        if (difference < 0.01) {
                            validation.textContent = 'Total matches ✓';
                            validation.className = 'validation success';
                        } else {
                            validation.textContent = \`Total mismatch: $\${difference.toFixed(2)}\`;
                            validation.className = 'validation error';
                        }
                    }
                }
                
                window.splitCalculator = new SplitCalculator();
            </script>
        `);

        // Verify initial equal split
        await expect(page.getByTestId('split-amount-admin-user-123')).toHaveText('$40.00');
        await expect(page.getByTestId('split-amount-member-user-456')).toHaveText('$40.00');
        await expect(page.getByTestId('split-amount-viewer-user-789')).toHaveText('$40.00');
        await expect(page.getByTestId('calculated-total')).toHaveText('Total: $120.00');
        await expect(page.getByTestId('total-validation')).toHaveText('Total matches ✓');

        // Switch to exact amounts - should preserve current values
        await page.getByTestId('split-type').selectOption('exact');
        
        // Should show input fields with equal split values
        await expect(page.getByTestId('exact-input-admin-user-123')).toBeVisible();
        await expect(page.getByTestId('exact-input-admin-user-123')).toHaveValue('40.00');
        await expect(page.getByTestId('exact-input-member-user-456')).toHaveValue('40.00');
        await expect(page.getByTestId('exact-input-viewer-user-789')).toHaveValue('40.00');

        // Modify exact amounts
        await page.getByTestId('exact-input-admin-user-123').fill('60');
        await page.getByTestId('exact-input-member-user-456').fill('40');
        await page.getByTestId('exact-input-viewer-user-789').fill('20');
        
        // Should validate correctly
        await expect(page.getByTestId('calculated-total')).toHaveText('Total: $120.00');
        await expect(page.getByTestId('total-validation')).toHaveText('Total matches ✓');

        // Test validation error
        await page.getByTestId('exact-input-admin-user-123').fill('70');
        await expect(page.getByTestId('calculated-total')).toHaveText('Total: $130.00');
        await expect(page.getByTestId('total-validation')).toHaveText('Total mismatch: $10.00');
    });

    test('should handle percentage split calculations correctly', async ({ page }) => {
        await createTestPage(page, `
            <div class="split-form">
                <input id="total-amount" type="number" step="0.01" value="100" data-testid="total-amount" />
                
                <select id="split-type" data-testid="split-type">
                    <option value="equal">Equal Split</option>
                    <option value="exact">Exact Amounts</option>
                    <option value="percentage" selected>Percentage</option>
                </select>
                
                <div id="participants-container">
                    ${testUsers.slice(0, 2).map(user => `
                        <input type="checkbox" class="participant-checkbox" value="${user.uid}" 
                               data-testid="participant-${user.uid}" checked />
                    `).join('')}
                </div>
                
                <div id="split-amounts"></div>
                <div id="total-validation" data-testid="total-validation"></div>
                <div id="calculated-total" data-testid="calculated-total"></div>
            </div>

            <script>
                // Reuse the same SplitCalculator class
                const users = ${JSON.stringify(testUsers.slice(0, 2))};
                
                class SplitCalculator {
                    constructor() {
                        this.totalAmount = 100;
                        this.splitType = 'percentage';
                        this.participants = users.map(u => u.uid);
                        this.splits = new Map();
                        
                        this.setupEventListeners();
                        this.calculateSplits();
                    }
                    
                    setupEventListeners() {
                        document.getElementById('total-amount').addEventListener('input', (e) => {
                            this.totalAmount = parseFloat(e.target.value) || 0;
                            this.calculateSplits();
                        });
                        
                        document.getElementById('split-type').addEventListener('change', (e) => {
                            this.splitType = e.target.value;
                            this.calculateSplits();
                            this.renderSplitInputs();
                        });
                    }
                    
                    calculateSplits() {
                        if (this.participants.length === 0 || this.totalAmount <= 0) {
                            this.splits.clear();
                            this.renderSplitInputs();
                            return;
                        }
                        
                        if (this.splitType === 'percentage') {
                            const equalPercentage = 100 / this.participants.length;
                            this.participants.forEach(userId => {
                                const amount = (this.totalAmount * equalPercentage) / 100;
                                this.splits.set(userId, amount);
                            });
                        }
                        
                        this.renderSplitInputs();
                        this.validateTotal();
                    }
                    
                    renderSplitInputs() {
                        const container = document.getElementById('split-amounts');
                        
                        container.innerHTML = this.participants.map(userId => {
                            const user = users.find(u => u.uid === userId);
                            const amount = this.splits.get(userId) || 0;
                            const percentage = this.totalAmount > 0 ? (amount / this.totalAmount * 100) : 0;
                            
                            return \`
                                <div class="split-item" data-testid="split-item-\${userId}">
                                    <span>\${user.displayName}:</span>
                                    <input type="number" step="0.1" min="0" max="100"
                                           value="\${percentage.toFixed(1)}" 
                                           data-testid="percentage-input-\${userId}"
                                           data-user-id="\${userId}" />
                                    <span data-testid="amount-display-\${userId}">% = $\${amount.toFixed(2)}</span>
                                </div>
                            \`;
                        }).join('');
                        
                        // Add event listeners
                        container.querySelectorAll('input[data-testid^="percentage-input-"]').forEach(input => {
                            input.addEventListener('input', (e) => {
                                const userId = e.target.getAttribute('data-user-id');
                                const percentage = parseFloat(e.target.value) || 0;
                                const amount = (this.totalAmount * percentage) / 100;
                                this.splits.set(userId, amount);
                                
                                // Update display
                                const display = document.querySelector(\`[data-testid="amount-display-\${userId}"]\`);
                                if (display) {
                                    display.textContent = \`% = $\${amount.toFixed(2)}\`;
                                }
                                
                                this.validateTotal();
                            });
                        });
                    }
                    
                    validateTotal() {
                        const calculatedTotal = Array.from(this.splits.values()).reduce((sum, amount) => sum + amount, 0);
                        const totalDisplay = document.getElementById('calculated-total');
                        const validation = document.getElementById('total-validation');
                        
                        totalDisplay.textContent = \`Total: $\${calculatedTotal.toFixed(2)}\`;
                        
                        const difference = Math.abs(calculatedTotal - this.totalAmount);
                        if (difference < 0.01) {
                            validation.textContent = 'Total matches ✓';
                            validation.className = 'validation success';
                        } else {
                            validation.textContent = \`Total mismatch: $\${difference.toFixed(2)}\`;
                            validation.className = 'validation error';
                        }
                    }
                }
                
                window.splitCalculator = new SplitCalculator();
            </script>
        `);

        // Should start with 50% each for 2 people
        await expect(page.getByTestId('percentage-input-admin-user-123')).toHaveValue('50.0');
        await expect(page.getByTestId('percentage-input-member-user-456')).toHaveValue('50.0');
        await expect(page.getByTestId('amount-display-admin-user-123')).toHaveText('% = $50.00');
        await expect(page.getByTestId('amount-display-member-user-456')).toHaveText('% = $50.00');

        // Change percentages
        await page.getByTestId('percentage-input-admin-user-123').fill('70');
        await page.getByTestId('percentage-input-member-user-456').fill('30');

        // Should update amounts in real-time
        await expect(page.getByTestId('amount-display-admin-user-123')).toHaveText('% = $70.00');
        await expect(page.getByTestId('amount-display-member-user-456')).toHaveText('% = $30.00');
        await expect(page.getByTestId('calculated-total')).toHaveText('Total: $100.00');
        await expect(page.getByTestId('total-validation')).toHaveText('Total matches ✓');
    });

    test('should handle keyboard navigation between split inputs', async ({ page }) => {
        await createTestPage(page, `
            <div class="split-form">
                <input id="total-amount" type="number" value="90" data-testid="total-amount" />
                
                <select id="split-type" data-testid="split-type">
                    <option value="exact" selected>Exact Amounts</option>
                </select>
                
                <div id="participants-container">
                    ${testUsers.map(user => `
                        <input type="checkbox" class="participant-checkbox" value="${user.uid}" checked />
                    `).join('')}
                </div>
                
                <div id="split-amounts"></div>
            </div>

            <script>
                const users = ${JSON.stringify(testUsers)};
                
                class SplitCalculator {
                    constructor() {
                        this.totalAmount = 90;
                        this.splitType = 'exact';
                        this.participants = users.map(u => u.uid);
                        this.splits = new Map();
                        
                        // Set initial equal amounts
                        const equalAmount = this.totalAmount / this.participants.length;
                        this.participants.forEach(userId => {
                            this.splits.set(userId, equalAmount);
                        });
                        
                        this.renderSplitInputs();
                    }
                    
                    renderSplitInputs() {
                        const container = document.getElementById('split-amounts');
                        
                        container.innerHTML = this.participants.map((userId, index) => {
                            const user = users.find(u => u.uid === userId);
                            const amount = this.splits.get(userId) || 0;
                            
                            return \`
                                <div class="split-item">
                                    <label for="input-\${index}">\${user.displayName}:</label>
                                    <input type="number" step="0.01" min="0"
                                           id="input-\${index}"
                                           value="\${amount.toFixed(2)}" 
                                           data-testid="exact-input-\${userId}"
                                           data-user-id="\${userId}" 
                                           tabindex="\${index + 1}" />
                                </div>
                            \`;
                        }).join('');
                        
                        // Add keyboard navigation
                        container.querySelectorAll('input').forEach((input, index) => {
                            input.addEventListener('keydown', (e) => {
                                if (e.key === 'Tab') return; // Let natural tab work
                                
                                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                                    e.preventDefault();
                                    const nextIndex = (index + 1) % this.participants.length;
                                    const nextInput = container.querySelectorAll('input')[nextIndex];
                                    if (nextInput) {
                                        nextInput.focus();
                                        nextInput.select();
                                    }
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const prevIndex = index === 0 ? this.participants.length - 1 : index - 1;
                                    const prevInput = container.querySelectorAll('input')[prevIndex];
                                    if (prevInput) {
                                        prevInput.focus();
                                        prevInput.select();
                                    }
                                }
                            });
                            
                            input.addEventListener('input', (e) => {
                                const userId = e.target.getAttribute('data-user-id');
                                const value = parseFloat(e.target.value) || 0;
                                this.splits.set(userId, value);
                            });
                        });
                    }
                }
                
                window.splitCalculator = new SplitCalculator();
            </script>
        `);

        // Test tab navigation
        await page.getByTestId('exact-input-admin-user-123').focus();
        await expect(page.getByTestId('exact-input-admin-user-123')).toBeFocused();

        // Test arrow down navigation
        await page.keyboard.press('ArrowDown');
        await expect(page.getByTestId('exact-input-member-user-456')).toBeFocused();

        // Test arrow down wrapping
        await page.keyboard.press('ArrowDown');
        await expect(page.getByTestId('exact-input-viewer-user-789')).toBeFocused();
        
        await page.keyboard.press('ArrowDown');
        await expect(page.getByTestId('exact-input-admin-user-123')).toBeFocused();

        // Test arrow up navigation
        await page.keyboard.press('ArrowUp');
        await expect(page.getByTestId('exact-input-viewer-user-789')).toBeFocused();

        // Test Enter key navigation
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('exact-input-admin-user-123')).toBeFocused();
    });

    test('should handle precision and decimal validation correctly', async ({ page }) => {
        await createTestPage(page, `
            <div class="split-form">
                <input id="total-amount" type="number" value="10.01" data-testid="total-amount" />
                
                <select id="split-type" data-testid="split-type">
                    <option value="exact" selected>Exact Amounts</option>
                </select>
                
                <div id="participants-container">
                    ${testUsers.slice(0, 2).map(user => `
                        <input type="checkbox" class="participant-checkbox" value="${user.uid}" checked />
                    `).join('')}
                </div>
                
                <div id="split-amounts"></div>
                <div id="precision-test" data-testid="precision-info"></div>
            </div>

            <script>
                const users = ${JSON.stringify(testUsers.slice(0, 2))};
                
                class SplitCalculator {
                    constructor() {
                        this.totalAmount = 10.01;
                        this.splitType = 'exact';
                        this.participants = users.map(u => u.uid);
                        this.splits = new Map();
                        
                        // Set initial amounts that don't divide evenly
                        this.splits.set(this.participants[0], 5.00);
                        this.splits.set(this.participants[1], 5.01);
                        
                        this.renderSplitInputs();
                    }
                    
                    renderSplitInputs() {
                        const container = document.getElementById('split-amounts');
                        
                        container.innerHTML = this.participants.map(userId => {
                            const user = users.find(u => u.uid === userId);
                            const amount = this.splits.get(userId) || 0;
                            
                            return \`
                                <div class="split-item">
                                    <span>\${user.displayName}:</span>
                                    <input type="number" step="0.01" min="0"
                                           value="\${amount.toFixed(2)}" 
                                           data-testid="exact-input-\${userId}"
                                           data-user-id="\${userId}" />
                                </div>
                            \`;
                        }).join('');
                        
                        container.querySelectorAll('input').forEach(input => {
                            input.addEventListener('input', (e) => {
                                const userId = e.target.getAttribute('data-user-id');
                                const value = parseFloat(e.target.value) || 0;
                                this.splits.set(userId, value);
                                this.updatePrecisionInfo();
                            });
                        });
                        
                        this.updatePrecisionInfo();
                    }
                    
                    updatePrecisionInfo() {
                        const total = Array.from(this.splits.values()).reduce((sum, amount) => sum + amount, 0);
                        const difference = Math.abs(total - this.totalAmount);
                        const precisionInfo = document.getElementById('precision-test');
                        
                        precisionInfo.textContent = \`Total: $\${total.toFixed(2)}, Difference: $\${difference.toFixed(3)}\`;
                    }
                }
                
                window.splitCalculator = new SplitCalculator();
            </script>
        `);

        // Should handle precision correctly
        await expect(page.getByTestId('exact-input-admin-user-123')).toHaveValue('5.00');
        await expect(page.getByTestId('exact-input-member-user-456')).toHaveValue('5.01');
        await expect(page.getByTestId('precision-info')).toHaveText('Total: $10.01, Difference: $0.000');

        // Test decimal input precision
        await page.getByTestId('exact-input-admin-user-123').fill('5.005');
        await expect(page.getByTestId('precision-info')).toContainText('Total: $10.02');
        
        // Test very small differences
        await page.getByTestId('exact-input-admin-user-123').fill('5.004');
        await expect(page.getByTestId('precision-info')).toContainText('Difference: $0.004');
    });
});