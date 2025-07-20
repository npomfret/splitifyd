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