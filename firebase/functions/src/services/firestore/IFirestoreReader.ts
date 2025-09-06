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
    UnsubscribeFunction,
    PaginatedResult
} from '../../types/firestore-reader-types';

// Import parsed types from schemas
import type {
    UserDocument,
    GroupDocument,
    ExpenseDocument,
    SettlementDocument,
    PolicyDocument,
    GroupChangeDocument
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

    /**
     * Get all policy documents
     * @returns Array of all policy documents
     */
    getAllPolicies(): Promise<PolicyDocument[]>;

    // ========================================================================
    // Collection Read Operations - User-related
    // ========================================================================

    /**
     * Get multiple user documents by IDs
     * @param userIds - Array of user IDs
     * @returns Array of user documents (missing users are excluded)
     */
    getUsersById(userIds: string[]): Promise<UserDocument[]>;


    // ========================================================================
    // Collection Read Operations - Group-related
    // ========================================================================

    /**
     * Get all groups where the user is a member with pagination support
     * @param userId - The user ID
     * @param options - Query options for pagination and filtering
     * @returns Paginated result containing group documents, hasMore flag, and nextCursor
     */
    getGroupsForUser(userId: string, options?: QueryOptions): Promise<PaginatedResult<GroupDocument[]>>;

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


    // ========================================================================
    // Collection Read Operations - Comment-related
    // ========================================================================


    // ========================================================================
    // Specialized Query Operations
    // ========================================================================

    /**
     * Get recent group changes for a user
     * @param userId - The user ID to filter changes for
     * @param options - Query options including timeWindowMs for how far back to look
     * @returns Array of group change documents
     */
    getRecentGroupChanges(userId: string, options?: { 
        timeWindowMs?: number;
        limit?: number;
    }): Promise<GroupChangeDocument[]>;



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




    // ========================================================================
    // Batch Operations
    // ========================================================================


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

}