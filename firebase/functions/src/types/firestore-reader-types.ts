/**
 * Type definitions for FirestoreReader service
 * Supporting types for pagination, filtering, and query options
 */

import { FirestoreTimestamp, MemberRole, MemberStatus } from '@splitifyd/shared';
import type { Transaction } from 'firebase-admin/firestore';

/**
 * Pagination options for collection queries
 */
export interface PaginationOptions {
    limit?: number;
    offset?: number;
    cursor?: string;
}

/**
 * Filtering options for collection queries
 */
export interface FilterOptions {
    includeDeleted?: boolean;
    dateRange?: {
        start?: FirestoreTimestamp;
        end?: FirestoreTimestamp;
    };
}

/**
 * Group member query options
 */
export interface GroupMemberQueryOptions {
    includeInactive?: boolean;
    roles?: MemberRole[];
    statuses?: MemberStatus[];
}

/**
 * Comment target specification
 */
export interface CommentTarget {
    type: 'group' | 'expense';
    id: string;
}

/**
 * Real-time subscription callback types
 */
export type GroupSubscriptionCallback = (group: any | null) => void;
export type ExpenseListSubscriptionCallback = (expenses: any[]) => void;
export type CommentListSubscriptionCallback = (comments: any[]) => void;

/**
 * Unsubscribe function type for real-time listeners
 */
export type UnsubscribeFunction = () => void;

/**
 * Transaction context for read operations
 */
export interface TransactionContext {
    transaction: Transaction;
}

/**
 * Query execution options
 */
export interface QueryOptions extends PaginationOptions, FilterOptions {
    orderBy?: {
        field: string;
        direction: 'asc' | 'desc';
    };
}

/**
 * Error handling context for FirestoreReader operations
 */
export interface ReadErrorContext {
    operation: string;
    collection?: string;
    documentId?: string;
    query?: Record<string, any>;
}