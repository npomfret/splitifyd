import { logger } from './logger.js';

export interface Environment {
    API_BASE_URL: string;
    FIREBASE_EMULATOR_HOST: string;
    FIREBASE_AUTH_EMULATOR_PORT: string;
    FIREBASE_FUNCTIONS_PORT: string;
    FIREBASE_HOSTING_PORT: string;
}

let environment: Environment | null = null;

export async function loadEnvironment(): Promise<Environment> {
    if (environment) {
        return environment;
    }

    // Determine environment based on hostname
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const envName = isLocal ? 'development' : 'production';
    
    try {
        const response = await fetch(`/.env.${envName}`);
        if (!response.ok) {
            throw new Error(`Failed to load .env.${envName} file: ${response.status}`);
        }
        
        const envText = await response.text();
        const env: Partial<Environment> = {};
        
        // Parse the .env file
        const lines = envText.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const [key, ...valueParts] = trimmedLine.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').trim();
                    env[key.trim() as keyof Environment] = value;
                }
            }
        }
        
        // Set defaults for missing values
        environment = {
            API_BASE_URL: env.API_BASE_URL || (isLocal ? 'http://localhost:6001/splitifyd/us-central1/api' : '/api'),
            FIREBASE_EMULATOR_HOST: env.FIREBASE_EMULATOR_HOST || (isLocal ? 'localhost' : ''),
            FIREBASE_AUTH_EMULATOR_PORT: env.FIREBASE_AUTH_EMULATOR_PORT || (isLocal ? '9199' : ''),
            FIREBASE_FUNCTIONS_PORT: env.FIREBASE_FUNCTIONS_PORT || (isLocal ? '6001' : ''),
            FIREBASE_HOSTING_PORT: env.FIREBASE_HOSTING_PORT || (isLocal ? '6002' : '')
        };
        
        logger.log(`Environment loaded: ${envName}`, environment);
        return environment;
        
    } catch (error) {
        logger.error('Failed to load environment configuration:', error);
        throw new Error(`Environment configuration failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export function getEnvironment(): Environment {
    if (!environment) {
        throw new Error('Environment not loaded. Call loadEnvironment() first.');
    }
    return environment;
}

export function isLocalEnvironment(): boolean {
    const hostname = window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
}