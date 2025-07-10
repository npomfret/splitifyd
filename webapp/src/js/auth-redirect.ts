import { authManager } from './auth.js';

// Authentication redirect logic for index.html
window.addEventListener('DOMContentLoaded', () => {
    // Check if user is already authenticated
    if (authManager && authManager.isAuthenticated()) {
        // Check if there's a pending join group request
        const urlParams = new URLSearchParams(window.location.search);
        const joinLinkId = urlParams.get('join');
        
        if (joinLinkId) {
            // Redirect to join group page
            window.location.href = `join-group.html?linkId=${joinLinkId}`;
        } else {
            // Otherwise redirect to dashboard
            window.location.href = 'dashboard.html';
        }
        return;
    }
});