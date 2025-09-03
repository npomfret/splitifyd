/**
 * Firestore Reader Interface
 * 
 * Centralized interface for all Firestore read operations across the application.
 * This interface provides type-safe, validated access to all collections with
 * consistent error handling and performance monitoring.
 * 
 * Design Principles:
 * - All methods return validated, typed data using Zod schemas
 * - Consistent null return for missing documents
 * - Consistent array return for collection queries
 * - Transaction-aware methods for complex operations
 * - Real-time subscription management
 */

import type { Transaction, DocumentReference } from 'firebase-admin/firestore';
import {
    QueryOptions,
    GroupMemberQueryOptions,
    CommentTarget,
    GroupSubscriptionCallback,
    ExpenseListSubscriptionCallback,
    CommentListSubscriptionCallback,
    UnsubscribeFunction
} from '../../types/firestore-reader-types';

// Import parsed types from schemas
import type {
    UserDocument,
    GroupDocument,
    ExpenseDocument,
    SettlementDocument,
    PolicyDocument
} from '../../schemas';
import type { ParsedComment as CommentDocument } from '../../schemas';
import type { ParsedShareLink as ShareLinkDocument } from '../../schemas';
import type { GroupMemberDocument } from '@splitifyd/shared';

export interface IFirestoreReader {
    // ========================================================================
    // Document Read Operations
    // ========================================================================

    /**
     * Get a user document by ID
     * @param userId - The user ID
     * @returns User document or null if not found
     */
    getUser(userId: string): Promise<UserDocument | null>;

    /**
     * Get a group document by ID
     * @param groupId - The group ID
     * @returns Group document or null if not found
     */
    getGroup(groupId: string): Promise<GroupDocument | null>;

    /**
     * Get an expense document by ID
     * @param expenseId - The expense ID
     * @returns Expense document or null if not found
     */
    getExpense(expenseId: string): Promise<ExpenseDocument | null>;

    /**
     * Get a settlement document by ID
     * @param settlementId - The settlement ID
     * @returns Settlement document or null if not found
     */
    getSettlement(settlementId: string): Promise<SettlementDocument | null>;

    /**
     * Get a policy document by ID
     * @param policyId - The policy ID
     * @returns Policy document or null if not found
     */
    getPolicy(policyId: string): Promise<PolicyDocument | null>;

    // ========================================================================
    // Collection Read Operations - User-related
    // ========================================================================

    /**
     * Get multiple user documents by IDs
     * @param userIds - Array of user IDs
     * @returns Array of user documents (missing users are excluded)
     */
    getUsersById(userIds: string[]): Promise<UserDocument[]>;

    /**
     * Get users that are members of a specific group
     * @param groupId - The group ID
     * @returns Array of user documents
     */
    getUsersForGroup(groupId: string): Promise<UserDocument[]>;

    // ========================================================================
    // Collection Read Operations - Group-related
    // ========================================================================

    /**
     * Get all groups where the user is a member
     * @param userId - The user ID
     * @param options - Query options for pagination and filtering
     * @returns Array of group documents
     */
    getGroupsForUser(userId: string, options?: QueryOptions): Promise<GroupDocument[]>;

    /**
     * Get group members for a specific group
     * @param groupId - The group ID
     * @param options - Options for filtering members
     * @returns Array of group member documents
     */
    getGroupMembers(groupId: string, options?: GroupMemberQueryOptions): Promise<GroupMemberDocument[]>;

    /**
     * Get a single member from group's member subcollection
     * @param groupId - The group ID
     * @param userId - The user ID to find
     * @returns Group member document or null if not found
     */
    getMemberFromSubcollection(groupId: string, userId: string): Promise<GroupMemberDocument | null>;

    /**
     * Get all members for a group from the member subcollection
     * @param groupId - The group ID
     * @returns Array of group member documents
     */
    getMembersFromSubcollection(groupId: string): Promise<GroupMemberDocument[]>;

    // ========================================================================
    // Collection Read Operations - Expense-related
    // ========================================================================

    /**
     * Get all expenses for a specific group
     * @param groupId - The group ID
     * @param options - Query options for pagination and filtering
     * @returns Array of expense documents
     */
    getExpensesForGroup(groupId: string, options?: QueryOptions): Promise<ExpenseDocument[]>;

    /**
     * Get expenses created by a specific user
     * @param userId - The user ID
     * @param options - Query options for pagination and filtering
     * @returns Array of expense documents
     */
    getExpensesByUser(userId: string, options?: QueryOptions): Promise<ExpenseDocument[]>;

    // ========================================================================
    // Collection Read Operations - Settlement-related
    // ========================================================================

    /**
     * Get all settlements for a specific group
     * @param groupId - The group ID
     * @param options - Query options for pagination and filtering
     * @returns Array of settlement documents
     */
    getSettlementsForGroup(groupId: string, options?: QueryOptions): Promise<SettlementDocument[]>;

    /**
     * Get settlements involving a specific user
     * @param userId - The user ID
     * @param options - Query options for pagination and filtering
     * @returns Array of settlement documents
     */
    getSettlementsForUser(userId: string, options?: QueryOptions): Promise<SettlementDocument[]>;

    // ========================================================================
    // Collection Read Operations - Comment-related
    // ========================================================================

    /**
     * Get comments for a specific target (group or expense)
     * @param target - The target specification
     * @param options - Query options for pagination and filtering
     * @returns Array of comment documents
     */
    getCommentsForTarget(target: CommentTarget, options?: QueryOptions): Promise<CommentDocument[]>;

    // ========================================================================
    // Specialized Query Operations
    // ========================================================================

    /**
     * Find an active share link by token
     * @param token - The share link token
     * @returns Share link document or null if not found/expired
     */
    getActiveShareLinkByToken(token: string): Promise<ShareLinkDocument | null>;

    /**
     * Get policy versions for a user
     * @param userId - The user ID
     * @returns Array of policy documents
     */
    getPolicyVersionsForUser(userId: string): Promise<PolicyDocument[]>;

    // ========================================================================
    // Transaction-aware Read Operations
    // ========================================================================

    /**
     * Get a group document within a transaction context
     * @param transaction - The transaction context
     * @param groupId - The group ID
     * @returns Group document or null if not found
     */
    getGroupInTransaction(transaction: Transaction, groupId: string): Promise<GroupDocument | null>;

    /**
     * Get a user document within a transaction context
     * @param transaction - The transaction context
     * @param userId - The user ID
     * @returns User document or null if not found
     */
    getUserInTransaction(transaction: Transaction, userId: string): Promise<UserDocument | null>;

    /**
     * Get multiple documents within a transaction context
     * @param transaction - The transaction context
     * @param refs - Array of document references to read
     * @returns Array of document snapshots
     */
    getMultipleInTransaction<T>(
        transaction: Transaction,
        refs: DocumentReference[]
    ): Promise<T[]>;

    // ========================================================================
    // Real-time Subscription Operations
    // ========================================================================

    /**
     * Subscribe to real-time updates for a group document
     * @param groupId - The group ID
     * @param callback - Callback function for group updates
     * @returns Unsubscribe function
     */
    subscribeToGroup(groupId: string, callback: GroupSubscriptionCallback): UnsubscribeFunction;

    /**
     * Subscribe to real-time updates for group expenses
     * @param groupId - The group ID
     * @param callback - Callback function for expense list updates
     * @returns Unsubscribe function
     */
    subscribeToGroupExpenses(groupId: string, callback: ExpenseListSubscriptionCallback): UnsubscribeFunction;

    /**
     * Subscribe to real-time updates for comments on a target
     * @param target - The comment target
     * @param callback - Callback function for comment list updates
     * @returns Unsubscribe function
     */
    subscribeToComments(target: CommentTarget, callback: CommentListSubscriptionCallback): UnsubscribeFunction;

    // ========================================================================
    // Batch Operations
    // ========================================================================

    /**
     * Get multiple documents by collection and IDs
     * @param collection - The collection name
     * @param documentIds - Array of document IDs
     * @returns Array of document data (validated by collection schema)
     */
    getBatchDocuments<T>(collection: string, documentIds: string[]): Promise<T[]>;

    // ========================================================================
    // Utility Operations
    // ========================================================================

    /**
     * Check if a document exists without reading its data
     * @param collection - The collection name
     * @param documentId - The document ID
     * @returns True if document exists, false otherwise
     */
    documentExists(collection: string, documentId: string): Promise<boolean>;

    /**
     * Count documents in a collection query
     * @param collection - The collection name
     * @param filters - Query filters
     * @returns Number of matching documents
     */
    countDocuments(collection: string, filters?: Record<string, any>): Promise<number>;
}