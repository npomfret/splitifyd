import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore, 
  Firestore, 
  connectFirestoreEmulator 
} from 'firebase/firestore';
import { firebaseConfigManager } from './firebase-config';

class FirebaseService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private firestore: Firestore | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const {firebase, firebaseAuthUrl, firebaseFirestoreUrl} = await firebaseConfigManager.getConfig();
    
    // Initialize Firebase with config from API
    this.app = initializeApp(firebase);
    this.auth = getAuth(this.app);
    this.firestore = getFirestore(this.app);
    
    // Connect to emulators in development (server provides URLs only in emulator mode)
    const isEmulator = firebaseAuthUrl!!;// this is only set in emulator config
    if (isEmulator) {
        const firestoreUrl = new URL(firebaseFirestoreUrl!);
        const firestorePort = parseInt(firestoreUrl.port);
        console.log("emulator detected", {firebaseAuthUrl, firebaseFirestoreUrl, firestorePort})

        connectAuthEmulator(this.auth, firebaseAuthUrl!, {disableWarnings: true});
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

}

export const firebaseService = new FirebaseService();

// Export a getter for db to ensure initialization
export const getDb = () => firebaseService.getFirestore();