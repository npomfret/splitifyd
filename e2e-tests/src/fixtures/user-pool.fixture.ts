import type { RegisteredUser as BaseUser } from '@splitifyd/shared';
import { ApiDriver } from '@splitifyd/test-support';

/**
 * Thin wrapper around the remote test user pool API.
 * Provides a simple interface for e2e tests to borrow/return users.
 */
export class UserPool {
    private static instance: UserPool | undefined;
    private apiDriver: ApiDriver;
    private usersInUse: Set<string> = new Set(); // Track borrowed users

    constructor() {
        if (UserPool.instance) {
            throw new Error('UserPool has already been instantiated! Use getUserPool() to get the existing instance.');
        }
        
        UserPool.instance = this;
        this.apiDriver = new ApiDriver();
        console.log('🔧 User pool initialized (remote API mode)');
    }

    static resetInstance(): void {
        UserPool.instance = undefined;
    }

    /**
     * Claim a user from the remote API pool.
     */
    async claimUser(_browser: any): Promise<BaseUser> {
        const poolUser = await this.apiDriver.borrowTestUser();
        this.usersInUse.add(poolUser.uid);
        return poolUser;
    }

    /**
     * Release a user back to the remote API pool with retry logic.
     */
    async releaseUser(user: BaseUser): Promise<void> {
        if (!this.usersInUse.has(user.uid)) {
            console.log(`⚠️ Attempted to release unknown user: ${user.email}`);
            return;
        }

        this.usersInUse.delete(user.uid);
        
        // Return to API pool with retry logic
        await this.returnUserWithRetry(user.email);
        
        console.log(`🏊 Returned pool user: ${user.email}`);
    }

    /**
     * Return user with exponential backoff retry logic.
     */
    private async returnUserWithRetry(email: string, maxRetries = 3, baseDelay = 1000): Promise<void> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.apiDriver.returnTestUser(email);
                return; // Success!
            } catch (error: any) {
                const isLastAttempt = attempt === maxRetries;
                
                if (isLastAttempt) {
                    console.log(`❌ Failed to return user ${email} after ${maxRetries} attempts: ${error.message}`);
                    // Don't throw - we don't want to break the test, just log the failure
                    return;
                }
                
                const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`⏳ Retry ${attempt}/${maxRetries} for user ${email} in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
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
