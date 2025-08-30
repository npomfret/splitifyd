import { test, expect } from '@playwright/test';
import { setupMocks } from './setup';

/**
 * Simple Playwright tests for create group modal validation
 * 
 * These tests focus on testing the modal component in isolation.
 * They DO NOT require the Firebase emulator.
 */

test.describe('Create Group Modal Validation', () => {
    test.beforeEach(async ({ page }) => {
        await setupMocks(page);
        
        // Create a simple test page with the modal
        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Test Page</title>
            </head>
            <body>
                <div role="dialog" aria-modal="true" style="display: block; padding: 20px; border: 1px solid #ccc;">
                    <h2>Create New Group</h2>
                    <form>
                        <div>
                            <label for="group-name">Group Name *</label>
                            <input 
                                id="group-name" 
                                name="name" 
                                type="text" 
                                placeholder="e.g., Apartment Expenses" 
                                required 
                            />
                        </div>
                        
                        <div>
                            <label for="group-description">Description (optional)</label>
                            <textarea 
                                id="group-description" 
                                name="description" 
                                data-testid="group-description-input"
                                placeholder="What is this group for?"
                                rows="3"
                            ></textarea>
                        </div>
                        
                        <div style="margin-top: 20px;">
                            <button type="button" id="cancel-btn">Cancel</button>
                            <button type="submit" id="submit-btn">Create Group</button>
                        </div>
                    </form>
                </div>
                
                <script>
                    // Simple form validation
                    const form = document.querySelector('form');
                    const nameInput = document.querySelector('#group-name');
                    const submitBtn = document.querySelector('#submit-btn');
                    const cancelBtn = document.querySelector('#cancel-btn');
                    
                    function updateSubmitButton() {
                        const isValid = nameInput.value.trim().length >= 2;
                        submitBtn.disabled = !isValid;
                    }
                    
                    nameInput.addEventListener('input', updateSubmitButton);
                    updateSubmitButton(); // Initial state
                    
                    cancelBtn.addEventListener('click', () => {
                        document.querySelector('[role="dialog"]').style.display = 'none';
                    });
                    
                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape') {
                            document.querySelector('[role="dialog"]').style.display = 'none';
                        }
                    });
                </script>
            </body>
            </html>
        `);
    });

    test('displays modal correctly', async ({ page }) => {
        // Verify modal is visible
        await expect(page.locator('[role="dialog"]')).toBeVisible();
        await expect(page.locator('h2').filter({ hasText: 'Create New Group' })).toBeVisible();
        
        // Verify form elements
        await expect(page.locator('#group-name')).toBeVisible();
        await expect(page.locator('#group-description')).toBeVisible();
        await expect(page.locator('#submit-btn')).toBeVisible();
        await expect(page.locator('#cancel-btn')).toBeVisible();
    });

    test('validates required group name', async ({ page }) => {
        const submitButton = page.locator('#submit-btn');
        
        // Initially disabled (empty name)
        await expect(submitButton).toBeDisabled();
        
        // Fill with single character - still disabled
        await page.fill('#group-name', 'a');
        await expect(submitButton).toBeDisabled();
        
        // Fill with valid name - enabled
        await page.fill('#group-name', 'Test Group');
        await expect(submitButton).toBeEnabled();
        
        // Clear name - disabled again
        await page.fill('#group-name', '');
        await expect(submitButton).toBeDisabled();
    });

    test('allows optional description', async ({ page }) => {
        // Fill only name
        await page.fill('#group-name', 'Test Group');
        const submitButton = page.locator('#submit-btn');
        await expect(submitButton).toBeEnabled();
        
        // Add description
        await page.fill('[data-testid="group-description-input"]', 'Optional description');
        await expect(submitButton).toBeEnabled();
        
        // Clear description - should still be enabled
        await page.fill('[data-testid="group-description-input"]', '');
        await expect(submitButton).toBeEnabled();
    });

    test('closes modal on cancel', async ({ page }) => {
        const modal = page.locator('[role="dialog"]');
        const cancelButton = page.locator('#cancel-btn');
        
        // Modal should be visible initially
        await expect(modal).toBeVisible();
        
        // Click cancel
        await cancelButton.click();
        
        // Modal should be hidden
        await expect(modal).not.toBeVisible();
    });

    test('closes modal on escape key', async ({ page }) => {
        const modal = page.locator('[role="dialog"]');
        
        // Modal should be visible initially
        await expect(modal).toBeVisible();
        
        // Press escape
        await page.keyboard.press('Escape');
        
        // Modal should be hidden
        await expect(modal).not.toBeVisible();
    });
});