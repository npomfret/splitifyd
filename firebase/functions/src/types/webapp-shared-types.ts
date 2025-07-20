// Single shared type file for webapp
// This file contains all type definitions used by the webapp client

// Configuration Types - Used by webapp for API client
/**
 * Firebase client SDK configuration.
 * These values are used by the Firebase JavaScript SDK in the client application.
 * 
 * NOTE: In development/emulator mode, these values are not actually used by Firebase
 * since the emulator provides its own auth and storage services. We populate them
 * with dummy values to satisfy the SDK initialization requirements.
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface ApiConfig {
  timeout: number;
  retryAttempts: number;
}

export interface EnvironmentConfig {
  warningBanner?: WarningBanner;
}

export interface WarningBanner {
  enabled: boolean;
  message: string;
}

export interface FormDefaults {
  displayName?: string;
  email?: string;
  password?: string;
}

export interface AppConfiguration {
  firebase: FirebaseConfig;
  api: ApiConfig;
  environment: EnvironmentConfig;
  formDefaults: FormDefaults;
  /**
   * URL for Firebase Auth emulator - only populated in development.
   * Used by the client to connect to the local auth emulator instead of production Firebase Auth.
   * Format: http://localhost:9099 (or whatever port the auth emulator is running on)
   */
  firebaseAuthUrl?: string;
}

// Group Types - Actually used by webapp
export interface Member {
  uid: string;
  name: string;
  initials: string;
  email?: string;
  displayName?: string;
  joinedAt?: string;
}

