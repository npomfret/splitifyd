class Config {
    constructor() {
        this._configPromise = null;
    }

    async _ensureInitialized() {
        if (!this._configPromise) {
            this._configPromise = window.firebaseConfigManager.initialize();
        }
        return this._configPromise;
    }

    async getApiUrl() {
        await this._ensureInitialized();
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
        await this._ensureInitialized();
        return window.firebaseConfigManager.getConfig();
    }
}

const config = new Config();