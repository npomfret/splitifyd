/**
 * Zod schemas for runtime validation of API responses
 *
 * MANDATORY: Every API response must be validated against these schemas
 * This ensures type safety at runtime and catches server contract violations
 */

import { z } from 'zod';
import {
    ActivityFeedActions,
    ActivityFeedEventTypes,
    PositiveAmountStringSchema,
    SplitTypes,
    SystemUserRoles,
    toDisplayName,
    toEmail,
    toGroupId,
    toGroupName,
    toISOString,
    toShowLandingPageFlag,
    toShowMarketingContentFlag,
    toShowPricingPageFlag,
    toTenantAccentColor,
    toTenantAppName,
    toTenantSurfaceColor,
    toTenantCustomCss,
    toTenantFaviconUrl,
    toTenantTextColor,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantThemePaletteName,
    toUserId,
    UserId,
} from '../shared-types';
import { TenantBrandingSchema } from '../types/branding';

const UserThemeColorSchema = z.object({
    light: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color'),
    dark: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color'),
    name: z.string().min(1).max(50),
    pattern: z.enum(['solid', 'dots', 'stripes', 'diagonal']),
    assignedAt: z.string().datetime().transform(toISOString),
    colorIndex: z.number().int().min(-1), // -1 reserved for neutral phantom members
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

const BrandingMarketingFlagsSchema = z.object({
    showLandingPage: z.boolean().transform(toShowLandingPageFlag).optional(),
    showMarketingContent: z.boolean().transform(toShowMarketingContentFlag).optional(),
    showPricingPage: z.boolean().transform(toShowPricingPageFlag).optional(),
});

const BrandingConfigSchema = z.object({
    appName: z.string().min(1).transform(toTenantAppName),
    logoUrl: z.string().min(1).transform(toTenantLogoUrl),
    faviconUrl: z.string().min(1).transform(toTenantFaviconUrl).optional(), // Optional - falls back to logoUrl
    primaryColor: z.string().min(1).transform(toTenantPrimaryColor),
    secondaryColor: z.string().min(1).transform(toTenantSecondaryColor),
    accentColor: z.string().min(1).transform(toTenantAccentColor).optional(),
    surfaceColor: z.string().min(1).transform(toTenantSurfaceColor).optional(),
    textColor: z.string().min(1).transform(toTenantTextColor).optional(),
    themePalette: z.string().min(1).transform(toTenantThemePaletteName).optional(),
    customCSS: z.string().transform(toTenantCustomCss).optional(),
    marketingFlags: BrandingMarketingFlagsSchema.optional(),
});

export const TenantConfigSchema = z.object({
    tenantId: z.string().min(1).transform(toTenantId),
    branding: BrandingConfigSchema,
    createdAt: z.string().datetime().transform(toISOString),
    updatedAt: z.string().datetime().transform(toISOString),
});

export const AppConfigurationSchema = z.object({
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
    label: z.string().min(1),
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
    shareToken: z.string(),
    shareablePath: z.string(),
    expiresAt: z.string(),
});

const JoinGroupResponseSchema = z.object({
    groupId: z.string(),
    groupName: z.string(),
    success: z.boolean(),
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
    email: z.string().email(),
    emailVerified: z.boolean(),
});

// Admin user profile schema - extends UserProfile with Firebase Auth admin fields
export const AdminUserProfileSchema = z
    .object({
        uid: z.string().transform((value) => toUserId(value)),
        email: z.string().email().transform((value) => toEmail(value)),
        emailVerified: z.boolean(),
        displayName: z.string().transform((value) => toDisplayName(value)),
        photoURL: z.string().nullable(),
        role: z.nativeEnum(SystemUserRoles),
        disabled: z.boolean(),
        metadata: z.object({
            creationTime: z.string(),
            lastSignInTime: z.string().optional(),
        }),
        // Firestore fields (optional)
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
        preferredLanguage: z.string().optional(),
        acceptedPolicies: z.record(z.string(), z.string()).optional(), // Record<PolicyId, VersionHash>
    })
    .passthrough();

// List auth users response schema
export const ListAuthUsersResponseSchema = z.object({
    users: z.array(AdminUserProfileSchema),
    nextPageToken: z.string().optional(),
    hasMore: z.boolean(),
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
    actorId: z.string().transform((value) => value as UserId),
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

// Tenant settings schemas
export const TenantSettingsResponseSchema = z.object({
    tenantId: z.string().min(1).transform(toTenantId),
    config: TenantConfigSchema,
    domains: z.array(z.string().min(1).transform((v: string) => v as any)),
});

export const TenantDomainsResponseSchema = z.object({
    domains: z.array(z.string().min(1).transform((v: string) => v as any)),
});

// Admin tenant list schemas
export const AdminTenantItemSchema = z.object({
    tenant: TenantConfigSchema,
    domains: z.array(z.string()),
    isDefault: z.boolean(),
    brandingTokens: TenantBrandingSchema.optional(),
});

export const AdminTenantsListResponseSchema = z.object({
    tenants: z.array(AdminTenantItemSchema),
    count: z.number(),
});

// ========================================================================
// Merge Response Schemas
// ========================================================================

const MergeJobStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);

export const InitiateMergeResponseSchema = z.object({
    jobId: z.string().min(1),
    status: MergeJobStatusSchema,
});

export const MergeJobResponseSchema = z.object({
    id: z.string().min(1),
    primaryUserId: z.string().min(1).transform(toUserId),
    secondaryUserId: z.string().min(1).transform(toUserId),
    status: MergeJobStatusSchema,
    createdAt: z.string().datetime().transform(toISOString),
    startedAt: z.string().datetime().transform(toISOString).optional(),
    completedAt: z.string().datetime().transform(toISOString).optional(),
    error: z.string().optional(),
});

// ========================================================================
// Policy Admin Response Schemas
// ========================================================================

export const CreatePolicyResponseSchema = z.object({
    id: z.string().min(1),
    versionHash: z.string().min(1),
});

export const UpdatePolicyResponseSchema = z.object({
    versionHash: z.string().min(1),
    published: z.boolean(),
    currentVersionHash: z.string().min(1).optional(),
});

export const PublishPolicyResponseSchema = z.object({
    currentVersionHash: z.string().min(1),
});

// ========================================================================
// Admin Browser Response Schemas
// ========================================================================

// Schema for Firestore user profile (simpler than AdminUserProfile from Auth)
const FirestoreUserProfileSchema = z.object({
    uid: z.string().min(1).transform(toUserId),
    displayName: z.string().transform(toDisplayName),
    email: z.string().email().transform(toEmail),
    role: z.nativeEnum(SystemUserRoles).optional(),
    photoURL: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    preferredLanguage: z.string().optional(),
});

export const ListFirestoreUsersResponseSchema = z.object({
    users: z.array(FirestoreUserProfileSchema),
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
});

// ========================================================================
// Tenant Theme Response Schemas
// ========================================================================

export const PublishTenantThemeResponseSchema = z.object({
    cssUrl: z.string().min(1),
    tokensUrl: z.string().min(1),
    artifact: z.object({
        hash: z.string().min(1),
        cssUrl: z.string().min(1),
        tokensUrl: z.string().min(1),
        version: z.number().int().min(0),
        generatedAtEpochMs: z.number().int().min(0),
        generatedBy: z.string().min(1),
    }),
});

export const responseSchemas = {
    '/config': AppConfigurationSchema,
    '/health': HealthCheckResponseSchema,
    'GET /activity-feed': ActivityFeedResponseSchema,
    'GET /groups': ListGroupsResponseSchema,
    'POST /groups': GroupSchema,
    '/groups/:groupId': GroupSchema,
    'PUT /groups/:groupId': MessageResponseSchema,
    '/groups/:groupId/members': GroupMembersResponseSchema,
    '/groups/:groupId/full-details': GroupFullDetailsSchema,
    '/expenses': ExpenseDataSchema,
    'DELETE /expenses': MessageResponseSchema,
    '/expenses/group': ExpenseListResponseSchema,
    '/expenses/:expenseId/full-details': ExpenseFullDetailsSchema,
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
    'POST /user/change-email': UserProfileResponseSchema,
    'POST /user/change-password': MessageResponseSchema,
    'POST /user/reset-password': MessageResponseSchema,
    // Group member endpoints
    'POST /groups/:groupId/leave': MessageResponseSchema,
    'DELETE /groups/:groupId': MessageResponseSchema,
    'DELETE /groups/:groupId/members/:memberId': MessageResponseSchema,
    'PUT /groups/:groupId/members/display-name': MessageResponseSchema,
    // Policy endpoints
    'GET /policies/:policyId/current': CurrentPolicyResponseSchema,
    'GET /user/policies/status': UserPolicyStatusResponseSchema,
    'POST /user/policies/accept-multiple': AcceptMultiplePoliciesResponseSchema,
    // Tenant settings endpoints
    'GET /settings/tenant': TenantSettingsResponseSchema,
    'GET /settings/tenant/domains': TenantDomainsResponseSchema,
    'PUT /settings/tenant/branding': MessageResponseSchema,
    'POST /settings/tenant/domains': MessageResponseSchema,
    // Admin tenant endpoints
    'GET /admin/browser/tenants': AdminTenantsListResponseSchema,
    // Admin user management endpoints
    'GET /admin/browser/users/auth': ListAuthUsersResponseSchema,
    'GET /admin/browser/users/firestore': ListFirestoreUsersResponseSchema,
    'PUT /admin/users/:userId': AdminUserProfileSchema,
    'PUT /admin/users/:userId/role': AdminUserProfileSchema,
    // Merge endpoints
    'POST /merge': InitiateMergeResponseSchema,
    'GET /merge/:jobId': MergeJobResponseSchema,
    // Policy admin endpoints
    'POST /admin/policies': CreatePolicyResponseSchema,
    'PUT /admin/policies/:policyId': UpdatePolicyResponseSchema,
    'POST /admin/policies/:policyId/publish': PublishPolicyResponseSchema,
    // Tenant theme endpoints
    'POST /admin/tenants/publish': PublishTenantThemeResponseSchema,
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
