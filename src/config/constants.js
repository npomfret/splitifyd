// Application constants
export const APP_CONFIG = {
    // Sync settings
    SYNC_INTERVAL: 5000, // 5 seconds
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    REQUEST_TIMEOUT: 8000, // 8 seconds
    
    // Storage settings
    MAX_PROJECTS: 10,
    
    // Toast duration
    TOAST_DURATION: 3000,
    
    // localStorage keys
    STORAGE_KEYS: {
        PROJECTS: 'splitifyd_projects',
        ACTIVE_PROJECT: 'splitifyd_active',
        // Legacy keys
        PROJECT_ID: 'splitifyd_project_id',
        USER_ID: 'splitifyd_user_id'
    }
};

// JSONBin.io configuration
export const JSONBIN_CONFIG = {
    API_KEY: '$2a$10$hm7J97lLcGQCE9NGfef8ReIVgLddJrgsro7DJE14.vYdD.b01my1e',
    BASE_URL: 'https://api.jsonbin.io/v3'
};