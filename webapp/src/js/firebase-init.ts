import { logger } from './utils/logger.js';
import { firebaseConfigManager as configManager } from './firebase-config-manager.js';
import type { 
    FirebaseApp, 
    FirebaseAuth, 
    FirebaseUser,
    FirebaseError
} from './types/global.js';
import type { AppConfiguration } from './types/config.types.js';

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
            
            // Connect to emulator if auth URL is provided
            if (config.firebaseAuthUrl) {
                try {
                    connectAuthEmulator(this.auth, config.firebaseAuthUrl, { disableWarnings: true });
                } catch (error) {
                    const firebaseError = error as FirebaseError;
                    if (firebaseError.code !== 'auth/emulator-config-failed') {
                        throw error;
                    }
                }
            }
            
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
            this.initialized = false;
            throw new Error(`Firebase initialization failed: ${(error as Error).message}`);
        }
    }
}

export const firebaseInitializer = new FirebaseInitializer();

// Note: Firebase initialization is handled by app-init.ts or when first needed
// This prevents double initialization and improves startup performance