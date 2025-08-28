import { beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

beforeAll(() => {
    // Global test setup
    process.env.FUNCTIONS_EMULATOR = 'true';
    process.env.GCLOUD_PROJECT = 'splitifyd';
});

afterAll(() => {
    // Global cleanup
});
