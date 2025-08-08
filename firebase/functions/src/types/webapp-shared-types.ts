// Single shared type file for webapp
// This file contains all type definitions used by the webapp client
import * as admin from 'firebase-admin';

// ========================================================================
// Constants
// ========================================================================

export const UserRoles = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export const FirestoreCollections = {
  DOCUMENTS: 'documents',
  GROUPS: 'groups',
  EXPENSES: 'expenses',
  SETTLEMENTS: 'settlements',
  USERS: 'users',
  POLICIES: 'policies',
} as const;

export const SplitTypes = {
  EQUAL: 'equal',
  EXACT: 'exact',
  PERCENTAGE: 'percentage',
} as const;

export const AuthErrors = {
  EMAIL_EXISTS: 'auth/email-already-exists',
  EMAIL_EXISTS_CODE: 'EMAIL_EXISTS',
} as const;

export const PolicyIds = {
  TERMS_OF_SERVICE: 'terms-of-service',
  COOKIE_POLICY: 'cookie-policy',
  PRIVACY_POLICY: 'privacy-policy',
} as const;

export const DELETED_AT_FIELD = 'deletedAt';

// ========================================================================
// Configuration Types - Used by webapp for API client
// ========================================================================

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

// ========================================================================
// User Types
// ========================================================================

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role?: typeof UserRoles.ADMIN | typeof UserRoles.USER; // Role field for admin access control
  termsAcceptedAt?: Date | admin.firestore.Timestamp; // Legacy timestamp field
  cookiePolicyAcceptedAt?: Date | admin.firestore.Timestamp; // Legacy timestamp field
  acceptedPolicies?: Record<string, string>; // Map of policyId -> versionHash
}

// ========================================================================
// Policy Types - For versioned terms and cookie policy acceptance
// ========================================================================

export interface PolicyVersion {
  text: string;
  createdAt: string; // ISO string
}

export interface Policy {
  policyName: string;
  currentVersionHash: string;
  versions: Record<string, PolicyVersion>; // Map of versionHash -> PolicyVersion
}

export interface PolicyDocument {
  id: string;
  policyName: string;
  currentVersionHash: string;
  versions: Record<string, PolicyVersion>;
}

// Admin Policy Management Types
export interface CreatePolicyRequest {
  policyName: string;
  text: string;
}

export interface UpdatePolicyRequest {
  text: string;
  publish?: boolean; // If true, immediately set as current version
}

export interface PublishPolicyRequest {
  versionHash: string;
}

// ========================================================================
// Balance Types
// ========================================================================

export interface UserBalance {
  userId: string;
  owes: Record<string, number>;
  owedBy: Record<string, number>;
  netBalance: number;
}

export interface GroupBalance {
  userBalance: UserBalance | null;
  totalOwed: number;
  totalOwing: number;
}

// ========================================================================
// Group Types - Single unified interface for both storage and API
// ========================================================================

export interface Group {
  // Always present
  id: string;
  name: string;
  description?: string;
  memberIds: string[];  // Array of user IDs - use memberIds.length for count
  createdBy: string;
  createdAt: string;  // ISO string
  updatedAt: string;  // ISO string
  // Computed fields (only in API responses)
  balance?: {
    userBalance: UserBalance | null;
    totalOwed: number;
    totalOwing: number;
  };
  lastActivity?: string;
  lastActivityRaw?: string;
}

// Request/Response types
export interface CreateGroupRequest {
  name: string;
  description?: string;
  members?: User[];
}

// List groups response
export interface ListGroupsResponse {
  groups: Group[];
  count: number;
  hasMore: boolean;
  nextCursor?: string;
  pagination: {
    limit: number;
    order: string;
  };
}

// Group members response
export interface GroupMembersResponse {
  members: User[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

// ========================================================================
// Expense Types
// ========================================================================

export interface ExpenseSplit {
  userId: string;
  amount: number;
  percentage?: number;
}

export interface ExpenseCategory {
  name: string;
  displayName: string;
  icon: string;
}

export interface ExpenseData {
  id: string;
  groupId: string;
  createdBy: string;
  paidBy: string;
  amount: number;
  description: string;
  category: string;
  date: string;  // ISO string
  splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
  participants: string[];
  splits: ExpenseSplit[];
  receiptUrl?: string;
  createdAt: string;  // ISO string
  updatedAt: string;  // ISO string
  deletedAt: string | null;  // ISO string
  deletedBy: string | null;
}

export interface CreateExpenseRequest {
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  category: string;
  date: string;
  splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
  participants: string[];
  splits?: ExpenseSplit[];
  receiptUrl?: string;
}

export interface UpdateExpenseRequest {
  description?: string;
  amount?: number;
  paidBy?: string;
  category?: string;
  date?: string;
  splitType?: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
  participants?: string[];
  splits?: ExpenseSplit[];
  receiptUrl?: string;
}

// ========================================================================
// Settlement Types
// ========================================================================

export interface Settlement {
  id: string;
  groupId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  currency: string;
  date: string;  // ISO string
  note?: string | undefined;
  createdBy: string;
  createdAt: string;  // ISO string
  updatedAt: string;  // ISO string
}

export interface CreateSettlementRequest {
  groupId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  currency: string;
  date?: string;  // ISO string, defaults to today
  note?: string;
}

export interface UpdateSettlementRequest {
  amount?: number;
  currency?: string;
  date?: string;
  note?: string;
}

export interface SettlementListItem {
  id: string;
  groupId: string;
  payer: User;
  payee: User;
  amount: number;
  currency: string;
  date: string;
  note?: string;
  createdAt: string;
}

// ========================================================================
// Balance calculation types
// ========================================================================

export interface SimplifiedDebt {
  from: {
    userId: string;
  };
  to: {
    userId: string;
  };
  amount: number;
  currency?: string;  // Add currency support for multi-currency groups
}

export interface GroupBalances {
  groupId: string;
  userBalances: Record<string, UserBalance>;
  simplifiedDebts: SimplifiedDebt[];
  lastUpdated: string;  // ISO string
}