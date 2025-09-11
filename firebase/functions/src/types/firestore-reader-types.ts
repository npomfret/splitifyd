/**
 * Type definitions for FirestoreReader service
 * Supporting types for pagination, filtering, and query options
 */

import { FirestoreTimestamp, MemberRole, MemberStatus } from '@splitifyd/shared';

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
 * Query execution options
 */
export interface QueryOptions extends PaginationOptions, FilterOptions {
    orderBy?: {
        field: string;
        direction: 'asc' | 'desc';
    };
}

/**
 * Paginated result wrapper for collection queries
 * Provides consistent pagination interface with cursor support
 */
export interface PaginatedResult<T> {
    /** The actual data for this page */
    data: T;
    /** Whether more results exist after this page */
    hasMore: boolean;
    /** Cursor for fetching the next page (undefined if hasMore is false) */
    nextCursor?: string;
    /** Optional rough estimate of total items for UI purposes */
    totalEstimate?: number;
}

/**
 * Cursor data for groups pagination
 * Contains all necessary information for resuming pagination
 */
export interface GroupsPaginationCursor {
    /** ID of the last group in current page */
    lastGroupId: string;
    /** UpdatedAt timestamp of the last group for ordering */
    lastUpdatedAt: string;
    /** Optional cursor for subcollection pagination */
    membershipCursor?: string;
}

/**
 * Order by specification for queries
 */
export interface OrderBy {
    field: string;
    direction: 'asc' | 'desc';
}

/**
 * Options for efficient batch group fetching
 */
export interface BatchGroupFetchOptions {
    orderBy: OrderBy;
    limit: number;
}
