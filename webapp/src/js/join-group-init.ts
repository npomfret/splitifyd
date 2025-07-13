import { logger } from './utils/logger.js';
import { JoinGroupComponent } from './components/JoinGroupComponent.js';

document.addEventListener('DOMContentLoaded', () => {
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