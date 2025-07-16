import { authManager } from './auth.js';
import { ROUTES } from './routes.js';

// Authentication redirect logic for index.html
window.addEventListener('DOMContentLoaded', () => {
    // Check if user is already authenticated
    if (authManager && authManager.isAuthenticated()) {
        // Check if there's a pending join group request
        const urlParams = new URLSearchParams(window.location.search);
        const joinLinkId = urlParams.get('join');
        
        if (joinLinkId) {
            // Redirect to join group page
            window.location.href = `${ROUTES.JOIN_GROUP}?linkId=${joinLinkId}`;
        } else {
            // Otherwise redirect to dashboard
            window.location.href = ROUTES.DASHBOARD;
        }
        return;
    }
});