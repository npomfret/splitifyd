import { Page } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';
import type {User as BaseUser} from "@shared/types/webapp-shared-types.ts";

export interface PooledUser {
  id: string;
  user: BaseUser;
  inUse: boolean;
  claimedBy?: string;
  claimedAt?: Date;
}

export interface UserPoolConfig {
  minPoolSize: number;
  maxPoolSize: number;
  preWarmCount: number;
  maxClaimDuration: number; // Auto-release after timeout (ms)
}

export class UserPool {
  private pool: Map<string, PooledUser> = new Map();
  private config: UserPoolConfig;
  private creationPage?: Page;
  private static POOL_FILE: string | undefined;

  constructor(config: Partial<UserPoolConfig> = {}) {
    this.config = {
      minPoolSize: 2,
      maxPoolSize: 10,
      preWarmCount: 2, // Start small for debugging
      maxClaimDuration: 300000, // 5 minutes
      ...config
    };
  }

  /**
   * Initialize the pool, loading any existing data from disk
   */
  async initialize(): Promise<void> {
    // First try to load from environment variable (most reliable in CI)
    if (process.env.PLAYWRIGHT_USER_POOL) {
      try {
        console.log('Loading user pool from environment variable...');
        const users = JSON.parse(process.env.PLAYWRIGHT_USER_POOL) as BaseUser[];
        
        for (let i = 0; i < users.length; i++) {
          const pooledUser: PooledUser = {
            id: `prewarm-${i}`,
            user: users[i],
            inUse: false
          };
          this.pool.set(pooledUser.id, pooledUser);
        }
        
        console.log(`✅ Loaded ${this.pool.size} users from environment variable`);
        return;
      } catch (error) {
        console.warn('Failed to load pool from environment variable:', error);
      }
    }
    
    // Fall back to disk-based persistence
    await this.loadPoolFromDisk();
  }

  /**
   * Get the pool file path
   */
  private static async getPoolFilePath(): Promise<string> {
    if (!UserPool.POOL_FILE) {
      // Simple fallback path for local development
      UserPool.POOL_FILE = '.playwright-user-pool.json';
    }
    return UserPool.POOL_FILE;
  }

  /**
   * Pre-warm the pool with test users
   */
  async preWarmPool(page: Page): Promise<void> {
    this.creationPage = page;
    console.log(`Pre-warming user pool with ${this.config.preWarmCount} users...`);
    
    // Create users sequentially to avoid resource contention
    const createdUsers: BaseUser[] = [];
    for (let i = 0; i < this.config.preWarmCount; i++) {
      const pooledUser = await this.createPooledUser(`prewarm-${i}`);
      createdUsers.push(pooledUser.user);
    }
    
    console.log(`User pool ready with ${this.pool.size} users`);
    
    // Store users in environment variable for cross-process sharing
    process.env.PLAYWRIGHT_USER_POOL = JSON.stringify(createdUsers);
    
    // Also persist to disk as backup
    await this.savePoolToDisk();
  }

  /**
   * Atomically claim a user from the pool
   */
  async claimUser(testId: string): Promise<BaseUser> {
    // Find available user
    const availableUser = this.findAvailableUser();
    
    if (!availableUser) {
      const stats = this.getPoolStats();
      throw new Error(`User pool exhausted: ${stats.inUse}/${stats.total} users in use. Increase pool size or reduce parallel test execution.`);
    }

    // Claim the user atomically
    availableUser.inUse = true;
    availableUser.claimedBy = testId;
    availableUser.claimedAt = new Date();

    console.log(`User ${availableUser.user.email} claimed by test ${testId}`);
    
    // Update persistent pool state (fire and forget to avoid blocking test execution)
    this.savePoolToDisk().catch(err => console.warn('Failed to persist pool state after claim:', err));
    return availableUser.user;
  }

  /**
   * Release a user back to the pool
   */
  async releaseUser(userId: string, testId: string): Promise<void> {
    const pooledUser = Array.from(this.pool.values()).find(
      u => u.user.uid === userId && u.claimedBy === testId
    );

    if (!pooledUser) {
      console.warn(`Attempted to release user ${userId} not claimed by ${testId}`);
      return;
    }

    // Reset user state
    pooledUser.inUse = false;
    pooledUser.claimedBy = undefined;
    pooledUser.claimedAt = undefined;

    console.log(`User ${pooledUser.user.email} released by test ${testId}`);
    
    // Update persistent pool state (fire and forget to avoid blocking test execution)
    this.savePoolToDisk().catch(err => console.warn('Failed to persist pool state after release:', err));
  }

  /**
   * Find an available user in the pool
   */
  private findAvailableUser(): PooledUser | undefined {
    const now = new Date();
    
    for (const pooledUser of this.pool.values()) {
      // Check if user is available
      if (!pooledUser.inUse) {
        return pooledUser;
      }
      
      // Check if user claim has expired
      if (pooledUser.claimedAt) {
        const claimDuration = now.getTime() - pooledUser.claimedAt.getTime();
        if (claimDuration > this.config.maxClaimDuration) {
          console.warn(`Force-releasing expired user claim: ${pooledUser.user.email}`);
          pooledUser.inUse = false;
          pooledUser.claimedBy = undefined;
          pooledUser.claimedAt = undefined;
          return pooledUser;
        }
      }
    }
    
    return undefined;
  }

  /**
   * Create a new pooled user
   */
  private async createPooledUser(id: string): Promise<PooledUser> {
    if (!this.creationPage) {
      throw new Error('User pool not initialized - call preWarmPool() first');
    }

    // Create user directly without going through AuthenticationWorkflow to avoid page object issues
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const processId = process.pid || Math.floor(Math.random() * 10000);
    const uniqueId = `${timestamp}-${randomSuffix}-${processId}-${id}`;
    
    const displayName = `Pool User ${uniqueId}`;
    const email = `pool-user-${uniqueId}@example.com`;
    const password = 'TestPassword123!';

    // Navigate to register page (or back to register if we're on dashboard)
    console.log(`Creating user ${id} - navigating to register page...`);
    await this.creationPage.goto('/register');
    await this.creationPage.waitForLoadState('networkidle');
    
    // Check if we're actually on the register page
    const currentUrl = this.creationPage.url();
    console.log(`Current URL: ${currentUrl}`);
    
    // Wait for form to be visible
    await this.creationPage.waitForSelector('input[placeholder="Enter your full name"]', { timeout: TIMEOUTS.EXTENDED * 2 });
    
    // Clear any existing form data and fill registration form
    await this.creationPage.fill('input[placeholder="Enter your full name"]', '');
    await this.creationPage.fill('input[placeholder="Enter your full name"]', displayName);
    
    await this.creationPage.fill('input[placeholder="Enter your email"]', '');
    await this.creationPage.fill('input[placeholder="Enter your email"]', email);
    
    await this.creationPage.fill('input[placeholder="Create a strong password"]', '');
    await this.creationPage.fill('input[placeholder="Create a strong password"]', password);
    
    await this.creationPage.fill('input[placeholder="Confirm your password"]', '');
    await this.creationPage.fill('input[placeholder="Confirm your password"]', password);
    
    // Ensure checkbox is checked
    await this.creationPage.check('input[type="checkbox"]');
    
    // Submit form
    await this.creationPage.click('button:has-text("Create Account")');
    
    // Wait for redirect to dashboard
    await this.creationPage.waitForURL(/\/dashboard/, { timeout: TIMEOUTS.EXTENDED * 2 });
    
    // Logout the user so the next user creation can work
    await this.creationPage.click('button:has-text("' + displayName + '")');
    await this.creationPage.waitForSelector('text=Sign out', { timeout: TIMEOUTS.EXTENDED });
    await this.creationPage.click('text=Sign out');
    
    // Wait for logout to complete - should redirect to login or home
    await this.creationPage.waitForURL(url => !url.toString().includes('/dashboard'), { timeout: TIMEOUTS.EXTENDED * 2 });
    
    const user: BaseUser = {
      uid: uniqueId,
      email,
      displayName
    };
    
    const pooledUser: PooledUser = {
      id,
      user,
      inUse: false
    };

    this.pool.set(id, pooledUser);
    console.log(`✅ Created pool user: ${email}`);
    return pooledUser;
  }

  /**
   * Clean up all users in the pool
   */
  async cleanupPool(): Promise<void> {
    console.log(`Cleaning up user pool with ${this.pool.size} users`);
    this.pool.clear();
    
    // Remove persistent pool file
    try {
      const fs = await import('fs');
      const poolPath = await UserPool.getPoolFilePath();
      
      if (fs.existsSync(poolPath)) {
        fs.unlinkSync(poolPath);
        console.log(`✅ Removed persistent pool file at ${poolPath}`);
      }
    } catch (error) {
      console.warn('Failed to remove pool file:', error);
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    const total = this.pool.size;
    const inUse = Array.from(this.pool.values()).filter(u => u.inUse).length;
    const available = total - inUse;
    
    return { total, inUse, available };
  }

  /**
   * Save pool state to disk
   */
  private async savePoolToDisk(): Promise<void> {
    try {
      const fs = await import('fs');
      const poolPath = await UserPool.getPoolFilePath();
      
      const poolData = {
        users: Array.from(this.pool.entries()).map(([id, pooledUser]) => ({
          id,
          pooledUser: {
            ...pooledUser,
            claimedAt: pooledUser.claimedAt?.toISOString()
          }
        })),
        config: this.config
      };
      
      fs.writeFileSync(poolPath, JSON.stringify(poolData, null, 2));
      console.log(`💾 Saved ${this.pool.size} users to pool file at ${poolPath}`);
    } catch (error) {
      console.warn('Failed to save pool to disk:', error);
    }
  }

  /**
   * Load pool state from disk
   */
  private async loadPoolFromDisk(): Promise<void> {
    try {
      const fs = await import('fs');
      const poolPath = await UserPool.getPoolFilePath();
      
      console.log(`Looking for pool file at: ${poolPath}`);
      
      if (fs.existsSync(poolPath)) {
        const poolData = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
        
        // Restore pool users
        for (const { id, pooledUser } of poolData.users) {
          const restoredUser = {
            ...pooledUser,
            claimedAt: pooledUser.claimedAt ? new Date(pooledUser.claimedAt) : undefined
          };
          this.pool.set(id, restoredUser);
        }
        
        console.log(`✅ Loaded ${this.pool.size} users from persistent pool at ${poolPath}`);
      } else {
        console.log(`⚠️ No pool file found at ${poolPath}`);
      }
    } catch (error) {
      console.warn('Failed to load pool from disk:', error);
    }
  }
}

// Global pool instance
let globalUserPool: UserPool | undefined;
let globalUserPoolInitialized = false;

export async function getUserPool(): Promise<UserPool> {
  if (!globalUserPool) {
    globalUserPool = new UserPool();
  }
  
  // Initialize only once per process
  if (!globalUserPoolInitialized) {
    await globalUserPool.initialize();
    globalUserPoolInitialized = true;
  }
  
  return globalUserPool;
}

export function resetUserPool(): void {
  globalUserPool = undefined;
  globalUserPoolInitialized = false;
}