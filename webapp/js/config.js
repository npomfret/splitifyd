import { firebaseConfigManager } from './firebase-config.js';

class Config {
    constructor() {
    }

    async getApiUrl() {
        if (!firebaseConfigManager.isInitialized()) {
            await firebaseConfigManager.initialize();
        }
        return firebaseConfigManager.getApiUrl();
    }

    getApiUrlSync() {
        if (firebaseConfigManager.isInitialized()) {
            return firebaseConfigManager.getApiUrl();
        }
        
        const hostname = window.location.hostname;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
        
        if (isLocal) {
            return `http://${hostname}:5001/splitifyd/us-central1/api`;
        }
        
        return `${window.location.protocol}//${window.location.host}/api`;
    }

    isLocalEnvironment() {
        const hostname = window.location.hostname;
        return hostname === 'localhost' || hostname === '127.0.0.1';
    }

    async getConfig() {
        if (!firebaseConfigManager.isInitialized()) {
            await firebaseConfigManager.initialize();
        }
        return firebaseConfigManager.getConfig();
    }
}

export const config = new Config();