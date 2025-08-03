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
    // Wait for modal to be fully visible first
    await this.page.getByText(this.modalTitle).waitFor({ state: 'visible' });
    
    // Wait for modal to be fully loaded
    await this.page.waitForLoadState('domcontentloaded');
    
    // Try multiple selectors for better reliability
    let nameInput;
    try {
      // First try the label selector
      nameInput = this.page.getByLabel('Group Name*');
      await nameInput.waitFor({ state: 'visible', timeout: 1000 });
    } catch {
      // Fallback to placeholder
      nameInput = this.page.getByPlaceholder('e.g., Apartment Expenses, Trip to Paris');
      await nameInput.waitFor({ state: 'visible', timeout: 1000 });
    }
    
    // Wait for input to be enabled
    await expect(nameInput).toBeEnabled({ timeout: 5000 });
    
    // Click to focus
    await nameInput.click();
    
    // Clear any existing value
    await nameInput.clear();
    
    // Fill the new value with force option
    await nameInput.fill(name, { force: true });
    
    // Small delay to ensure fill completes
    await this.page.waitForTimeout(300);
    
    // Trigger validation by pressing Tab (crucial for form validation)
    await this.page.keyboard.press('Tab');
    
    // Verify the name was actually filled
    const filledValue = await nameInput.inputValue();
    if (filledValue !== name) {
      // Log more debug info
      const isVisible = await nameInput.isVisible();
      const isEnabled = await nameInput.isEnabled();
      throw new Error(`Failed to fill group name. Expected: "${name}", Got: "${filledValue}". Input visible: ${isVisible}, enabled: ${isEnabled}`);
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
    // Ensure modal is open before proceeding
    const isModalOpen = await this.isOpen();
    if (!isModalOpen) {
      throw new Error('Create Group modal is not open');
    }
    
    await this.fillGroupForm(name, description);
    await this.submitForm();
  }
  
  async waitForModalToClose() {
    await this.page.getByText(this.modalTitle).waitFor({ state: 'hidden' });
  }
}