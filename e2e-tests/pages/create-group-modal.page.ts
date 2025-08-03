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
    // Use the reliable clearAndFill method from BasePage
    const nameInput = this.page.getByLabel('Group Name*');
    await nameInput.click();
    await nameInput.clear();
    await nameInput.fill(name);
    
    // Verify the name was actually filled
    const filledValue = await nameInput.inputValue();
    if (filledValue !== name) {
      throw new Error(`Failed to fill group name. Expected: "${name}", Got: "${filledValue}"`);
    }
    
    if (description) {
      const descInput = this.page.getByPlaceholder('Add any details about this group...');
      await descInput.fill(description);
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