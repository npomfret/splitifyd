class Config {
    constructor() {
        this.env = this._detectEnvironment();
    }

    _detectEnvironment() {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        }
        return 'production';
    }

    getApiUrl() {
        if (this.env === 'development') {
            return `http://${window.location.hostname}:5001/splitifyd/us-central1/api`;
        }
        return 'https://api-po437q3l5q-uc.a.run.app';
    }
}

const config = new Config();