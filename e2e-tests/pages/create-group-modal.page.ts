import { expect } from '@playwright/test';
import { BasePage } from './base.page';

export class CreateGroupModalPage extends BasePage {
  // Selectors
  readonly modal = '.fixed.inset-0'; // Modal backdrop
  readonly modalContent = '.bg-white.rounded-lg'; // Modal content
  readonly modalTitle = 'Create New Group';
  readonly groupNameInput = 'input[aria-label*="Group Name"], input[aria-label*="Name"]';
  readonly descriptionInput = 'textarea[aria-label*="Description"], input[aria-label*="Description"]';
  readonly createButton = 'Create';
  readonly cancelButton = 'Cancel';
  readonly closeButton = 'Close';
  
  async isOpen(): Promise<boolean> {
    try {
      // Check if modal title is visible
      await this.page.getByText(this.modalTitle).waitFor({ state: 'visible', timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }
  
  async fillGroupForm(name: string, description?: string) {
    // Use label selector that includes the asterisk for required field
    const nameInput = this.page.getByLabel('Group Name*');
    
    // Click to focus the input first
    await nameInput.click();
    
    // Triple-click to select all text (works on all platforms)
    await nameInput.click({ clickCount: 3 });
    await nameInput.press('Delete');
    
    // Type the text character by character to ensure proper event triggering
    for (const char of name) {
      await nameInput.press(char);
    }
    
    // Tab out to trigger blur event if needed
    await this.page.keyboard.press('Tab');
    
    // Verify the name was actually filled
    const filledValue = await nameInput.inputValue();
    if (filledValue !== name) {
      throw new Error(`Failed to fill group name. Expected: "${name}", Got: "${filledValue}"`);
    }
    
    if (description) {
      const descInput = this.page.getByPlaceholder('Add any details about this group...');
      
      await descInput.click();
      
      // Triple-click to select all text
      await descInput.click({ clickCount: 3 });
      await descInput.press('Delete');
      
      for (const char of description) {
        await descInput.press(char);
      }
    }
    
    // Wait for form validation to process
    await this.page.waitForTimeout(200);
  }
  
  async submitForm() {
    // Wait for button to be enabled before clicking (use form-specific selector)
    const submitButton = this.page.locator('form').getByRole('button', { name: 'Create Group' });
    await submitButton.waitFor({ state: 'visible' });
    
    // Wait for button to be enabled (form validation may take a moment)
    await expect(submitButton).toBeEnabled({ timeout: 2000 });
    
    await submitButton.click();
  }
  
  async cancel() {
    const cancelButton = await this.page.getByRole('button', { name: /Cancel/i }).isVisible()
      ? this.page.getByRole('button', { name: /Cancel/i })
      : this.page.getByRole('button', { name: /Close/i });
    
    await cancelButton.click();
  }
  
  async createGroup(name: string, description?: string) {
    await this.fillGroupForm(name, description);
    await this.submitForm();
  }
  
  async waitForModalToClose() {
    await this.page.getByText(this.modalTitle).waitFor({ state: 'hidden' });
  }
}