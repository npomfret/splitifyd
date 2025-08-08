import { Page } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';
import type {User as BaseUser} from "@shared/types/webapp-shared-types";
import { generateShortId, generateTestEmail, generateTestUserName } from '../utils/test-helpers';

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
   */
  async claimUser(page: Page): Promise<BaseUser> {
    // Try to get an existing user from the pool
    let user = this.availableUsers.pop();
    
    if (user) {
      // console.log(`📤 Claimed existing user: ${user.email}`);
    } else {
      // Pool is empty, create a new user on-demand
      // console.log(`🔨 Creating new user on-demand`);
      user = await this.createUser(page, 'u');
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
   * Optional: Pre-warm the pool with users for better performance.
   * This is now optional - the pool works fine with on-demand creation.
   * @deprecated Consider removing this method entirely
   */
  async preWarmPool(page: Page, count: number): Promise<void> {
    console.log(`🔥 Pre-warming pool with ${count} users (optional optimization)...`);
    
    for (let i = 0; i < count; i++) {
      const user = await this.createUser(page, `prewarm-${i}`);
      this.availableUsers.push(user);
      console.log(`✅ Created pool user ${i + 1}/${count}: ${user.email}`);
    }
    
    console.log(`✅ Pool pre-warmed with ${count} users`);
  }

  /**
   * Create a new test user.
   */
  private async createUser(page: Page, prefix: string): Promise<BaseUser> {
    const uniqueId = generateShortId();
    const displayName = generateTestUserName('Pool');
    const email = generateTestEmail(prefix);
    const password = 'TestPassword123!';

    // Navigate to register page
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    // Wait for form to be visible
    await page.waitForSelector('input[placeholder="Enter your full name"]');
    
    // Fill registration form
    await page.fill('input[placeholder="Enter your full name"]', displayName);
    await page.fill('input[placeholder="Enter your email"]', email);
    await page.fill('input[placeholder="Create a strong password"]', password);
    await page.fill('input[placeholder="Confirm your password"]', password);
    
    // Check both terms and cookie policy checkboxes (first and last)
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator('input[type="checkbox"]').last().check();
    
    // Submit form
    await page.click('button:has-text("Create Account")');
    
    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: TIMEOUTS.EXTENDED * 2 });
    
    // Logout so the page is ready for the next user creation
    await page.click(`button:has-text("${displayName}")`);
    await page.waitForSelector('text=Sign out', { timeout: TIMEOUTS.EXTENDED });
    await page.click('text=Sign out');
    
    // Wait for logout to complete
    await page.waitForURL(url => !url.toString().includes('/dashboard'), { 
      timeout: TIMEOUTS.EXTENDED * 2 
    });
    
    return {
      uid: uniqueId,
      email,
      displayName
    };
  }

  /**
   * Get pool statistics for debugging.
   */
  getStats() {
    return {
      available: this.availableUsers.length,
      inUse: this.usersInUse.size,
      total: this.availableUsers.length + this.usersInUse.size
    };
  }

  /**
   * Clear the pool (for cleanup).
   */
  clear(): void {
    this.availableUsers = [];
    this.usersInUse.clear();
    console.log('🧹 User pool cleared');
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