import { AppInit } from './app-init.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // Load all required modules in parallel
    await Promise.all([
        import('./firebase-init.js'),
        import('./firebase-config-manager.js'),
        import('./api.js'),
        import('./auth.js'),
        import('./logout-handler.js'),
        import('./add-expense.js')
    ]);
    
    // Initialize warning banner from config
    const { firebaseConfigManager } = await import('./firebase-config-manager.js');
    const warningBannerConfig = await firebaseConfigManager.getWarningBanner();
    if (warningBannerConfig?.message) {
        const warningBanner = document.getElementById('warningBanner');
        if (warningBanner) {
            warningBanner.textContent = warningBannerConfig.message;
            warningBanner.classList.remove('hidden');
        }
    }
    
    // Import and initialize add expense page after all scripts are loaded
    const { initializeAddExpensePage } = await import('./add-expense.js');
    await initializeAddExpensePage();
    
    // Initialize logout button
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            const { authManager } = await import('./auth.js');
            authManager.logout();
        });
    }
});