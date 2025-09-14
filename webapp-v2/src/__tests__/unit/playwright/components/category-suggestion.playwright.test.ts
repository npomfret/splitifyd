import { test, expect } from '@playwright/test';
import { setupStoreMocks, createTestPage } from '../stores/setup';

/**
 * Focused Playwright tests for category suggestion input functionality
 * 
 * Tests autocomplete behavior, keyboard navigation, filtering logic,
 * and focus management that require real browser interactions.
 */

test.describe('Category Suggestion Input - Autocomplete Interactions', () => {
    const mockCategories = [
        { name: 'food', displayName: 'Food & Dining', icon: '🍽️' },
        { name: 'transport', displayName: 'Transportation', icon: '🚗' },
        { name: 'entertainment', displayName: 'Entertainment', icon: '🎬' },
        { name: 'groceries', displayName: 'Groceries', icon: '🛒' },
        { name: 'utilities', displayName: 'Utilities', icon: '💡' },
        { name: 'healthcare', displayName: 'Healthcare', icon: '🏥' },
        { name: 'shopping', displayName: 'Shopping', icon: '🛍️' },
        { name: 'travel', displayName: 'Travel', icon: '✈️' },
    ];
    
    test.beforeEach(async ({ page }) => {
        await setupStoreMocks(page);
    });

    test('should filter suggestions based on user input', async ({ page }) => {
        await createTestPage(page, `
            <div class="category-input-container">
                <label for="category-input" data-testid="category-label">Category</label>
                <div class="input-wrapper">
                    <input 
                        id="category-input"
                        type="text" 
                        placeholder="Enter category..." 
                        data-testid="category-input"
                        autocomplete="off"
                    />
                    <div id="dropdown" class="dropdown" data-testid="dropdown" style="display: none;">
                        <div id="suggestions-list" class="suggestions-list" data-testid="suggestions-list"></div>
                    </div>
                </div>
                <div id="selected-value" data-testid="selected-value">Selected: none</div>
            </div>

            <style>
                .input-wrapper {
                    position: relative;
                    width: 300px;
                }
                .dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: white;
                    border: 1px solid #ccc;
                    border-top: none;
                    border-radius: 0 0 4px 4px;
                    max-height: 200px;
                    overflow-y: auto;
                    z-index: 1000;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .suggestion-item {
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid #eee;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .suggestion-item:hover, .suggestion-item.highlighted {
                    background: #f0f0f0;
                }
                .suggestion-item:last-child {
                    border-bottom: none;
                }
                .input-wrapper input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 14px;
                }
                .input-wrapper input:focus {
                    border-color: #007bff;
                    outline: none;
                }
            </style>

            <script>
                const categories = ${JSON.stringify(mockCategories)};
                
                class CategorySuggestionInput {
                    constructor() {
                        this.input = document.getElementById('category-input');
                        this.dropdown = document.getElementById('dropdown');
                        this.suggestionsList = document.getElementById('suggestions-list');
                        this.selectedValue = document.getElementById('selected-value');
                        
                        this.isOpen = false;
                        this.filteredSuggestions = categories;
                        this.highlightedIndex = -1;
                        this.currentValue = '';
                        
                        this.setupEventListeners();
                    }
                    
                    setupEventListeners() {
                        this.input.addEventListener('input', (e) => {
                            this.currentValue = e.target.value;
                            this.filterSuggestions(this.currentValue);
                            this.showDropdown();
                        });
                        
                        this.input.addEventListener('focus', () => {
                            if (this.filteredSuggestions.length > 0) {
                                this.showDropdown();
                            }
                        });
                        
                        this.input.addEventListener('keydown', (e) => {
                            this.handleKeydown(e);
                        });
                        
                        // Click outside to close
                        document.addEventListener('click', (e) => {
                            if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
                                this.hideDropdown();
                            }
                        });
                    }
                    
                    filterSuggestions(value) {
                        if (!value.trim()) {
                            this.filteredSuggestions = categories;
                        } else {
                            this.filteredSuggestions = categories.filter(cat => 
                                cat.displayName.toLowerCase().includes(value.toLowerCase()) ||
                                cat.name.toLowerCase().includes(value.toLowerCase())
                            );
                        }
                        this.highlightedIndex = -1;
                        this.renderSuggestions();
                    }
                    
                    renderSuggestions() {
                        if (this.filteredSuggestions.length === 0) {
                            this.suggestionsList.innerHTML = '<div class="suggestion-item" data-testid="no-results">No categories found</div>';
                            return;
                        }
                        
                        this.suggestionsList.innerHTML = this.filteredSuggestions.map((cat, index) => \`
                            <div class="suggestion-item \${index === this.highlightedIndex ? 'highlighted' : ''}" 
                                 data-testid="suggestion-\${cat.name}" 
                                 data-index="\${index}"
                                 data-value="\${cat.name}">
                                <span class="icon">\${cat.icon}</span>
                                <span class="name">\${cat.displayName}</span>
                                <span class="code">(\${cat.name})</span>
                            </div>
                        \`).join('');
                        
                        // Add click listeners to suggestions
                        this.suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
                            if (item.hasAttribute('data-value')) {
                                item.addEventListener('click', () => {
                                    const value = item.getAttribute('data-value');
                                    const category = this.filteredSuggestions.find(cat => cat.name === value);
                                    this.selectCategory(category);
                                });
                            }
                        });
                    }
                    
                    handleKeydown(e) {
                        if (!this.isOpen) {
                            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                e.preventDefault();
                                this.showDropdown();
                                return;
                            }
                            return;
                        }
                        
                        switch (e.key) {
                            case 'ArrowDown':
                                e.preventDefault();
                                this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.filteredSuggestions.length - 1);
                                this.renderSuggestions();
                                break;
                                
                            case 'ArrowUp':
                                e.preventDefault();
                                this.highlightedIndex = Math.max(this.highlightedIndex - 1, -1);
                                this.renderSuggestions();
                                break;
                                
                            case 'Enter':
                                e.preventDefault();
                                if (this.highlightedIndex >= 0) {
                                    const category = this.filteredSuggestions[this.highlightedIndex];
                                    this.selectCategory(category);
                                }
                                break;
                                
                            case 'Escape':
                                e.preventDefault();
                                this.hideDropdown();
                                break;
                                
                            case 'Tab':
                                // Allow natural tab behavior but close dropdown
                                this.hideDropdown();
                                break;
                        }
                    }
                    
                    selectCategory(category) {
                        this.input.value = category.displayName;
                        this.currentValue = category.displayName;
                        this.selectedValue.textContent = \`Selected: \${category.name}\`;
                        this.hideDropdown();
                        
                        // Dispatch custom event
                        this.input.dispatchEvent(new CustomEvent('categorySelected', {
                            detail: { category }
                        }));
                    }
                    
                    showDropdown() {
                        this.isOpen = true;
                        this.dropdown.style.display = 'block';
                        this.dropdown.setAttribute('data-open', 'true');
                        this.renderSuggestions();
                    }
                    
                    hideDropdown() {
                        this.isOpen = false;
                        this.dropdown.style.display = 'none';
                        this.dropdown.setAttribute('data-open', 'false');
                        this.highlightedIndex = -1;
                    }
                }
                
                window.categoryInput = new CategorySuggestionInput();
            </script>
        `);

        // Initially dropdown should be closed
        await expect(page.getByTestId('dropdown')).toBeHidden();

        // Focus should show all suggestions
        await page.getByTestId('category-input').focus();
        await expect(page.getByTestId('dropdown')).toBeVisible();
        await expect(page.getByTestId('suggestion-food')).toBeVisible();
        await expect(page.getByTestId('suggestion-transport')).toBeVisible();

        // Typing should filter suggestions
        await page.getByTestId('category-input').fill('foo');
        await expect(page.getByTestId('suggestion-food')).toBeVisible();
        await expect(page.getByTestId('suggestion-transport')).toBeHidden();
        await expect(page.getByTestId('suggestion-groceries')).toBeHidden();

        // More specific filter
        await page.getByTestId('category-input').fill('transport');
        await expect(page.getByTestId('suggestion-transport')).toBeVisible();
        await expect(page.getByTestId('suggestion-food')).toBeHidden();

        // No results
        await page.getByTestId('category-input').fill('xyz123');
        await expect(page.getByTestId('no-results')).toBeVisible();
        await expect(page.getByTestId('no-results')).toHaveText('No categories found');
    });

    test('should handle keyboard navigation correctly', async ({ page }) => {
        await createTestPage(page, `
            <div class="category-input-container">
                <input id="category-input" type="text" data-testid="category-input" />
                <div id="dropdown" class="dropdown" data-testid="dropdown" style="display: none;">
                    <div id="suggestions-list" class="suggestions-list"></div>
                </div>
                <div id="selected-value" data-testid="selected-value">Selected: none</div>
            </div>

            <style>
                .dropdown {
                    position: absolute;
                    background: white;
                    border: 1px solid #ccc;
                    max-height: 200px;
                    overflow-y: auto;
                }
                .suggestion-item {
                    padding: 8px 12px;
                    cursor: pointer;
                    display: flex;
                    gap: 8px;
                }
                .suggestion-item.highlighted {
                    background: #e3f2fd;
                    font-weight: bold;
                }
            </style>

            <script>
                const categories = ${JSON.stringify(mockCategories.slice(0, 4))}; // Use fewer for cleaner testing
                
                class CategorySuggestionInput {
                    constructor() {
                        this.input = document.getElementById('category-input');
                        this.dropdown = document.getElementById('dropdown');
                        this.suggestionsList = document.getElementById('suggestions-list');
                        this.selectedValue = document.getElementById('selected-value');
                        
                        this.isOpen = false;
                        this.filteredSuggestions = categories;
                        this.highlightedIndex = -1;
                        
                        this.setupEventListeners();
                    }
                    
                    setupEventListeners() {
                        this.input.addEventListener('input', (e) => {
                            this.filterSuggestions(e.target.value);
                            this.showDropdown();
                        });
                        
                        this.input.addEventListener('focus', () => {
                            this.showDropdown();
                        });
                        
                        this.input.addEventListener('keydown', (e) => {
                            this.handleKeydown(e);
                        });
                    }
                    
                    filterSuggestions(value) {
                        if (!value.trim()) {
                            this.filteredSuggestions = categories;
                        } else {
                            this.filteredSuggestions = categories.filter(cat => 
                                cat.displayName.toLowerCase().includes(value.toLowerCase()) ||
                                cat.name.toLowerCase().includes(value.toLowerCase())
                            );
                        }
                        this.highlightedIndex = -1;
                        this.renderSuggestions();
                    }
                    
                    renderSuggestions() {
                        this.suggestionsList.innerHTML = this.filteredSuggestions.map((cat, index) => \`
                            <div class="suggestion-item \${index === this.highlightedIndex ? 'highlighted' : ''}" 
                                 data-testid="suggestion-\${cat.name}" 
                                 data-index="\${index}">
                                <span>\${cat.icon}</span>
                                <span>\${cat.displayName}</span>
                            </div>
                        \`).join('');
                        
                        // Update highlight indicator
                        const highlightInfo = document.getElementById('highlight-info');
                        if (highlightInfo) {
                            highlightInfo.textContent = \`Highlighted: \${this.highlightedIndex >= 0 ? this.filteredSuggestions[this.highlightedIndex].name : 'none'}\`;
                        }
                    }
                    
                    handleKeydown(e) {
                        if (!this.isOpen) {
                            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                e.preventDefault();
                                this.showDropdown();
                                return;
                            }
                            return;
                        }
                        
                        switch (e.key) {
                            case 'ArrowDown':
                                e.preventDefault();
                                this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.filteredSuggestions.length - 1);
                                this.renderSuggestions();
                                break;
                                
                            case 'ArrowUp':
                                e.preventDefault();
                                this.highlightedIndex = Math.max(this.highlightedIndex - 1, -1);
                                this.renderSuggestions();
                                break;
                                
                            case 'Enter':
                                e.preventDefault();
                                if (this.highlightedIndex >= 0) {
                                    const category = this.filteredSuggestions[this.highlightedIndex];
                                    this.selectCategory(category);
                                }
                                break;
                                
                            case 'Escape':
                                e.preventDefault();
                                this.hideDropdown();
                                break;
                        }
                    }
                    
                    selectCategory(category) {
                        this.input.value = category.displayName;
                        this.selectedValue.textContent = \`Selected: \${category.name}\`;
                        this.hideDropdown();
                    }
                    
                    showDropdown() {
                        this.isOpen = true;
                        this.dropdown.style.display = 'block';
                        this.renderSuggestions();
                    }
                    
                    hideDropdown() {
                        this.isOpen = false;
                        this.dropdown.style.display = 'none';
                        this.highlightedIndex = -1;
                    }
                }
                
                window.categoryInput = new CategorySuggestionInput();
            </script>
            
            <!-- Debug info -->
            <div id="highlight-info" data-testid="highlight-info">Highlighted: none</div>
        `);

        // Focus and open dropdown
        await page.getByTestId('category-input').focus();
        await expect(page.getByTestId('dropdown')).toBeVisible();

        // Initially no item highlighted
        await expect(page.getByTestId('highlight-info')).toHaveText('Highlighted: none');

        // Arrow down should highlight first item
        await page.keyboard.press('ArrowDown');
        await expect(page.getByTestId('highlight-info')).toHaveText('Highlighted: food');
        await expect(page.getByTestId('suggestion-food')).toHaveClass(/highlighted/);

        // Arrow down should move to next item
        await page.keyboard.press('ArrowDown');
        await expect(page.getByTestId('highlight-info')).toHaveText('Highlighted: transport');
        await expect(page.getByTestId('suggestion-transport')).toHaveClass(/highlighted/);
        await expect(page.getByTestId('suggestion-food')).not.toHaveClass(/highlighted/);

        // Arrow up should go back
        await page.keyboard.press('ArrowUp');
        await expect(page.getByTestId('highlight-info')).toHaveText('Highlighted: food');

        // Arrow up from first item should go to none
        await page.keyboard.press('ArrowUp');
        await expect(page.getByTestId('highlight-info')).toHaveText('Highlighted: none');

        // Arrow down to last item, then down again should stay at last
        await page.keyboard.press('ArrowDown'); // food
        await page.keyboard.press('ArrowDown'); // transport  
        await page.keyboard.press('ArrowDown'); // entertainment
        await page.keyboard.press('ArrowDown'); // groceries
        await page.keyboard.press('ArrowDown'); // should stay at groceries
        await expect(page.getByTestId('highlight-info')).toHaveText('Highlighted: groceries');

        // Enter should select highlighted item
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('selected-value')).toHaveText('Selected: groceries');
        await expect(page.getByTestId('category-input')).toHaveValue('Groceries');
        await expect(page.getByTestId('dropdown')).toBeHidden();
    });

    test('should handle click selection correctly', async ({ page }) => {
        await createTestPage(page, `
            <div class="category-input-container">
                <input id="category-input" type="text" data-testid="category-input" />
                <div id="dropdown" class="dropdown" data-testid="dropdown" style="display: none;">
                    <div id="suggestions-list" class="suggestions-list"></div>
                </div>
                <div id="selected-value" data-testid="selected-value">Selected: none</div>
            </div>

            <style>
                .dropdown { 
                    position: absolute; 
                    background: white; 
                    border: 1px solid #ccc; 
                    display: none; 
                }
                .suggestion-item { 
                    padding: 8px 12px; 
                    cursor: pointer; 
                    display: flex; 
                    gap: 8px; 
                }
                .suggestion-item:hover { background: #f0f0f0; }
            </style>

            <script>
                const categories = ${JSON.stringify(mockCategories.slice(0, 3))};
                
                class CategorySuggestionInput {
                    constructor() {
                        this.input = document.getElementById('category-input');
                        this.dropdown = document.getElementById('dropdown');
                        this.suggestionsList = document.getElementById('suggestions-list');
                        this.selectedValue = document.getElementById('selected-value');
                        
                        this.isOpen = false;
                        this.filteredSuggestions = categories;
                        
                        this.setupEventListeners();
                    }
                    
                    setupEventListeners() {
                        this.input.addEventListener('focus', () => {
                            this.showDropdown();
                        });
                        
                        // Click outside to close
                        document.addEventListener('click', (e) => {
                            if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
                                this.hideDropdown();
                            }
                        });
                    }
                    
                    renderSuggestions() {
                        this.suggestionsList.innerHTML = this.filteredSuggestions.map(cat => \`
                            <div class="suggestion-item" 
                                 data-testid="suggestion-\${cat.name}" 
                                 data-value="\${cat.name}">
                                <span>\${cat.icon}</span>
                                <span>\${cat.displayName}</span>
                            </div>
                        \`).join('');
                        
                        // Add click listeners
                        this.suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
                            item.addEventListener('click', () => {
                                const value = item.getAttribute('data-value');
                                const category = this.filteredSuggestions.find(cat => cat.name === value);
                                this.selectCategory(category);
                            });
                        });
                    }
                    
                    selectCategory(category) {
                        this.input.value = category.displayName;
                        this.selectedValue.textContent = \`Selected: \${category.name}\`;
                        this.hideDropdown();
                        
                        // Dispatch selection event
                        this.input.dispatchEvent(new CustomEvent('categorySelected', {
                            detail: { category }
                        }));
                    }
                    
                    showDropdown() {
                        this.isOpen = true;
                        this.dropdown.style.display = 'block';
                        this.renderSuggestions();
                    }
                    
                    hideDropdown() {
                        this.isOpen = false;
                        this.dropdown.style.display = 'none';
                    }
                }
                
                window.categoryInput = new CategorySuggestionInput();
            </script>
        `);

        // Focus to open dropdown
        await page.getByTestId('category-input').focus();
        await expect(page.getByTestId('dropdown')).toBeVisible();

        // Click on a suggestion
        await page.getByTestId('suggestion-transport').click();
        
        // Should select the item and close dropdown
        await expect(page.getByTestId('selected-value')).toHaveText('Selected: transport');
        await expect(page.getByTestId('category-input')).toHaveValue('Transportation');
        await expect(page.getByTestId('dropdown')).toBeHidden();

        // Open again and click different item
        await page.getByTestId('category-input').focus();
        await page.getByTestId('suggestion-food').click();
        
        await expect(page.getByTestId('selected-value')).toHaveText('Selected: food');
        await expect(page.getByTestId('category-input')).toHaveValue('Food & Dining');
    });

    test('should close on Escape key and click outside', async ({ page }) => {
        await createTestPage(page, `
            <div class="category-input-container">
                <input id="category-input" type="text" data-testid="category-input" />
                <div id="dropdown" class="dropdown" data-testid="dropdown" style="display: none;">
                    <div id="suggestions-list" class="suggestions-list"></div>
                </div>
                <button id="outside-button" data-testid="outside-button">Outside Button</button>
            </div>

            <style>
                .dropdown { 
                    position: absolute; 
                    background: white; 
                    border: 1px solid #ccc; 
                }
                .suggestion-item { padding: 8px 12px; }
            </style>

            <script>
                const categories = ${JSON.stringify(mockCategories.slice(0, 2))};
                
                class CategorySuggestionInput {
                    constructor() {
                        this.input = document.getElementById('category-input');
                        this.dropdown = document.getElementById('dropdown');
                        this.suggestionsList = document.getElementById('suggestions-list');
                        
                        this.isOpen = false;
                        this.dropdown.setAttribute('data-open', 'false');
                        
                        this.setupEventListeners();
                    }
                    
                    setupEventListeners() {
                        this.input.addEventListener('focus', () => {
                            this.showDropdown();
                        });
                        
                        this.input.addEventListener('keydown', (e) => {
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                this.hideDropdown();
                            }
                        });
                        
                        // Click outside to close
                        document.addEventListener('click', (e) => {
                            if (e.target !== this.input && !this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
                                this.hideDropdown();
                            }
                        });
                    }
                    
                    showDropdown() {
                        this.isOpen = true;
                        this.dropdown.style.display = 'block';
                        this.dropdown.setAttribute('data-open', 'true');
                        
                        this.suggestionsList.innerHTML = categories.map(cat => \`
                            <div class="suggestion-item" data-testid="suggestion-\${cat.name}">
                                \${cat.displayName}
                            </div>
                        \`).join('');
                    }
                    
                    hideDropdown() {
                        this.isOpen = false;
                        this.dropdown.style.display = 'none';
                        this.dropdown.setAttribute('data-open', 'false');
                    }
                }
                
                window.categoryInput = new CategorySuggestionInput();
            </script>
        `);

        // Focus to open dropdown
        await page.getByTestId('category-input').focus();
        await expect(page.getByTestId('dropdown')).toBeVisible();
        await expect(page.getByTestId('dropdown')).toHaveAttribute('data-open', 'true');

        // Escape should close dropdown
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('dropdown')).toBeHidden();
        await expect(page.getByTestId('dropdown')).toHaveAttribute('data-open', 'false');

        // Open again - blur first to ensure focus event fires
        await page.getByTestId('category-input').blur();
        await page.getByTestId('category-input').focus();
        await expect(page.getByTestId('dropdown')).toBeVisible();

        // Click outside should close dropdown
        await page.getByTestId('outside-button').click();
        await expect(page.getByTestId('dropdown')).toBeHidden();

        // Input should still have focus after closing
        await expect(page.getByTestId('outside-button')).toBeFocused();
    });

    test('should handle complex filtering scenarios', async ({ page }) => {
        await createTestPage(page, `
            <div class="category-input-container">
                <input id="category-input" type="text" data-testid="category-input" />
                <div id="dropdown" class="dropdown" data-testid="dropdown" style="display: none;">
                    <div id="suggestions-list" class="suggestions-list"></div>
                </div>
                <div id="filter-info" data-testid="filter-info">Showing: 0 results</div>
            </div>

            <style>
                .dropdown { position: absolute; background: white; border: 1px solid #ccc; }
                .suggestion-item { padding: 8px 12px; }
            </style>

            <script>
                const categories = ${JSON.stringify(mockCategories)};
                
                class CategorySuggestionInput {
                    constructor() {
                        this.input = document.getElementById('category-input');
                        this.dropdown = document.getElementById('dropdown');
                        this.suggestionsList = document.getElementById('suggestions-list');
                        this.filterInfo = document.getElementById('filter-info');
                        
                        this.isOpen = false;
                        this.filteredSuggestions = categories;
                        
                        this.setupEventListeners();
                        this.updateFilterInfo();
                    }
                    
                    setupEventListeners() {
                        this.input.addEventListener('input', (e) => {
                            this.filterSuggestions(e.target.value);
                            this.showDropdown();
                        });
                        
                        this.input.addEventListener('focus', () => {
                            this.showDropdown();
                        });
                    }
                    
                    filterSuggestions(value) {
                        const searchTerm = value.toLowerCase().trim();
                        
                        if (!searchTerm) {
                            this.filteredSuggestions = categories;
                        } else {
                            this.filteredSuggestions = categories.filter(cat => {
                                return cat.displayName.toLowerCase().includes(searchTerm) ||
                                       cat.name.toLowerCase().includes(searchTerm) ||
                                       cat.displayName.toLowerCase().startsWith(searchTerm) ||
                                       cat.name.toLowerCase().startsWith(searchTerm);
                            });
                        }
                        
                        this.renderSuggestions();
                        this.updateFilterInfo();
                    }
                    
                    renderSuggestions() {
                        if (this.filteredSuggestions.length === 0) {
                            this.suggestionsList.innerHTML = '<div class="suggestion-item" data-testid="no-results">No matching categories</div>';
                            return;
                        }
                        
                        this.suggestionsList.innerHTML = this.filteredSuggestions.map(cat => \`
                            <div class="suggestion-item" data-testid="suggestion-\${cat.name}">
                                <span>\${cat.icon}</span>
                                <span>\${cat.displayName}</span>
                                <small>(\${cat.name})</small>
                            </div>
                        \`).join('');
                    }
                    
                    updateFilterInfo() {
                        this.filterInfo.textContent = \`Showing: \${this.filteredSuggestions.length} results\`;
                    }
                    
                    showDropdown() {
                        this.isOpen = true;
                        this.dropdown.style.display = 'block';
                        this.renderSuggestions();
                    }
                    
                    hideDropdown() {
                        this.isOpen = false;
                        this.dropdown.style.display = 'none';
                    }
                }
                
                window.categoryInput = new CategorySuggestionInput();
            </script>
        `);

        // Focus to show all results
        await page.getByTestId('category-input').focus();
        await expect(page.getByTestId('filter-info')).toHaveText('Showing: 8 results');

        // Partial match should work
        await page.getByTestId('category-input').fill('tr');
        await expect(page.getByTestId('suggestion-transport')).toBeVisible();
        await expect(page.getByTestId('suggestion-travel')).toBeVisible();
        await expect(page.getByTestId('filter-info')).toHaveText('Showing: 2 results');

        // More specific search
        await page.getByTestId('category-input').fill('food');
        await expect(page.getByTestId('suggestion-food')).toBeVisible();
        await expect(page.getByTestId('suggestion-transport')).toBeHidden();
        await expect(page.getByTestId('filter-info')).toHaveText('Showing: 1 results');

        // Case insensitive
        await page.getByTestId('category-input').fill('TRANSPORT');
        await expect(page.getByTestId('suggestion-transport')).toBeVisible();
        await expect(page.getByTestId('filter-info')).toHaveText('Showing: 1 results');

        // No results
        await page.getByTestId('category-input').fill('nonexistent');
        await expect(page.getByTestId('no-results')).toBeVisible();
        await expect(page.getByTestId('filter-info')).toHaveText('Showing: 0 results');

        // Clear search should show all
        await page.getByTestId('category-input').fill('');
        await expect(page.getByTestId('filter-info')).toHaveText('Showing: 8 results');
    });
});