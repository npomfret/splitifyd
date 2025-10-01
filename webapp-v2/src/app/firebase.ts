import {FirebaseApp, initializeApp} from 'firebase/app';
import {Auth, connectAuthEmulator, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, User as FirebaseUser} from 'firebase/auth';
import {connectFirestoreEmulator, doc, Firestore, getFirestore, onSnapshot} from 'firebase/firestore';
import {firebaseConfigManager} from './firebase-config';
import {mapFirebaseUser} from "@/app/stores/auth-store.ts";
import {ClientUser} from "@splitifyd/shared";

export interface FirebaseService {
    connect(): Promise<void>;
    performTokenRefresh(): Promise<string>;
    performUserRefresh(): Promise<void>;
    getCurrentUserId(): string | null;
    signInWithEmailAndPassword(email: string, password: string): Promise<void>;
    sendPasswordResetEmail(email: string): Promise<void>;
    signOut(): Promise<void>;
    onAuthStateChanged(callback: (user: ClientUser | null, idToken: string | null) => Promise<void>): () => void;
    onDocumentSnapshot(collection: string, documentId: string, onData: (data: any) => void, onError: (error: Error) => void): () => void;
}

class FirebaseServiceImpl implements FirebaseService {
    private app: FirebaseApp | null = null;
    private auth: Auth | null = null;
    private firestore: Firestore | null = null;
    private initialized = false;

    async connect(): Promise<void> {
        if (this.initialized) {
            return;
        }

        const { firebase, firebaseAuthUrl, firebaseFirestoreUrl } = await firebaseConfigManager.getConfig();

        // Initialize Firebase with config from API
        // see https://firebase.google.com/docs/auth/web/start
        this.app = initializeApp(firebase);
        this.auth = getAuth(this.app);
        this.firestore = getFirestore(this.app);

        // Connect to emulators in development (server provides URLs only in emulator mode)
        const isEmulator = firebaseAuthUrl!!; // this is only set in emulator config
        if (isEmulator) {
            const firestoreUrl = new URL(firebaseFirestoreUrl!);
            const firestorePort = parseInt(firestoreUrl.port);
            // Emulator connection configured

            connectAuthEmulator(this.auth, firebaseAuthUrl!, { disableWarnings: true });
            connectFirestoreEmulator(this.firestore, firestoreUrl.hostname, firestorePort);
        }

        this.initialized = true;
    }

    private getAuth(): Auth {
        if (!this.auth) {
            throw new Error('Firebase not initialized - call initialize() first');
        }
        return this.auth;
    }

    getCurrentUserId(): string | null {
        const currentUser = this.getAuth().currentUser;
        const userId = currentUser?.uid;
        return userId ?? null;
    }

    private getFirestore(): Firestore {
        if (!this.firestore) {
            throw new Error('Firebase not initialized - call initialize() first');
        }
        return this.firestore;
    }

    // Auth methods
    async signInWithEmailAndPassword(email: string, password: string) {
        await signInWithEmailAndPassword(this.getAuth(), email, password);
    }

    async sendPasswordResetEmail(email: string) {
        return sendPasswordResetEmail(this.getAuth(), email);
    }

    async signOut() {
        return signOut(this.getAuth());
    }

    async performTokenRefresh() {
        const currentUser = this.getAuth().currentUser;

        if (!currentUser) {
            throw new Error('No authenticated user');
        }

        // Force refresh
        return await currentUser.getIdToken(true);
    }

    async performUserRefresh() {
        const currentUser = this.getAuth().currentUser;
        if (currentUser) {
            await currentUser.reload();
        }
    }

    onAuthStateChanged(callback: (user: ClientUser | null, idToken: string | null) => Promise<void>) {
        return onAuthStateChanged(this.getAuth(), async (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser) {
                const user = mapFirebaseUser(firebaseUser);
                const idToken = await firebaseUser.getIdToken();
                callback(user!, idToken!);
            } else {
                callback(null, null);
            }
        });
    }

    onDocumentSnapshot(collection: string, documentId: string, onData: (data: any) => void, onError: (error: Error) => void): () => void {
        const docRef = doc(this.getFirestore(), collection, documentId);
        return onSnapshot(docRef, onData, onError);
    }
}

// Conditionally export either the real service or a mock for testing
let serviceInstance: FirebaseService;

if (typeof window !== 'undefined' && (window as any).__MOCK_FIREBASE_SERVICE__) {
    /* MONKEY PATCH!!! */
    // Use the mock service provided by Playwright tests
    serviceInstance = (window as any).__MOCK_FIREBASE_SERVICE__;
} else {
    // Use the real implementation in production
    serviceInstance = new FirebaseServiceImpl();
}

export const firebaseService: FirebaseService = serviceInstance;
