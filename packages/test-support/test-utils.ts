import {ApiDriver, type User} from './ApiDriver';

// Global registry for borrowed users
declare global {
    var borrowedUsers: Set<string> | undefined;
}

/**
 * Borrow users from the test pool with automatic cleanup.
 * Users are automatically returned to the pool when the process exits.
 *
 * @param userCount Number of users to borrow
 * @returns Promise that resolves to { driver, users }
 */
export async function borrowTestUsers(userCount: number): Promise<{ apiDriver: ApiDriver, driver: ApiDriver; users: User[] }> {
    const driver = new ApiDriver();

    // Initialize global cleanup if needed
    if (!global.borrowedUsers) {
        global.borrowedUsers = new Set();

        const cleanup = async () => {
            if (global.borrowedUsers && global.borrowedUsers.size > 0) {
                console.log(`🧹 Returning ${global.borrowedUsers.size} borrowed users to pool...`);

                const cleanupPromises = Array.from(global.borrowedUsers).map(email =>
                    driver.returnTestUser(email).catch(err =>
                        console.warn(`Warning: Failed to return user ${email}:`, err.message)
                    )
                );

                await Promise.all(cleanupPromises);
                global.borrowedUsers.clear();
                console.log('✅ All users returned to pool');
            }
        };

        process.on('exit', cleanup);
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('beforeExit', cleanup);
    }

    // Borrow users from the remote pool
    console.log(`🏊 Borrowing ${userCount} users from remote pool...`);
    const users: User[] = [];

    for (let i = 0; i < userCount; i++) {
        const user = await driver.borrowTestUser();
        users.push(user);
        global.borrowedUsers.add(user.email);
        console.log(`✓ Borrowed user: ${user.email}`);
    }

    console.log(`🏊 Ready with ${users.length} users (${global.borrowedUsers.size} total borrowed)`);

    return {driver, users, apiDriver: driver};
}

/**
 * Manually return all borrowed users (useful for tests that want explicit control)
 */
export async function returnAllBorrowedUsers(): Promise<void> {
    if (global.borrowedUsers && global.borrowedUsers.size > 0) {
        const driver = new ApiDriver();
        await Promise.all(Array.from(global.borrowedUsers).map(email =>
            driver.returnTestUser(email).catch(err =>
                console.warn(`Warning: Failed to return user ${email}:`, err.message)
            )
        ));
        global.borrowedUsers.clear();
    }
}

/**
 * Get the count of currently borrowed users (useful for debugging)
 */
export function getBorrowedUserCount(): number {
    return global.borrowedUsers?.size || 0;
}