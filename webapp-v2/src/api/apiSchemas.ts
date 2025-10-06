/**
 * Zod schemas for runtime validation of API responses
 *
 * MANDATORY: Every API response must be validated against these schemas
 * This ensures type safety at runtime and catches server contract violations
 */

import { z } from 'zod';
import { SplitTypes } from '@splitifyd/shared';

const UserThemeColorSchema = z.object({
    light: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color'),
    dark: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color'),
    name: z.string().min(1).max(50),
    pattern: z.enum(['solid', 'dots', 'stripes', 'diagonal']),
    assignedAt: z.string().datetime(),
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

const ApiConfigSchema = z.object({
    timeout: z.number(),
    retryAttempts: z.number(),
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
    api: ApiConfigSchema,
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
                    netBalance: z.number(),
                    owes: z.record(z.string(), z.number()).optional(),
                    owedBy: z.record(z.string(), z.number()).optional(),
                }),
            ),
        })
        .optional(),
    lastActivity: z.string().min(1),
    lastExpense: z
        .object({
            description: z.string().min(1),
            amount: z.number(),
            date: z.string(),
        })
        .optional(),

    // Security configuration for permission system
    securityPreset: z.enum(['open', 'managed', 'custom']).optional(),
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
const ExpenseSplitSchema = z.object({
    uid: z.string().min(1),
    amount: z.number(),
    percentage: z.number().optional(),
    userName: z.string().min(1).optional(),
});

const ExpenseDataSchema = z.object({
    id: z.string().min(1),
    groupId: z.string().min(1),
    description: z.string().min(1),
    amount: z.number(),
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
});

const ExpenseListResponseSchema = z.object({
    expenses: z.array(ExpenseDataSchema),
    count: z.number(),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
});

const SimplifiedDebtSchema = z.object({
    from: z.object({ uid: z.string() }),
    to: z.object({ uid: z.string() }),
    amount: z.number(),
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
    email: z.string().email(),
    initials: z.string().min(1),

    // User display properties
    photoURL: z.string().url().nullable().optional(),
    themeColor: UserThemeColorSchema,

    // Group membership metadata (required for permissions)
    memberRole: z.enum(['admin', 'member', 'viewer']),
    memberStatus: z.enum(['active', 'pending']),
    joinedAt: z.string().datetime(),
    invitedBy: z.string().optional(),
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
        email: z.string().email(),
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
    amount: z.number().positive(),
    currency: z.string().length(3),
    date: z.string(),
    note: z.string().optional(),
    createdBy: z.string().min(1),
    createdAt: z.string(),
    updatedAt: z.string(),
});

const SettlementListItemSchema = z.object({
    id: z.string().min(1),
    groupId: z.string().min(1),
    payer: z.object({
        uid: z.string().min(1),
        displayName: z.string().min(1),
        email: z.string().email().optional(),
    }),
    payee: z.object({
        uid: z.string().min(1),
        displayName: z.string().min(1),
        email: z.string().email().optional(),
    }),
    amount: z.number().positive(),
    currency: z.string().length(3),
    date: z.string(),
    note: z.string().optional(),
    createdBy: z.string().min(1).optional(),
    createdAt: z.string(),
});

const ListSettlementsResponseSchema = z.object({
    settlements: z.array(SettlementListItemSchema),
    count: z.number(),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
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

const CreateCommentResponseSchema = z.object({
    success: z.boolean(),
    data: CommentSchema,
});

const ListCommentsApiResponseSchema = z.object({
    success: z.boolean(),
    data: ListCommentsResponseSchema,
});

// User profile schemas
const UserProfileResponseSchema = z.object({
    uid: z.string().min(1),
    email: z.string().email(),
    displayName: z.string(),
});

// Group full details schema - combines multiple endpoint responses
const GroupFullDetailsSchema = z.object({
    group: GroupSchema,
    members: z.object({
        members: z.array(
            z.object({
                uid: z.string().min(1),
                email: z.string().email(),
                displayName: z.string().min(1),
                role: z.enum(['system_admin', 'system_user']).optional(),
                termsAcceptedAt: z.any().optional(),
                cookiePolicyAcceptedAt: z.any().optional(),
                acceptedPolicies: z.record(z.string(), z.string()).optional(),
                themeColor: UserThemeColorSchema.optional(),
            }),
        ),
    }),
    expenses: z.object({
        expenses: z.array(ExpenseDataSchema),
        hasMore: z.boolean(),
        nextCursor: z.string().optional(),
    }),
    balances: GroupBalancesSchema,
    settlements: z.object({
        settlements: z.array(SettlementListItemSchema),
        hasMore: z.boolean(),
        nextCursor: z.string().optional(),
    }),
});

export const responseSchemas = {
    '/config': AppConfigurationSchema,
    '/health': HealthCheckResponseSchema,
    'GET /groups': ListGroupsResponseSchema,
    'POST /groups': GroupSchema,
    '/groups/:id': GroupSchema,
    '/groups/:id/members': GroupMembersResponseSchema,
    '/groups/:id/full-details': GroupFullDetailsSchema,
    '/expenses': ExpenseDataSchema,
    'DELETE /expenses': MessageResponseSchema,
    '/expenses/group': ExpenseListResponseSchema,
    '/groups/balances': GroupBalancesSchema,
    'POST /groups/share': ShareableLinkResponseSchema,
    '/groups/share': ShareableLinkResponseSchema,
    '/groups/join': JoinGroupResponseSchema,
    '/register': RegisterResponseSchema,
    'POST /settlements': z.object({
        success: z.boolean(),
        data: SettlementSchema,
    }),
    'PUT /settlements/:settlementId': z.object({
        success: z.boolean(),
        data: SettlementListItemSchema,
    }),
    'GET /settlements/:settlementId': z.object({
        success: z.boolean(),
        data: SettlementListItemSchema,
    }),
    'DELETE /settlements/:settlementId': z.object({
        success: z.boolean(),
        message: z.string(),
    }),
    '/settlements': z.object({
        success: z.boolean(),
        data: ListSettlementsResponseSchema,
    }),
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
} as const;
