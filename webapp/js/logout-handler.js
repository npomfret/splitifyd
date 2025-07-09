import { logger } from './utils/logger.js';

// Shared logout functionality
window.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await window.authManager.logout();
                window.location.href = 'index.html';
            } catch (error) {
                logger.error('Logout failed:', error);
            }
        });
    }
});
