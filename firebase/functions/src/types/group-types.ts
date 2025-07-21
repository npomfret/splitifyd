import { Member } from './webapp-shared-types';

/**
 * Core group structure
 */
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

/**
 * Group with balance information for the current user
 */
export interface GroupWithBalance extends Group {
  balance: GroupBalance;
}

/**
 * Balance information for a user in a group
 */
export interface GroupBalance {
  userBalance: number;
  totalOwed: number;
  totalOwing: number;
}

/**
 * Simplified group for list views
 */
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

/**
 * Request to create a new group
 */
export interface CreateGroupRequest {
  name: string;
  description?: string;
  memberEmails?: string[];
}

/**
 * Request to update an existing group
 */
export interface UpdateGroupRequest {
  name?: string;
  description?: string;
}

/**
 * Response for group list endpoint
 */
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

/**
 * Firestore document structure for groups
 */
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

/**
 * Group member structure - alias for shared type
 */
export type GroupMember = Member;

/**
 * Group data structure (legacy support for expenses)
 */
export interface GroupData {
  name: string;
  description?: string;
  memberEmails: string[];
  members: GroupMember[];
  yourBalance: number;
  expenseCount: number;
  lastExpenseTime: string | null;
  createdAt: string;
  updatedAt: string;
}