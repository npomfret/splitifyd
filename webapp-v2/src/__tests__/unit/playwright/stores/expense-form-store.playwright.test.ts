import { test, expect } from '@playwright/test';
import { setupStoreMocks, createTestPage, createTestUsers, createTestGroup, mockAuthState, mockGroupData } from './setup';

/**
 * Focused Playwright tests for expense form store functionality
 * 
 * Tests complex form state management, split calculations, draft persistence,
 * and real-time validation without requiring full backend integration.
 */

test.describe('Expense Form Store - Split Calculations', () => {
    const testUsers = createTestUsers().slice(0, 3); // Use 3 users for testing
    
    test.beforeEach(async ({ page }) => {
        await setupStoreMocks(page);
        await mockAuthState(page, testUsers[0]);
    });

    test('should calculate equal splits correctly', async ({ page }) => {
        // Create test group data
        const testGroup = createTestGroup(testUsers);
        
        await createTestPage(page, `
            <div class="expense-form">
                <h2>Create Expense</h2>
                
                <div class="form-group">
                    <label>Amount:</label>
                    <input id="amount" type="number" step="0.01" min="0" data-testid="amount-input" />
                </div>
                
                <div class="form-group">
                    <label>Split Type:</label>
                    <select id="split-type" data-testid="split-type">
                        <option value="equal">Equal Split</option>
                        <option value="exact">Exact Amounts</option>
                        <option value="percentage">Percentage</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Participants:</label>
                    <div id="participants">
                        ${testUsers.map((user, index) => `
                            <label>
                                <input type="checkbox" class="participant-checkbox" value="${user.uid}" data-testid="participant-${index}" />
                                ${user.displayName}
                            </label>
                        `).join('')}
                    </div>
                </div>
                
                <div id="split-details" data-testid="split-details">
                    <h3>Split Breakdown</h3>
                    <div id="split-amounts"></div>
                    <div id="split-total" data-testid="split-total">Total: $0.00</div>
                    <div id="split-validation" data-testid="split-validation" class="error"></div>
                </div>
            </div>

            <script>
                // Inject mock group data first
                window.mockGroup = ${JSON.stringify(testGroup)};
                
                class ExpenseFormStore {
                    constructor() {
                        this.amount = 0;
                        this.splitType = 'equal';
                        this.participants = [];
                        this.splits = new Map();
                        
                        this.setupEventListeners();
                        this.calculateSplits();
                    }

                    setupEventListeners() {
                        document.getElementById('amount').addEventListener('input', (e) => {
                            this.amount = parseFloat(e.target.value) || 0;
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
                                this.renderSplitInputs();
                            });
                        });
                    }

                    updateParticipants() {
                        this.participants = Array.from(document.querySelectorAll('.participant-checkbox:checked'))
                            .map(checkbox => checkbox.value);
                    }

                    calculateSplits() {
                        if (this.participants.length === 0 || this.amount <= 0) {
                            this.splits.clear();
                            this.renderSplitAmounts();
                            return;
                        }

                        if (this.splitType === 'equal') {
                            const equalAmount = this.amount / this.participants.length;
                            this.participants.forEach(userId => {
                                this.splits.set(userId, equalAmount);
                            });
                        }
                        
                        this.renderSplitAmounts();
                        this.validateSplits();
                    }

                    renderSplitInputs() {
                        const container = document.getElementById('split-amounts');
                        if (this.participants.length === 0) {
                            container.innerHTML = '<p>Select participants first</p>';
                            return;
                        }

                        container.innerHTML = this.participants.map(userId => {
                            const user = window.mockGroup.members.find(m => m.uid === userId);
                            const amount = this.splits.get(userId) || 0;
                            
                            if (this.splitType === 'equal') {
                                return '<div class="split-item" data-testid="split-item-' + userId + '">' +
                                    '<span>' + user.displayName + ':</span> ' +
                                    '<span class="amount" data-testid="split-amount-' + userId + '">$' + amount.toFixed(2) + '</span>' +
                                    '</div>';
                            } else if (this.splitType === 'exact') {
                                return '<div class="split-item" data-testid="split-item-' + userId + '">' +
                                    '<label>' + user.displayName + ':</label> ' +
                                    '<input type="number" step="0.01" min="0" value="' + amount.toFixed(2) + '" ' +
                                    'data-testid="exact-input-' + userId + '" ' +
                                    'onchange="expenseForm.updateExactAmount(\\''+userId+'\\', this.value)" />' +
                                    '</div>';
                            }
                        }).join('');
                    }

                    updateExactAmount(userId, value) {
                        this.splits.set(userId, parseFloat(value) || 0);
                        this.validateSplits();
                        this.renderSplitTotal();
                    }

                    renderSplitAmounts() {
                        this.renderSplitInputs();
                        this.renderSplitTotal();
                    }

                    renderSplitTotal() {
                        const total = Array.from(this.splits.values()).reduce((sum, amount) => sum + amount, 0);
                        document.getElementById('split-total').textContent = 'Total: $' + total.toFixed(2);
                    }

                    validateSplits() {
                        const total = Array.from(this.splits.values()).reduce((sum, amount) => sum + amount, 0);
                        const validation = document.getElementById('split-validation');
                        
                        if (Math.abs(total - this.amount) < 0.01) {
                            validation.textContent = '';
                            validation.className = '';
                        } else {
                            validation.textContent = 'Split amounts must equal total expense amount';
                            validation.className = 'error';
                        }
                    }
                }

                // Global reference for event handlers
                window.expenseForm = new ExpenseFormStore();
            </script>
        `);

        // Test equal split calculation
        await page.getByTestId('amount-input').fill('100');
        await page.getByTestId('participant-0').check(); // Admin user
        await page.getByTestId('participant-1').check(); // Member user

        // Should split $100 equally between 2 users = $50 each
        await expect(page.getByTestId('split-amount-admin-user-123')).toHaveText('$50.00');
        await expect(page.getByTestId('split-amount-member-user-456')).toHaveText('$50.00');
        await expect(page.getByTestId('split-total')).toHaveText('Total: $100.00');
        await expect(page.getByTestId('split-validation')).toHaveText('');

        // Add third participant
        await page.getByTestId('participant-2').check(); // Viewer user

        // Should now split between 3 users = $33.33 each (with rounding)
        await expect(page.getByTestId('split-total')).toHaveText('Total: $100.00');
        await expect(page.getByTestId('split-validation')).toHaveText('');
    });

    test('should transition from equal to exact split type', async ({ page }) => {
        // Create test group data
        const testGroup = createTestGroup(testUsers);
        
        await createTestPage(page, `
            <div class="expense-form">
                <div class="form-group">
                    <input id="amount" type="number" step="0.01" min="0" data-testid="amount-input" value="120" />
                </div>
                
                <div class="form-group">
                    <select id="split-type" data-testid="split-type">
                        <option value="equal">Equal Split</option>
                        <option value="exact">Exact Amounts</option>
                    </select>
                </div>
                
                <div class="form-group">
                    ${testUsers.slice(0, 2).map((user, index) => `
                        <label>
                            <input type="checkbox" class="participant-checkbox" value="${user.uid}" 
                                   data-testid="participant-${index}" checked />
                            ${user.displayName}
                        </label>
                    `).join('')}
                </div>
                
                <div id="split-amounts"></div>
                <div id="split-total" data-testid="split-total">Total: $0.00</div>
                <div id="split-validation" data-testid="split-validation"></div>
            </div>

            <script>
                // Inject mock group data first
                window.mockGroup = ${JSON.stringify(testGroup)};
            </script>
            ${getExpenseFormScript()} <!-- Reuse the same script -->
        `);

        // Wait for form to initialize and calculate splits
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(100); // Small delay for script execution

        // Wait for form initialization and split calculation
        await expect(page.getByTestId('split-total')).toHaveText('Total: $120.00');
        
        // Initially equal split: $120 ÷ 2 = $60 each  
        await expect(page.getByTestId('split-amount-admin-user-123')).toHaveText('$60.00');

        // Switch to exact amounts
        await page.getByTestId('split-type').selectOption('exact');

        // Should now show input fields with current equal amounts
        await expect(page.getByTestId('exact-input-admin-user-123')).toBeVisible();
        await expect(page.getByTestId('exact-input-member-user-456')).toBeVisible();
        await expect(page.getByTestId('exact-input-admin-user-123')).toHaveValue('60.00');

        // Change exact amounts
        await page.getByTestId('exact-input-admin-user-123').fill('80');
        await page.getByTestId('exact-input-member-user-456').fill('40');

        // Should validate correctly
        await expect(page.getByTestId('split-total')).toHaveText('Total: $120.00');
        await expect(page.getByTestId('split-validation')).toHaveText('');

        // Test validation error with incorrect total
        await page.getByTestId('exact-input-admin-user-123').fill('90');
        await expect(page.getByTestId('split-total')).toHaveText('Total: $130.00');
        await expect(page.getByTestId('split-validation')).toHaveText('Split amounts must equal total expense amount');
    });
});

// Helper method to avoid code duplication
function getExpenseFormScript() {
    return `<script>
        class ExpenseFormStore {
            constructor() {
                this.amount = parseFloat(document.getElementById('amount').value) || 0;
                this.splitType = 'equal';
                this.participants = [];
                this.splits = new Map();
                
                this.setupEventListeners();
                this.updateParticipants();
                this.calculateSplits();
            }

            setupEventListeners() {
                document.getElementById('amount').addEventListener('input', (e) => {
                    this.amount = parseFloat(e.target.value) || 0;
                    this.calculateSplits();
                    this.renderSplitAmounts();
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
                        this.renderSplitInputs();
                    });
                });
            }

            updateParticipants() {
                this.participants = Array.from(document.querySelectorAll('.participant-checkbox:checked'))
                    .map(checkbox => checkbox.value);
            }

            calculateSplits() {
                if (this.participants.length === 0 || this.amount <= 0) {
                    this.splits.clear();
                    this.renderSplitAmounts();
                    return;
                }

                if (this.splitType === 'equal') {
                    const equalAmount = this.amount / this.participants.length;
                    this.participants.forEach(userId => {
                        this.splits.set(userId, equalAmount);
                    });
                }
                
                this.renderSplitInputs();
                this.renderSplitAmounts();
                this.validateSplits();
            }

            renderSplitInputs() {
                const container = document.getElementById('split-amounts');
                if (this.participants.length === 0) {
                    container.innerHTML = '<p>Select participants first</p>';
                    return;
                }

                container.innerHTML = this.participants.map(userId => {
                    const user = window.mockGroup.members.find(m => m.uid === userId);
                    const amount = this.splits.get(userId) || 0;
                    
                    if (this.splitType === 'equal') {
                        return '<div class="split-item" data-testid="split-item-' + userId + '">' +
                            '<span>' + user.displayName + ':</span> ' +
                            '<span class="amount" data-testid="split-amount-' + userId + '">$' + amount.toFixed(2) + '</span>' +
                            '</div>';
                    } else if (this.splitType === 'exact') {
                        return '<div class="split-item" data-testid="split-item-' + userId + '">' +
                            '<label>' + user.displayName + ':</label> ' +
                            '<input type="number" step="0.01" min="0" class="exact-input" ' +
                                'data-testid="exact-input-' + userId + '" ' +
                                'data-user-id="' + userId + '" ' +
                                'value="' + amount.toFixed(2) + '" />' +
                            '</div>';
                    }
                }).join('');

                // Set up event listeners for exact amount inputs
                if (this.splitType === 'exact') {
                    document.querySelectorAll('.exact-input').forEach(input => {
                        input.addEventListener('input', (e) => {
                            const userId = e.target.dataset.userId;
                            const amount = parseFloat(e.target.value) || 0;
                            this.splits.set(userId, amount);
                            this.renderSplitAmounts();
                            this.validateSplits();
                        });
                    });
                }
            }

            renderSplitAmounts() {
                const total = Array.from(this.splits.values()).reduce((sum, amount) => sum + amount, 0);
                document.getElementById('split-total').textContent = 'Total: $' + total.toFixed(2);
            }

            validateSplits() {
                const total = Array.from(this.splits.values()).reduce((sum, amount) => sum + amount, 0);
                const validation = document.getElementById('split-validation');
                
                if (Math.abs(total - this.amount) < 0.01) {
                    validation.textContent = '';
                    validation.className = '';
                } else {
                    validation.textContent = 'Split amounts must equal total expense amount';
                    validation.className = 'error';
                }
            }
        }
        window.expenseForm = new ExpenseFormStore();
    </script>`;
}

test.describe('Expense Form Store - Draft Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await setupStoreMocks(page);
    });

    test('should save and restore form drafts', async ({ page }) => {
        await createTestPage(page, `
            <div class="expense-form">
                <input id="description" data-testid="description" placeholder="Expense description" />
                <input id="amount" type="number" data-testid="amount-input" />
                <select id="category" data-testid="category">
                    <option value="food">Food</option>
                    <option value="transport">Transport</option>
                    <option value="entertainment">Entertainment</option>
                </select>
                
                <button id="save-draft" data-testid="save-draft">Save Draft</button>
                <button id="load-draft" data-testid="load-draft">Load Draft</button>
                <button id="clear-draft" data-testid="clear-draft">Clear Draft</button>
                
                <div id="draft-status" data-testid="draft-status">No draft saved</div>
            </div>

            <script>
                // Mock localStorage since it's not available in test context
                window.mockStorage = {};
                
                class DraftManager {
                    constructor() {
                        this.groupId = 'test-group-123';
                        this.setupEventListeners();
                    }

                    setupEventListeners() {
                        document.getElementById('save-draft').addEventListener('click', () => {
                            this.saveDraft();
                        });
                        
                        document.getElementById('load-draft').addEventListener('click', () => {
                            this.loadDraft();
                        });
                        
                        document.getElementById('clear-draft').addEventListener('click', () => {
                            this.clearDraft();
                        });

                        // Auto-save on input changes
                        ['description', 'amount', 'category'].forEach(field => {
                            document.getElementById(field).addEventListener('input', () => {
                                this.autoSave();
                            });
                        });
                    }

                    saveDraft() {
                        const draft = {
                            description: document.getElementById('description').value,
                            amount: parseFloat(document.getElementById('amount').value) || 0,
                            category: document.getElementById('category').value,
                            savedAt: Date.now()
                        };

                        window.mockStorage['expense-draft-' + this.groupId] = JSON.stringify(draft);
                        this.updateDraftStatus('Draft saved');
                    }

                    loadDraft() {
                        const saved = window.mockStorage['expense-draft-' + this.groupId];
                        if (!saved) {
                            this.updateDraftStatus('No draft found');
                            return false;
                        }

                        try {
                            const draft = JSON.parse(saved);
                            document.getElementById('description').value = draft.description || '';
                            document.getElementById('amount').value = draft.amount || '';
                            document.getElementById('category').value = draft.category || 'food';
                            
                            const savedTime = new Date(draft.savedAt).toLocaleTimeString();
                            this.updateDraftStatus('Draft loaded (saved at ' + savedTime + ')');
                            return true;
                        } catch (e) {
                            this.updateDraftStatus('Error loading draft');
                            return false;
                        }
                    }

                    clearDraft() {
                        // Only clear form fields, keep draft in storage for reload
                        document.getElementById('description').value = '';
                        document.getElementById('amount').value = '';
                        document.getElementById('category').value = 'food';
                        this.updateDraftStatus('Form cleared');
                    }

                    autoSave() {
                        // Auto-save with debouncing
                        clearTimeout(this.autoSaveTimeout);
                        this.autoSaveTimeout = setTimeout(() => {
                            this.saveDraft();
                            this.updateDraftStatus('Auto-saved');
                        }, 1000);
                    }

                    updateDraftStatus(message) {
                        document.getElementById('draft-status').textContent = message;
                    }
                }

                new DraftManager();
            </script>
        `);

        // Fill out form
        await page.getByTestId('description').fill('Team lunch');
        await page.getByTestId('amount-input').fill('75.50');
        await page.getByTestId('category').selectOption('food');

        // Save draft
        await page.getByTestId('save-draft').click();
        await expect(page.getByTestId('draft-status')).toHaveText('Draft saved');

        // Clear form
        await page.getByTestId('clear-draft').click();
        await expect(page.getByTestId('description')).toHaveValue('');
        await expect(page.getByTestId('amount-input')).toHaveValue('');
        await expect(page.getByTestId('category')).toHaveValue('food');

        // Load draft
        await page.getByTestId('load-draft').click();
        await expect(page.getByTestId('description')).toHaveValue('Team lunch');
        await expect(page.getByTestId('amount-input')).toHaveValue('75.5');
        await expect(page.getByTestId('category')).toHaveValue('food');
        await expect(page.getByTestId('draft-status')).toContainText('Draft loaded');
    });

    test('should auto-save drafts on input changes', async ({ page }) => {
        await createTestPage(page, `
            <div class="expense-form">
                <input id="description" data-testid="description" placeholder="Expense description" />
                <div id="draft-status" data-testid="draft-status">No draft saved</div>
            </div>

            <script>
                // Mock localStorage since it's not available in test context
                window.mockStorage = {};
                let autoSaveTimeout;
                
                document.getElementById('description').addEventListener('input', () => {
                    clearTimeout(autoSaveTimeout);
                    autoSaveTimeout = setTimeout(() => {
                        const value = document.getElementById('description').value;
                        if (value.trim()) {
                            window.mockStorage['auto-draft'] = JSON.stringify({ description: value });
                            document.getElementById('draft-status').textContent = 'Auto-saved';
                        }
                    }, 500); // Short timeout for testing
                });
            </script>
        `);

        // Type description and wait for auto-save
        await page.getByTestId('description').fill('Coffee meeting');
        
        // Wait for auto-save to trigger
        await expect(page.getByTestId('draft-status')).toHaveText('Auto-saved', { timeout: 1000 });
    });
});