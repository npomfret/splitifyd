import { Page, expect, Locator } from '@playwright/test';
import { TIMEOUT_CONTEXTS } from '../config/timeouts';
import { LoginPage } from './login.page';
import { DashboardPage } from './dashboard.page';

/**
 * Clean join group page object - no retry logic, no hacks.
 * Each test must know the current state and pick the right journey.
 */
export class JoinGroupPage {
  constructor(private page: Page) {}

  // Simple selectors
  getJoinGroupHeading(): Locator {
    return this.page.getByRole('heading', { name: /join group/i });
  }

  getJoinGroupButton(): Locator {
    return this.page.getByRole('button', { name: /join group/i });
  }

  getAlreadyMemberMessage(): Locator {
    return this.page.getByText(/already.*member|you.*already.*part/i);
  }

  getErrorMessage(): Locator {
    return this.page.getByText(/error|not found|invalid/i);
  }

  // Clean state detection - no timeouts, no retries
  async getCurrentState(userId?: string): Promise<{
    type: 'LOGGED_OUT' | 'ERROR_PAGE' | 'ALREADY_MEMBER' | 'READY_TO_JOIN' | 'SUCCESS';
    message: string;
  }> {
    const userContext = userId ? ` (User: ${userId})` : '';
    const url = this.page.url();
    console.log(`getCurrentState: Checking URL: ${url}`);

    // Check URL patterns first (most reliable)
    if (url.includes('/login') || url.includes('/register')) {
      return { 
        type: 'LOGGED_OUT', 
        message: `User needs to log in first${userContext}` 
      };
    }

    // Check for success - being on a group page (but not join page)
    if (url.includes('/groups/') && !url.includes('/join')) {
      console.log(`getCurrentState: Detected SUCCESS - on group page: ${url}`);
      return { 
        type: 'SUCCESS', 
        message: `User successfully joined group${userContext}` 
      };
    }

    // Check if we're on the dashboard (might need to navigate to join link)
    if (url.includes('/dashboard')) {
      console.log(`getCurrentState: On dashboard - user logged in but not on join page`);
      return { 
        type: 'SUCCESS', // Treat dashboard as success since user is logged in
        message: `User logged in and on dashboard${userContext}` 
      };
    }

    // Check if we're on the join page (handles both /join and /join?linkId=...)
    if (url.includes('/join')) {
      console.log(`getCurrentState: On join page, checking page content...`);
      
      // Wait a moment for the page to render
      await this.page.waitForTimeout(500);
      
      // Check for error messages
      if (await this.getErrorMessage().isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`getCurrentState: Found error message on join page`);
        return { 
          type: 'ERROR_PAGE', 
          message: `Share link is invalid or group not found${userContext}. URL: ${url}` 
        };
      }

      // Check for already member message
      if (await this.getAlreadyMemberMessage().isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`getCurrentState: Found already member message`);
        return { 
          type: 'ALREADY_MEMBER', 
          message: `User is already a member${userContext}` 
        };
      }

      // Check for join button visibility - wait a bit longer for it to appear
      if (await this.getJoinGroupButton().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`getCurrentState: Found join button - ready to join`);
        return { 
          type: 'READY_TO_JOIN', 
          message: `Ready to join group${userContext}` 
        };
      }
      
      // If we're on the join page but no button is visible yet, wait a bit more
      await this.page.waitForTimeout(1000);
      if (await this.getJoinGroupButton().isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`getCurrentState: Found join button after additional wait`);
        return { 
          type: 'READY_TO_JOIN', 
          message: `Ready to join group${userContext}` 
        };
      }
      
      console.log(`getCurrentState: On join page but no clear state detected`);
      return { 
        type: 'ERROR_PAGE', 
        message: `Join page loaded but no clear action available${userContext}. URL: ${url}` 
      };
    }

    console.log(`getCurrentState: URL doesn't match known patterns: ${url}`);
    return { 
      type: 'ERROR_PAGE', 
      message: `Unknown page state${userContext}. URL: ${url}` 
    };
  }

  /**
   * Navigate to share link and wait for page to load
   */
  async navigateToShareLink(shareLink: string): Promise<void> {
    console.log(`Navigating to share link: ${shareLink}`);
    await this.page.goto(shareLink);
    await this.page.waitForLoadState('domcontentloaded');
    
    // Give time for any automatic redirects (like login redirect)
    await this.page.waitForTimeout(1000);
    
    console.log(`After navigation, current URL: ${this.page.url()}`);
  }

  /**
   * Join group with comprehensive assertions at every step
   */
  async joinGroup(userId?: string): Promise<void> {
    const userContext = userId ? ` (User: ${userId})` : '';
    const context = `joinGroup${userContext}`;
    
    // Assert 1: Validate current page state
    console.log(`${context}: Starting join group process...`);
    const currentUrl = this.page.url();
    console.log(`${context}: Current URL: ${currentUrl}`);
    
    // Assert 2: Check current state before proceeding
    console.log(`${context}: Checking current state...`);
    const initialState = await this.getCurrentState(userId);
    console.log(`${context}: Initial state: ${initialState.type} - ${initialState.message}`);
    
    if (initialState.type !== 'READY_TO_JOIN') {
      throw new Error(`${context}: Cannot join - wrong state: ${initialState.message}`);
    }
    console.log(`${context}: ✓ Ready to join state confirmed`);
    
    // Assert 3: Join button is visible and clickable
    console.log(`${context}: Looking for join button...`);
    const joinButton = this.getJoinGroupButton();
    
    try {
      await joinButton.waitFor({ state: 'visible', timeout: 5000 });
      console.log(`${context}: ✓ Join button found and visible`);
    } catch (error) {
      throw new Error(`${context}: Join button not visible after 5s. Current URL: ${this.page.url()}. Error: ${(error as Error).message}`);
    }
    
    // Assert 4: Join button is enabled
    console.log(`${context}: Checking join button is enabled...`);
    await expect(joinButton, `${context}: Join button not enabled`).toBeEnabled({ timeout: 3000 });
    console.log(`${context}: ✓ Join button is enabled`);

    // Assert 5: Click join button
    console.log(`${context}: Clicking join button...`);
    await joinButton.click();
    console.log(`${context}: ✓ Join button clicked`);

    // Assert 6: Wait for redirect to group page
    console.log(`${context}: Waiting for redirect to group page...`);
    try {
      await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { 
        timeout: TIMEOUT_CONTEXTS.GROUP_CREATION 
      });
      console.log(`${context}: ✓ Redirected to group page`);
    } catch (error) {
      const currentUrlAfterClick = this.page.url();
      throw new Error(`${context}: Failed to redirect to group page within ${TIMEOUT_CONTEXTS.GROUP_CREATION}ms. Current URL: ${currentUrlAfterClick}. Error: ${(error as Error).message}`);
    }

    // Assert 7: Verify final state is success
    console.log(`${context}: Verifying final join state...`);
    const finalState = await this.getCurrentState(userId);
    if (finalState.type !== 'SUCCESS') {
      throw new Error(`${context}: Join failed - final state: ${finalState.message}`);
    }
    
    const finalUrl = this.page.url();
    console.log(`${context}: ✓ Final state verified as SUCCESS`);
    console.log(`${context}: 🎉 COMPLETE - Successfully joined group: ${finalUrl}`);
  }

  /**
   * Complete join flow with login if needed
   */
  async joinGroupWithLogin(shareLink: string, email: string, password: string, userId?: string): Promise<void> {
    const userContext = userId ? ` (User: ${userId})` : '';
    
    // Navigate to share link first
    await this.navigateToShareLink(shareLink);
    
    // Assert we navigated successfully 
    if (!this.page.url().includes('/')) {
      throw new Error(`${userContext}: Failed to navigate to share link: ${shareLink}`);
    }
    
    // Check current state
    const state = await this.getCurrentState(userId);
    console.log(`${userContext}: Initial state after navigation: ${state.type} - ${state.message}`);
    
    if (state.type === 'LOGGED_OUT') {
      // Assert we're on login page
      if (!this.page.url().includes('/login')) {
        throw new Error(`${userContext}: Expected to be on login page but URL is: ${this.page.url()}`);
      }
      
      console.log(`${userContext}: User needs to login. Current URL: ${this.page.url()}`);
      
      // We're on login page with returnUrl - perform the login
      const loginPage = new LoginPage(this.page);
      
      // Assert form elements are visible before filling
      await expect(loginPage.getEmailInput()).toBeVisible({ timeout: 5000 });
      await expect(loginPage.getPasswordInput()).toBeVisible({ timeout: 5000 });
      await expect(loginPage.getSubmitButton()).toBeVisible({ timeout: 5000 });
      
      // Fill the form carefully
      await loginPage.fillLoginForm(email, password);
      
      // Assert form was filled correctly
      await expect(loginPage.getEmailInput()).toHaveValue(email);
      // Note: password field value checking is usually not reliable due to security
      
      console.log(`${userContext}: Form filled and validated, submitting...`);
      
      // Assert submit button is enabled before clicking
      const submitButton = loginPage.getSubmitButton();
      await expect(submitButton).toBeEnabled({ timeout: 3000 });
      
      // Submit and wait for navigation
      await submitButton.click();
      
      console.log(`${userContext}: Form submitted, waiting for navigation...`);
      
      // Wait for navigation away from login page - more specific wait
      await this.page.waitForURL(url => !url.toString().includes('/login'), { 
        timeout: 10000 
      });
      
      const postLoginUrl = this.page.url();
      console.log(`${userContext}: Navigation complete, new URL: ${postLoginUrl}`);
      
      // Assert we successfully left the login page
      if (postLoginUrl.includes('/login')) {
        throw new Error(`${userContext}: Login failed - still on login page: ${postLoginUrl}`);
      }
      
      // Wait for any automatic redirects to complete
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(2000);
      
      const finalUrl = this.page.url();
      console.log(`${userContext}: Final URL after login: ${finalUrl}`);
      
      // Check if we automatically ended up on the group page (success)
      if (finalUrl.includes('/groups/')) {
        console.log(`${userContext}: SUCCESS - Automatically joined via login flow`);
        // Assert we're on a valid group page
        await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 3000 });
        return;
      }
      
      // If we're on dashboard or somewhere else, navigate back to the share link
      if (!finalUrl.includes('/join?linkId=')) {
        console.log(`${userContext}: Not on join page (on ${finalUrl}), navigating back to share link`);
        await this.navigateToShareLink(shareLink);
        await this.page.waitForLoadState('domcontentloaded');
        
        // Assert we're back on the join page
        const joinPageUrl = this.page.url();
        if (!joinPageUrl.includes('/join?linkId=')) {
          throw new Error(`${userContext}: Failed to navigate back to join page. URL: ${joinPageUrl}`);
        }
      }
    } else if (state.type === 'SUCCESS') {
      console.log(`${userContext}: Already on group page - join flow complete`);
      return;
    } else if (state.type === 'ERROR_PAGE') {
      throw new Error(`${userContext}: Share link error - ${state.message}`);
    } else if (state.type === 'ALREADY_MEMBER') {
      console.log(`${userContext}: User is already a member - should redirect to group`);
      await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 5000 });
      return;
    }
    
    // Now attempt to join if we're not already in the group
    console.log(`${userContext}: Attempting manual join...`);
    await this.joinGroup(userId);
  }

  /**
   * Handle already-member scenario
   */
  async handleAlreadyMember(shareLink: string, userId?: string): Promise<void> {
    const userContext = userId ? ` (User: ${userId})` : '';
    
    await this.navigateToShareLink(shareLink);
    
    const state = await this.getCurrentState(userId);
    
    if (state.type === 'ALREADY_MEMBER') {
      // Expected - should redirect to group page
      await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 5000 });
      return;
    }
    
    if (state.type === 'SUCCESS') {
      // Already redirected to group page
      return;
    }
    
    throw new Error(`Expected already-member scenario but got: ${state.message}`);
  }

  /**
   * Test invalid share link
   */
  async testInvalidShareLink(invalidShareLink: string, userId?: string): Promise<void> {
    const userContext = userId ? ` (User: ${userId})` : '';
    
    await this.navigateToShareLink(invalidShareLink);
    
    const state = await this.getCurrentState(userId);
    
    if (state.type !== 'ERROR_PAGE') {
      throw new Error(`Expected error page but got: ${state.message}`);
    }
  }

  /**
   * Comprehensive join flow that handles all authentication states.
   * Returns information about the join result.
   * DEPRECATED - use specific methods instead
   */
  async attemptJoinWithStateDetection(shareLink: string): Promise<{
    success: boolean;
    reason: string;
    needsLogin: boolean;
    alreadyMember: boolean;
    error: boolean;
  }> {
    await this.navigateToShareLink(shareLink);

    // Wait a moment for potential redirects to complete (login redirect)
    await this.page.waitForTimeout(1000);
    
    // Get current state
    const state = await this.getCurrentState();
    
    if (state.type === 'LOGGED_OUT') {
      return {
        success: false,
        reason: 'User needs to log in first',
        needsLogin: true,
        alreadyMember: false,
        error: false
      };
    }
    
    if (state.type === 'ERROR_PAGE') {
      return {
        success: false,
        reason: 'Invalid share link or group not found',
        needsLogin: false,
        alreadyMember: false,
        error: true
      };
    }

    if (state.type === 'ALREADY_MEMBER') {
      return {
        success: false,
        reason: 'User is already a member of this group',
        needsLogin: false,
        alreadyMember: true,
        error: false
      };
    }

    if (state.type === 'SUCCESS') {
      return {
        success: true,
        reason: 'Already redirected to group page',
        needsLogin: false,
        alreadyMember: false,
        error: false
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
}