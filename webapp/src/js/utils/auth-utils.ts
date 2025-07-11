import { authManager } from '../auth.js';

/**
 * Waits for the authentication manager to be initialized and the user to be authenticated.
 * Throws an error if authentication fails after multiple attempts.
 */
export async function waitForAuthManager(): Promise<void> {
    const maxAttempts = 50;
    let attempts = 0;
    
    while ((!authManager || !authManager.isAuthenticated()) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!authManager || !authManager.isAuthenticated()) {
        throw new Error('Authentication manager failed to initialize or user not authenticated');
    }
}