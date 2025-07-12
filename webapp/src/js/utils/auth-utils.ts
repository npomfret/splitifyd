import { authManager } from '../auth.js';
import { MAX_AUTH_ATTEMPTS, AUTH_ATTEMPT_INTERVAL_MS } from '../constants.js';

/**
 * Waits for the authentication manager to be initialized and the user to be authenticated.
 * Throws an error if authentication fails after multiple attempts.
 */
export async function waitForAuthManager(): Promise<void> {
    let attempts = 0;
    
    while ((!authManager || !authManager.isAuthenticated()) && attempts < MAX_AUTH_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, AUTH_ATTEMPT_INTERVAL_MS));
        attempts++;
    }
    
    if (!authManager || !authManager.isAuthenticated()) {
        throw new Error('Authentication manager failed to initialize or user not authenticated');
    }
}