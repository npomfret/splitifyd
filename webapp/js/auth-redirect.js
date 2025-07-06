// Authentication redirect logic for index.html
window.addEventListener('DOMContentLoaded', () => {
    // Check if user is already authenticated and redirect to dashboard
    if (window.authManager && window.authManager.isAuthenticated()) {
        window.location.href = 'dashboard.html';
        return;
    }
});