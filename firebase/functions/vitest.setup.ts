import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
    // Global test setup
    process.env.GCLOUD_PROJECT = 'splitifyd';
});

afterAll(() => {
    // Global cleanup
});
