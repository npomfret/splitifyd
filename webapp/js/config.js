class Config {
    constructor() {
    }

    async getApiUrl() {
        if (!window.firebaseConfigManager.isInitialized()) {
            await window.firebaseConfigManager.initialize();
        }
        return window.firebaseConfigManager.getApiUrl();
    }

    getApiUrlSync() {
        if (window.firebaseConfigManager.isInitialized()) {
            return window.firebaseConfigManager.getApiUrl();
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
        if (!window.firebaseConfigManager.isInitialized()) {
            await window.firebaseConfigManager.initialize();
        }
        return window.firebaseConfigManager.getConfig();
    }
}

const config = new Config();