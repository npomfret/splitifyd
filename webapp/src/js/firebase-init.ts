import { logger } from './utils/logger.js';
import { firebaseConfigManager as configManager } from './firebase-config-manager.js';
import type { 
    FirebaseApp, 
    FirebaseAuth, 
    FirebaseUser,
    FirebaseError
} from './types/global.js';
import type { AppConfiguration } from './types/config.types.js';

// Firebase SDK module types
interface FirebaseAppModule {
    initializeApp(config: any): FirebaseApp;
}

interface FirebaseAuthModule {
    getAuth(app: FirebaseApp): FirebaseAuth;
    connectAuthEmulator(auth: FirebaseAuth, url: string, options?: { disableWarnings?: boolean }): void;
    signInWithEmailAndPassword(auth: FirebaseAuth, email: string, password: string): Promise<any>;
    createUserWithEmailAndPassword(auth: FirebaseAuth, email: string, password: string): Promise<any>;
    signOut(auth: FirebaseAuth): Promise<void>;
    onAuthStateChanged(auth: FirebaseAuth, callback: (user: FirebaseUser | null) => void): () => void;
    updateProfile(user: FirebaseUser, profile: { displayName?: string; photoURL?: string }): Promise<void>;
    sendPasswordResetEmail(auth: FirebaseAuth, email: string): Promise<void>;
}

interface FirebaseAuthService {
    signInWithEmailAndPassword(email: string, password: string): Promise<any>;
    createUserWithEmailAndPassword(email: string, password: string): Promise<any>;
    updateProfile(user: any, profile: { displayName: string }): Promise<void>;
    sendPasswordResetEmail(email: string): Promise<void>;
    onAuthStateChanged(callback: (user: any) => void): () => void;
    getCurrentUser(): any;
    signOut(): Promise<void>;
}

export let firebaseAuthInstance: FirebaseAuthService | null = null;

export function isFirebaseInitialized(): boolean {
    return firebaseAuthInstance !== null;
}

class FirebaseInitializer {
    private app: FirebaseApp | null = null;
    private auth: FirebaseAuth | null = null;
    private emulatorConnected: boolean = false;
    private initialized: boolean = false;

    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            // Fetch configuration from API
            const config = await configManager.getConfig();
            
            // @ts-ignore - Dynamic import from CDN
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            // @ts-ignore - Dynamic import from CDN
            const firebaseAuthModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { 
                getAuth, 
                connectAuthEmulator,
                signInWithEmailAndPassword,
                createUserWithEmailAndPassword,
                signOut,
                onAuthStateChanged,
                updateProfile,
                sendPasswordResetEmail
            } = firebaseAuthModule;
            
            // Initialize Firebase with config from API
            this.app = initializeApp(config.firebase);
            this.auth = getAuth(this.app);
            
            // Connect to emulators if in development
            if (config.environment.isEmulator && config.environment.emulatorPorts?.auth && !this.emulatorConnected) {
                try {
                    const authEmulatorUrl = `http://localhost:${config.environment.emulatorPorts.auth}`;
                    connectAuthEmulator(this.auth, authEmulatorUrl, { disableWarnings: true });
                    this.emulatorConnected = true;
                    // Connected to emulator successfully
                } catch (error) {
                    const firebaseError = error as FirebaseError;
                    if (firebaseError.code === 'auth/emulator-config-failed') {
                        this.emulatorConnected = true;
                    } else {
                        throw error;
                    }
                }
            }
            
            // Store API base URL globally for backward compatibility
            // This will be removed in future phases
            (window as any).__API_BASE_URL__ = config.api.baseUrl;
            
            // Create auth service instance
            firebaseAuthInstance = {
                signInWithEmailAndPassword: (email: string, password: string) => 
                    signInWithEmailAndPassword(this.auth!, email, password),
                createUserWithEmailAndPassword: (email: string, password: string) => 
                    createUserWithEmailAndPassword(this.auth!, email, password),
                updateProfile: (user: any, profile: { displayName: string }) => updateProfile(user, profile),
                signOut: () => signOut(this.auth!),
                onAuthStateChanged: (callback: (user: any) => void) => onAuthStateChanged(this.auth!, callback),
                getCurrentUser: () => this.auth!.currentUser,
                sendPasswordResetEmail: (email: string) => sendPasswordResetEmail(this.auth!, email)
            };
            
            this.initialized = true;
            // Firebase initialized successfully
            
        } catch (error) {
            logger.error('Failed to initialize Firebase:', error);
            this.initialized = false;
            throw new Error(`Firebase initialization failed: ${(error as Error).message}`);
        }
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    getApp(): FirebaseApp | null {
        return this.app;
    }

    getAuth(): FirebaseAuth | null {
        return this.auth;
    }
}

export const firebaseInitializer = new FirebaseInitializer();

// For backward compatibility - expose old firebaseConfigManager interface
export const firebaseConfigManager = {
    async initialize() {
        // Return config without re-initializing Firebase
        // Firebase initialization is handled by AppInit
        return await this.getConfig();
    },
    async getConfig() {
        const config = await configManager.getConfig();
        return {
            firebaseConfig: config.firebase,
            apiUrl: config.api.baseUrl,
            isLocal: config.environment.isDevelopment || config.environment.isEmulator,
            formDefaults: config.formDefaults,
            warningBanner: config.environment.warningBanner?.message
        };
    },
    getApiUrl() {
        return configManager.getApiBaseUrl();
    },
    isInitialized() {
        return firebaseInitializer.isInitialized();
    },
    async getFormDefaults() {
        return await configManager.getFormDefaults();
    },
    async getWarningBanner() {
        const banner = await configManager.getWarningBanner();
        return banner?.message;
    }
};

// Note: Firebase initialization is handled by app-init.ts or when first needed
// This prevents double initialization and improves startup performance