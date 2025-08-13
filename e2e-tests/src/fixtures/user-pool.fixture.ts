import { TIMEOUTS } from '../config/timeouts';
import type {User as BaseUser} from "@shared/shared-types";
import { generateShortId, generateTestEmail, generateTestUserName } from '../utils/test-helpers';
import { EMULATOR_URL } from '../helpers';
import { RegisterPage } from '../pages/register.page';

/**
 * Simple in-memory user pool implementation.
 * 
 * Key design principles:
 * - No filesystem persistence (no race conditions)
 * - Simple pop/push operations for claim/release
 * - On-demand user creation when pool is empty
 * - Singleton pattern - only one instance per process/worker
 */
export class UserPool {
  // Singleton tracking
  private static instance: UserPool | undefined;
  
  // In-memory pool of available users
  private availableUsers: BaseUser[] = [];
  // Track users currently in use (for debugging/stats)
  private usersInUse: Set<string> = new Set(); // uid
  
  constructor() {
    // Enforce singleton pattern - only one UserPool per process
    if (UserPool.instance) {
      throw new Error(
        'UserPool has already been instantiated! ' +
        'Use getUserPool() to get the existing instance. ' +
        'Multiple UserPool instances would cause user conflicts.'
      );
    }
    
    // Register this as the singleton instance
    UserPool.instance = this;
    
    // Each worker starts with an empty pool and creates users on-demand
    console.log('🔧 User pool initialized (on-demand mode)');
  }
  
  /**
   * Reset the singleton instance (mainly for testing).
   * Should only be called from resetUserPool().
   */
  static resetInstance(): void {
    UserPool.instance = undefined;
  }

  /**
   * Claim a user from the pool.
   * If pool is empty, creates a new user on-demand.
   * @param browser - The browser instance to use for creating users if needed
   */
  async claimUser(browser: any): Promise<BaseUser> {
    // Try to get an existing user from the pool
    let user = this.availableUsers.pop();
    
    if (user) {
      // console.log(`📤 Claimed existing user: ${user.email}`);
    } else {
      // Pool is empty, create a new user on-demand
      // console.log(`🔨 Creating new user on-demand`);
      user = await this.createUser(browser, 'u');
      // console.log(`✅ Created new user: ${user.email}`);
    }
    
    // Track that this user is in use
    this.usersInUse.add(user.uid);
    
    return user;
  }

  /**
   * Release a user back to the pool for reuse.
   * This is optional - tests don't have to return users.
   */
  releaseUser(user: BaseUser): void {
    // Only accept users that were claimed from this pool
    if (!this.usersInUse.has(user.uid)) {
      // console.log(`⚠️ Attempted to release unknown user: ${user.email}`);
      return;
    }
    
    // Remove from in-use tracking
    this.usersInUse.delete(user.uid);
    
    // Add back to available pool
    this.availableUsers.push(user);
    // console.log(`📥 Released user back to pool: ${user.email}`);
  }
  /**
   * Create a new test user using a temporary browser context.
   * The temporary context is closed after user creation to avoid empty browser windows.
   */
  private async createUser(browser: any, prefix: string): Promise<BaseUser> {
    const uniqueId = generateShortId();
    const displayName = generateTestUserName('Pool');
    const email = generateTestEmail(prefix);
    const password = 'TestPassword123!';

    // Create a temporary context and page for user registration
    const tempContext = await browser.newContext();
    const tempPage = await tempContext.newPage();

    // Add console error reporting to catch JavaScript errors during user creation
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    
    tempPage.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`CONSOLE ERROR: ${msg.text()}`);
      }
    });
    
    tempPage.on('pageerror', (error: Error) => {
      pageErrors.push(`PAGE ERROR: ${error.message}`);
    });

    try {
      // Navigate to register page with full URL
      await tempPage.goto(`${EMULATOR_URL}/register`);
      await tempPage.waitForLoadState('networkidle');
      
      // Check for errors before waiting for form
      if (consoleErrors.length > 0 || pageErrors.length > 0) {
        const errorMessage = `Registration page has errors:\n${consoleErrors.join('\n')}\n${pageErrors.join('\n')}`;
        throw new Error(errorMessage);
      }
      
      // Wait for form to be visible
      await tempPage.waitForSelector('input[placeholder="Enter your full name"]');
      
      // Use RegisterPage to properly fill form with Preact input handling
      const registerPage = new RegisterPage(tempPage);
      
      // Fill registration form using fillPreactInput to handle form defaults
      await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', displayName);
      await registerPage.fillPreactInput('input[placeholder="Enter your email"]', email);
      await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', password);
      await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', password);
      
      // Check both terms and cookie policy checkboxes (first and last)
      await tempPage.locator('input[type="checkbox"]').first().check();
      await tempPage.locator('input[type="checkbox"]').last().check();
      
      // Submit form
      await tempPage.click('button:has-text("Create Account")');
      
      // Wait for redirect to dashboard
      await tempPage.waitForURL(/\/dashboard/, { timeout: TIMEOUTS.EXTENDED * 2 });
      
      // Logout so the user can be used later
      // Wait for page to be stable before clicking menu
      await tempPage.waitForLoadState('domcontentloaded');
      await tempPage.waitForTimeout(200); // Small delay for DOM stability
      
      await tempPage.click('[data-testid="user-menu-button"]');
      
      // Wait for dropdown and ensure it's stable
      await tempPage.waitForSelector('[data-testid="sign-out-button"]', { state: 'visible', timeout: 5000 });
      await tempPage.waitForTimeout(100); // Small delay for dropdown animation
      
      await tempPage.click('[data-testid="sign-out-button"]');
      
      // Wait for logout to complete
      await tempPage.waitForURL((url: URL) => !url.toString().includes('/dashboard'), { 
        timeout: TIMEOUTS.EXTENDED * 2 
      });
    } finally {
      // Always close the temporary context to avoid empty browser windows
      await tempContext.close();
    }
    
    return {
      uid: uniqueId,
      email,
      displayName
    };
  }
}

// Global pool instance per worker process
let globalUserPool: UserPool | undefined;

/**
 * Get or create the user pool for this worker.
 * Each worker gets its own pool instance.
 */
export function getUserPool(): UserPool {
  if (!globalUserPool) {
    globalUserPool = new UserPool();
  }
  return globalUserPool;
}

/**
 * Reset the global pool (mainly for testing).
 */
export function resetUserPool(): void {
  globalUserPool = undefined;
  UserPool.resetInstance(); // Clear singleton tracking
}