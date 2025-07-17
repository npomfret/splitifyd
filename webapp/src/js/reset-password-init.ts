import { ResetPasswordComponent } from './components/ResetPasswordComponent.js';
import { WarningBannerComponent } from './components/warning-banner.js';
import { AppInit } from './app-init.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Set up API base URL before loading components that use auth
    AppInit.setupApiBaseUrl();
    
    // Initialize warning banner from config
    const { firebaseConfigManager } = await import('./firebase-config-manager.js');
    try {
        const warningBannerConfig = await firebaseConfigManager.getWarningBanner();
        if (warningBannerConfig?.message) {
            const banner = WarningBannerComponent.createGlobalBanner({
                message: warningBannerConfig.message,
                type: 'warning',
                dismissible: true
            });
            banner.show();
        }
    } catch (error) {
        // Warning banner is optional, continue silently
    }
    
    const appRoot = document.getElementById('app-root');
    if (!appRoot) {
        throw new Error('app-root element not found');
    }

    const resetPasswordComponent = new ResetPasswordComponent();
    resetPasswordComponent.mount(appRoot);
});