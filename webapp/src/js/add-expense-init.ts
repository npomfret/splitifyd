import { AppInit } from './app-init.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Set up API base URL before loading any other scripts
    AppInit.setupApiBaseUrl();
    
    // Load all required modules in parallel
    await Promise.all([
        import('./firebase-init.js'),
        import('./firebase-config-manager.js'),
        import('./api.js'),
        import('./auth.js'),
        import('./logout-handler.js')
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
    
    // TODO: Convert add-expense page to functional approach
    console.info('Add expense page needs to be converted to functional approach');
});