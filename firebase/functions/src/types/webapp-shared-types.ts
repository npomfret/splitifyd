// Single shared type file for webapp
// This file contains all type definitions used by the webapp client

// Configuration Types
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

// API Types
export interface CreateGroupRequest {
  name: string;
  description?: string;
  memberEmails?: string[];
}

export interface ListDocumentsResponse {
  documents: DocumentResponse[];
}

export interface DocumentResponse {
  id: string;
  data: any;
}

export interface ShareableLinkResponse {
  linkId: string;
  shareableUrl: string;
  expiresAt: string;
}

export interface JoinGroupResponse {
  groupId: string;
  groupName: string;
  success: boolean;
}

export interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

// Expense Types
export interface ExpenseSplit {
  userId: string;
  amount: number;
  percentage?: number;
  userName?: string;
}

export interface ExpenseData {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  paidByName?: string;
  splits: ExpenseSplit[];
  createdAt: string;
  createdBy: string;
  category: string;
  date: string;
  updatedAt?: string;
  splitType: 'equal' | 'exact' | 'percentage';
  participants: string[];
  receiptUrl?: string;
}

export interface CreateExpenseRequest {
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  category: string;
  date: string;
  splitType: 'equal' | 'exact' | 'percentage';
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
  splitType?: 'equal' | 'exact' | 'percentage';
  participants?: string[];
  splits?: ExpenseSplit[];
  receiptUrl?: string;
}

// Group Types
export interface Member {
  uid: string;
  name: string;
  initials: string;
  email?: string;
  displayName?: string;
  joinedAt?: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  members: Member[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupDocument {
  id: string;
  data: {
    name: string;
    description?: string;
    members: Member[];
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    yourBalance?: number;
    lastExpense?: string | null;
    expenseCount?: number;
    lastExpenseTime?: string | null;
  };
}

export interface TransformedGroup {
  id: string;
  name: string;
  memberCount: number;
  yourBalance: number;
  lastActivity: string;
  lastActivityRaw: string;
  lastExpense: string | null;
  members: Member[];
  expenseCount: number;
  lastExpenseTime: string | null;
}

export interface GroupBalances {
  balances: Record<string, number>;
  summary: BalanceSummary[];
}

export interface BalanceSummary {
  userId: string;
  userName: string;
  balance: number;
}

// Expense Categories
export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'utilities',
  'entertainment',
  'shopping',
  'accommodation',
  'healthcare',
  'education',
  'other'
] as const;