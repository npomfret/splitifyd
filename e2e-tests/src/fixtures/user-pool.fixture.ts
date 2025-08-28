import { TIMEOUTS } from '../config/timeouts';
import type { User as BaseUser } from '@splitifyd/shared';
import {generateNewUserDetails, generateShortId} from '../../../packages/test-support/test-helpers.ts';
import {LoginPage, RegisterPage, DashboardPage} from '../pages';
import { expect } from '@playwright/test';

let staticCount = 1;

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
    // Track active contexts to ensure cleanup
    private activeContexts: Set<any> = new Set();

    constructor() {
        // Enforce singleton pattern - only one UserPool per process
        if (UserPool.instance) {
            throw new Error('UserPool has already been instantiated! ' + 'Use getUserPool() to get the existing instance. ' + 'Multiple UserPool instances would cause user conflicts.');
        }

        // Register this as the singleton instance
        UserPool.instance = this;

        // Each worker starts with an empty pool and creates users on-demand
        console.log('🔧 User pool initialized (on-demand mode)');
        
        // Register cleanup on process exit to ensure contexts are closed
        process.on('exit', () => this.cleanup());
        process.on('SIGINT', () => this.cleanup());
        process.on('SIGTERM', () => this.cleanup());
    }
    
    /**
     * Cleanup all active contexts
     */
    private cleanup(): void {
        if (this.activeContexts.size > 0) {
            console.log(`⚠️ Cleaning up ${this.activeContexts.size} active contexts`);
            for (const context of this.activeContexts) {
                try {
                    context.close();
                } catch (error) {
                    // Ignore errors during cleanup
                }
            }
            this.activeContexts.clear();
        }
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
            user = await this.createUser(browser);
            // console.log(`✅ Created new user: ${user.email}`);
        }

        // Track that this user is in use
        this.usersInUse.add(user.uid);

        return user;
    }

    /**
     * Release a user back to the pool for reuse.
     * This is optional - tests don't have to return users.
     * Note: Users are not automatically logged out here since they may be
     * used immediately by another test that expects them to be logged in.
     * Authentication state management is handled by the test fixtures.
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
    private async createUser(browser: any): Promise<BaseUser> {
        // Use the same ID for both display name and email so they match
        const uniqueId = generateShortId();
        const {displayName, email, password} = generateNewUserDetails(`u${staticCount++}`);

        // Create a temporary context and page for user registration
        let tempContext: any = null;
        let tempPage: any = null;
        
        try {
            tempContext = await browser.newContext();
            // Track this context for cleanup
            this.activeContexts.add(tempContext);
            tempPage = await tempContext.newPage();

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
            // Create a temporary user object for better error reporting
            const tempUser: BaseUser = {
                uid: uniqueId,
                email,
                displayName,
            };

            // Use RegisterPage to properly navigate and fill form
            const registerPage = new RegisterPage(tempPage, tempUser);
            await registerPage.navigateToRegister();

            // Check for errors before proceeding
            if (consoleErrors.length > 0 || pageErrors.length > 0) {
                const errorMessage = `Registration page has errors:\n${consoleErrors.join('\n')}\n${pageErrors.join('\n')}`;
                throw new Error(errorMessage);
            }

            // Use the RegisterPage's encapsulated register method which handles everything:
            // - Filling all form fields
            // - Checking both required checkboxes
            // - Submitting the form
            // - Waiting for redirect to dashboard
            await registerPage.register(displayName, email, password);

            // Logout so the user can be used later using DashboardPage helper
            const dashboardPage = new DashboardPage(tempPage, tempUser);
            await dashboardPage.logout();  // This already waits for redirect to login page
        } finally {
            // Always close the page and context to avoid resource leaks
            // Close in reverse order of creation to prevent issues
            if (tempPage) {
                try {
                    await tempPage.close();
                } catch (error) {
                    console.log('Warning: Failed to close temp page:', error);
                }
            }
            if (tempContext) {
                try {
                    await tempContext.close();
                    // Remove from tracking after successful close
                    this.activeContexts.delete(tempContext);
                } catch (error) {
                    console.log('Warning: Failed to close temp context:', error);
                }
            }
        }

        return {
            uid: uniqueId,
            email,
            displayName,
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
