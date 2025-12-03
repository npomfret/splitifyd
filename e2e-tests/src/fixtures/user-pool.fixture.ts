import { PooledTestUser } from '@billsplit-wl/shared';
import { ApiDriver } from '@billsplit-wl/test-support';

/**
 * Thin wrapper around the remote test user pool API.
 * Provides a simple interface for e2e tests to borrow/return users.
 */
export class UserPool {
    private static instance: UserPool | undefined;
    private apiDriver: ApiDriver;
    private usersInUse: Set<string> = new Set(); // Track borrowed users

    private constructor(apiDriver: ApiDriver) {
        this.apiDriver = apiDriver;
    }

    static async create(): Promise<UserPool> {
        if (UserPool.instance) {
            return UserPool.instance;
        }

        const apiDriver = await ApiDriver.create();
        UserPool.instance = new UserPool(apiDriver);
        return UserPool.instance;
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
    }
}

// Global pool instance per worker process
let globalUserPool: UserPool | undefined;

/**
 * Get or create the user pool for this worker.
 * Each worker gets its own pool instance.
 */
export async function getUserPool(): Promise<UserPool> {
    if (!globalUserPool) {
        globalUserPool = await UserPool.create();
    }
    return globalUserPool;
}
