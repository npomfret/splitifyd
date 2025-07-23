/**
 * Shared API Types
 * 
 * This file re-exports types from webapp-shared-types.ts to avoid duplication
 * while maintaining backward compatibility for existing imports.
 * 
 * IMPORTANT: webapp-shared-types.ts is the single source of truth for shared types.
 */

// Re-export all types from webapp-shared-types
export type {
  // User types
  User,
  UserBalance,
  
  // Group types
  Group,
  GroupDetail,
  GroupDocument,
  TransformedGroup,
  CreateGroupRequest,
  UpdateGroupRequest,
  GroupBalance,
  GroupBalances,
  
  // Expense types
  ExpenseSplit,
  ExpenseData,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  
  // Share types
  ShareableLinkResponse,
  JoinGroupResponse,
  
  // Other types
  FirestoreTimestamp
} from '../../../../firebase/functions/src/types/webapp-shared-types';

// Configuration Types (not in webapp-shared-types.ts)
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
  firebaseAuthUrl?: string;
}