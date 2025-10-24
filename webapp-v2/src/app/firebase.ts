import { mapFirebaseUser } from '@/app/stores/auth-store.ts';
import { ClientUser } from '@splitifyd/shared';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth, onIdTokenChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, User as FirebaseUser } from 'firebase/auth';
import { connectFirestoreEmulator, doc, Firestore, getFirestore, onSnapshot } from 'firebase/firestore';
import { firebaseConfigManager } from './firebase-config';
import type {Email} from "@splitifyd/shared";

declare global {
    interface Window {
        __provideFirebaseForTests?: (service: FirebaseService) => void;
        __resetFirebaseForTests?: () => void;
        __pendingFirebaseServiceOverrides?: FirebaseService[];
    }
}

export interface FirebaseService {
    connect(): Promise<void>;
    performTokenRefresh(): Promise<string>;
    performUserRefresh(): Promise<void>;
    getCurrentUserId(): string | null;
    signInWithEmailAndPassword(email: Email, password: string): Promise<void>;
    sendPasswordResetEmail(email: Email): Promise<void>;
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
    async signInWithEmailAndPassword(email: Email, password: string) {
        await signInWithEmailAndPassword(this.getAuth(), email, password);
    }

    async sendPasswordResetEmail(email: Email) {
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
        return onIdTokenChanged(this.getAuth(), (firebaseUser: FirebaseUser | null) => {
            void (async () => {
                try {
                    if (firebaseUser) {
                        const user = mapFirebaseUser(firebaseUser);
                        const idToken = await firebaseUser.getIdToken();
                        await callback(user!, idToken!);
                    } else {
                        await callback(null, null);
                    }
                } catch (error) {
                    console.error('Auth state callback failed', error);
                }
            })();
        });
    }

    onDocumentSnapshot(collection: string, documentId: string, onData: (data: any) => void, onError: (error: Error) => void): () => void {
        const docRef = doc(this.getFirestore(), collection, documentId);
        return onSnapshot(docRef, onData, onError);
    }
}

const isBrowser = typeof window !== 'undefined';
const devMode = Boolean((import.meta as any)?.env?.DEV);
let overrideService: FirebaseService | null = null;
if (isBrowser) {
    const pending = window.__pendingFirebaseServiceOverrides;
    if (pending && pending.length > 0) {
        overrideService = pending[pending.length - 1] ?? null;
    }
}
let defaultService: FirebaseService | null = null;

function ensureDefaultService(): FirebaseService {
    if (!defaultService) {
        defaultService = new FirebaseServiceImpl();
    }
    return defaultService;
}

function applyOverride(service: FirebaseService | null) {
    overrideService = service;
    if (!service) {
        defaultService = null;
    }
}

export function getFirebaseService(): FirebaseService {
    return overrideService ?? ensureDefaultService();
}

function setFirebaseService(service: FirebaseService): void {
    if (!devMode) {
        console.warn('Ignoring attempt to override Firebase service outside development mode.');
        return;
    }
    applyOverride(service);
}

function resetFirebaseService(): void {
    if (!devMode) {
        console.warn('Ignoring attempt to reset Firebase service outside development mode.');
        return;
    }
    applyOverride(null);
}

if (isBrowser && devMode) {
    const queue = window.__pendingFirebaseServiceOverrides ?? [];
    window.__pendingFirebaseServiceOverrides = queue;

    window.__provideFirebaseForTests = (service: FirebaseService) => {
        setFirebaseService(service);
    };
    window.__resetFirebaseForTests = resetFirebaseService;

    if (queue.length > 0) {
        const last = queue.pop() ?? null;
        queue.length = 0;
        if (last) {
            setFirebaseService(last);
        }
    }
}
