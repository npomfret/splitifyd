/**
 * Service Provider Interface
 * 
 * Central interface for accessing all services in a dependency-injected manner.
 * This interface abstracts away direct service dependencies and prevents circular 
 * dependencies by providing a unified access point for all service operations.
 * 
 * Design Principles:
 * - Services depend only on this interface, not concrete implementations
 * - Each method represents a specific business operation, not a raw service
 * - Return types match the existing service APIs for seamless migration
 * - All methods are async to support future caching/optimization
 */

import type { Transaction } from 'firebase-admin/firestore';
import type {
    GroupMembersResponse,
    GroupMemberDocument,
    UserWithProfile,
    ExpenseListResponse,
    SettlementsData
} from '@splitifyd/shared';

export interface ExpenseListOptions {
    limit?: number;
    cursor?: string;
}

export interface SettlementListOptions {
    limit?: number;
    cursor?: string;
}

export interface ExpenseMetadata {
    totalExpenses: number;
    totalAmount: number;
    currencies: string[];
    dateRange?: {
        earliest?: string;
        latest?: string;
    };
}

/**
 * Central service provider interface for dependency injection
 */
export interface IServiceProvider {
    // ========================================================================
    // User Operations
    // ========================================================================

    /**
     * Get user profiles for multiple user IDs
     * @param userIds - Array of user IDs to fetch
     * @returns Map of user ID to user profile
     */
    getUserProfiles(userIds: string[]): Promise<Map<string, UserWithProfile>>;

    // ========================================================================
    // Group Member Operations
    // ========================================================================

    /**
     * Get all members of a group with their profiles
     * @param groupId - The group ID
     * @returns Group members response with profiles
     */
    getGroupMembers(groupId: string): Promise<GroupMembersResponse>;

    /**
     * Get a single group member
     * @param groupId - The group ID
     * @param userId - The user ID
     * @returns Group member document or null if not found
     */
    getGroupMember(groupId: string, userId: string): Promise<GroupMemberDocument | null>;

    /**
     * Get raw member documents from subcollection (without profiles)
     * @param groupId - The group ID
     * @returns Array of group member documents
     */
    getMembersFromSubcollection(groupId: string): Promise<GroupMemberDocument[]>;

    // ========================================================================
    // Expense Operations
    // ========================================================================

    /**
     * List expenses for a group with pagination
     * @param groupId - The group ID
     * @param userId - The requesting user ID (for access control)
     * @param options - Pagination options
     * @returns Expense list response with pagination
     */
    listGroupExpenses(groupId: string, userId: string, options: ExpenseListOptions): Promise<ExpenseListResponse>;

    /**
     * Calculate expense metadata for a group
     * @param groupId - The group ID
     * @returns Expense metadata including totals and currencies
     */
    getExpenseMetadata(groupId: string): Promise<ExpenseMetadata>;

    // ========================================================================
    // Settlement Operations
    // ========================================================================

    /**
     * Get settlements data for a group with pagination
     * @param groupId - The group ID
     * @param options - Pagination options
     * @returns Settlements data with pagination
     */
    getGroupSettlementsData(groupId: string, options: SettlementListOptions): Promise<SettlementsData>;

    // ========================================================================
    // Transaction Support
    // ========================================================================

    /**
     * Execute operations within a Firestore transaction
     * This allows services to perform complex operations atomically
     * @param updateFunction - Function that performs transactional operations
     * @returns Transaction result
     */
    runTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>): Promise<T>;
}