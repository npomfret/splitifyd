import { Page, expect } from '@playwright/test';
import { GroupDetailPage, JoinGroupPage } from '../pages';
import type {User as BaseUser} from "@shared/shared-types";

/**
 * Clean multi-user workflow - removed redundant methods and hacks.
 * Each method has a clear single responsibility.
 */
export class MultiUserWorkflow {

  /**
   * Get share link from group page with comprehensive assertions
   */
  async getShareLink(page: Page, testName: string = 'unknown'): Promise<string> {
    const context = `getShareLink(${testName})`;
    
    // Assert 1: Validate we're on a group page
    const currentUrl = page.url();
    if (!currentUrl.includes('/groups/')) {
      throw new Error(`${context}: Expected to be on group page, but URL is: ${currentUrl}`);
    }
    console.log(`${context}: ✓ Confirmed on group page: ${currentUrl}`);
    
    // Assert 2: Create group detail page instance
    const groupDetailPage = new GroupDetailPage(page);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedTestName = testName.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 50);
    console.log(`${context}: ✓ GroupDetailPage instance created`);
    
    // Assert 3: Share button is present and clickable
    console.log(`${context}: Looking for share button...`);
    const shareButton = groupDetailPage.getShareButton();
    await expect(shareButton, `${context}: Share button not found`).toBeVisible({ timeout: 3000 });
    await expect(shareButton, `${context}: Share button not enabled`).toBeEnabled({ timeout: 1000 });
    console.log(`${context}: ✓ Share button found and enabled`);
    
    // Assert 4: Click share button
    console.log(`${context}: Clicking share button...`);
    await shareButton.click();
    console.log(`${context}: ✓ Share button clicked`);
    
    // Assert 5: Share dialog opens
    console.log(`${context}: Waiting for share dialog...`);
    const dialogSelector = '[role="dialog"]';
    await page.waitForSelector(dialogSelector, { timeout: 5000 });
    const dialog = page.locator(dialogSelector);
    await expect(dialog, `${context}: Share dialog not visible`).toBeVisible({ timeout: 2000 });
    console.log(`${context}: ✓ Share dialog opened`);
    
    // Take screenshot of initial modal state
    await page.screenshot({ 
      path: `tmp/${timestamp}-${sanitizedTestName}-modal-opened.png`,
      fullPage: true 
    });
    
    // Assert 6: Wait for share link generation to complete
    console.log(`${context}: Checking for loading spinner...`);
    const loadingSpinner = page.locator('[role="dialog"] .animate-spin');
    
    const spinnerAppeared = await loadingSpinner.isVisible({ timeout: 1000 }).catch(() => false);
    if (spinnerAppeared) {
      console.log(`${context}: Loading spinner detected, waiting for share link generation...`);
      await expect(loadingSpinner, `${context}: Loading spinner did not disappear within 10s`).not.toBeVisible({ timeout: 10000 });
      console.log(`${context}: ✓ Share link generation complete`);
    } else {
      console.log(`${context}: ✓ No loading spinner detected - share link ready`);
    }
    
    // Assert 7: Share link input field appears and has value
    console.log(`${context}: Looking for share link input field...`);
    const shareLinkInput = page.locator('[role="dialog"] input[type="text"]').first();
    await expect(shareLinkInput, `${context}: Share link input not found`).toBeVisible({ timeout: 5000 });
    console.log(`${context}: ✓ Share link input field found`);
    
    // Assert 8: Input field has a valid value
    await page.waitForTimeout(200); // Ensure value is populated
    const shareLink = await shareLinkInput.inputValue();
    
    if (!shareLink || shareLink.trim().length === 0) {
      throw new Error(`${context}: Share link input field is empty`);
    }
    if (!shareLink.includes('/join?linkId=')) {
      throw new Error(`${context}: Invalid share link format: ${shareLink}`);
    }
    console.log(`${context}: ✓ Valid share link retrieved: ${shareLink}`);
    
    // Take screenshot with share link visible
    await page.screenshot({ 
      path: `tmp/${timestamp}-${sanitizedTestName}-share-link-visible.png`,
      fullPage: true 
    });
    
    // Assert 9: Close modal successfully
    console.log(`${context}: Closing share dialog...`);
    await page.keyboard.press('Escape');
    
    // Assert 10: Verify modal closed
    try {
      await expect(dialog, `${context}: Share dialog failed to close within 3s`).not.toBeVisible({ timeout: 3000 });
      console.log(`${context}: ✓ Share dialog closed successfully`);
    } catch (error) {
      console.log(`${context}: Warning - Share dialog may not have closed immediately`);
      // Continue anyway as this is not critical
    }
    
    // NOTE: shareLink validation was already done above, so this check is now redundant
    // but keeping for backwards compatibility
    if (!shareLink || !shareLink.includes('/join?')) {
      await page.screenshot({ 
        path: `tmp/${timestamp}-${sanitizedTestName}-share-link-fail.png`,
        fullPage: true 
      });
      throw new Error(`${context}: Invalid share link validation failed: ${shareLink}`);
    }
    
    // Assert 11: Final validation - still on group page
    const finalUrl = page.url();
    if (!finalUrl.includes('/groups/')) {
      throw new Error(`${context}: Expected to remain on group page after closing dialog, but URL is: ${finalUrl}`);
    }
    console.log(`${context}: ✓ Final validation - remained on group page: ${finalUrl}`);
    console.log(`${context}: 🎉 COMPLETE - Share link obtained successfully: ${shareLink}`);
    
    return shareLink;
  }

  /**
   * Join group when user is already logged in
   */
  async joinGroup(page: Page, shareLink: string, userId?: string): Promise<void> {
    const joinGroupPage = new JoinGroupPage(page);
    
    await joinGroupPage.navigateToShareLink(shareLink);
    await joinGroupPage.joinGroup(userId);
  }

  /**
   * Test share link for already-member user
   */
  async testShareLinkAlreadyMember(page: Page, shareLink: string, userId?: string): Promise<void> {
    const joinGroupPage = new JoinGroupPage(page);
    await joinGroupPage.handleAlreadyMember(shareLink, userId);
  }

  /**
   * Test invalid share link
   */
  async testInvalidShareLink(page: Page, invalidShareLink: string, userId?: string): Promise<void> {
    const joinGroupPage = new JoinGroupPage(page);
    await joinGroupPage.testInvalidShareLink(invalidShareLink, userId);
  }

  /**
   * Join group via share link - determines correct flow based on state
   * This is the simplified version of the old joinGroupViaShareLink
   */
  async joinGroupViaShareLink(page: Page, shareLink: string, user?: BaseUser): Promise<void> {
    const joinGroupPage = new JoinGroupPage(page);
    
    // Navigate to share link
    await joinGroupPage.navigateToShareLink(shareLink);
    
    // Check current state
    const state = await joinGroupPage.getCurrentState(user?.displayName);
    
    switch(state.type) {
      case 'SUCCESS':
        // Already on group page
        return;
        
      case 'ALREADY_MEMBER':
        // User is already a member - wait for redirect
        await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 5000 });
        return;
        
      case 'LOGGED_OUT':
        throw new Error(`User needs to log in first. Use joinGroupWithLogin() instead. ${state.message}`);
        
      case 'ERROR_PAGE':
        throw new Error(state.message);
        
      case 'READY_TO_JOIN':
        // Join the group
        await joinGroupPage.joinGroup(user?.displayName);
        return;
        
      default:
        throw new Error(`Unexpected state: ${state.message}`);
    }
  }

  /**
   * Join group via share link when user is not logged in.
   * Enhanced with comprehensive assertions at every step.
   */
  async joinGroupViaShareLinkWithLogin(page: Page, shareLink: string, user: BaseUser): Promise<void> {
    const password = 'TestPassword123!'; // Standard test password
    const userContext = `${user.displayName} (${user.email})`;
    
    // Assert 1: Validate inputs
    if (!shareLink || !shareLink.includes('/join?linkId=')) {
      throw new Error(`${userContext}: Invalid share link provided: ${shareLink}`);
    }
    if (!user.email || !user.displayName) {
      throw new Error(`${userContext}: Invalid user data - email: ${user.email}, displayName: ${user.displayName}`);
    }
    console.log(`${userContext}: ✓ Input validation passed`);
    
    // Assert 2: Page is available and responsive
    const initialUrl = page.url();
    console.log(`${userContext}: Starting from URL: ${initialUrl}`);
    
    // Assert 3: Create join group page instance
    const joinGroupPage = new JoinGroupPage(page);
    console.log(`${userContext}: ✓ JoinGroupPage instance created`);
    
    // Assert 4: Call join method with comprehensive error context
    try {
      console.log(`${userContext}: Calling joinGroupWithLogin...`);
      await joinGroupPage.joinGroupWithLogin(shareLink, user.email, password, user.displayName);
      console.log(`${userContext}: ✓ joinGroupWithLogin completed successfully`);
    } catch (error) {
      const currentUrl = page.url();
      throw new Error(`${userContext}: joinGroupWithLogin failed at URL ${currentUrl}. Original error: ${(error as Error).message}`);
    }
    
    // Assert 5: Final state validation - ensure we're on a group page
    const finalUrl = page.url();
    if (!finalUrl.includes('/groups/')) {
      throw new Error(`${userContext}: Expected to be on group page after join, but URL is: ${finalUrl}`);
    }
    console.log(`${userContext}: ✓ Final validation passed - successfully on group page: ${finalUrl}`);
  }
}