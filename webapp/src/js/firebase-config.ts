import { logger } from './utils/logger.js';
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
            
            if (this.isLocalEnvironment() && !this.emulatorConnected) {
                try {
                    const authPort = this.getLocalAuthPort();
                    logger.log(`🔧 Connecting to Firebase Auth emulator at localhost:${authPort}`);
                    connectAuthEmulator(this.auth, `http://localhost:${authPort}`, { disableWarnings: true });
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
            
            this.config = {
                firebaseConfig,
                apiUrl: this.getApiUrlForProject(firebaseConfig.projectId),
                isLocal: this.isLocalEnvironment(),
                formDefaults: firebaseConfig.formDefaults,
                warningBanner: firebaseConfig.warningBanner
            };
            
            return firebaseConfig;
            
        } catch (error) {
            throw new Error(`Firebase configuration fetch failed: ${(error as Error).message}. Ensure Firebase emulator is running at ${configUrl}`);
        }
    }

    private isLocalEnvironment(): boolean {
        const hostname = window.location.hostname;
        return hostname === 'localhost' || hostname === '127.0.0.1';
    }

    private getConfigUrl(): string {
        const localHost = window.location.hostname;
        const LOCAL_FUNCTIONS_PORT = this.getLocalFunctionsPort();
        
        if (this.isLocalEnvironment()) {
            return `http://${localHost}:${LOCAL_FUNCTIONS_PORT}/splitifyd/us-central1/api/config`;
        }
        
        const protocol = window.location.protocol;
        const host = window.location.host;
        return `${protocol}//${host}/api/config`;
    }

    private getApiUrlForProject(projectId: string = 'splitifyd'): string {
        const localHost = window.location.hostname;
        const LOCAL_FUNCTIONS_PORT = this.getLocalFunctionsPort();
        
        if (this.isLocalEnvironment()) {
            return `http://${localHost}:${LOCAL_FUNCTIONS_PORT}/${projectId}/us-central1/api`;
        }
        
        const protocol = window.location.protocol;
        const host = window.location.host;
        return `${protocol}//${host}/api`;
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

    private getLocalFunctionsPort(): number {
        const hostingPort = parseInt(window.location.port || '5002');
        return hostingPort === 5002 ? 5001 : hostingPort - 1;
    }

    private getLocalAuthPort(): number {
        const hostingPort = parseInt(window.location.port || '5002');
        // Map hosting ports to auth emulator ports based on multi-instance configuration
        switch (hostingPort) {
            case 5002: return 9099; // Instance 1
            case 6002: return 9199; // Instance 2
            case 7002: return 9299; // Instance 3
            default: return 9099;   // Default to Instance 1
        }
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