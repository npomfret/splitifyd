import { ApiDriver } from './ApiDriver';
import { PooledTestUser } from '@splitifyd/shared';

/**
 * Borrows test users from the pool with automatic cleanup.
 * Users are automatically returned to the pool after each test via global afterEach hook.
 *
 * @param count Number of users to borrow
 * @returns Promise<User[]> Array of borrowed users
 *
 * @example
 * ```typescript
 * import { borrowTestUsers } from '@splitifyd/test-support';
 *
 * describe('My Test', () => {
 *   let users: AuthenticatedFirebaseUser[];
 *
 *   beforeEach(async () => {
 *     users = await borrowTestUsers(2); // Automatic cleanup after each test!
 *   });
 *
 *   test('my test', async () => {
 *     // Use users[0], users[1]
 *   });
 * });
 * ```
 */
export async function borrowTestUsers(count: number): Promise<PooledTestUser[]> {
    const apiDriver = new ApiDriver();
    const users: PooledTestUser[] = [];

    // Borrow users sequentially to avoid Firebase emulator multi-instance issues
    for (let i = 0; i < count; i++) {
        const user = await apiDriver.borrowTestUser();
        users.push(user);
    }

    // Register users for automatic cleanup via global afterEach hook
    if (typeof (global as any).__registerTestUsers === 'function') {
        const testId = `${Date.now()}-${Math.random()}`;
        (global as any).__registerTestUsers(testId, users, apiDriver);
    }

    return users;
}
