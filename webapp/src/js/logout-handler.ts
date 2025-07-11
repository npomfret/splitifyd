import { authManager } from './auth.js';
window.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton') as HTMLButtonElement | null;
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            authManager.logout();
        });
    }
});