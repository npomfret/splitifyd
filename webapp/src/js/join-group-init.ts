import { logger } from './utils/logger.js';
import { JoinGroupComponent } from './components/JoinGroupComponent.js';
import { AppInit } from './app-init.js';

document.addEventListener('DOMContentLoaded', () => {
    // Set up API base URL before loading auth scripts
    AppInit.setupApiBaseUrl();
    try {
        const appRoot = document.getElementById('app-root');
        if (!appRoot) {
            throw new Error('App root element not found');
        }

        const component = new JoinGroupComponent();
        component.mount(appRoot);
    } catch (error) {
        logger.error('Failed to initialize join group page:', error);
    }
});