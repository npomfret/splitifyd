import { ApiDriver, User } from './ApiDriver';
import { UserBuilder } from './builders';

/**
 * Manages a pool of test users for Firebase integration tests.
 * This class helps reduce test execution time by creating users once
 * and reusing them across multiple tests, rather than creating new users
 * for each test case.
 * 
 * Note: This is specifically for Firebase integration tests, not E2E tests.
 */
export class FirebaseIntegrationTestUserPool {
    private pool: User[] = [];
    private driver: ApiDriver;
    private poolSize: number;
    private initialized = false;

    constructor(driver: ApiDriver, poolSize: number = 5) {
        this.driver = driver;
        this.poolSize = poolSize;
    }

    /**
     * Initialize the user pool by creating the specified number of users.
     * This should be called in beforeAll() hooks.
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        const userPromises: Promise<User>[] = [];
        for (let i = 0; i < this.poolSize; i++) {
            userPromises.push(this.driver.createUser(new UserBuilder().build()));
        }
        
        this.pool = await Promise.all(userPromises);
        this.initialized = true;
    }

    /**
     * Get a specified number of users from the pool.
     * @param count Number of users to retrieve
     * @throws Error if requesting more users than available in the pool
     */
    getUsers(count: number): User[] {
        if (!this.initialized) {
            throw new Error('User pool not initialized. Call initialize() in beforeAll()');
        }
        
        if (count > this.pool.length) {
            throw new Error(`Requested ${count} users but pool only has ${this.pool.length}. Consider increasing pool size.`);
        }
        
        return this.pool.slice(0, count);
    }

    /**
     * Get a single user from the pool at the specified index.
     * @param index The index of the user to retrieve (0-based)
     */
    getUser(index: number = 0): User {
        if (!this.initialized) {
            throw new Error('User pool not initialized. Call initialize() in beforeAll()');
        }
        
        if (index >= this.pool.length) {
            throw new Error(`Requested user at index ${index} but pool only has ${this.pool.length} users`);
        }
        
        return this.pool[index];
    }

    /**
     * Get the size of the pool.
     */
    size(): number {
        return this.pool.length;
    }
}