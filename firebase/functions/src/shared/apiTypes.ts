/**
 * Shared API Types
 * 
 * This file contains all type definitions shared between the client and server.
 * These types are used in the API contract and throughout the application.
 * 
 * IMPORTANT: This file should be the single source of truth for API types.
 */

// Configuration Types
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

// User Types
export interface Member {
  uid: string;
  name: string;
  initials: string;
  email?: string;
  displayName?: string;
  joinedAt?: string;
}

// Group Types
export interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  members: Member[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupDocument extends GroupDetail {
  // Additional fields that might be in Firestore but not in API response
}

export interface TransformedGroup {
  id: string;
  name: string;
  memberCount: number;
  yourBalance: number;
  lastActivity: string;
  lastActivityRaw: string;
  lastExpense: { description: string; amount: number; date: string } | null;
  members: Member[];
  expenseCount: number;
  lastExpenseTime: string | null;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  memberEmails?: string[];
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
  category: string;
  date: string;
  splitType: 'equal' | 'exact' | 'percentage';
  participants: string[];
  splits: ExpenseSplit[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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

// Balance Types
export interface GroupBalances {
  balances: Array<{
    userId: string;
    userName: string;
    balance: number;
    owes: Array<{ userId: string; userName: string; amount: number }>;
    owedBy: Array<{ userId: string; userName: string; amount: number }>;
  }>;
  simplifiedDebts: Array<{
    fromUserId: string;
    fromUserName: string;
    toUserId: string;
    toUserName: string;
    amount: number;
  }>;
}

// Share Types
export interface ShareableLinkResponse {
  linkId: string;
  shareUrl: string;
  expiresAt: string;
}

export interface JoinGroupResponse {
  groupId: string;
  groupName: string;
  success: boolean;
}

// Firestore Types
export interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}