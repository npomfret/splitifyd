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
    ReactionEmojis,
    SplitTypes,
    SystemUserRoles,
    toActivityFeedItemId,
    toAttachmentId,
    toDisplayName,
    toEmail,
    toExpenseLabel,
    toGroupId,
    toGroupName,
    toISOString,
    toShowMarketingContentFlag,
    toShowPricingPageFlag,
    toTenantAccentColor,
    toTenantId,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toUserId,
    UserId,
} from '../shared-types';
import { TenantBrandingSchema } from '../types/branding';

const UserThemeColorSchema = z
    .object({
        light: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color'),
        dark: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color'),
        name: z.string().min(1).max(50),
        pattern: z.enum(['solid', 'dots', 'stripes', 'diagonal']),
        assignedAt: z.string().datetime().transform(toISOString),
        colorIndex: z.number().int().min(-1), // -1 reserved for neutral phantom members
    })
    .passthrough();

const FirebaseConfigSchema = z
    .object({
        apiKey: z.string(),
        authDomain: z.string(),
        projectId: z.string(),
        storageBucket: z.string(),
        messagingSenderId: z.string(),
        appId: z.string(),
        measurementId: z.string().optional(),
    })
    .passthrough();

const FormDefaultsSchema = z
    .object({
        displayName: z.string().optional(),
        email: z.string().optional(),
        password: z.string().optional(),
    })
    .passthrough();

const BrandingMarketingFlagsSchema = z
    .object({
        showMarketingContent: z.boolean().transform(toShowMarketingContentFlag).optional(),
        showPricingPage: z.boolean().transform(toShowPricingPageFlag).optional(),
    })
    .passthrough();

const BrandingConfigSchema = z
    .object({
        primaryColor: z.string().min(1).transform(toTenantPrimaryColor),
        secondaryColor: z.string().min(1).transform(toTenantSecondaryColor),
        accentColor: z.string().min(1).transform(toTenantAccentColor).optional(),
        showAppNameInHeader: z.boolean().optional(),
    })
    .passthrough();

export const TenantConfigSchema = z
    .object({
        tenantId: z.string().min(1).transform(toTenantId),
        branding: BrandingConfigSchema,
        brandingTokens: TenantBrandingSchema,
        marketingFlags: BrandingMarketingFlagsSchema.optional(),
        createdAt: z.string().datetime().transform(toISOString),
        updatedAt: z.string().datetime().transform(toISOString),
    })
    .passthrough();

/**
 * Schema for tenant config JSON files stored in docs/tenants/{tenant-id}/config.json.
 * This differs from TenantConfigSchema (the API response format) in that:
 * - Uses `id` instead of `tenantId`
 * - Includes `domains` array and `isDefault` flag
 * - No createdAt/updatedAt (added by Firestore)
 */
export const TenantConfigFileSchema = z.object({
    id: z.string().min(1),
    domains: z.array(z.string().min(1)).min(1),
    branding: z.object({
        primaryColor: z.string().min(1),
        secondaryColor: z.string().min(1),
        accentColor: z.string().min(1).optional(),
        showAppNameInHeader: z.boolean().optional(),
    }),
    marketingFlags: z
        .object({
            showMarketingContent: z.boolean().optional(),
            showPricingPage: z.boolean().optional(),
        })
        .optional(),
    brandingTokens: TenantBrandingSchema,
    isDefault: z.boolean().optional(),
});

export type TenantConfigFile = z.infer<typeof TenantConfigFileSchema>;

const ThemeConfigSchema = z
    .object({
        hash: z.string().min(1),
        generatedAtEpochMs: z.number().optional(),
    })
    .passthrough();

export const AppConfigurationSchema = z
    .object({
        firebase: FirebaseConfigSchema,
        warningBanner: z.string().optional(),
        formDefaults: FormDefaultsSchema,
        tenant: TenantConfigSchema.optional(),
        theme: ThemeConfigSchema.nullable().optional(),
        firebaseAuthUrl: z.string().optional(),
        firebaseFirestoreUrl: z.string().optional(),
    })
    .passthrough();

// Group schemas

const GroupSchema = z
    .object({
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
                expenseEditing: z.enum(['anyone', 'creator-and-admin', 'admin-only']).optional(),
                expenseDeletion: z.enum(['anyone', 'creator-and-admin', 'admin-only']).optional(),
                memberInvitation: z.enum(['anyone', 'admin-only']).optional(),
                memberApproval: z.enum(['automatic', 'admin-required']).optional(),
                settingsManagement: z.enum(['anyone', 'admin-only']).optional(),
            })
            .optional(),

        // Optional fields for detail view
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
        deletedAt: z.string().nullable().optional(),
        lastExpenseTime: z.string().optional(),

        // Currency restrictions
        currencySettings: z
            .object({
                permitted: z.array(z.string()),
                default: z.string(),
            })
            .optional(),

        // Recently used expense labels (label -> last used ISO timestamp)
        recentlyUsedLabels: z.record(z.string(), z.string()).optional(),
    })
    .passthrough();

// Change metadata schema for REST responses
const ChangeMetadataSchema = z
    .object({
        lastChangeTimestamp: z.number(),
        changeCount: z.number(),
        serverTime: z.number(),
    })
    .passthrough();

const ListGroupsResponseSchema = z
    .object({
        groups: z.array(GroupSchema),
        count: z.number(),
        hasMore: z.boolean(),
        nextCursor: z.string().optional(),
        pagination: z
            .object({
                limit: z.number(),
                order: z.string(),
            })
            .passthrough(),
        metadata: ChangeMetadataSchema.optional(),
    })
    .passthrough();

// Expense schemas
export const ExpenseSplitSchema = z
    .object({
        uid: z.string().min(1),
        amount: PositiveAmountStringSchema,
        percentage: z.number().optional(),
        userName: z.string().min(1).optional(),
    })
    .passthrough();

const ExpenseDataSchema = z
    .object({
        id: z.string().min(1),
        groupId: z.string().min(1),
        description: z.string().min(1),
        amount: PositiveAmountStringSchema,
        currency: z.string().length(3),
        paidBy: z.string().min(1),
        paidByName: z.string().min(1).optional(),
        labels: z.array(z.string().transform(toExpenseLabel)).max(3), // 0-3 freeform labels
        date: z.string(),
        splitType: z.enum([SplitTypes.EQUAL, SplitTypes.EXACT, SplitTypes.PERCENTAGE]),
        participants: z.array(z.string().min(1)),
        splits: z.array(ExpenseSplitSchema),
        createdBy: z.string().min(1),
        createdAt: z.string(),
        updatedAt: z.string(),
        receiptUrl: z.string().optional(),
        location: z
            .object({
                name: z.string(),
                url: z.string().optional(),
            })
            .optional(),
        deletedAt: z.string().nullable().optional(), // Soft delete timestamp
        deletedBy: z.string().nullable().optional(), // User who deleted the expense
        supersededBy: z.string().nullable(), // ExpenseId of newer version if edited, null if current
        isLocked: z.boolean().optional(), // True if any participant has left the group
    })
    .passthrough();

const ExpenseListResponseSchema = z
    .object({
        expenses: z.array(ExpenseDataSchema),
        count: z.number(),
        hasMore: z.boolean(),
        nextCursor: z.string().optional(),
    })
    .passthrough();

export const SimplifiedDebtSchema = z
    .object({
        from: z.object({ uid: z.string() }).passthrough(),
        to: z.object({ uid: z.string() }).passthrough(),
        amount: PositiveAmountStringSchema,
        currency: z.string().length(3),
    })
    .passthrough();

const GroupBalancesSchema = z
    .object({
        groupId: z.string(),
        simplifiedDebts: z.array(SimplifiedDebtSchema),
        lastUpdated: z.string(),
    })
    .passthrough();

// Group member DTO schema - validates the lean DTO returned by API
const GroupMemberDTOSchema = z
    .object({
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
    })
    .passthrough();

// Group members response schema
const GroupMembersResponseSchema = z
    .object({
        members: z.array(GroupMemberDTOSchema),
        hasMore: z.boolean(),
        nextCursor: z.string().optional(),
    })
    .passthrough();

// Share schemas
const ShareableLinkResponseSchema = z
    .object({
        shareToken: z.string(),
        shareablePath: z.string(),
        expiresAt: z.string(),
    })
    .passthrough();

const JoinGroupResponseSchema = z
    .object({
        groupId: z.string(),
        groupName: z.string(),
        memberStatus: z.enum(['active', 'pending', 'archived']),
    })
    .passthrough();

// Health check schemas
const HealthCheckResponseSchema = z
    .object({
        status: z.enum(['healthy', 'unhealthy']),
        timestamp: z.string().datetime(),
        checks: z
            .object({
                firestore: z
                    .object({
                        status: z.enum(['healthy', 'unhealthy']),
                        responseTime: z.number().optional(),
                        error: z.string().optional(),
                    })
                    .passthrough(),
                auth: z
                    .object({
                        status: z.enum(['healthy', 'unhealthy']),
                        responseTime: z.number().optional(),
                        error: z.string().optional(),
                    })
                    .passthrough(),
            })
            .passthrough(),
    })
    .passthrough();

// Error response schema - two-tier error code format
export const ApiErrorResponseSchema = z
    .object({
        error: z
            .object({
                code: z.string().min(1), // Category code (e.g., VALIDATION_ERROR, NOT_FOUND)
                detail: z.string().optional(), // Specific error detail (e.g., INVALID_AMOUNT, GROUP_NOT_FOUND)
                resource: z.string().optional(), // Resource type (e.g., 'Group', 'Expense')
                resourceId: z.string().optional(), // Resource ID for logging
                field: z.string().optional(), // Field name for single-field validation errors
                fields: z.record(z.string(), z.string()).optional(), // Multiple field errors for validation
                correlationId: z.string().optional(), // Request correlation ID
            })
            .passthrough(),
    })
    .passthrough();

// Map of endpoints to their response schemas
const RegisterResponseSchema = z
    .object({
        success: z.boolean(),
        message: z.string().min(1),
        user: z
            .object({
                uid: z.string().min(1),
                displayName: z.string().min(2).max(50),
            })
            .passthrough(),
    })
    .passthrough();

// Login response schema
export const LoginResponseSchema = z
    .object({
        success: z.boolean(),
        customToken: z.string().min(1),
    })
    .passthrough();

// Empty response schema for 204 No Content responses
// Used to signal that the endpoint returns no body
export const EmptyResponseSchema = z.void();

// Settlement schemas
const SettlementSchema = z
    .object({
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
    })
    .passthrough();

// Minimal member schema for settlements - only includes fields needed for display
// Does not require group membership metadata like joinedAt, memberRole, etc.
const SettlementMemberSchema = z
    .object({
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
    })
    .passthrough();

const SettlementListItemSchema = z
    .object({
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
        supersededBy: z.string().nullable(), // SettlementId of newer version if edited, null if current
        isLocked: z.boolean().optional(), // True if payer or payee has left the group
    })
    .passthrough();

const ListSettlementsResponseSchema = z
    .object({
        settlements: z.array(SettlementListItemSchema),
        count: z.number(),
        hasMore: z.boolean(),
        nextCursor: z.string().nullable().optional(),
    })
    .passthrough();

// Attachment schemas
const CommentAttachmentRefSchema = z.object({
    attachmentId: z.string().min(1).transform(toAttachmentId),
    fileName: z.string().min(1),
    contentType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
});

const AttachmentDTOSchema = z
    .object({
        id: z.string().min(1).transform(toAttachmentId),
        fileName: z.string().min(1),
        contentType: z.string().min(1),
        sizeBytes: z.number().int().positive(),
    })
    .passthrough();

const UploadAttachmentResponseSchema = z
    .object({
        attachment: AttachmentDTOSchema,
        url: z.string().min(1),
    })
    .passthrough();

// Comment schemas
const CommentSchema = z
    .object({
        id: z.string().min(1),
        authorId: z.string().min(1),
        authorName: z.string().min(1),
        authorAvatar: z.string().optional(),
        text: z.string().min(1).max(500),
        attachments: z.array(CommentAttachmentRefSchema).optional(),
        createdAt: z.string(),
        updatedAt: z.string(),
    })
    .passthrough();

const ListCommentsResponseSchema = z
    .object({
        comments: z.array(CommentSchema),
        hasMore: z.boolean(),
        nextCursor: z.string().optional(),
    })
    .passthrough();

// Comment response is now unwrapped - returns CommentDTO directly
const CreateCommentResponseSchema = CommentSchema;

// List comments response is now unwrapped - returns ListCommentsResponse directly
const ListCommentsApiResponseSchema = ListCommentsResponseSchema;

// Reaction toggle response schema
const ReactionToggleResponseSchema = z
    .object({
        action: z.enum(['added', 'removed']),
        emoji: z.enum([
            ReactionEmojis.THUMBS_UP,
            ReactionEmojis.HEART,
            ReactionEmojis.LAUGH,
            ReactionEmojis.WOW,
            ReactionEmojis.SAD,
            ReactionEmojis.CELEBRATE,
        ]),
        newCount: z.number().int().min(0),
    })
    .strict();

// User profile schemas
const UserProfileResponseSchema = z
    .object({
        displayName: z.string(),
        role: z.nativeEnum(SystemUserRoles),
        email: z.string().email(),
        emailVerified: z.boolean(),
        preferredLanguage: z.string().optional(),
        adminEmailsAcceptedAt: z.string().datetime().optional(),
        marketingEmailsAcceptedAt: z.string().datetime().nullable().optional(),
    })
    .passthrough();

// Admin user profile schema - extends UserProfile with Firebase Auth admin fields
// Note: email is intentionally excluded for privacy. Admins can search by email (server-side)
// but email is never returned in responses.
export const AdminUserProfileSchema = z
    .object({
        uid: z.string().transform((value) => toUserId(value)),
        // email intentionally excluded for privacy
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
        acceptedPolicies: z.record(z.string(), z.record(z.string(), z.string())).optional(), // Record<PolicyId, Record<VersionHash, ISOString>>
        signupTenantId: z.string().transform((value) => toTenantId(value)).optional(), // Tenant where user signed up
    })
    .passthrough();

// List auth users response schema
export const ListAuthUsersResponseSchema = z
    .object({
        users: z.array(AdminUserProfileSchema),
        nextPageToken: z.string().optional(),
        hasMore: z.boolean(),
    })
    .passthrough();

// Policy schemas
const PolicyAcceptanceStatusSchema = z
    .object({
        policyId: z.string().min(1),
        currentVersionHash: z.string().min(1),
        userAcceptedHash: z.string().optional(),
        needsAcceptance: z.boolean(),
        policyName: z.string().min(1),
    })
    .passthrough();

const UserPolicyStatusResponseSchema = z
    .object({
        needsAcceptance: z.boolean(),
        policies: z.array(PolicyAcceptanceStatusSchema),
        totalPending: z.number().int().min(0),
    })
    .passthrough();

const AcceptMultiplePoliciesResponseSchema = z
    .object({
        acceptedPolicies: z.array(
            z
                .object({
                    policyId: z.string().min(1),
                    versionHash: z.string().min(1),
                    acceptedAt: z.string().datetime().transform(toISOString),
                })
                .passthrough(),
        ),
    })
    .passthrough();

// Group full details schema - combines multiple endpoint responses
const GroupFullDetailsSchema = z
    .object({
        group: GroupSchema,
        members: GroupMembersResponseSchema, // Reuse the standard member response schema
        expenses: z
            .object({
                expenses: z.array(ExpenseDataSchema),
                hasMore: z.boolean(),
                nextCursor: z.string().nullable().optional(),
            })
            .passthrough(),
        balances: GroupBalancesSchema,
        settlements: z
            .object({
                settlements: z.array(SettlementListItemSchema),
                hasMore: z.boolean(),
                nextCursor: z.string().nullable().optional(),
            })
            .passthrough(),
        comments: ListCommentsResponseSchema,
    })
    .passthrough();

// Minimal group schema for expense details - only includes fields that are actually returned
const MinimalGroupSchema = z
    .object({
        id: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        createdBy: z.string().optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
        permissions: z
            .object({
                expenseEditing: z.enum(['anyone', 'creator-and-admin', 'admin-only']).optional(),
                expenseDeletion: z.enum(['anyone', 'creator-and-admin', 'admin-only']).optional(),
                memberInvitation: z.enum(['anyone', 'admin-only']).optional(),
                memberApproval: z.enum(['automatic', 'admin-required']).optional(),
                settingsManagement: z.enum(['anyone', 'admin-only']).optional(),
            })
            .passthrough()
            .optional(),
    })
    .passthrough();

const ExpenseFullDetailsSchema = z
    .object({
        expense: ExpenseDataSchema,
        group: MinimalGroupSchema,
        members: z
            .object({
                members: z.array(GroupMemberDTOSchema),
            })
            .passthrough(),
    })
    .passthrough();

const ActivityFeedEventTypeSchema = z.enum(Object.values(ActivityFeedEventTypes) as [string, ...string[]]);
const ActivityFeedActionSchema = z.enum(Object.values(ActivityFeedActions) as [string, ...string[]]);

const ActivityFeedItemDetailsSchema = z
    .object({
        expenseId: z.string().optional(),
        expenseDescription: z.string().optional(),
        commentId: z.string().optional(),
        commentPreview: z.string().optional(),
        settlementId: z.string().optional(),
        settlementDescription: z.string().optional(),
        targetUserId: z.string().optional(),
        targetUserName: z.string().optional(),
        previousGroupName: z.string().optional(),
    })
    .passthrough();

export const ActivityFeedItemSchema = z
    .object({
        id: z.string().transform(toActivityFeedItemId),
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
    })
    .passthrough();

export const ActivityFeedResponseSchema = z
    .object({
        items: z.array(ActivityFeedItemSchema),
        hasMore: z.boolean(),
        nextCursor: z.string().optional(),
    })
    .passthrough();

// Tenant settings schemas
export const TenantSettingsResponseSchema = z
    .object({
        tenantId: z.string().min(1).transform(toTenantId),
        config: TenantConfigSchema,
        domains: z.array(z.string().min(1).transform((v: string) => v as any)),
    })
    .passthrough();

export const TenantDomainsResponseSchema = z
    .object({
        domains: z.array(z.string().min(1).transform((v: string) => v as any)),
    })
    .passthrough();

// Admin tenant list schemas
export const AdminTenantItemSchema = z
    .object({
        tenant: TenantConfigSchema,
        domains: z.array(z.string()),
        isDefault: z.boolean(),
    })
    .passthrough();

export const AdminTenantsListResponseSchema = z
    .object({
        tenants: z.array(AdminTenantItemSchema),
        count: z.number(),
    })
    .passthrough();

// ========================================================================
// Merge Response Schemas
// ========================================================================

const MergeJobStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);

export const InitiateMergeResponseSchema = z
    .object({
        jobId: z.string().min(1),
        status: MergeJobStatusSchema,
    })
    .passthrough();

export const MergeJobResponseSchema = z
    .object({
        id: z.string().min(1),
        primaryUserId: z.string().min(1).transform(toUserId),
        secondaryUserId: z.string().min(1).transform(toUserId),
        status: MergeJobStatusSchema,
        createdAt: z.string().datetime().transform(toISOString),
        startedAt: z.string().datetime().transform(toISOString).optional(),
        completedAt: z.string().datetime().transform(toISOString).optional(),
        error: z.string().optional(),
    })
    .passthrough();

// ========================================================================
// Policy Admin Response Schemas
// ========================================================================

export const CreatePolicyResponseSchema = z
    .object({
        id: z.string().min(1),
        versionHash: z.string().min(1),
    })
    .passthrough();

export const UpdatePolicyResponseSchema = z
    .object({
        versionHash: z.string().min(1),
        published: z.boolean(),
        currentVersionHash: z.string().min(1).optional(),
    })
    .passthrough();

export const PublishPolicyResponseSchema = z
    .object({
        currentVersionHash: z.string().min(1),
    })
    .passthrough();

// ========================================================================
// Admin Browser Response Schemas
// ========================================================================

// Schema for Firestore user profile (simpler than AdminUserProfile from Auth)
const FirestoreUserProfileSchema = z
    .object({
        uid: z.string().min(1).transform(toUserId),
        displayName: z.string().transform(toDisplayName),
        email: z.string().email().transform(toEmail),
        role: z.nativeEnum(SystemUserRoles).optional(),
        photoURL: z.string().nullable().optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
        preferredLanguage: z.string().optional(),
    })
    .passthrough();

export const ListFirestoreUsersResponseSchema = z
    .object({
        users: z.array(FirestoreUserProfileSchema),
        nextCursor: z.string().optional(),
        hasMore: z.boolean(),
    })
    .passthrough();

// ========================================================================
// Tenant Theme Response Schemas
// ========================================================================

export const PublishTenantThemeResponseSchema = z
    .object({
        cssUrl: z.string().min(1),
        tokensUrl: z.string().min(1),
        artifact: z
            .object({
                hash: z.string().min(1),
                cssUrl: z.string().min(1),
                tokensUrl: z.string().min(1),
                version: z.number().int().min(0),
                generatedAtEpochMs: z.number().int().min(0),
                generatedBy: z.string().min(1),
            })
            .passthrough(),
    })
    .passthrough();

// ========================================================================
// Group Member Management Schemas
// ========================================================================

// GroupMembershipDTO schema - the raw membership document (different from GroupMemberDTO)
const GroupMembershipDTOSchema = z
    .object({
        uid: z.string().min(1).transform(toUserId),
        groupId: z.string().min(1).transform(toGroupId),
        memberRole: z.enum(['admin', 'member', 'viewer']),
        memberStatus: z.enum(['active', 'pending', 'archived']),
        joinedAt: z.string().datetime().transform(toISOString),
        invitedBy: z.string().transform(toUserId).optional(),
        theme: UserThemeColorSchema,
        groupDisplayName: z.string().min(1).transform(toDisplayName),
    })
    .passthrough();

// Pending members response - array of GroupMembershipDTO
const PendingMembersResponseSchema = z.array(GroupMembershipDTOSchema);

// ========================================================================
// Admin Policy Schemas
// ========================================================================

const PolicyVersionSchema = z
    .object({
        text: z.string().min(1),
        createdAt: z.string().datetime().transform(toISOString),
    })
    .passthrough();

const PolicyDTOSchema = z
    .object({
        id: z.string().min(1),
        policyName: z.string().min(1),
        currentVersionHash: z.string().min(1),
        versions: z.record(z.string(), PolicyVersionSchema),
    })
    .passthrough();

const ListPoliciesResponseSchema = z
    .object({
        policies: z.array(PolicyDTOSchema),
        count: z.number().int().min(0),
    })
    .passthrough();

const PolicyVersionResponseSchema = PolicyVersionSchema
    .extend({
        versionHash: z.string().min(1),
    })
    .passthrough();

const DeletePolicyVersionResponseSchema = z.object({}).passthrough();

// Public policy response (for policy acceptance modal)
const CurrentPolicyResponseSchema = z
    .object({
        id: z.string().min(1),
        policyName: z.string().min(1),
        currentVersionHash: z.string().min(1),
        text: z.string().min(1),
        createdAt: z.string().datetime().transform(toISOString),
    })
    .passthrough();

// ========================================================================
// Admin User Schemas
// ========================================================================

// Raw Firebase Auth user record (passthrough for flexibility)
const AdminUserAuthRecordSchema = z
    .object({
        uid: z.string().min(1),
        email: z.string().optional(),
        emailVerified: z.boolean().optional(),
        displayName: z.string().optional(),
        disabled: z.boolean().optional(),
        metadata: z
            .object({
                creationTime: z.string().optional(),
                lastSignInTime: z.string().optional(),
            })
            .passthrough()
            .optional(),
    })
    .passthrough();

// Raw Firestore user document (passthrough for flexibility)
const AdminUserFirestoreRecordSchema = z
    .object({
        uid: z.string().min(1).transform(toUserId).optional(),
        displayName: z.string().transform(toDisplayName).optional(),
        email: z.string().email().transform(toEmail).optional(),
        role: z.nativeEnum(SystemUserRoles).optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
    })
    .passthrough();

// ========================================================================
// Admin Tenant Schemas
// ========================================================================

const UpsertTenantResponseSchema = z
    .object({
        tenantId: z.string().min(1),
        created: z.boolean(),
    })
    .passthrough();

const UploadTenantAssetResponseSchema = z
    .object({
        url: z.string().min(1),
    })
    .passthrough();

// ========================================================================
// Group Preview Schema
// ========================================================================

const GroupPreviewResponseSchema = z
    .object({
        groupId: z.string().min(1).transform(toGroupId),
        groupName: z.string().min(1).transform(toGroupName),
        groupDescription: z.string(),
        memberCount: z.number().int().min(0),
        isAlreadyMember: z.boolean(),
    })
    .passthrough();

export const responseSchemas = {
    '/config': AppConfigurationSchema,
    '/health': HealthCheckResponseSchema,
    'GET /activity-feed': ActivityFeedResponseSchema,
    'GET /groups': ListGroupsResponseSchema,
    'POST /groups': GroupSchema,
    '/groups/:groupId': GroupSchema,
    'PUT /groups/:groupId': EmptyResponseSchema,
    '/groups/:groupId/members': GroupMembersResponseSchema,
    '/groups/:groupId/full-details': GroupFullDetailsSchema,
    '/expenses': ExpenseDataSchema,
    'PUT /expenses/:expenseId': ExpenseDataSchema,
    'DELETE /expenses/:expenseId': EmptyResponseSchema,
    '/expenses/group': ExpenseListResponseSchema,
    '/expenses/:expenseId/full-details': ExpenseFullDetailsSchema,
    '/groups/balances': GroupBalancesSchema,
    'POST /groups/share': ShareableLinkResponseSchema,
    '/groups/share': ShareableLinkResponseSchema,
    '/groups/join': JoinGroupResponseSchema,
    '/register': RegisterResponseSchema,
    'POST /login': LoginResponseSchema,
    'POST /password-reset': EmptyResponseSchema,
    'POST /settlements': SettlementSchema,
    'PUT /settlements/:settlementId': SettlementListItemSchema,
    'GET /settlements/:settlementId': SettlementListItemSchema,
    'DELETE /settlements/:settlementId': EmptyResponseSchema,
    '/settlements': ListSettlementsResponseSchema,
    '/settlements/:settlementId': SettlementListItemSchema,
    // Comment endpoints
    'POST /groups/:groupId/comments': CreateCommentResponseSchema,
    'GET /groups/:groupId/comments': ListCommentsApiResponseSchema,
    'POST /expenses/:expenseId/comments': CreateCommentResponseSchema,
    'GET /expenses/:expenseId/comments': ListCommentsApiResponseSchema,
    // Reaction endpoints
    'POST /expenses/:expenseId/reactions': ReactionToggleResponseSchema,
    'POST /groups/:groupId/comments/:commentId/reactions': ReactionToggleResponseSchema,
    'POST /expenses/:expenseId/comments/:commentId/reactions': ReactionToggleResponseSchema,
    'POST /settlements/:settlementId/reactions': ReactionToggleResponseSchema,
    // Attachment endpoints
    'POST /groups/:groupId/attachments': UploadAttachmentResponseSchema,
    'DELETE /groups/:groupId/attachments/:attachmentId': EmptyResponseSchema,
    // User profile endpoints
    'GET /user/profile': UserProfileResponseSchema,
    'PUT /user/profile': EmptyResponseSchema,
    'POST /user/change-email': EmptyResponseSchema,
    'POST /user/change-password': EmptyResponseSchema,
    'POST /user/reset-password': EmptyResponseSchema,
    // Group member endpoints
    'POST /groups/:groupId/leave': EmptyResponseSchema,
    'DELETE /groups/:groupId': EmptyResponseSchema,
    'DELETE /groups/:groupId/members/:memberId': EmptyResponseSchema,
    'PUT /groups/:groupId/members/display-name': EmptyResponseSchema,
    'PUT /groups/:groupId/security/permissions': EmptyResponseSchema,
    'POST /groups/:groupId/archive': EmptyResponseSchema,
    'POST /groups/:groupId/unarchive': EmptyResponseSchema,
    'GET /groups/:groupId/members/pending': PendingMembersResponseSchema,
    'PUT /groups/:groupId/members/:memberId/role': EmptyResponseSchema,
    'POST /groups/:groupId/members/:memberId/approve': EmptyResponseSchema,
    'POST /groups/:groupId/members/:memberId/reject': EmptyResponseSchema,
    // Group preview endpoint
    'POST /groups/preview': GroupPreviewResponseSchema,
    // Policy endpoints
    'GET /user/policies/status': UserPolicyStatusResponseSchema,
    'POST /user/policies/accept-multiple': AcceptMultiplePoliciesResponseSchema,
    // Public policy endpoint (for policy acceptance modal)
    'GET /policies/:policyId/current': CurrentPolicyResponseSchema,
    // Tenant settings endpoints
    'GET /settings/tenant': TenantSettingsResponseSchema,
    'GET /settings/tenant/domains': TenantDomainsResponseSchema,
    'PUT /settings/tenant/branding': EmptyResponseSchema,
    'POST /settings/tenant/domains': EmptyResponseSchema,
    // Admin tenant endpoints
    'GET /admin/browser/tenants': AdminTenantsListResponseSchema,
    // Admin user management endpoints
    'GET /admin/browser/users/auth': ListAuthUsersResponseSchema,
    'GET /admin/browser/users/firestore': ListFirestoreUsersResponseSchema,
    'PUT /admin/users/:userId': EmptyResponseSchema,
    'PUT /admin/users/:userId/role': EmptyResponseSchema,
    'GET /admin/users/:userId/auth': AdminUserAuthRecordSchema,
    'GET /admin/users/:userId/firestore': AdminUserFirestoreRecordSchema,
    // Merge endpoints
    'POST /merge': InitiateMergeResponseSchema,
    'GET /merge/:jobId': MergeJobResponseSchema,
    // Policy admin endpoints
    'GET /admin/policies': ListPoliciesResponseSchema,
    'POST /admin/policies': CreatePolicyResponseSchema,
    'GET /admin/policies/:policyId': PolicyDTOSchema,
    'PUT /admin/policies/:policyId': UpdatePolicyResponseSchema,
    'POST /admin/policies/:policyId/publish': PublishPolicyResponseSchema,
    'GET /admin/policies/:policyId/versions/:hash': PolicyVersionResponseSchema,
    'DELETE /admin/policies/:policyId/versions/:hash': DeletePolicyVersionResponseSchema,
    // Tenant admin endpoints
    'POST /admin/tenants': UpsertTenantResponseSchema,
    'POST /admin/tenants/publish': PublishTenantThemeResponseSchema,
    'POST /admin/tenants/:tenantId/assets/:assetType': UploadTenantAssetResponseSchema,
} as const;

// Schema for the currency-specific balance data used in GroupService.addComputedFields
export const CurrencyBalanceDisplaySchema = z
    .object({
        currency: z.string(),
        netBalance: z.string(),
        totalOwed: z.string(),
        totalOwing: z.string(),
    })
    .passthrough();

export const BalanceDisplaySchema = z
    .object({
        balancesByCurrency: z.record(z.string(), CurrencyBalanceDisplaySchema),
    })
    .passthrough();
