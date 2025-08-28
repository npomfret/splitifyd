import { UserPool, resetUserPool } from './user-pool.fixture';

describe('UserPool Singleton Pattern', () => {
    beforeEach(() => {
        // Reset before each test to ensure clean state
        resetUserPool();
    });

    afterEach(() => {
        // Clean up after each test
        resetUserPool();
    });

    it('should allow creating first instance', () => {
        expect(() => new UserPool()).not.toThrow();
    });

    it('should throw error when trying to create second instance', () => {
        // First instance should work
        const pool1 = new UserPool();
        expect(pool1).toBeDefined();

        // Second instance should throw
        expect(() => new UserPool()).toThrow('UserPool has already been instantiated! Use getUserPool() to get the existing instance. Multiple UserPool instances would cause user conflicts.');
    });

    it('should allow new instance after reset', () => {
        // First instance
        const pool1 = new UserPool();
        expect(pool1).toBeDefined();

        // Reset singleton
        resetUserPool();

        // Should allow new instance after reset
        expect(() => new UserPool()).not.toThrow();
    });

    it('should maintain singleton across getUserPool() calls', async () => {
        const { getUserPool } = await import('./user-pool.fixture');

        const pool1 = getUserPool();
        const pool2 = getUserPool();

        // Should be the same instance
        expect(pool1).toBe(pool2);
    });
});
