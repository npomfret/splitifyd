import { Page, expect, Locator } from '@playwright/test';

import { TIMEOUT_CONTEXTS } from '../config/timeouts';

/**
 * Page object for join group functionality via share links.
 * Handles different authentication states and provides robust join operations.
 */
export class JoinGroupPage {
  constructor(private page: Page) {}

  // Core selectors with retry logic
  getJoinGroupHeading(): Locator {
    return this.page.getByRole('heading', { name: /join group/i });
  }

  getJoinGroupButton(): Locator {
    return this.page.getByRole('button', { name: /join group/i });
  }

  getAlreadyMemberMessage(): Locator {
    return this.page.getByText(/already.*member|you.*already.*part/i);
  }

  getGroupNameHeading(): Locator {
    return this.page.getByRole('heading').first();
  }

  getLoginButton(): Locator {
    return this.page.getByRole('button', { name: /login|sign in/i });
  }

  getRegisterButton(): Locator {
    return this.page.getByRole('button', { name: /register|sign up/i });
  }

  getErrorMessage(): Locator {
    return this.page.getByText(/error|not found|invalid/i);
  }

  // Authentication state detection
  async isUserLoggedIn(): Promise<boolean> {
    try {
      // Check if we see login/register buttons (indicates not logged in)
      const loginVisible = await this.getLoginButton().isVisible({ timeout: 1000 });
      const registerVisible = await this.getRegisterButton().isVisible({ timeout: 1000 });
      return !loginVisible && !registerVisible;
    } catch {
      return true; // Assume logged in if we can't detect login buttons
    }
  }

  async isUserAlreadyMember(): Promise<boolean> {
    try {
      return await this.getAlreadyMemberMessage().isVisible({ timeout: 2000 });
    } catch {
      return false;
    }
  }

  async isJoinPageVisible(): Promise<boolean> {
    try {
      await this.getJoinGroupHeading().waitFor({ timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  async isErrorPage(): Promise<boolean> {
    try {
      return await this.getErrorMessage().isVisible({ timeout: 2000 });
    } catch {
      return false;
    }
  }

  // Navigation and join operations
  async navigateToShareLink(shareLink: string): Promise<void> {
    await this.page.goto(shareLink);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Attempts to join group with comprehensive error handling and retry logic.
   * Handles different authentication states automatically.
   */
  async joinGroup(options: {
    maxRetries?: number;
    expectedRedirectPattern?: RegExp;
    skipRedirectWait?: boolean;
  } = {}): Promise<void> {
    const {
      maxRetries = 3,
      expectedRedirectPattern = /\/groups\/[a-zA-Z0-9]+$/,
      skipRedirectWait = false
    } = options;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait for page to be ready
        await this.page.waitForLoadState('networkidle');

        // Check if user is already a member
        if (await this.isUserAlreadyMember()) {
          throw new Error('User is already a member of this group');
        }

        // Check if this is an error page
        if (await this.isErrorPage()) {
          throw new Error('Share link is invalid or group not found');
        }

        // Check if user needs to log in first
        if (!(await this.isUserLoggedIn())) {
          throw new Error('User must be logged in to join group');
        }

        // Wait for join button to be available
        const joinButton = this.getJoinGroupButton();
        await joinButton.waitFor({ state: 'visible', timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
        await joinButton.waitFor({ state: 'attached', timeout: 1000 });

        // Ensure button is clickable
        await expect(joinButton).toBeEnabled();

        // Click the join button
        await joinButton.click();

        // Wait for redirect unless skipped
        if (!skipRedirectWait) {
          await this.page.waitForURL(expectedRedirectPattern, { 
            timeout: TIMEOUT_CONTEXTS.GROUP_CREATION 
          });
        }

        // Success - exit retry loop
        return;

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          // Wait before retry
          await this.page.waitForTimeout(1000 * attempt);
          
          // Refresh page state
          await this.page.waitForLoadState('networkidle');
        }
      }
    }

    // All retries failed
    throw new Error(`Failed to join group after ${maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Comprehensive join flow that handles all authentication states.
   * Returns information about the join result.
   */
  async attemptJoinWithStateDetection(shareLink: string): Promise<{
    success: boolean;
    reason: string;
    needsLogin: boolean;
    alreadyMember: boolean;
    error: boolean;
  }> {
    await this.navigateToShareLink(shareLink);

    // Check various states
    const needsLogin = !(await this.isUserLoggedIn());
    const alreadyMember = await this.isUserAlreadyMember();
    const error = await this.isErrorPage();
    const joinPageVisible = await this.isJoinPageVisible();

    if (error) {
      return {
        success: false,
        reason: 'Invalid share link or group not found',
        needsLogin: false,
        alreadyMember: false,
        error: true
      };
    }

    if (needsLogin) {
      return {
        success: false,
        reason: 'User needs to log in first',
        needsLogin: true,
        alreadyMember: false,
        error: false
      };
    }

    if (alreadyMember) {
      return {
        success: false,
        reason: 'User is already a member of this group',
        needsLogin: false,
        alreadyMember: true,
        error: false
      };
    }

    if (!joinPageVisible) {
      return {
        success: false,
        reason: 'Join group page not visible',
        needsLogin: false,
        alreadyMember: false,
        error: true
      };
    }

    // Attempt to join
    try {
      await this.joinGroup();
      return {
        success: true,
        reason: 'Successfully joined group',
        needsLogin: false,
        alreadyMember: false,
        error: false
      };
    } catch (error) {
      return {
        success: false,
        reason: `Failed to join: ${(error as Error).message}`,
        needsLogin: false,
        alreadyMember: false,
        error: true
      };
    }
  }

  // Utility methods for testing
  async waitForJoinPageLoad(): Promise<void> {
    await this.getJoinGroupHeading().waitFor({ timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
  }

  async getGroupName(): Promise<string> {
    const heading = this.getGroupNameHeading();
    await heading.waitFor({ timeout: 3000 });
    return await heading.textContent() || '';
  }

  async takeDebugScreenshot(name: string = 'join-group-debug'): Promise<void> {
    await this.page.screenshot({ 
      path: `tmp/debug-screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  // Helper for debugging failed joins
  async getPageState(): Promise<{
    url: string;
    title: string;
    isLoggedIn: boolean;
    isAlreadyMember: boolean;
    isErrorPage: boolean;
    isJoinPageVisible: boolean;
    joinButtonVisible: boolean;
    joinButtonEnabled: boolean;
  }> {
    const joinButton = this.getJoinGroupButton();
    
    return {
      url: this.page.url(),
      title: await this.page.title(),
      isLoggedIn: await this.isUserLoggedIn(),
      isAlreadyMember: await this.isUserAlreadyMember(),
      isErrorPage: await this.isErrorPage(),
      isJoinPageVisible: await this.isJoinPageVisible(),
      joinButtonVisible: await joinButton.isVisible().catch(() => false),
      joinButtonEnabled: await joinButton.isEnabled().catch(() => false),
    };
  }
}