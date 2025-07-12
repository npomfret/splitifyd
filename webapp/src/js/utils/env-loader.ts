import { logger } from './logger.js';

export interface Environment {
    API_BASE_URL: string;
    FIREBASE_EMULATOR_HOST: string;
    FIREBASE_AUTH_EMULATOR_PORT: string;
    FIREBASE_FUNCTIONS_PORT: string;
    FIREBASE_HOSTING_PORT: string;
}

declare const API_BASE_URL: string;
declare const FIREBASE_EMULATOR_HOST: string;
declare const FIREBASE_AUTH_EMULATOR_PORT: string;
declare const FIREBASE_FUNCTIONS_PORT: string;
declare const FIREBASE_HOSTING_PORT: string;

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export function getEnvironment(): Environment {
    const env: Environment = {
        API_BASE_URL: API_BASE_URL || (isLocal ? 'http://localhost:6001/splitifyd/us-central1/api' : '/api'),
        FIREBASE_EMULATOR_HOST: FIREBASE_EMULATOR_HOST || (isLocal ? 'localhost' : ''),
        FIREBASE_AUTH_EMULATOR_PORT: FIREBASE_AUTH_EMULATOR_PORT || (isLocal ? '9199' : ''),
        FIREBASE_FUNCTIONS_PORT: FIREBASE_FUNCTIONS_PORT || (isLocal ? '6001' : ''),
        FIREBASE_HOSTING_PORT: FIREBASE_HOSTING_PORT || (isLocal ? '6002' : '')
    };
    logger.log(`Environment loaded: ${isLocal ? 'development' : 'production'}`, env);
    return env;
}

export function isLocalEnvironment(): boolean {
    return isLocal;
}

// No need for loadEnvironment() anymore as variables are injected at build time
export async function loadEnvironment(): Promise<Environment> {
    return getEnvironment();
}
