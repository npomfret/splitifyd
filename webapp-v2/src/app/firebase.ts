import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  User as FirebaseUser,
  AuthError
} from 'firebase/auth';
import { firebaseConfigManager } from './firebase-config';

class FirebaseService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Fetch configuration from API
      const config = await firebaseConfigManager.getConfig();
      
      // Initialize Firebase with config from API
      this.app = initializeApp(config.firebase);
      this.auth = getAuth(this.app);
      
      // Connect to emulator if auth URL is provided (development only)
      if (config.firebaseAuthUrl && import.meta.env.DEV) {
        try {
          connectAuthEmulator(this.auth, config.firebaseAuthUrl, { disableWarnings: true });
        } catch (error) {
          const authError = error as AuthError;
          if (authError.code !== 'auth/emulator-config-failed') {
            throw error;
          }
          // Emulator already connected, continue
        }
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      throw error;
    }
  }

  getAuth(): Auth {
    if (!this.auth) {
      throw new Error('Firebase not initialized - call initialize() first');
    }
    return this.auth;
  }

  // Auth methods
  async signInWithEmailAndPassword(email: string, password: string) {
    return signInWithEmailAndPassword(this.getAuth(), email, password);
  }

  async createUserWithEmailAndPassword(email: string, password: string) {
    return createUserWithEmailAndPassword(this.getAuth(), email, password);
  }

  async updateProfile(user: FirebaseUser, profile: { displayName?: string; photoURL?: string }) {
    return updateProfile(user, profile);
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

  getCurrentUser() {
    return this.getAuth().currentUser;
  }

  isInitialized() {
    return this.initialized;
  }
}

export const firebaseService = new FirebaseService();