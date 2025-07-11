// API Request types
export interface CreateGroupRequest {
  name: string;
  description?: string;
  memberEmails?: string[];
}

export interface CreateExpenseRequest {
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  splits: ExpenseSplit[];
}

export interface UpdateExpenseRequest {
  description?: string;
  amount?: number;
  paidBy?: string;
  splits?: ExpenseSplit[];
}

export interface GenerateShareableLinkRequest {
  groupId: string;
}

export interface JoinGroupRequest {
  linkId: string;
}

// API Response types
export interface ListDocumentsResponse {
  documents: DocumentResponse[];
}

export interface DocumentResponse {
  id: string;
  data: any;
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

export interface Member {
  uid: string;
  name: string;
  initials: string;
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

export interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  members: Member[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
  category?: string;
  date?: string;
  updatedAt?: string;
}

export interface ExpenseSplit {
  userId: string;
  amount: number;
  userName?: string;
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

export interface ShareableLinkResponse {
  linkId: string;
  url: string;
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