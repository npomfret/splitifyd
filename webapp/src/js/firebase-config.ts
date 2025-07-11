import { logger } from './utils/logger.js';
import { loadEnvironment, getEnvironment, isLocalEnvironment } from './utils/env-loader.js';
import type { 
    FirebaseConfig, 
    FirebaseApp, 
    FirebaseAuth, 
    FirebaseUser,
    FirebaseError,
    FirebaseConfigManagerConfig 
} from './types/global.js';

// Firebase SDK module types
interface FirebaseAppModule {
    initializeApp(config: FirebaseConfig): FirebaseApp;
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

class FirebaseConfigManager {
    private config: FirebaseConfigManagerConfig | null = null;
    private initialized: boolean = false;
    private app: FirebaseApp | null = null;
    private auth: FirebaseAuth | null = null;
    private emulatorConnected: boolean = false;

    async initialize(): Promise<FirebaseConfigManagerConfig | null> {
        if (this.initialized) {
            return this.config;
        }

        try {
            // Load environment configuration first
            await loadEnvironment();
            
            const firebaseConfig = await this.fetchFirebaseConfig();
            
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
            
            this.app = initializeApp(firebaseConfig);
            this.auth = getAuth(this.app);
            
            const env = getEnvironment();
            if (env.FIREBASE_EMULATOR_HOST && env.FIREBASE_AUTH_EMULATOR_PORT && !this.emulatorConnected) {
                try {
                    const authEmulatorUrl = `http://${env.FIREBASE_EMULATOR_HOST}:${env.FIREBASE_AUTH_EMULATOR_PORT}`;
                    logger.log(`🔧 Connecting to Firebase Auth emulator at ${authEmulatorUrl}`);
                    connectAuthEmulator(this.auth, authEmulatorUrl, { disableWarnings: true });
                    this.emulatorConnected = true;
                } catch (error) {
                    const firebaseError = error as FirebaseError;
                    if (firebaseError.code === 'auth/emulator-config-failed') {
                        logger.log('Auth emulator already connected, skipping');
                        this.emulatorConnected = true;
                    } else {
                        throw error;
                    }
                }
            }
            
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
            logger.log('Firebase initialized successfully');
            
            return this.config;
            
        } catch (error) {
            logger.error('Failed to initialize Firebase:', error);
            this.initialized = false;
            throw new Error(`Firebase initialization failed: ${(error as Error).message}`);
        }
    }

    private async fetchFirebaseConfig(): Promise<FirebaseConfig> {
        const configUrl = this.getConfigUrl();
        logger.log('Fetching Firebase configuration from:', configUrl);
        
        try {
            const response = await fetch(configUrl);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message);
            }
            
            const firebaseConfig = await response.json() as FirebaseConfig & { formDefaults?: any; warningBanner?: string };
            logger.log('Firebase configuration loaded:', { projectId: firebaseConfig.projectId });
            
            const env = getEnvironment();
            this.config = {
                firebaseConfig,
                apiUrl: env.API_BASE_URL,
                isLocal: isLocalEnvironment(),
                formDefaults: firebaseConfig.formDefaults,
                warningBanner: firebaseConfig.warningBanner
            };
            
            return firebaseConfig;
            
        } catch (error) {
            throw new Error(`Firebase configuration fetch failed: ${(error as Error).message}. Ensure Firebase emulator is running at ${configUrl}`);
        }
    }


    private getConfigUrl(): string {
        const env = getEnvironment();
        return `${env.API_BASE_URL}/config`;
    }


    getConfig(): FirebaseConfigManagerConfig {
        if (!this.config) {
            throw new Error('Firebase not initialized. Call initialize() first.');
        }
        return this.config;
    }

    getApiUrl(): string {
        return this.getConfig().apiUrl;
    }

    isInitialized(): boolean {
        return this.initialized;
    }


    getFormDefaults(): any {
        return this.config?.formDefaults;
    }

    getWarningBanner(): string | undefined {
        return this.config?.warningBanner;
    }
}

export const firebaseConfigManager = new FirebaseConfigManager();

firebaseConfigManager.initialize().catch((error: Error) => {
    logger.error('Failed to initialize Firebase on startup:', error);
});