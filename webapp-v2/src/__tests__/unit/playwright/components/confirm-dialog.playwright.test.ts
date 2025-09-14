import { test, expect } from '@playwright/test';
import { setupStoreMocks, createTestPage } from '../stores/setup';

/**
 * Focused Playwright tests for confirm dialog functionality
 * 
 * Tests modal behavior, focus management, keyboard interactions, loading states,
 * and accessibility features that require real browser behavior.
 */

test.describe('Confirm Dialog - Modal Interactions', () => {
    test.beforeEach(async ({ page }) => {
        await setupStoreMocks(page);
    });

    test('should handle basic confirm and cancel actions', async ({ page }) => {
        await createTestPage(page, `
            <div id="app">
                <button id="show-dialog" data-testid="show-dialog">Show Dialog</button>
                <div id="result" data-testid="result">No action</div>
                
                <div id="confirm-dialog" class="modal-overlay" data-testid="dialog-overlay" style="display: none;">
                    <div class="modal-dialog" data-testid="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
                        <div class="modal-header">
                            <h2 id="dialog-title" data-testid="dialog-title">Confirm Action</h2>
                        </div>
                        <div class="modal-body">
                            <p id="dialog-message" data-testid="dialog-message">Are you sure you want to proceed?</p>
                        </div>
                        <div class="modal-footer">
                            <button id="cancel-btn" class="btn btn-secondary" data-testid="cancel-btn">Cancel</button>
                            <button id="confirm-btn" class="btn btn-danger" data-testid="confirm-btn">Delete</button>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                
                .modal-dialog {
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
                    max-width: 400px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                
                .modal-header {
                    padding: 20px 20px 0;
                }
                
                .modal-body {
                    padding: 16px 20px;
                }
                
                .modal-footer {
                    padding: 0 20px 20px;
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }
                
                .btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                
                .btn-secondary {
                    background: #6c757d;
                    color: white;
                }
                
                .btn-danger {
                    background: #dc3545;
                    color: white;
                }
                
                .btn:focus {
                    outline: 2px solid #007bff;
                    outline-offset: 2px;
                }
                
                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                
                #show-dialog {
                    padding: 8px 16px;
                    margin: 20px;
                }
            </style>

            <script>
                class ConfirmDialog {
                    constructor() {
                        this.overlay = document.getElementById('confirm-dialog');
                        this.dialog = document.querySelector('.modal-dialog');
                        this.title = document.getElementById('dialog-title');
                        this.message = document.getElementById('dialog-message');
                        this.cancelBtn = document.getElementById('cancel-btn');
                        this.confirmBtn = document.getElementById('confirm-btn');
                        this.result = document.getElementById('result');
                        
                        this.isOpen = false;
                        this.loading = false;
                        this.previousActiveElement = null;
                        
                        this.setupEventListeners();
                    }
                    
                    setupEventListeners() {
                        document.getElementById('show-dialog').addEventListener('click', () => {
                            this.show('Delete Item', 'Are you sure you want to delete this item? This action cannot be undone.');
                        });
                        
                        this.cancelBtn.addEventListener('click', () => {
                            this.cancel();
                        });
                        
                        this.confirmBtn.addEventListener('click', () => {
                            this.confirm();
                        });
                        
                        // Backdrop click
                        this.overlay.addEventListener('click', (e) => {
                            if (e.target === this.overlay && !this.loading) {
                                this.cancel();
                            }
                        });
                        
                        // Escape key
                        document.addEventListener('keydown', (e) => {
                            if (this.isOpen && e.key === 'Escape' && !this.loading) {
                                this.cancel();
                            }
                        });
                        
                        // Focus trap
                        this.overlay.addEventListener('keydown', (e) => {
                            if (e.key === 'Tab') {
                                this.trapFocus(e);
                            }
                        });
                    }
                    
                    show(title, message, variant = 'danger') {
                        this.title.textContent = title;
                        this.message.textContent = message;
                        
                        // Update button styles based on variant
                        this.confirmBtn.className = \`btn btn-\${variant}\`;
                        
                        this.isOpen = true;
                        this.loading = false;
                        this.previousActiveElement = document.activeElement;
                        
                        this.overlay.style.display = 'flex';
                        this.overlay.setAttribute('aria-hidden', 'false');
                        
                        // Focus the cancel button by default (safer default)
                        setTimeout(() => {
                            this.cancelBtn.focus();
                        }, 10);
                    }
                    
                    hide() {
                        this.isOpen = false;
                        this.loading = false;
                        
                        this.overlay.style.display = 'none';
                        this.overlay.setAttribute('aria-hidden', 'true');
                        
                        // Restore focus
                        if (this.previousActiveElement) {
                            this.previousActiveElement.focus();
                        }
                    }
                    
                    cancel() {
                        this.result.textContent = 'Cancelled';
                        this.hide();
                    }
                    
                    async confirm() {
                        this.result.textContent = 'Loading...';
                        this.setLoading(true);
                        
                        // Simulate async operation
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        this.result.textContent = 'Confirmed';
                        this.setLoading(false);
                        this.hide();
                    }
                    
                    setLoading(loading) {
                        this.loading = loading;
                        this.confirmBtn.disabled = loading;
                        this.cancelBtn.disabled = loading;
                        
                        if (loading) {
                            this.confirmBtn.textContent = 'Deleting...';
                            this.overlay.style.cursor = 'wait';
                        } else {
                            this.confirmBtn.textContent = 'Delete';
                            this.overlay.style.cursor = 'default';
                        }
                        
                        // Update loading state for testing
                        this.overlay.setAttribute('data-loading', loading.toString());
                    }
                    
                    trapFocus(e) {
                        const focusableElements = this.dialog.querySelectorAll(
                            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                        );
                        
                        const firstElement = focusableElements[0];
                        const lastElement = focusableElements[focusableElements.length - 1];
                        
                        if (e.shiftKey) {
                            if (document.activeElement === firstElement) {
                                e.preventDefault();
                                lastElement.focus();
                            }
                        } else {
                            if (document.activeElement === lastElement) {
                                e.preventDefault();
                                firstElement.focus();
                            }
                        }
                    }
                }
                
                window.confirmDialog = new ConfirmDialog();
            </script>
        `);

        // Initially dialog should be hidden
        await expect(page.getByTestId('dialog-overlay')).toBeHidden();
        await expect(page.getByTestId('result')).toHaveText('No action');

        // Show dialog
        await page.getByTestId('show-dialog').click();
        await expect(page.getByTestId('dialog-overlay')).toBeVisible();
        await expect(page.getByTestId('dialog-title')).toHaveText('Delete Item');
        await expect(page.getByTestId('dialog-message')).toHaveText('Are you sure you want to delete this item? This action cannot be undone.');

        // Cancel button should be focused by default
        await expect(page.getByTestId('cancel-btn')).toBeFocused();

        // Click cancel
        await page.getByTestId('cancel-btn').click();
        await expect(page.getByTestId('dialog-overlay')).toBeHidden();
        await expect(page.getByTestId('result')).toHaveText('Cancelled');
        
        // Focus should return to trigger button
        await expect(page.getByTestId('show-dialog')).toBeFocused();
    });

    test('should handle loading states correctly', async ({ page }) => {
        await createTestPage(page, `
            <div id="app">
                <button id="show-dialog" data-testid="show-dialog">Show Dialog</button>
                <div id="result" data-testid="result">No action</div>
                
                <div id="confirm-dialog" class="modal-overlay" data-testid="dialog-overlay" style="display: none;">
                    <div class="modal-dialog" data-testid="dialog">
                        <div class="modal-header">
                            <h2 id="dialog-title" data-testid="dialog-title">Confirm Action</h2>
                        </div>
                        <div class="modal-body">
                            <p id="dialog-message" data-testid="dialog-message">Are you sure?</p>
                        </div>
                        <div class="modal-footer">
                            <button id="cancel-btn" class="btn btn-secondary" data-testid="cancel-btn">Cancel</button>
                            <button id="confirm-btn" class="btn btn-danger" data-testid="confirm-btn">Delete</button>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .modal-dialog {
                    background: white;
                    border-radius: 8px;
                    padding: 20px;
                    max-width: 400px;
                }
                .modal-footer {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 20px;
                }
                .btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .btn-secondary { background: #6c757d; color: white; }
                .btn-danger { background: #dc3545; color: white; }
                .btn:disabled { opacity: 0.6; cursor: not-allowed; }
            </style>

            <script>
                class ConfirmDialog {
                    constructor() {
                        this.overlay = document.getElementById('confirm-dialog');
                        this.cancelBtn = document.getElementById('cancel-btn');
                        this.confirmBtn = document.getElementById('confirm-btn');
                        this.result = document.getElementById('result');
                        
                        this.isOpen = false;
                        this.loading = false;
                        
                        this.setupEventListeners();
                    }
                    
                    setupEventListeners() {
                        document.getElementById('show-dialog').addEventListener('click', () => {
                            this.show();
                        });
                        
                        this.cancelBtn.addEventListener('click', () => {
                            if (!this.loading) {
                                this.cancel();
                            }
                        });
                        
                        this.confirmBtn.addEventListener('click', () => {
                            if (!this.loading) {
                                this.confirm();
                            }
                        });
                        
                        // Backdrop click should be disabled during loading
                        this.overlay.addEventListener('click', (e) => {
                            if (e.target === this.overlay && !this.loading) {
                                this.cancel();
                            }
                        });
                        
                        // Escape key should be disabled during loading
                        document.addEventListener('keydown', (e) => {
                            if (this.isOpen && e.key === 'Escape' && !this.loading) {
                                this.cancel();
                            }
                        });
                    }
                    
                    show() {
                        this.isOpen = true;
                        this.loading = false;
                        this.overlay.style.display = 'flex';
                        this.updateLoadingState();
                    }
                    
                    hide() {
                        this.isOpen = false;
                        this.loading = false;
                        this.overlay.style.display = 'none';
                        this.updateLoadingState();
                    }
                    
                    cancel() {
                        this.result.textContent = 'Cancelled';
                        this.hide();
                    }
                    
                    async confirm() {
                        this.setLoading(true);
                        this.result.textContent = 'Processing...';
                        
                        // Simulate async operation
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        this.result.textContent = 'Confirmed';
                        this.setLoading(false);
                        this.hide();
                    }
                    
                    setLoading(loading) {
                        this.loading = loading;
                        this.updateLoadingState();
                    }
                    
                    updateLoadingState() {
                        this.confirmBtn.disabled = this.loading;
                        this.cancelBtn.disabled = this.loading;
                        
                        if (this.loading) {
                            this.confirmBtn.textContent = 'Processing...';
                            this.overlay.style.cursor = 'wait';
                        } else {
                            this.confirmBtn.textContent = 'Delete';
                            this.overlay.style.cursor = 'default';
                        }
                        
                        this.overlay.setAttribute('data-loading', this.loading.toString());
                    }
                }
                
                window.confirmDialog = new ConfirmDialog();
            </script>
        `);

        // Show dialog
        await page.getByTestId('show-dialog').click();
        await expect(page.getByTestId('dialog-overlay')).toBeVisible();
        await expect(page.getByTestId('dialog-overlay')).toHaveAttribute('data-loading', 'false');

        // Buttons should be enabled initially
        await expect(page.getByTestId('confirm-btn')).toBeEnabled();
        await expect(page.getByTestId('cancel-btn')).toBeEnabled();
        await expect(page.getByTestId('confirm-btn')).toHaveText('Delete');

        // Click confirm to trigger loading
        await page.getByTestId('confirm-btn').click();
        await expect(page.getByTestId('result')).toHaveText('Processing...');
        
        // Should be in loading state
        await expect(page.getByTestId('dialog-overlay')).toHaveAttribute('data-loading', 'true');
        await expect(page.getByTestId('confirm-btn')).toBeDisabled();
        await expect(page.getByTestId('cancel-btn')).toBeDisabled();
        await expect(page.getByTestId('confirm-btn')).toHaveText('Processing...');

        // During loading, escape should not close dialog
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('dialog-overlay')).toBeVisible();

        // During loading, backdrop click should not close dialog
        await page.getByTestId('dialog-overlay').click();
        await expect(page.getByTestId('dialog-overlay')).toBeVisible();

        // Wait for completion
        await expect(page.getByTestId('result')).toHaveText('Confirmed', { timeout: 2000 });
        await expect(page.getByTestId('dialog-overlay')).toBeHidden();
    });

    test('should handle keyboard navigation and focus trap', async ({ page }) => {
        await createTestPage(page, `
            <div id="app">
                <button id="show-dialog" data-testid="show-dialog">Show Dialog</button>
                <button id="other-button" data-testid="other-button">Other Button</button>
                
                <div id="confirm-dialog" class="modal-overlay" data-testid="dialog-overlay" style="display: none;">
                    <div class="modal-dialog" data-testid="dialog">
                        <div class="modal-header">
                            <h2 id="dialog-title">Confirm Action</h2>
                        </div>
                        <div class="modal-body">
                            <p>Are you sure?</p>
                            <input type="text" id="dialog-input" data-testid="dialog-input" placeholder="Type 'DELETE' to confirm" />
                        </div>
                        <div class="modal-footer">
                            <button id="cancel-btn" data-testid="cancel-btn">Cancel</button>
                            <button id="confirm-btn" data-testid="confirm-btn">Delete</button>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .modal-dialog {
                    background: white;
                    border-radius: 8px;
                    padding: 20px;
                    max-width: 400px;
                }
                .modal-footer {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 20px;
                }
                button, input {
                    padding: 8px 16px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    margin: 4px;
                }
                input { width: 100%; box-sizing: border-box; }
                button:focus, input:focus { outline: 2px solid #007bff; }
            </style>

            <script>
                class ConfirmDialog {
                    constructor() {
                        this.overlay = document.getElementById('confirm-dialog');
                        this.dialog = document.querySelector('.modal-dialog');
                        this.dialogInput = document.getElementById('dialog-input');
                        this.cancelBtn = document.getElementById('cancel-btn');
                        this.confirmBtn = document.getElementById('confirm-btn');
                        
                        this.isOpen = false;
                        this.previousActiveElement = null;
                        
                        this.setupEventListeners();
                    }
                    
                    setupEventListeners() {
                        document.getElementById('show-dialog').addEventListener('click', () => {
                            this.show();
                        });
                        
                        this.cancelBtn.addEventListener('click', () => {
                            this.cancel();
                        });
                        
                        this.confirmBtn.addEventListener('click', () => {
                            this.confirm();
                        });
                        
                        document.addEventListener('keydown', (e) => {
                            if (this.isOpen && e.key === 'Escape') {
                                this.cancel();
                            }
                        });
                        
                        // Focus trap
                        this.overlay.addEventListener('keydown', (e) => {
                            if (e.key === 'Tab') {
                                this.trapFocus(e);
                            }
                        });
                    }
                    
                    show() {
                        this.isOpen = true;
                        this.previousActiveElement = document.activeElement;
                        
                        this.overlay.style.display = 'flex';
                        
                        // Focus the input field initially
                        setTimeout(() => {
                            this.dialogInput.focus();
                        }, 10);
                    }
                    
                    hide() {
                        this.isOpen = false;
                        this.overlay.style.display = 'none';
                        
                        // Restore focus
                        if (this.previousActiveElement) {
                            this.previousActiveElement.focus();
                        }
                    }
                    
                    cancel() {
                        this.hide();
                    }
                    
                    confirm() {
                        this.hide();
                    }
                    
                    trapFocus(e) {
                        const focusableElements = Array.from(this.dialog.querySelectorAll(
                            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                        ));
                        
                        if (focusableElements.length === 0) return;
                        
                        const currentElement = document.activeElement;
                        const currentIndex = focusableElements.indexOf(currentElement);
                        
                        e.preventDefault();
                        
                        let nextIndex;
                        if (e.shiftKey) {
                            // Shift + Tab (backwards)
                            nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
                        } else {
                            // Tab (forwards)
                            nextIndex = currentIndex >= focusableElements.length - 1 ? 0 : currentIndex + 1;
                        }
                        focusableElements[nextIndex].focus();
                    }
                }
                
                window.confirmDialog = new ConfirmDialog();
            </script>
        `);

        // Show dialog
        await page.getByTestId('show-dialog').click();
        await expect(page.getByTestId('dialog-overlay')).toBeVisible();
        
        // Input should be focused initially
        await expect(page.getByTestId('dialog-input')).toBeFocused();

        // Tab should move to cancel button
        await page.keyboard.press('Tab');
        await expect(page.getByTestId('cancel-btn')).toBeFocused();

        // Tab should move to confirm button
        await page.keyboard.press('Tab');
        await expect(page.getByTestId('confirm-btn')).toBeFocused();

        // Tab should wrap back to input (focus trap)
        await page.keyboard.press('Tab');
        await expect(page.getByTestId('dialog-input')).toBeFocused();

        // Shift+Tab should go backwards
        await page.keyboard.press('Shift+Tab');
        await expect(page.getByTestId('confirm-btn')).toBeFocused();

        // Shift+Tab again
        await page.keyboard.press('Shift+Tab');
        await expect(page.getByTestId('cancel-btn')).toBeFocused();

        // Shift+Tab should go to input (first element)
        await page.keyboard.press('Shift+Tab');
        await expect(page.getByTestId('dialog-input')).toBeFocused();
        
        // Shift+Tab should wrap to last element
        await page.keyboard.press('Shift+Tab');
        await expect(page.getByTestId('confirm-btn')).toBeFocused();

        // Escape should close and restore focus
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('dialog-overlay')).toBeHidden();
        await expect(page.getByTestId('show-dialog')).toBeFocused();
    });

    test('should handle backdrop click and various dismiss methods', async ({ page }) => {
        await createTestPage(page, `
            <div id="app">
                <button id="show-dialog" data-testid="show-dialog">Show Dialog</button>
                <div id="dismiss-method" data-testid="dismiss-method">Not dismissed</div>
                
                <div id="confirm-dialog" class="modal-overlay" data-testid="dialog-overlay" style="display: none;">
                    <div class="modal-dialog" data-testid="dialog">
                        <div class="modal-header">
                            <h2>Confirm Action</h2>
                            <button id="close-x" class="close-btn" data-testid="close-x" aria-label="Close">×</button>
                        </div>
                        <div class="modal-body">
                            <p>Are you sure?</p>
                        </div>
                        <div class="modal-footer">
                            <button id="cancel-btn" data-testid="cancel-btn">Cancel</button>
                            <button id="confirm-btn" data-testid="confirm-btn">Delete</button>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .modal-dialog {
                    background: white;
                    border-radius: 8px;
                    padding: 20px;
                    max-width: 400px;
                    position: relative;
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .close-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 4px 8px;
                }
                .modal-footer {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 20px;
                }
                button { padding: 8px 16px; border: 1px solid #ccc; border-radius: 4px; }
            </style>

            <script>
                class ConfirmDialog {
                    constructor() {
                        this.overlay = document.getElementById('confirm-dialog');
                        this.dialog = document.querySelector('.modal-dialog');
                        this.dismissMethod = document.getElementById('dismiss-method');
                        
                        this.isOpen = false;
                        
                        this.setupEventListeners();
                    }
                    
                    setupEventListeners() {
                        document.getElementById('show-dialog').addEventListener('click', () => {
                            this.show();
                        });
                        
                        document.getElementById('close-x').addEventListener('click', () => {
                            this.dismiss('close-button');
                        });
                        
                        document.getElementById('cancel-btn').addEventListener('click', () => {
                            this.dismiss('cancel-button');
                        });
                        
                        document.getElementById('confirm-btn').addEventListener('click', () => {
                            this.dismiss('confirm-button');
                        });
                        
                        // Backdrop click
                        this.overlay.addEventListener('click', (e) => {
                            if (e.target === this.overlay) {
                                this.dismiss('backdrop-click');
                            }
                        });
                        
                        // Escape key
                        document.addEventListener('keydown', (e) => {
                            if (this.isOpen && e.key === 'Escape') {
                                this.dismiss('escape-key');
                            }
                        });
                    }
                    
                    show() {
                        this.isOpen = true;
                        this.overlay.style.display = 'flex';
                        this.dismissMethod.textContent = 'Dialog open';
                    }
                    
                    dismiss(method) {
                        this.isOpen = false;
                        this.overlay.style.display = 'none';
                        this.dismissMethod.textContent = \`Dismissed by: \${method}\`;
                    }
                }
                
                window.confirmDialog = new ConfirmDialog();
            </script>
        `);

        // Test backdrop click
        await page.getByTestId('show-dialog').click();
        await expect(page.getByTestId('dismiss-method')).toHaveText('Dialog open');
        
        // Click on backdrop (overlay but not dialog)
        await page.getByTestId('dialog-overlay').click({ position: { x: 50, y: 50 } });
        await expect(page.getByTestId('dialog-overlay')).toBeHidden();
        await expect(page.getByTestId('dismiss-method')).toHaveText('Dismissed by: backdrop-click');

        // Test escape key
        await page.getByTestId('show-dialog').click();
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('dialog-overlay')).toBeHidden();
        await expect(page.getByTestId('dismiss-method')).toHaveText('Dismissed by: escape-key');

        // Test close button
        await page.getByTestId('show-dialog').click();
        await page.getByTestId('close-x').click();
        await expect(page.getByTestId('dialog-overlay')).toBeHidden();
        await expect(page.getByTestId('dismiss-method')).toHaveText('Dismissed by: close-button');

        // Test cancel button
        await page.getByTestId('show-dialog').click();
        await page.getByTestId('cancel-btn').click();
        await expect(page.getByTestId('dialog-overlay')).toBeHidden();
        await expect(page.getByTestId('dismiss-method')).toHaveText('Dismissed by: cancel-button');

        // Test confirm button
        await page.getByTestId('show-dialog').click();
        await page.getByTestId('confirm-btn').click();
        await expect(page.getByTestId('dialog-overlay')).toBeHidden();
        await expect(page.getByTestId('dismiss-method')).toHaveText('Dismissed by: confirm-button');

        // Clicking inside dialog should NOT dismiss
        await page.getByTestId('show-dialog').click();
        await page.getByTestId('dialog').click();
        await expect(page.getByTestId('dialog-overlay')).toBeVisible();
        await expect(page.getByTestId('dismiss-method')).toHaveText('Dialog open');
    });
});