import { logger } from './utils/logger.js';
import { authManager } from './auth.js';

// Shared logout functionality
window.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await authManager.logout();
                window.location.href = 'index.html';
            } catch (error) {
                logger.error('Logout failed:', error);
            }
        });
    }
});
