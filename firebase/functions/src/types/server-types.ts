// Server-only types - not shared with webapp clients
import { Group, GroupBalance, User } from './webapp-shared-types';

// Firestore document structure
export interface GroupDocument {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  memberIds: string[];
  memberEmails: string[];
  members: User[];
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

// Request/Response types for server-side validation
export interface UpdateGroupRequest {
  name?: string;
  description?: string;
}

export interface GroupWithBalance extends Group {
  balance: GroupBalance;
}

export interface GroupData {
  name: string;
  description?: string;
  memberIds?: string[];
  memberEmails: string[];
  members: User[];
  yourBalance: number;
  expenseCount: number;
  lastExpenseTime: string | null;
  createdAt: string;
  updatedAt: string;
}