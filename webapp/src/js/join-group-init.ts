import { logger } from './utils/logger.js';
import { AppInit } from './app-init.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Set up API base URL before loading auth scripts
    AppInit.setupApiBaseUrl();
    // TODO: Convert join-group page to functional approach
    console.log('Join group page needs to be converted to functional approach');
    
    // Load required modules
    await Promise.all([
        import('./firebase-init.js'),
        import('./api.js'),
        import('./auth.js'),
        import('./logout-handler.js')
    ]);
});