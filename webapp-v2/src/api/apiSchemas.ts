/**
 * Zod schemas for runtime validation of API responses
 *
 * MANDATORY: Every API response must be validated against these schemas
 * This ensures type safety at runtime and catches server contract violations
 */

import { z } from 'zod';
import { UserRoles, SplitTypes } from '@shared/shared-types';

// Base schemas
export const UserThemeColorSchema = z.object({
    light: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color'),
    dark: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color'),
    name: z.string().min(1).max(50),
    pattern: z.enum(['solid', 'dots', 'stripes', 'diagonal']),
    assignedAt: z.string().datetime(),
    colorIndex: z.number().int().min(0),
});

export const MemberSchema = z.object({
    uid: z.string().min(1),
    name: z.string().min(1),
    initials: z.string().min(1),
    email: z.string().email().optional(),
    displayName: z.string().min(1).optional(),
    joinedAt: z.string().optional(),
    themeColor: UserThemeColorSchema.optional(),
});

export const FirebaseConfigSchema = z.object({
    apiKey: z.string(),
    authDomain: z.string(),
    projectId: z.string(),
    storageBucket: z.string(),
    messagingSenderId: z.string(),
    appId: z.string(),
    measurementId: z.string().optional(),
});

export const ApiConfigSchema = z.object({
    timeout: z.number(),
    retryAttempts: z.number(),
});

export const WarningBannerSchema = z.object({
    enabled: z.boolean(),
    message: z.string().min(1),
});

export const EnvironmentConfigSchema = z.object({
    warningBanner: WarningBannerSchema.optional(),
});

export const FormDefaultsSchema = z.object({
    displayName: z.string().optional(),
    email: z.string().optional(),
    password: z.string().optional(),
});

// Configuration response
export const AppConfigurationSchema = z.object({
    firebase: FirebaseConfigSchema,
    api: ApiConfigSchema,
    environment: EnvironmentConfigSchema,
    formDefaults: FormDefaultsSchema,
    firebaseAuthUrl: z.string().optional(),
    firebaseFirestoreUrl: z.string().optional(),
});

// Group schemas

export const GroupSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    memberIds: z.array(z.string()),
    balance: z.object({
        balancesByCurrency: z.record(
            z.string(),
            z.object({
                currency: z.string(),
                netBalance: z.number(),
                totalOwed: z.number(),
                totalOwing: z.number(),
            }),
        ),
    }),
    lastActivity: z.string().min(1),
    lastActivityRaw: z.string(),
    lastExpense: z
        .object({
            description: z.string().min(1),
            amount: z.number(),
            date: z.string(),
        })
        .optional(),

    // Optional fields for detail view
    members: z.array(MemberSchema).optional(),
    createdBy: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    lastExpenseTime: z.string().optional(),
});

// Change metadata schema for REST responses
export const ChangeMetadataSchema = z.object({
    lastChangeTimestamp: z.number(),
    changeCount: z.number(),
    serverTime: z.number(),
    hasRecentChanges: z.boolean().optional(),
});

// Minimal change document schemas for Firestore notifications
export const MinimalChangeDocumentSchema = z.object({
    id: z.string(),
    type: z.enum(['group', 'expense', 'settlement']),
    action: z.enum(['created', 'updated', 'deleted']),
    timestamp: z.any(), // Firestore Timestamp
    users: z.array(z.string()),
    groupId: z.string().optional(), // Only for expense/settlement
});

export const MinimalBalanceChangeDocumentSchema = z.object({
    groupId: z.string(),
    type: z.literal('balance'),
    action: z.literal('recalculated'),
    timestamp: z.any(), // Firestore Timestamp
    users: z.array(z.string()),
});

export const ListGroupsResponseSchema = z.object({
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
    userId: z.string().min(1),
    amount: z.number(),
    percentage: z.number().optional(),
    userName: z.string().min(1).optional(),
});

export const ExpenseDataSchema = z.object({
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

export const ExpenseListResponseSchema = z.object({
    expenses: z.array(ExpenseDataSchema),
    count: z.number(),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
});

// Balance schemas - Updated to match server response structure
export const UserBalanceSchema = z.object({
    userId: z.string(),
    netBalance: z.number(),
    owes: z.record(z.string(), z.number()),
    owedBy: z.record(z.string(), z.number()),
});

export const SimplifiedDebtSchema = z.object({
    from: z.object({ userId: z.string() }),
    to: z.object({ userId: z.string() }),
    amount: z.number(),
    currency: z.string().length(3),
});

export const GroupBalancesSchema = z.object({
    groupId: z.string(),
    userBalances: z.record(z.string(), UserBalanceSchema), // Legacy field for internal use
    simplifiedDebts: z.array(SimplifiedDebtSchema),
    lastUpdated: z.string(),
    balancesByCurrency: z.record(z.string(), z.record(z.string(), UserBalanceSchema)),
});

// Group members response schema
export const GroupMembersResponseSchema = z.object({
    members: z.array(
        z.object({
            uid: z.string().min(1),
            email: z.string().email(),
            displayName: z.string().min(1),
            role: z.enum([UserRoles.ADMIN, UserRoles.USER]).optional(),
            termsAcceptedAt: z.any().optional(),
            cookiePolicyAcceptedAt: z.any().optional(),
            acceptedPolicies: z.record(z.string(), z.string()).optional(),
            themeColor: UserThemeColorSchema.optional(),
        }),
    ),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
});

// Share schemas
export const ShareableLinkResponseSchema = z.object({
    linkId: z.string(),
    shareablePath: z.string(),
});

export const JoinGroupResponseSchema = z.object({
    groupId: z.string(),
    groupName: z.string(),
    success: z.boolean(),
});

// Health check schemas
export const HealthCheckResponseSchema = z.object({
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

// Error response schema
export const ApiErrorResponseSchema = z.object({
    error: z.object({
        code: z.string().min(1),
        message: z.string().min(1),
        details: z.unknown().optional(),
    }),
});

// Map of endpoints to their response schemas
export const RegisterResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().min(1),
    user: z.object({
        uid: z.string().min(1),
        email: z.string().email(),
        displayName: z.string().min(2).max(50),
    }),
});

// Generic message response for operations like DELETE
export const MessageResponseSchema = z.object({
    message: z.string().min(1),
});

// Settlement schemas
export const SettlementSchema = z.object({
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

export const SettlementListItemSchema = z.object({
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

export const ListSettlementsResponseSchema = z.object({
    settlements: z.array(SettlementListItemSchema),
    count: z.number(),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
});

// User profile schemas
export const UserProfileResponseSchema = z.object({
    uid: z.string().min(1),
    email: z.string().email(),
    displayName: z.string(),
});

export const responseSchemas = {
    '/config': AppConfigurationSchema,
    '/health': HealthCheckResponseSchema,
    'GET /groups': ListGroupsResponseSchema,
    'POST /groups': GroupSchema,
    '/groups/:id': GroupSchema,
    '/groups/:id/members': GroupMembersResponseSchema,
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
    '/settlements': z.object({
        success: z.boolean(),
        data: ListSettlementsResponseSchema,
    }),
    '/settlements/:settlementId': SettlementListItemSchema,
    // User profile endpoints
    'GET /user/profile': UserProfileResponseSchema,
    'PUT /user/profile': UserProfileResponseSchema,
    'POST /user/change-password': MessageResponseSchema,
    'POST /user/reset-password': MessageResponseSchema,
    'DELETE /user/account': MessageResponseSchema,
} as const;
