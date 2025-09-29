import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator, doc, onSnapshot } from 'firebase/firestore';
import { firebaseConfigManager } from './firebase-config';

export interface FirebaseService {
    initialize(): Promise<void>;
    getAuth(): Auth;
    getFirestore(): Firestore;
    signInWithEmailAndPassword(email: string, password: string): Promise<any>;
    sendPasswordResetEmail(email: string): Promise<void>;
    signOut(): Promise<void>;
    onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void;
    onDocumentSnapshot(collection: string, documentId: string, onData: (data: any) => void, onError: (error: Error) => void): () => void;
}

class FirebaseServiceImpl implements FirebaseService {
    private app: FirebaseApp | null = null;
    private auth: Auth | null = null;
    private firestore: Firestore | null = null;
    private initialized = false;

    async initialize(): Promise<void> {
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

    getAuth(): Auth {
        if (!this.auth) {
            throw new Error('Firebase not initialized - call initialize() first');
        }
        return this.auth;
    }

    getFirestore(): Firestore {
        if (!this.firestore) {
            throw new Error('Firebase not initialized - call initialize() first');
        }
        return this.firestore;
    }

    // Auth methods
    async signInWithEmailAndPassword(email: string, password: string) {
        return signInWithEmailAndPassword(this.getAuth(), email, password);
    }

    async sendPasswordResetEmail(email: string) {
        return sendPasswordResetEmail(this.getAuth(), email);
    }

    async signOut() {
        return signOut(this.getAuth());
    }

    onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
        return onAuthStateChanged(this.getAuth(), callback);
    }

    onDocumentSnapshot(collection: string, documentId: string, onData: (data: any) => void, onError: (error: Error) => void): () => void {
        const docRef = doc(this.getFirestore(), collection, documentId);
        return onSnapshot(docRef, onData, onError);
    }
}

export const firebaseService: FirebaseService = new FirebaseServiceImpl();

// Export a getter for db to ensure initialization
export const getDb = () => firebaseService.getFirestore();
