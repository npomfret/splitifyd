/**
 * Configuration type definitions shared across the monorepo.
 * 
 * WHY THIS FILE IS HERE (NOT IN shared-types):
 * 
 * This file logically belongs in the shared-types package, but Firebase Functions
 * deployment has a critical limitation: it doesn't support npm workspace dependencies.
 * 
 * TECHNICAL DETAILS:
 * - Firebase Functions only packages the /functions directory during deployment
 * - Workspace dependencies like "workspace:*" are resolved at build time on the local machine
 * - In the cloud deployment environment, sibling packages (like shared-types) are not available
 * - This causes deployment failures when Firebase tries to resolve workspace dependencies
 * 
 * CURRENT SOLUTION:
 * - This file serves as the canonical source in firebase/functions (deployment requirement)
 * - webapp/src/js/types/config.types.ts -> symlinks to this file
 * - shared-types/src/core/config.ts -> symlinks to this file
 * - All imports use local relative paths (no workspace dependencies)
 * 
 * REFERENCES:
 * - Firebase Functions deployment process: https://firebase.google.com/docs/functions/manage-functions#deploy-functions
 * - npm workspaces limitations in serverless: https://docs.npmjs.com/cli/v7/using-npm/workspaces
 * - Related issue: Firebase doesn't support monorepo workspace dependencies in cloud deployment
 * 
 * ALTERNATIVE APPROACHES CONSIDERED:
 * - Copy script during build: Adds complexity, potential for sync issues
 * - Duplicate maintenance: Code duplication, high maintenance burden
 * - Symlinks (current): Clean development experience, single source of truth
 */

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

