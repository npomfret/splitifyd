/**
 * Zod schemas for runtime validation of API responses
 *
 * MANDATORY: Every API response must be validated against these schemas
 * This ensures type safety at runtime and catches server contract violations
 */

import { z } from 'zod';
import { ActivityFeedActions, ActivityFeedEventTypes, PositiveAmountStringSchema, SplitTypes, SystemUserRoles, toGroupId, toGroupName, toISOString, UserId } from '../shared-types';

const UserThemeColorSchema = z.object({
    light: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color'),
    dark: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color'),
    name: z.string().min(1).max(50),
    pattern: z.enum(['solid', 'dots', 'stripes', 'diagonal']),
    assignedAt: z.string().datetime().transform(toISOString),
    colorIndex: z.number().int().min(0),
});

const FirebaseConfigSchema = z.object({
    apiKey: z.string(),
    authDomain: z.string(),
    projectId: z.string(),
    storageBucket: z.string(),
    messagingSenderId: z.string(),
    appId: z.string(),
    measurementId: z.string().optional(),
});

const EnvironmentConfigSchema = z.object({
    warningBanner: z.string().optional(),
});

const FormDefaultsSchema = z.object({
    displayName: z.string().optional(),
    email: z.string().optional(),
    password: z.string().optional(),
});

const AppConfigurationSchema = z.object({
    firebase: FirebaseConfigSchema,
    environment: EnvironmentConfigSchema,
    formDefaults: FormDefaultsSchema,
    firebaseAuthUrl: z.string().optional(),
    firebaseFirestoreUrl: z.string().optional(),
});

// Group schemas

const GroupSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    balance: z
        .object({
            balancesByCurrency: z.record(
                z.string(),
                z.object({
                    currency: z.string(),
                    netBalance: z.string(),
                    owes: z.record(z.string(), z.string()).optional(),
                    owedBy: z.record(z.string(), z.string()).optional(),
                }),
            ),
        })
        .optional(),
    lastActivity: z.string().min(1),
    lastExpense: z
        .object({
            description: z.string().min(1),
            amount: PositiveAmountStringSchema,
            date: z.string(),
        })
        .optional(),

    permissions: z
        .object({
            expenseEditing: z.enum(['anyone', 'owner-and-admin', 'admin-only']).optional(),
            expenseDeletion: z.enum(['anyone', 'owner-and-admin', 'admin-only']).optional(),
            memberInvitation: z.enum(['anyone', 'admin-only']).optional(),
            memberApproval: z.enum(['automatic', 'admin-required']).optional(),
            settingsManagement: z.enum(['anyone', 'admin-only']).optional(),
        })
        .optional(),

    // Optional fields for detail view
    createdBy: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    deletedAt: z.string().nullable().optional(),
    lastExpenseTime: z.string().optional(),
});

// Change metadata schema for REST responses
const ChangeMetadataSchema = z.object({
    lastChangeTimestamp: z.number(),
    changeCount: z.number(),
    serverTime: z.number(),
});

const ListGroupsResponseSchema = z.object({
    groups: z.array(GroupSchema),
    count: z.number(),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
    pagination: z.object({
        limit: z.number(),
        order: z.string(),
    }),
    metadata: ChangeMetadataSchema.optional(),
});

// Expense schemas
export const ExpenseSplitSchema = z.object({
    uid: z.string().min(1),
    amount: PositiveAmountStringSchema,
    percentage: z.number().optional(),
    userName: z.string().min(1).optional(),
});

const ExpenseDataSchema = z.object({
    id: z.string().min(1),
    groupId: z.string().min(1),
    description: z.string().min(1),
    amount: PositiveAmountStringSchema,
    currency: z.string().length(3),
    paidBy: z.string().min(1),
    paidByName: z.string().min(1).optional(),
    category: z.string().min(1),
    date: z.string(),
    splitType: z.enum([SplitTypes.EQUAL, SplitTypes.EXACT, SplitTypes.PERCENTAGE]),
    participants: z.array(z.string().min(1)),
    splits: z.array(ExpenseSplitSchema),
    createdBy: z.string().min(1),
    createdAt: z.string(),
    updatedAt: z.string(),
    receiptUrl: z.string().optional(),
    deletedAt: z.string().nullable().optional(), // Soft delete timestamp
    deletedBy: z.string().nullable().optional(), // User who deleted the expense
    isLocked: z.boolean().optional(), // True if any participant has left the group
});

const ExpenseListResponseSchema = z.object({
    expenses: z.array(ExpenseDataSchema),
    count: z.number(),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
});

export const SimplifiedDebtSchema = z.object({
    from: z.object({ uid: z.string() }),
    to: z.object({ uid: z.string() }),
    amount: PositiveAmountStringSchema,
    currency: z.string().length(3),
});

const GroupBalancesSchema = z.object({
    groupId: z.string(),
    simplifiedDebts: z.array(SimplifiedDebtSchema),
    lastUpdated: z.string(),
});

// Group member DTO schema - validates the lean DTO returned by API
const GroupMemberDTOSchema = z.object({
    // User identification
    uid: z.string().min(1),
    displayName: z.string().min(1),
    initials: z.string().min(1),

    // User display properties
    photoURL: z.string().url().nullable().optional(),
    themeColor: UserThemeColorSchema,

    // Group membership metadata (required for permissions)
    memberRole: z.enum(['admin', 'member', 'viewer']),
    memberStatus: z.enum(['active', 'pending', 'archived']),
    joinedAt: z.union([z.string().datetime().transform(toISOString), z.literal('').transform(() => '' as any)]), // Allow empty string for departed members
    invitedBy: z.string().optional(),

    // Group-specific display name (required)
    groupDisplayName: z.string().min(1),
});

// Group members response schema
const GroupMembersResponseSchema = z.object({
    members: z.array(GroupMemberDTOSchema),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
});

// Share schemas
const ShareableLinkResponseSchema = z.object({
    linkId: z.string(),
    shareablePath: z.string(),
});

const JoinGroupResponseSchema = z.object({
    groupId: z.string(),
    groupName: z.string(),
    success: z.boolean(),
    displayNameConflict: z.boolean(),
    memberStatus: z.enum(['active', 'pending', 'archived']),
});

// Health check schemas
const HealthCheckResponseSchema = z.object({
    checks: z.object({
        firestore: z.object({
            status: z.enum(['healthy', 'unhealthy']),
            responseTime: z.number().optional(),
        }),
        auth: z.object({
            status: z.enum(['healthy', 'unhealthy']),
            responseTime: z.number().optional(),
        }),
    }),
});

// Error response schema - supports both structured and simple error formats
export const ApiErrorResponseSchema = z.union([
    // Structured error format (preferred)
    z.object({
        error: z.object({
            code: z.string().min(1),
            message: z.string().min(1),
            details: z.unknown().optional(),
        }),
    }),
    // Simple error format (current server implementation)
    z.object({
        error: z.string().min(1),
        field: z.string().optional(),
    }),
]);

// Map of endpoints to their response schemas
const RegisterResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().min(1),
    user: z.object({
        uid: z.string().min(1),
        displayName: z.string().min(2).max(50),
    }),
});

// Generic message response for operations like DELETE
const MessageResponseSchema = z.object({
    message: z.string().min(1),
});

// Settlement schemas
const SettlementSchema = z.object({
    id: z.string().min(1),
    groupId: z.string().min(1),
    payerId: z.string().min(1),
    payeeId: z.string().min(1),
    amount: PositiveAmountStringSchema,
    currency: z.string().length(3),
    date: z.string(),
    note: z.string().optional(),
    createdBy: z.string().min(1),
    createdAt: z.string(),
    updatedAt: z.string(),
});

// Minimal member schema for settlements - only includes fields needed for display
// Does not require group membership metadata like joinedAt, memberRole, etc.
const SettlementMemberSchema = z.object({
    uid: z.string().min(1),
    displayName: z.string().min(1),
    initials: z.string().min(1),
    photoURL: z.string().url().nullable().optional(),
    themeColor: UserThemeColorSchema,
    // Group-specific display name (required)
    groupDisplayName: z.string().min(1),
    // Optional membership fields that may or may not be present
    memberRole: z.enum(['admin', 'member', 'viewer']).optional(),
    memberStatus: z.enum(['active', 'pending', 'archived']).optional(),
    joinedAt: z.union([z.string().datetime().transform(toISOString), z.literal('').transform(() => '' as any)]).optional(), // Allow empty string or datetime - may be empty for departed members
    invitedBy: z.string().optional(),
});

const SettlementListItemSchema = z.object({
    id: z.string().min(1),
    groupId: z.string().min(1),
    payer: SettlementMemberSchema, // Minimal member object for display
    payee: SettlementMemberSchema, // Minimal member object for display
    amount: PositiveAmountStringSchema,
    currency: z.string().length(3),
    date: z.string(),
    note: z.string().optional(),
    createdBy: z.string().min(1).optional(),
    createdAt: z.string(),
    deletedAt: z.string().nullable().optional(), // Soft delete timestamp
    deletedBy: z.string().nullable().optional(), // User who deleted the settlement
    isLocked: z.boolean().optional(), // True if payer or payee has left the group
});

const ListSettlementsResponseSchema = z.object({
    settlements: z.array(SettlementListItemSchema),
    count: z.number(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable().optional(),
});

// Comment schemas
const CommentSchema = z.object({
    id: z.string().min(1),
    authorId: z.string().min(1),
    authorName: z.string().min(1),
    authorAvatar: z.string().optional(),
    text: z.string().min(1).max(500),
    createdAt: z.string(),
    updatedAt: z.string(),
});

const ListCommentsResponseSchema = z.object({
    comments: z.array(CommentSchema),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
});

// Comment response is now unwrapped - returns CommentDTO directly
const CreateCommentResponseSchema = CommentSchema;

// List comments response is now unwrapped - returns ListCommentsResponse directly
const ListCommentsApiResponseSchema = ListCommentsResponseSchema;

// User profile schemas
const UserProfileResponseSchema = z.object({
    displayName: z.string(),
    role: z.nativeEnum(SystemUserRoles),
});

// Policy schemas
const CurrentPolicyResponseSchema = z.object({
    id: z.string().min(1),
    policyName: z.string().min(1),
    currentVersionHash: z.string().min(1),
    text: z.string().min(1),
    createdAt: z.string().datetime().transform(toISOString),
});

const PolicyAcceptanceStatusSchema = z.object({
    policyId: z.string().min(1),
    currentVersionHash: z.string().min(1),
    userAcceptedHash: z.string().optional(),
    needsAcceptance: z.boolean(),
    policyName: z.string().min(1),
});

const UserPolicyStatusResponseSchema = z.object({
    needsAcceptance: z.boolean(),
    policies: z.array(PolicyAcceptanceStatusSchema),
    totalPending: z.number().int().min(0),
});

const AcceptMultiplePoliciesResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().min(1),
    acceptedPolicies: z.array(
        z.object({
            policyId: z.string().min(1),
            versionHash: z.string().min(1),
            acceptedAt: z.string().datetime().transform(toISOString),
        }),
    ),
});

// Group full details schema - combines multiple endpoint responses
const GroupFullDetailsSchema = z.object({
    group: GroupSchema,
    members: GroupMembersResponseSchema, // Reuse the standard member response schema
    expenses: z.object({
        expenses: z.array(ExpenseDataSchema),
        hasMore: z.boolean(),
        nextCursor: z.string().nullable().optional(),
    }),
    balances: GroupBalancesSchema,
    settlements: z.object({
        settlements: z.array(SettlementListItemSchema),
        hasMore: z.boolean(),
        nextCursor: z.string().nullable().optional(),
    }),
    comments: ListCommentsResponseSchema,
});

// Minimal group schema for expense details - only includes fields that are actually returned
const MinimalGroupSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    createdBy: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    permissions: z
        .object({
            expenseEditing: z.enum(['anyone', 'owner-and-admin', 'admin-only']).optional(),
            expenseDeletion: z.enum(['anyone', 'owner-and-admin', 'admin-only']).optional(),
            memberInvitation: z.enum(['anyone', 'admin-only']).optional(),
            memberApproval: z.enum(['automatic', 'admin-required']).optional(),
            settingsManagement: z.enum(['anyone', 'admin-only']).optional(),
        })
        .optional(),
});

const ExpenseFullDetailsSchema = z.object({
    expense: ExpenseDataSchema,
    group: MinimalGroupSchema,
    members: z.object({
        members: z.array(GroupMemberDTOSchema),
    }),
});

const ActivityFeedEventTypeSchema = z.enum(Object.values(ActivityFeedEventTypes) as [string, ...string[]]);
const ActivityFeedActionSchema = z.enum(Object.values(ActivityFeedActions) as [string, ...string[]]);

const ActivityFeedItemDetailsSchema = z.object({
    expenseId: z.string().optional(),
    expenseDescription: z.string().optional(),
    commentId: z.string().optional(),
    commentPreview: z.string().optional(),
    settlementId: z.string().optional(),
    settlementDescription: z.string().optional(),
    targetUserId: z.string().optional(),
    targetUserName: z.string().optional(),
    previousGroupName: z.string().optional(),
});

export const ActivityFeedItemSchema = z.object({
    id: z.string(),
    userId: z.string().transform((value) => value as UserId),
    groupId: z.string().transform((value) => toGroupId(value)),
    groupName: z.string().transform(toGroupName),
    eventType: ActivityFeedEventTypeSchema,
    action: ActivityFeedActionSchema,
    actorId: z.string(),
    actorName: z.string(),
    timestamp: z.string().datetime().transform(toISOString),
    details: ActivityFeedItemDetailsSchema,
    createdAt: z.string().datetime().transform(toISOString).optional(),
});

export const ActivityFeedResponseSchema = z.object({
    items: z.array(ActivityFeedItemSchema),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
});

export const responseSchemas = {
    '/config': AppConfigurationSchema,
    '/health': HealthCheckResponseSchema,
    'GET /activity-feed': ActivityFeedResponseSchema,
    'GET /groups': ListGroupsResponseSchema,
    'POST /groups': GroupSchema,
    '/groups/:id': GroupSchema,
    'PUT /groups/:id': MessageResponseSchema,
    '/groups/:id/members': GroupMembersResponseSchema,
    '/groups/:id/full-details': GroupFullDetailsSchema,
    '/expenses': ExpenseDataSchema,
    'DELETE /expenses': MessageResponseSchema,
    '/expenses/group': ExpenseListResponseSchema,
    '/expenses/:id/full-details': ExpenseFullDetailsSchema,
    '/groups/balances': GroupBalancesSchema,
    'POST /groups/share': ShareableLinkResponseSchema,
    '/groups/share': ShareableLinkResponseSchema,
    '/groups/join': JoinGroupResponseSchema,
    '/register': RegisterResponseSchema,
    'POST /settlements': SettlementSchema,
    'PUT /settlements/:settlementId': SettlementListItemSchema,
    'GET /settlements/:settlementId': SettlementListItemSchema,
    'DELETE /settlements/:settlementId': MessageResponseSchema,
    '/settlements': ListSettlementsResponseSchema,
    '/settlements/:settlementId': SettlementListItemSchema,
    // Comment endpoints
    'POST /groups/:groupId/comments': CreateCommentResponseSchema,
    'GET /groups/:groupId/comments': ListCommentsApiResponseSchema,
    'POST /expenses/:expenseId/comments': CreateCommentResponseSchema,
    'GET /expenses/:expenseId/comments': ListCommentsApiResponseSchema,
    // User profile endpoints
    'GET /user/profile': UserProfileResponseSchema,
    'PUT /user/profile': UserProfileResponseSchema,
    'POST /user/change-password': MessageResponseSchema,
    'POST /user/reset-password': MessageResponseSchema,
    // Group member endpoints
    'POST /groups/:id/leave': MessageResponseSchema,
    'DELETE /groups/:id/members/:memberId': MessageResponseSchema,
    'PUT /groups/:id/members/display-name': MessageResponseSchema,
    // Policy endpoints
    'GET /policies/:id/current': CurrentPolicyResponseSchema,
    'GET /user/policies/status': UserPolicyStatusResponseSchema,
    'POST /user/policies/accept-multiple': AcceptMultiplePoliciesResponseSchema,
} as const;

// Schema for the currency-specific balance data used in GroupService.addComputedFields
export const CurrencyBalanceDisplaySchema = z.object({
    currency: z.string(),
    netBalance: z.string(),
    totalOwed: z.string(),
    totalOwing: z.string(),
});

export const BalanceDisplaySchema = z.object({
    balancesByCurrency: z.record(z.string(), CurrencyBalanceDisplaySchema),
});
