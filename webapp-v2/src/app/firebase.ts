import {FirebaseApp, initializeApp} from 'firebase/app';
import {Auth, connectAuthEmulator, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, User as FirebaseUser} from 'firebase/auth';
import {connectFirestoreEmulator, Firestore, getFirestore} from 'firebase/firestore';
import {firebaseConfigManager} from './firebase-config';
import {logInfo} from "@/utils/browser-logger.ts";

class FirebaseService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private firestore: Firestore | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    /*
    you should see this in the console logs
    2025-08-12T22:48:38.714Z fb config: {"timestamp":"2025-08-12T22:48:38.714Z","firebase":{"apiKey":"AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg","authDomain":"","projectId":"splitifyd","storageBucket":"","messagingSenderId":"","appId":"","measurementId":""},"firebaseAuthUrl":"http://127.0.0.1:6002","firebaseFirestoreUrl":"http://127.0.0.1:6004"}
    2025-08-12T22:48:38.716Z emulator detected: {"timestamp":"2025-08-12T22:48:38.716Z","firebaseAuthUrl":"http://127.0.0.1:6002","firebaseFirestoreUrl":"http://127.0.0.1:6004"}
     */

    const {firebase, firebaseAuthUrl, firebaseFirestoreUrl} = await firebaseConfigManager.getConfig();

    logInfo("fb config", {firebase, firebaseAuthUrl, firebaseFirestoreUrl});

    this.app = initializeApp(firebase);
    this.auth = getAuth(this.app);
    this.firestore = getFirestore(this.app);

    const isEmulator = firebaseAuthUrl!!;// this is only set in emulator config
    if(isEmulator) {
      logInfo("emulator detected", {firebaseAuthUrl, firebaseFirestoreUrl})

      connectAuthEmulator(this.auth, firebaseAuthUrl!, {disableWarnings: true});
      const firestoreUrl = new URL(firebaseFirestoreUrl!);
      connectFirestoreEmulator(this.firestore, firestoreUrl.hostname, parseInt(firestoreUrl.port));
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