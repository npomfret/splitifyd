import { expect } from '@playwright/test';
import { BasePage } from './base.page';

export class CreateGroupModalPage extends BasePage {
  // Selectors
  readonly modal = '.fixed.inset-0'; // Modal backdrop
  readonly modalTitle = 'Create New Group';

  async isOpen(): Promise<boolean> {
    // Modal either exists or it doesn't - no ambiguity
    return await this.page.getByText(this.modalTitle).isVisible();
  }
  
  async fillGroupForm(name: string, description?: string) {
    // Wait for modal to be fully visible
    await this.page.getByText(this.modalTitle).waitFor({ state: 'visible' });
    
    // Get the input using the correct selector - label text without asterisk
    const nameInput = this.page.getByLabel('Group Name');
    
    // Wait for input to be visible and enabled
    await nameInput.waitFor({ state: 'visible' });
    await expect(nameInput).toBeEnabled();
    
    // Use the new fillPreactInput utility
    await this.fillPreactInput(nameInput, name);
    
    if (description) {
      const descInput = this.page.getByPlaceholder('Add any details about this group...');
      await this.fillPreactInput(descInput, description);
    }
  }
  
  async submitForm() {
    // Get the submit button and wait for it to be enabled
    const submitButton = this.page.locator('form').getByRole('button', { name: 'Create Group' });
    
    // Wait up to 5 seconds for the button to become enabled
    await expect(submitButton).toBeEnabled({ timeout: 500 });
    
    await submitButton.click();
  }
  
  async cancel() {
    // Modal MUST have a cancel/close button - this is basic UX
    // Use a regex that matches either "Cancel" or "Close"
    const cancelButton = this.page.getByRole('button', { name: /(Cancel|Close)/i });
    await cancelButton.click();
  }
  
  async createGroup(name: string, description?: string) {
    // Ensure modal is open before proceeding
    const isModalOpen = await this.isOpen();
    if (!isModalOpen) {
      throw new Error('Create Group modal is not open');
    }
    
    // Wait for any modal animation to complete
    await this.page.waitForFunction(() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return false;
      const style = window.getComputedStyle(modal);
      return style.opacity === '1' && style.visibility === 'visible';
    });
    
    await this.fillGroupForm(name, description);
    await this.submitForm();
  }
  
  async waitForModalToClose() {
    await this.page.getByText(this.modalTitle).waitFor({ state: 'hidden' });
  }
}