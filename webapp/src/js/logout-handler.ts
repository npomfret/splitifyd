import { logger } from './utils/logger.js';

// Shared logout functionality that doesn't import authManager to avoid duplicate instances
window.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton') as HTMLButtonElement | null;
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                // Clear auth tokens directly instead of importing authManager
                localStorage.removeItem('splitifyd_auth_token');
                localStorage.removeItem('userId');
                
                // Sign out from Firebase if available
                if (window.firebaseAuth && window.firebaseAuth.signOut) {
                    await window.firebaseAuth.signOut();
                }
                
                window.location.href = 'index.html';
            } catch (error) {
                logger.error('Logout failed:', error);
            }
        });
    }
});