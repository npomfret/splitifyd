import { ApiDriver } from '@splitifyd/test-support';
import { PooledTestUser } from '@splitifyd/shared';

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
        // console.log('🔧 User pool initialized (remote API mode)');
    }

    static resetInstance(): void {
        UserPool.instance = undefined;
    }

    /**
     * Claim a user from the remote API pool.
     */
    async claimUser(_browser: any): Promise<PooledTestUser> {
        const poolUser = await this.apiDriver.borrowTestUser();
        this.usersInUse.add(poolUser.uid);
        return poolUser;
    }

    /**
     * Release a user back to the remote API pool with retry logic.
     */
    async releaseUser(user: PooledTestUser): Promise<void> {
        if (!this.usersInUse.has(user.uid)) {
            console.log(`⚠️ Attempted to release unknown user: ${user.email}`);
            return;
        }

        this.usersInUse.delete(user.uid);

        await this.apiDriver.returnTestUser(user.email);
        // console.log(`🏊 Returned pool user: ${user.email}`);
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
