import {
    type DisplayName,
    type Email,
    ListAuthUsersQuerySchema,
    ListFirestoreUsersQuerySchema,
    toDisplayName,
    toEmail,
    toUserId,
    type UserId,
} from '@billsplit-wl/shared';
import { createRequestValidator, createZodErrorMapper } from '../validation/common';

// ========================================================================
// Error Mappers
// ========================================================================

const listAuthUsersQueryErrorMapper = createZodErrorMapper(
    {
        limit: {
            code: 'INVALID_QUERY_PARAMS',
            message: (issue) => issue.message,
        },
        email: {
            code: 'INVALID_QUERY_PARAMS',
            message: () => 'Invalid email format',
        },
        uid: {
            code: 'INVALID_QUERY_PARAMS',
            message: () => 'UID cannot be empty',
        },
    },
    {
        defaultCode: 'INVALID_QUERY_PARAMS',
        defaultMessage: (issue) => issue.message,
    },
);

const listFirestoreUsersQueryErrorMapper = createZodErrorMapper(
    {
        limit: {
            code: 'INVALID_QUERY_PARAMS',
            message: (issue) => issue.message,
        },
        email: {
            code: 'INVALID_QUERY_PARAMS',
            message: () => 'Invalid email format',
        },
        uid: {
            code: 'INVALID_QUERY_PARAMS',
            message: () => 'UID cannot be empty',
        },
    },
    {
        defaultCode: 'INVALID_QUERY_PARAMS',
        defaultMessage: (issue) => issue.message,
    },
);

// ========================================================================
// Query Result Types
// ========================================================================

export interface ListAuthUsersQueryResult {
    limit: number;
    pageToken?: string;
    email?: Email;
    uid?: UserId;
}

export interface ListFirestoreUsersQueryResult {
    limit: number;
    cursor: string | undefined;
    email: Email | undefined;
    uid: UserId | undefined;
    displayName: DisplayName | undefined;
}

// ========================================================================
// Validators
// ========================================================================

/**
 * Validate list auth users query parameters.
 */
export const validateListAuthUsersQuery = createRequestValidator({
    schema: ListAuthUsersQuerySchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value): ListAuthUsersQueryResult => ({
        limit: value.limit,
        pageToken: value.pageToken,
        email: value.email ? toEmail(value.email) : undefined,
        uid: value.uid ? toUserId(value.uid) : undefined,
    }),
    mapError: listAuthUsersQueryErrorMapper,
}) as (query: unknown) => ListAuthUsersQueryResult;

/**
 * Validate list firestore users query parameters.
 */
export const validateListFirestoreUsersQuery = createRequestValidator({
    schema: ListFirestoreUsersQuerySchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value): ListFirestoreUsersQueryResult => ({
        limit: value.limit,
        cursor: value.cursor,
        email: value.email ? toEmail(value.email) : undefined,
        uid: value.uid ? toUserId(value.uid) : undefined,
        displayName: value.displayName ? toDisplayName(value.displayName) : undefined,
    }),
    mapError: listFirestoreUsersQueryErrorMapper,
}) as (query: unknown) => ListFirestoreUsersQueryResult;
