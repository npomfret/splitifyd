import { Page, Locator, expect } from '@playwright/test';
import { EMULATOR_URL } from '../helpers';

export abstract class BasePage {
  constructor(protected page: Page) {}
  
  /**
   * Waits for and validates that an element has focus.
   * Useful for ensuring proper focus state before input operations.
   */
  private async waitForFocus(input: Locator, timeout = 2000): Promise<void> {
    await expect(input).toBeFocused({ timeout });
  }

  /**
   * Helper method to get field identifier for error reporting.
   */
  private async getFieldIdentifier(input: Locator): Promise<string> {
    const fieldName = await input.getAttribute('name').catch(() => null);
    const fieldId = await input.getAttribute('id').catch(() => null);
    const placeholder = await input.getAttribute('placeholder').catch(() => null);
    
    return fieldName || fieldId || placeholder || 'unknown field';
  }

  /**
   * Validates that an input field contains the expected value.
   * Pure validation method - does not modify DOM state.
   * Allows trimmed values to match (UI may trim whitespace).
   */
  private async validateInputValue(input: Locator, expectedValue: string): Promise<void> {
    const actualValue = await input.inputValue();
    const inputType = await input.getAttribute('type');
    
    // For number inputs, compare numeric values to handle normalization (e.g., "75.50" -> "75.5")
    if (inputType === 'number') {
      const expectedNum = parseFloat(expectedValue);
      const actualNum = parseFloat(actualValue);
      
      // Check if both parse as valid numbers and are equal
      if (!isNaN(expectedNum) && !isNaN(actualNum) && expectedNum === actualNum) {
        return; // Values are numerically equal
      }
    }
    
    // For non-number inputs or if number comparison failed, do string comparison
    // Allow trimmed values to match (UI may trim whitespace from inputs)
    if (actualValue !== expectedValue && actualValue !== expectedValue.trim()) {
      const fieldIdentifier = await this.getFieldIdentifier(input);
      throw new Error(`Input validation failed for field "${fieldIdentifier}": expected "${expectedValue}" but got "${actualValue}"`);
    }
  }
  
  /**
   * Fill an input field in a way that properly triggers Preact signal updates.
   * This is necessary because Playwright's fill() method doesn't always trigger
   * the onChange events that Preact signals rely on.
   * Uses focus-based waiting with pressSequentially for reliable input.
   * Includes retry logic to handle text truncation which has been observed to happen under high load (typically during parallel test execution).
   */
  async fillPreactInput(selector: string | Locator, value: string, maxRetries = 3) {
    const input = typeof selector === 'string' ? this.page.locator(selector) : selector;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Single click and wait for focus
        await input.click();
        await this.waitForFocus(input);
        
        // Clear and validate
        await input.fill('');
        await this.validateInputValue(input, '');
        
        // Ensure still focused before typing
        await this.waitForFocus(input);
        await this.page.waitForLoadState('domcontentloaded');
        
        // Check if this is a number input or has decimal inputMode
        const inputType = await input.getAttribute('type');
        const inputMode = await input.getAttribute('inputMode');
        
        // Use fill() for number inputs or decimal inputs to handle decimals correctly
        if (inputType === 'number' || inputMode === 'decimal') {
          await input.fill(value);
        } else {
          await input.pressSequentially(value);
        }

        // Blur to trigger Preact validation
        await input.blur();
        
        // Check if input was successful
        const actualValue = await input.inputValue();
        if (actualValue === value) {
          await this.page.waitForLoadState('domcontentloaded');
          return; // Success!
        }
        
        // For number/decimal inputs, check if values are numerically equal (handles decimal normalization)
        // This is kept for backward compatibility with any remaining number inputs
        if (inputType === 'number' || inputMode === 'decimal') {
          const expectedNum = parseFloat(value);
          const actualNum = parseFloat(actualValue);
          if (!isNaN(expectedNum) && !isNaN(actualNum) && expectedNum === actualNum) {
            // Values are numerically equal (e.g., "45.50" and "45.5")
            // With text inputs, this should no longer happen, but keep for safety
            await this.page.waitForLoadState('domcontentloaded');
            return; // Success - number normalization is expected!
          }
        }
        
        // Log and retry if not final attempt
        if (attempt < maxRetries) {
          const fieldId = await this.getFieldIdentifier(input);
          // Only warn if it's not expected number normalization
          if (inputType !== 'number' || parseFloat(value) !== parseFloat(actualValue)) {
            console.warn(`Input retry ${attempt}: expected "${value}", got "${actualValue}" for ${fieldId}`);
          }
          // Use DOM state waiting instead of arbitrary timeout
          await this.page.waitForLoadState('domcontentloaded');
        }
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.warn(`Attempt ${attempt} threw error, retrying:`, error instanceof Error ? error.message : String(error));
        // Use DOM state waiting instead of arbitrary timeout
        await this.page.waitForLoadState('domcontentloaded');
      }
    }
    
    // Final validation after all retries (throws error if still incorrect)
    await this.validateInputValue(input, value);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async waitForNetworkIdle() {
    await this.page.waitForLoadState('domcontentloaded');
  }
  
  /**
   * Expects a button to be enabled before clicking.
   * Provides detailed error messages if the button is disabled.
   */
  async expectButtonEnabled(button: Locator, buttonText?: string): Promise<void> {
    const isDisabled = await button.isDisabled();
    
    if (isDisabled) {
      // Gather validation error messages for better debugging
      const errorMessages = await this.page.locator('.error-message, .text-red-500, [role="alert"]').allTextContents();
      const buttonTitle = await button.getAttribute('title');
      const buttonName = buttonText || await button.textContent() || 'Submit';
      
      let errorDetail = `Button "${buttonName}" is disabled.`;
      if (errorMessages.length > 0) {
        errorDetail += ` Validation errors found: ${errorMessages.join(', ')}`;
      }
      if (buttonTitle) {
        errorDetail += ` Button hint: ${buttonTitle}`;
      }
      
      throw new Error(errorDetail);
    }
  }

  /**
   * Standard button click method that ensures button is visible and enabled before clicking.
   * Provides clear error messages if the button cannot be clicked.
   * This should be the default way to click any button in tests.
   * 
   * @param button - The button locator
   * @param options - Optional configuration
   * @returns Promise that resolves when button is clicked
   */
  async clickButton(
    button: Locator, 
    options?: {
      buttonName?: string;  // Human-readable name for error messages
      skipEnabledCheck?: boolean;  // Skip the enabled check (for special cases)
      timeout?: number;  // Custom timeout for visibility check
    }
  ): Promise<void> {
    const { buttonName, skipEnabledCheck = false, timeout = 5000 } = options || {};
    
    // Get button text for error messages if not provided
    const buttonText = buttonName || await button.textContent() || 'button';
    
    // Check visibility with clear error message
    try {
      await expect(button).toBeVisible({ timeout });
    } catch (error) {
      // Check if button exists in DOM
      const exists = await button.count() > 0;
      if (!exists) {
        throw new Error(`Button "${buttonText}" not found in the DOM. Check your selector.`);
      }
      
      // Button exists but not visible
      const isHidden = await button.isHidden();
      if (isHidden) {
        throw new Error(`Button "${buttonText}" exists but is hidden. It may be behind a modal or collapsed section.`);
      }
      
      throw new Error(`Button "${buttonText}" is not visible after ${timeout}ms timeout.`);
    }
    
    // Check if enabled (unless explicitly skipped)
    if (!skipEnabledCheck) {
      try {
        await expect(button).toBeEnabled({ timeout: 1000 });
      } catch (error) {
        // Use our detailed error reporting for disabled buttons
        await this.expectButtonEnabled(button, buttonText);
      }
    }
    
    // Click the button
    try {
      await button.click();
    } catch (error: any) {
      // Provide context for click failures
      if (error.message?.includes('intercept')) {
        throw new Error(`Cannot click button "${buttonText}" - it may be covered by another element.`);
      }
      throw new Error(`Failed to click button "${buttonText}": ${error.message}`);
    }
  }

  /**
   * Helper specifically for submit buttons with detailed validation error reporting.
   * Use this before clicking submit buttons in forms.
   */
  async expectSubmitButtonEnabled(submitButton?: Locator): Promise<void> {
    const button = submitButton || this.page.getByRole('button', { name: /submit|create|save|sign in|register/i });
    await this.expectButtonEnabled(button, 'Submit');
  }

  /**
   * Expects the page to match a URL pattern
   */
  async expectUrl(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }
  
  /**
   * Extracts a parameter from the current URL
   */
  getUrlParam(paramName: string): string | null {
    const url = new URL(this.page.url());
    const pathParts = url.pathname.split('/');
    const paramIndex = pathParts.indexOf(paramName);
    
    if (paramIndex !== -1 && paramIndex < pathParts.length - 1) {
      return pathParts[paramIndex + 1];
    }
    
    // For group IDs, extract from /groups/{id} pattern
    if (paramName === 'groupId') {
      const match = url.pathname.match(/\/groups\/([a-zA-Z0-9]+)/);
      return match ? match[1] : null;
    }
    
    return null;
  }

  /**
   * Navigation helper methods to replace direct page.goto() calls
   */
  async navigateToHomepage(): Promise<void> {
    await this.page.goto(EMULATOR_URL);
    await this.waitForNetworkIdle();
  }

  async navigateToRoot(): Promise<void> {
    await this.page.goto(EMULATOR_URL);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async navigateToLogin(): Promise<void> {
    await this.page.goto(`${EMULATOR_URL}/login`);
    await this.waitForNetworkIdle();
  }

  async navigateToRegister(): Promise<void> {
    await this.page.goto(`${EMULATOR_URL}/register`);
    await this.waitForNetworkIdle();
  }

  async navigateToPricing(): Promise<void> {
    await this.page.goto(`${EMULATOR_URL}/pricing`);
    await this.waitForNetworkIdle();
  }

  async navigateToDashboard(): Promise<void> {
    await this.page.goto(`${EMULATOR_URL}/dashboard`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async navigateToShareLink(shareLink: string): Promise<void> {
    await this.page.goto(shareLink);
    await this.waitForNetworkIdle();
  }

  async navigateToStaticPath(path: string): Promise<void> {
    await this.page.goto(`${EMULATOR_URL}${path}`);
    await this.waitForNetworkIdle();
  }
}
