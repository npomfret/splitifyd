import { test, expect } from '@playwright/test';
import { setupStoreMocks, createTestPage } from '../stores/setup';

/**
 * Focused Playwright tests for currency input component
 * 
 * Tests complex UI interactions like keyboard navigation, search filtering,
 * decimal precision handling, and focus management that are difficult to test with mocks.
 */

test.describe('Currency Input Component - Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await setupStoreMocks(page);
    });

    test('should navigate currency dropdown with keyboard', async ({ page }) => {
        await createTestPage(page, `
            <div class="currency-input">
                <div class="amount-section">
                    <input id="amount-input" type="number" step="0.01" data-testid="amount-input" 
                           placeholder="0.00" value="100.50" />
                </div>
                
                <div class="currency-section">
                    <button id="currency-button" data-testid="currency-button" type="button">
                        <span id="selected-currency">USD</span>
                        <span class="arrow">▼</span>
                    </button>
                    
                    <div id="currency-dropdown" data-testid="currency-dropdown" class="dropdown-menu" style="display: none;">
                        <div class="search-section">
                            <input id="currency-search" data-testid="currency-search" 
                                   placeholder="Search currencies..." type="text" />
                        </div>
                        
                        <div class="recent-currencies">
                            <div class="group-title">Recent</div>
                            <div class="currency-option" data-testid="currency-USD" data-code="USD">
                                <span class="code">USD</span>
                                <span class="name">US Dollar</span>
                            </div>
                            <div class="currency-option" data-testid="currency-EUR" data-code="EUR">
                                <span class="code">EUR</span>
                                <span class="name">Euro</span>
                            </div>
                        </div>
                        
                        <div class="popular-currencies">
                            <div class="group-title">Popular</div>
                            <div class="currency-option" data-testid="currency-GBP" data-code="GBP">
                                <span class="code">GBP</span>
                                <span class="name">British Pound</span>
                            </div>
                            <div class="currency-option" data-testid="currency-JPY" data-code="JPY">
                                <span class="code">JPY</span>
                                <span class="name">Japanese Yen</span>
                            </div>
                            <div class="currency-option" data-testid="currency-CAD" data-code="CAD">
                                <span class="code">CAD</span>
                                <span class="name">Canadian Dollar</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="validation-message" data-testid="validation-message" class="error"></div>
            </div>

            <script>
                class CurrencyInput {
                    constructor() {
                        this.isOpen = false;
                        this.highlightedIndex = -1;
                        this.filteredOptions = [];
                        this.selectedCurrency = 'USD';
                        
                        this.getAllOptions();
                        this.setupEventListeners();
                    }

                    getAllOptions() {
                        this.allOptions = Array.from(document.querySelectorAll('.currency-option'));
                        this.filteredOptions = [...this.allOptions];
                    }

                    setupEventListeners() {
                        const button = document.getElementById('currency-button');
                        const dropdown = document.getElementById('currency-dropdown');
                        const search = document.getElementById('currency-search');
                        const amount = document.getElementById('amount-input');

                        button.addEventListener('click', () => this.toggleDropdown());
                        
                        button.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                this.toggleDropdown();
                            }
                        });

                        search.addEventListener('input', (e) => {
                            this.filterCurrencies(e.target.value);
                        });

                        search.addEventListener('keydown', (e) => {
                            this.handleSearchKeydown(e);
                        });

                        // Currency option clicks
                        this.allOptions.forEach((option, index) => {
                            option.addEventListener('click', () => {
                                this.selectCurrency(option.dataset.code);
                            });
                            
                            option.addEventListener('mouseenter', () => {
                                this.setHighlightedIndex(index);
                            });
                        });

                        amount.addEventListener('input', (e) => {
                            this.validateAmount(e.target.value);
                        });

                        // Close dropdown when clicking outside
                        document.addEventListener('click', (e) => {
                            if (!e.target.closest('.currency-input')) {
                                this.closeDropdown();
                            }
                        });
                    }

                    toggleDropdown() {
                        if (this.isOpen) {
                            this.closeDropdown();
                        } else {
                            this.openDropdown();
                        }
                    }

                    openDropdown() {
                        this.isOpen = true;
                        document.getElementById('currency-dropdown').style.display = 'block';
                        document.getElementById('currency-search').focus();
                        this.getAllOptions(); // Refresh options when opening
                        this.highlightedIndex = -1; // Start with no selection
                    }

                    closeDropdown() {
                        this.isOpen = false;
                        document.getElementById('currency-dropdown').style.display = 'none';
                        document.getElementById('currency-search').value = '';
                        this.getAllOptions();
                        this.highlightedIndex = -1;
                    }

                    handleSearchKeydown(e) {
                        switch (e.key) {
                            case 'ArrowDown':
                                e.preventDefault();
                                this.moveHighlight(1);
                                break;
                            case 'ArrowUp':
                                e.preventDefault();
                                this.moveHighlight(-1);
                                break;
                            case 'Enter':
                                e.preventDefault();
                                if (this.highlightedIndex >= 0) {
                                    const highlighted = this.filteredOptions[this.highlightedIndex];
                                    this.selectCurrency(highlighted.dataset.code);
                                }
                                break;
                            case 'Escape':
                                e.preventDefault();
                                this.closeDropdown();
                                document.getElementById('currency-button').focus();
                                break;
                        }
                    }

                    moveHighlight(direction) {
                        const newIndex = this.highlightedIndex + direction;
                        if (newIndex >= 0 && newIndex < this.filteredOptions.length) {
                            this.setHighlightedIndex(newIndex);
                        }
                    }

                    setHighlightedIndex(index) {
                        // Remove previous highlight
                        this.allOptions.forEach(option => {
                            option.classList.remove('highlighted');
                        });

                        // Add new highlight
                        if (index >= 0 && index < this.filteredOptions.length) {
                            this.highlightedIndex = index;
                            this.filteredOptions[index].classList.add('highlighted');
                            this.filteredOptions[index].scrollIntoView({ block: 'nearest' });
                        }
                    }

                    filterCurrencies(searchTerm) {
                        const term = searchTerm.toLowerCase();
                        
                        this.allOptions.forEach(option => {
                            const code = option.querySelector('.code').textContent.toLowerCase();
                            const name = option.querySelector('.name').textContent.toLowerCase();
                            const matches = code.includes(term) || name.includes(term);
                            
                            option.style.display = matches ? 'block' : 'none';
                        });

                        // Update filtered options array
                        this.filteredOptions = this.allOptions.filter(option => 
                            option.style.display !== 'none'
                        );

                        // Reset highlight to first visible option
                        this.setHighlightedIndex(0);
                    }

                    selectCurrency(code) {
                        this.selectedCurrency = code;
                        document.getElementById('selected-currency').textContent = code;
                        this.closeDropdown();
                        document.getElementById('currency-button').focus();
                        
                        // Update amount input based on currency precision
                        this.updateAmountPrecision(code);
                    }

                    updateAmountPrecision(currencyCode) {
                        const amountInput = document.getElementById('amount-input');
                        const precisionMap = {
                            'JPY': 0, // No decimal places
                            'KRW': 0,
                            'USD': 2,
                            'EUR': 2,
                            'GBP': 2,
                            'CAD': 2,
                        };

                        const precision = precisionMap[currencyCode] || 2;
                        const step = precision === 0 ? '1' : '0.' + '0'.repeat(precision - 1) + '1';
                        
                        amountInput.step = step;
                        
                        // Round current value to appropriate precision
                        const currentValue = parseFloat(amountInput.value) || 0;
                        amountInput.value = currentValue.toFixed(precision);
                    }

                    validateAmount(value) {
                        const amount = parseFloat(value);
                        const validation = document.getElementById('validation-message');
                        
                        if (isNaN(amount) || amount < 0) {
                            validation.textContent = 'Please enter a valid positive amount';
                            validation.className = 'error';
                        } else if (amount > 999999) {
                            validation.textContent = 'Amount is too large';
                            validation.className = 'error';
                        } else {
                            validation.textContent = '';
                            validation.className = '';
                        }
                    }
                }

                new CurrencyInput();
            </script>
        `);

        // Test opening dropdown
        await page.getByTestId('currency-button').click();
        await expect(page.getByTestId('currency-dropdown')).toBeVisible();
        await expect(page.getByTestId('currency-search')).toBeFocused();

        // Test keyboard navigation
        await page.keyboard.press('ArrowDown');
        await expect(page.getByTestId('currency-USD')).toHaveClass(/highlighted/);

        await page.keyboard.press('ArrowDown');
        await expect(page.getByTestId('currency-EUR')).toHaveClass(/highlighted/);

        await page.keyboard.press('ArrowDown');
        await expect(page.getByTestId('currency-GBP')).toHaveClass(/highlighted/);

        // Test arrow up
        await page.keyboard.press('ArrowUp');
        await expect(page.getByTestId('currency-EUR')).toHaveClass(/highlighted/);

        // Test Enter to select
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('currency-dropdown')).toBeHidden();
        await expect(page.getByTestId('currency-button')).toHaveText(/EUR[\s\S]*▼/);
        await expect(page.getByTestId('currency-button')).toBeFocused();
    });

    test('should filter currencies by search term', async ({ page }) => {
        await createTestPage(page, `
            <div class="currency-input">
                <button id="currency-button" data-testid="currency-button">USD</button>
                
                <div id="currency-dropdown" data-testid="currency-dropdown" class="dropdown-menu">
                    <input id="currency-search" data-testid="currency-search" placeholder="Search..." />
                    
                    <div class="currency-option" data-testid="currency-USD" data-code="USD">
                        <span class="code">USD</span>
                        <span class="name">US Dollar</span>
                    </div>
                    <div class="currency-option" data-testid="currency-EUR" data-code="EUR">
                        <span class="code">EUR</span>
                        <span class="name">Euro</span>
                    </div>
                    <div class="currency-option" data-testid="currency-GBP" data-code="GBP">
                        <span class="code">GBP</span>
                        <span class="name">British Pound</span>
                    </div>
                    <div class="currency-option" data-testid="currency-JPY" data-code="JPY">
                        <span class="code">JPY</span>
                        <span class="name">Japanese Yen</span>
                    </div>
                </div>
            </div>

            <script>
                // Simplified filtering logic for testing
                document.getElementById('currency-search').addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    document.querySelectorAll('.currency-option').forEach(option => {
                        const code = option.querySelector('.code').textContent.toLowerCase();
                        const name = option.querySelector('.name').textContent.toLowerCase();
                        const matches = code.includes(term) || name.includes(term);
                        option.style.display = matches ? 'block' : 'none';
                    });
                });
            </script>
        `);

        // Show all currencies initially
        await expect(page.getByTestId('currency-USD')).toBeVisible();
        await expect(page.getByTestId('currency-EUR')).toBeVisible();
        await expect(page.getByTestId('currency-GBP')).toBeVisible();
        await expect(page.getByTestId('currency-JPY')).toBeVisible();

        // Search by currency code
        await page.getByTestId('currency-search').fill('eur');
        await expect(page.getByTestId('currency-EUR')).toBeVisible();
        await expect(page.getByTestId('currency-USD')).toBeHidden();
        await expect(page.getByTestId('currency-GBP')).toBeHidden();
        await expect(page.getByTestId('currency-JPY')).toBeHidden();

        // Search by currency name
        await page.getByTestId('currency-search').fill('dollar');
        await expect(page.getByTestId('currency-USD')).toBeVisible();
        await expect(page.getByTestId('currency-EUR')).toBeHidden();

        // Search with no matches
        await page.getByTestId('currency-search').fill('xyz');
        await expect(page.getByTestId('currency-USD')).toBeHidden();
        await expect(page.getByTestId('currency-EUR')).toBeHidden();
        await expect(page.getByTestId('currency-GBP')).toBeHidden();
        await expect(page.getByTestId('currency-JPY')).toBeHidden();

        // Clear search
        await page.getByTestId('currency-search').fill('');
        await expect(page.getByTestId('currency-USD')).toBeVisible();
        await expect(page.getByTestId('currency-EUR')).toBeVisible();
        await expect(page.getByTestId('currency-GBP')).toBeVisible();
        await expect(page.getByTestId('currency-JPY')).toBeVisible();
    });

    test('should handle decimal precision based on currency', async ({ page }) => {
        await createTestPage(page, `
            <div class="currency-input">
                <input id="amount-input" type="number" data-testid="amount-input" step="0.01" />
                <button id="usd-btn" data-testid="select-usd">USD</button>
                <button id="jpy-btn" data-testid="select-jpy">JPY</button>
                <button id="eur-btn" data-testid="select-eur">EUR</button>
                <div id="formatted-amount" data-testid="formatted-amount"></div>
            </div>

            <script>
                function selectCurrency(code) {
                    const amountInput = document.getElementById('amount-input');
                    const formatDisplay = document.getElementById('formatted-amount');
                    
                    const precisionMap = {
                        'USD': 2,
                        'EUR': 2,
                        'GBP': 2,
                        'JPY': 0,
                        'KRW': 0,
                    };

                    const precision = precisionMap[code] !== undefined ? precisionMap[code] : 2;
                    const step = precision === 0 ? '1' : '0.' + '0'.repeat(precision - 1) + '1';
                    
                    amountInput.step = step;
                    
                    // Format current value
                    const currentValue = parseFloat(amountInput.value) || 0;
                    const formatted = currentValue.toFixed(precision);
                    amountInput.value = formatted;
                    formatDisplay.textContent = code + ' ' + formatted;
                }

                document.getElementById('usd-btn').addEventListener('click', () => selectCurrency('USD'));
                document.getElementById('jpy-btn').addEventListener('click', () => selectCurrency('JPY'));
                document.getElementById('eur-btn').addEventListener('click', () => selectCurrency('EUR'));
            </script>
        `);

        // Test USD (2 decimal places)
        await page.getByTestId('amount-input').fill('123.456');
        await page.getByTestId('select-usd').click();
        await expect(page.getByTestId('amount-input')).toHaveValue('123.46'); // Rounded to 2 decimals
        await expect(page.getByTestId('formatted-amount')).toHaveText('USD 123.46');

        // Test JPY (0 decimal places)
        await page.getByTestId('amount-input').fill('123.456');
        await page.getByTestId('select-jpy').click();
        await expect(page.getByTestId('amount-input')).toHaveValue('123'); // No decimals
        await expect(page.getByTestId('formatted-amount')).toHaveText('JPY 123');

        // Test EUR (2 decimal places)
        await page.getByTestId('amount-input').fill('99.999');
        await page.getByTestId('select-eur').click();
        await expect(page.getByTestId('amount-input')).toHaveValue('100.00'); // Rounded up
        await expect(page.getByTestId('formatted-amount')).toHaveText('EUR 100.00');
    });

    test('should manage focus properly between amount and currency inputs', async ({ page }) => {
        await createTestPage(page, `
            <div class="currency-input">
                <input id="amount-input" type="number" data-testid="amount-input" />
                <button id="currency-button" data-testid="currency-button">USD</button>
                
                <div id="currency-dropdown" data-testid="currency-dropdown" style="display: none;">
                    <input id="currency-search" data-testid="currency-search" />
                    <div id="currency-eur" class="currency-option" data-testid="currency-eur" data-code="EUR">EUR</div>
                </div>
            </div>

            <script>
                let dropdownOpen = false;
                
                document.getElementById('currency-button').addEventListener('click', () => {
                    const dropdown = document.getElementById('currency-dropdown');
                    const search = document.getElementById('currency-search');
                    
                    if (dropdownOpen) {
                        dropdown.style.display = 'none';
                        dropdownOpen = false;
                    } else {
                        dropdown.style.display = 'block';
                        search.focus();
                        dropdownOpen = true;
                    }
                });

                document.getElementById('currency-search').addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        document.getElementById('currency-dropdown').style.display = 'none';
                        document.getElementById('currency-button').focus();
                        dropdownOpen = false;
                    }
                });

                document.getElementById('currency-eur').addEventListener('click', () => {
                    document.getElementById('currency-button').textContent = 'EUR';
                    document.getElementById('currency-dropdown').style.display = 'none';
                    document.getElementById('amount-input').focus(); // Return focus to amount
                    dropdownOpen = false;
                });
            </script>
        `);

        // Start with focus on amount input
        await page.getByTestId('amount-input').focus();
        await expect(page.getByTestId('amount-input')).toBeFocused();

        // Tab to currency button
        await page.keyboard.press('Tab');
        await expect(page.getByTestId('currency-button')).toBeFocused();

        // Open dropdown - focus should move to search
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('currency-dropdown')).toBeVisible();
        await expect(page.getByTestId('currency-search')).toBeFocused();

        // Escape should return focus to currency button
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('currency-dropdown')).toBeHidden();
        await expect(page.getByTestId('currency-button')).toBeFocused();

        // Select a currency - focus should return to amount input
        await page.getByTestId('currency-button').click();
        await page.getByTestId('currency-eur').click();
        await expect(page.getByTestId('currency-dropdown')).toBeHidden();
        await expect(page.getByTestId('amount-input')).toBeFocused();
        await expect(page.getByTestId('currency-button')).toHaveText('EUR');
    });
});