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

// Balance Types
export interface UserBalance {
  userId: string;
  name: string;
  owes: Record<string, number>;
  owedBy: Record<string, number>;
  netBalance: number;
}

export interface GroupBalance {
  userBalance: UserBalance;
  totalOwed: number;
  totalOwing: number;
}

// Group Types
export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  memberIds: string[];
  memberEmails: string[];
  members: Member[];
  expenseCount: number;
  lastExpenseTime?: string;
  lastExpense?: {
    description: string;
    amount: number;
    date: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  balance: GroupBalance;
  lastActivity: string;
  lastActivityRaw: string;
  lastExpense?: {
    description: string;
    amount: number;
    date: string;
  };
  expenseCount: number;
}

export interface GroupListResponse {
  groups: GroupSummary[];
  count: number;
  hasMore: boolean;
  nextCursor?: string;
  pagination: {
    limit: number;
    order: 'asc' | 'desc';
  };
}

// This is what the frontend currently expects
export interface TransformedGroup {
  id: string;
  name: string;
  memberCount: number;
  yourBalance: number;  // This should be balance.userBalance.netBalance
  lastActivity: string;
  lastActivityRaw: string;
  lastExpense: {
    description: string;
    amount: number;
    date: string;
  } | null;
  members: Member[];
  expenseCount: number;
  lastExpenseTime: string | null;
  isSettledUp?: boolean;
}

// Group Detail for single group view
export interface GroupDetail extends Group {
  // Extends Group with no additional fields currently
}

// Firestore document structure
export interface GroupDocument {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  memberIds: string[];
  memberEmails: string[];
  members: Member[];
  expenseCount: number;
  lastExpenseTime?: Date;
  lastExpense?: {
    description: string;
    amount: number;
    date: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Request/Response types
export interface CreateGroupRequest {
  name: string;
  description?: string;
  memberEmails?: string[];
}

export interface ShareableLinkResponse {
  linkId: string;
  groupId: string;
  expiresAt: string;
}

export interface JoinGroupResponse {
  success: boolean;
  groupId: string;
  message: string;
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
  createdBy: string;
  paidBy: string;
  amount: number;
  description: string;
  category: string;
  date: string;  // ISO string
  splitType: 'equal' | 'exact' | 'percentage';
  participants: string[];
  splits: ExpenseSplit[];
  receiptUrl?: string;
  createdAt: string;  // ISO string
  updatedAt: string;  // ISO string
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

// Firestore Timestamp type (for frontend compatibility)
export interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

// Balance calculation types
export interface SimplifiedDebt {
  from: {
    userId: string;
    name: string;
  };
  to: {
    userId: string;
    name: string;
  };
  amount: number;
}

export interface GroupBalances {
  groupId: string;
  userBalances: Record<string, UserBalance>;
  simplifiedDebts: SimplifiedDebt[];
  lastUpdated: string;  // ISO string
}

