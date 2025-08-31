import { beforeAll, afterAll, vi } from 'vitest';

// Mock firebase-functions logger to use console in tests
vi.mock('firebase-functions', () => ({
    logger: {
        info: console.log,
        warn: console.log,
        error: console.log,
    }
}));

beforeAll(() => {
    // Global test setup
});

afterAll(() => {
    // Global cleanup
});
