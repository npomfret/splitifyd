// Single shared type file for webapp
// This file contains all type definitions used by the webapp client
import { z } from 'zod';
import { createDisplayNameSchema } from './schemas/primitives';
import type { ColorPattern } from './user-colors';

// ========================================================================
// Type aliases for Firebase types (browser-safe)
// ========================================================================

// Utility to create branded primitive types for stronger nominal typing
type Brand<K, T> = K & { __brand: T };
type BrandedString<T extends string> = Brand<string, T>;
type BrandedNumber<T extends string> = Brand<number, T>;
type BrandedBoolean<T extends string> = Brand<boolean, T>;

/**
 * Type alias for ISO 8601 datetime strings
 *
 * This provides documentation that a string should be a valid ISO 8601 datetime format.
 * Example: "2025-01-15T10:30:00.000Z"
 *
 * Used throughout DTOs for all timestamp fields to ensure consistency with the
 * DTO-everywhere architecture where:
 * - Services work with ISO strings
 * - FirestoreReader converts Timestamp → ISO string when reading
 * - FirestoreWriter converts ISO string → Timestamp when writing
 *
 * Note: This is a simple type alias, not a branded type, to avoid requiring
 * explicit casts throughout the codebase while still providing semantic meaning.
 */
export type ISOString = Brand<string, 'ISOString'>;
export const toISOString = (value: string): ISOString => value as ISOString;
export const isoStringNow = (): ISOString => new Date().toISOString() as ISOString;

/**
 * Type alias for monetary amounts
 *
 * Currently defined as `number` for backward compatibility.
 *
 * **Future Migration**: This will be changed to `string` to eliminate JavaScript
 * floating-point precision bugs in financial calculations. Using strings ensures
 * exact decimal representation across the API wire format.
 *
 * Rationale: JavaScript's IEEE 754 floating-point arithmetic causes precision loss
 * (e.g., `0.1 + 0.2 !== 0.3`). For financial calculations, this is unacceptable.
 *
 * See: tasks/monetary-amounts-as-strings-refactor.md
 */
export type Amount = string;
export const ZERO: Amount = '0';

export type GroupId = Brand<string, 'GroupId'>;
export const toGroupId = (value: string): GroupId => value as GroupId;

export type ExpenseId = Brand<string, 'ExpenseId'>;
export const toExpenseId = (value: string): ExpenseId => value as ExpenseId;

export type SettlementId = Brand<string, 'SettlementId'>;
export const toSettlementId = (value: string): SettlementId => value as SettlementId;

export type CommentId = Brand<string, 'CommentId'>;
export const toCommentId = (value: string): CommentId => value as CommentId;

export type TenantId = Brand<string, 'TenantId'>;
export const toTenantId = (value: string): TenantId => value as TenantId;

export type OrganizationId = Brand<string, 'OrganizationId'>;
export const toOrganizationId = (value: string): OrganizationId => value as OrganizationId;

export type TenantAppName = BrandedString<'TenantAppName'>;
export const toTenantAppName = (value: string): TenantAppName => value as TenantAppName;

export type TenantLogoUrl = BrandedString<'TenantLogoUrl'>;
export const toTenantLogoUrl = (value: string): TenantLogoUrl => value as TenantLogoUrl;

export type TenantFaviconUrl = BrandedString<'TenantFaviconUrl'>;
export const toTenantFaviconUrl = (value: string): TenantFaviconUrl => value as TenantFaviconUrl;

export type TenantPrimaryColor = BrandedString<'TenantPrimaryColor'>;
export const toTenantPrimaryColor = (value: string): TenantPrimaryColor => value as TenantPrimaryColor;

export type TenantSecondaryColor = BrandedString<'TenantSecondaryColor'>;
export const toTenantSecondaryColor = (value: string): TenantSecondaryColor => value as TenantSecondaryColor;

export type TenantBackgroundColor = BrandedString<'TenantBackgroundColor'>;
export const toTenantBackgroundColor = (value: string): TenantBackgroundColor => value as TenantBackgroundColor;

export type TenantHeaderBackgroundColor = BrandedString<'TenantHeaderBackgroundColor'>;
export const toTenantHeaderBackgroundColor = (value: string): TenantHeaderBackgroundColor => value as TenantHeaderBackgroundColor;

export type TenantAccentColor = BrandedString<'TenantAccentColor'>;
export const toTenantAccentColor = (value: string): TenantAccentColor => value as TenantAccentColor;

export type TenantThemePaletteName = BrandedString<'TenantThemePaletteName'>;
export const toTenantThemePaletteName = (value: string): TenantThemePaletteName => value as TenantThemePaletteName;

export type TenantCustomCss = BrandedString<'TenantCustomCss'>;
export const toTenantCustomCss = (value: string): TenantCustomCss => value as TenantCustomCss;

export type TenantDomainName = BrandedString<'TenantDomainName'>;
export const toTenantDomainName = (value: string): TenantDomainName => value as TenantDomainName;

export type TenantDefaultFlag = BrandedBoolean<'TenantDefaultFlag'>;
export const toTenantDefaultFlag = (value: boolean): TenantDefaultFlag => value as TenantDefaultFlag;

export type ShowLandingPageFlag = BrandedBoolean<'ShowLandingPageFlag'>;
export const toShowLandingPageFlag = (value: boolean): ShowLandingPageFlag => value as ShowLandingPageFlag;

export type ShowPricingPageFlag = BrandedBoolean<'ShowPricingPageFlag'>;
export const toShowPricingPageFlag = (value: boolean): ShowPricingPageFlag => value as ShowPricingPageFlag;

export type ShowMarketingContentFlag = BrandedBoolean<'ShowMarketingContentFlag'>;
export const toShowMarketingContentFlag = (value: boolean): ShowMarketingContentFlag => value as ShowMarketingContentFlag;

export type GroupName = Brand<string, 'GroupName'>;
export const toGroupName = (value: string): GroupName => value as GroupName;

export type ShareLinkId = Brand<string, 'ShareLinkId'>;
export const toShareLinkId = (value: string): ShareLinkId => value as ShareLinkId;

export type ShareLinkToken = Brand<string, 'ShareLinkToken'>;
export const toShareLinkToken = (value: string): ShareLinkToken => value as ShareLinkToken;

export type CommentText = Brand<string, 'CommentText'>;
export const toCommentText = (value: string): CommentText => value as CommentText;

export type Password = Brand<string, 'Password'>;
export const toPassword = (value: string): Password => value as Password;

// export type DisplayName = Brand<string, 'CommentText'>;
// export const toDisplayName = (value: string): CommentText => value as CommentText;

export type DisplayName = string;
export type UserId = string;
export type Email = string;
export type CurrencyISOCode = string;
export type PolicyId = string;
export type VersionHash = string;
export type ActivityFeedItemId = string;

/**
 * Zod schema for expense splits
 */
export const PositiveAmountStringSchema = z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, 'Amount must be a positive decimal number')
    .refine((value) => parseFloat(value) > 0, 'Amount must be greater than zero');

// ========================================================================
// Constants
// ========================================================================

export const SplitTypes = {
    EQUAL: 'equal',
    EXACT: 'exact',
    PERCENTAGE: 'percentage',
} as const;

export const AuthErrors = {
    EMAIL_EXISTS: 'auth/email-already-exists',
    EMAIL_EXISTS_CODE: 'EMAIL_EXISTS',
} as const;

export const PolicyIds = {
    TERMS_OF_SERVICE: 'terms-of-service',
    COOKIE_POLICY: 'cookie-policy',
    PRIVACY_POLICY: 'privacy-policy',
} as const;

// ========================================================================
// Activity Feed Types
// ========================================================================

export const ActivityFeedEventTypes = {
    EXPENSE_CREATED: 'expense-created',
    EXPENSE_UPDATED: 'expense-updated',
    EXPENSE_DELETED: 'expense-deleted',
    MEMBER_JOINED: 'member-joined',
    MEMBER_LEFT: 'member-left',
    COMMENT_ADDED: 'comment-added',
    SETTLEMENT_CREATED: 'settlement-created',
    SETTLEMENT_UPDATED: 'settlement-updated',
    GROUP_UPDATED: 'group-updated',
} as const;

export type ActivityFeedEventType = (typeof ActivityFeedEventTypes)[keyof typeof ActivityFeedEventTypes];

export const ActivityFeedActions = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    COMMENT: 'comment',
    JOIN: 'join',
    LEAVE: 'leave',
} as const;

export type ActivityFeedAction = (typeof ActivityFeedActions)[keyof typeof ActivityFeedActions];

export interface ActivityFeedItemDetails {
    expenseId?: ExpenseId;
    expenseDescription?: string;
    commentId?: CommentId;
    commentPreview?: string;
    settlementId?: SettlementId;
    settlementDescription?: string;
    targetUserId?: UserId;
    targetUserName?: string;
    previousGroupName?: GroupName;
}

export interface ActivityFeedItem {
    id: ActivityFeedItemId;
    userId: UserId;
    groupId: GroupId;
    groupName: GroupName;
    eventType: ActivityFeedEventType;
    action: ActivityFeedAction;
    actorId: UserId;
    actorName: string;
    timestamp: ISOString;
    details: ActivityFeedItemDetails;
    createdAt?: ISOString;
}

export interface ActivityFeedResponse {
    items: ActivityFeedItem[];
    hasMore: boolean;
    nextCursor?: string;
}

export const DELETED_AT_FIELD = 'deletedAt';

// ========================================================================
// Tenant & Branding Types
// ========================================================================

export interface BrandingMarketingFlags {
    showLandingPage?: ShowLandingPageFlag;
    showMarketingContent?: ShowMarketingContentFlag;
    showPricingPage?: ShowPricingPageFlag;
}

/**
 * Runtime theming configuration provided per-tenant.
 *
 * Guardrails on colours and assets are intentionally light for MVP. Accessibility
 * review happens out-of-band, so these values are represented as free-form strings.
 */
export interface BrandingConfig {
    appName: TenantAppName;
    logoUrl: TenantLogoUrl;
    faviconUrl?: TenantFaviconUrl; // Optional - falls back to logoUrl if not provided
    primaryColor: TenantPrimaryColor;
    secondaryColor: TenantSecondaryColor;
    backgroundColor?: TenantBackgroundColor;
    headerBackgroundColor?: TenantHeaderBackgroundColor;
    accentColor?: TenantAccentColor;
    themePalette?: TenantThemePaletteName;
    customCSS?: TenantCustomCss;
    marketingFlags?: BrandingMarketingFlags;
}

export interface TenantConfig {
    tenantId: TenantId;
    branding: BrandingConfig;
    createdAt: ISOString;
    updatedAt: ISOString;
}

// ========================================================================
// Soft Delete Interface
// ========================================================================

/**
 * Common soft delete metadata fields.
 * All soft-deletable financial entities must include these fields.
 * Applies to: Expenses, Settlements
 * Does NOT apply to: Comments (hard delete). Groups maintain a lightweight soft delete timestamp only.
 */
export interface SoftDeletable {
    /**
     * ISO 8601 timestamp when the entity was soft-deleted.
     * null indicates the entity is active (not deleted).
     */
    deletedAt: ISOString | null;

    /**
     * UID of the user who deleted the entity.
     * null indicates the entity is active (not deleted).
     */
    deletedBy: UserId | null;
}

// ========================================================================
// System User Roles (App-level)
// ========================================================================

// System-level roles for the entire application
// These control admin panel access and system-wide features
export const SystemUserRoles = {
    SYSTEM_ADMIN: 'system_admin', // Can access admin panel, manage all users
    TENANT_ADMIN: 'tenant_admin', // Can manage tenant configuration (branding, domains)
    SYSTEM_USER: 'system_user', // Regular user, no admin access
} as const;

export type SystemUserRole = (typeof SystemUserRoles)[keyof typeof SystemUserRoles];

// ========================================================================
// Permission and Security Types (Group-level)
// ========================================================================

// Group member roles - these are specific to individual groups
// A user can have different roles in different groups

export const SecurityPresets = {
    OPEN: 'open',
    MANAGED: 'managed',
    CUSTOM: 'custom',
} as const;

export type SecurityPreset = (typeof SecurityPresets)[keyof typeof SecurityPresets];

export const MemberRoles = {
    ADMIN: 'admin',
    MEMBER: 'member',
    VIEWER: 'viewer',
} as const;

export type MemberRole = (typeof MemberRoles)[keyof typeof MemberRoles];

export const PermissionLevels = {
    ANYONE: 'anyone',
    OWNER_AND_ADMIN: 'owner-and-admin',
    ADMIN_ONLY: 'admin-only',
} as const;

export type PermissionLevel = (typeof PermissionLevels)[keyof typeof PermissionLevels];

export const MemberStatuses = {
    ACTIVE: 'active',
    PENDING: 'pending',
    ARCHIVED: 'archived',
} as const;

export type MemberStatus = (typeof MemberStatuses)[keyof typeof MemberStatuses];

export interface GroupPermissions {
    expenseEditing: PermissionLevel;
    expenseDeletion: PermissionLevel;
    memberInvitation: PermissionLevel;
    memberApproval: 'automatic' | 'admin-required';
    settingsManagement: PermissionLevel;
}

/**
 * Individual permission change entry
 */
export interface PermissionChange {
    field: string; // Field that changed (e.g., 'expenseEditing', 'memberRole')
    oldValue: string | undefined; // Previous value (PermissionLevel, SecurityPreset, MemberRole, etc.)
    newValue: string; // New value
}

/**
 * Log entry for permission changes
 */
export interface PermissionChangeLog {
    timestamp: ISOString;
    changedBy: string;
    changeType: 'preset' | 'custom' | 'role';
    changes: PermissionChange[];
}

export interface InviteLink {
    createdAt: ISOString;
    createdBy: UserId;
    expiresAt?: ISOString;
    maxUses?: number; // Optional usage limit
    usedCount: number;
}

// ========================================================================
// Expense Label Types and Constants
// ========================================================================

export interface ExpenseLabel {
    name: string;
    displayName: DisplayName;
    icon: string;
}

export const PREDEFINED_EXPENSE_LABELS: ExpenseLabel[] = [
    { name: 'food', displayName: 'Food & Dining', icon: '🍽️' },
    { name: 'transport', displayName: 'Transportation', icon: '🚗' },
    { name: 'utilities', displayName: 'Bills & Utilities', icon: '⚡' },
    { name: 'entertainment', displayName: 'Entertainment', icon: '🎬' },
    { name: 'shopping', displayName: 'Shopping', icon: '🛍️' },
    { name: 'accommodation', displayName: 'Travel & Accommodation', icon: '✈️' },
    { name: 'healthcare', displayName: 'Healthcare', icon: '🏥' },
    { name: 'education', displayName: 'Education', icon: '📚' },
    { name: 'Just the tip', displayName: 'Just the tip', icon: '😮' },
    { name: 'bedroom_supplies', displayName: 'Bedroom Supplies', icon: '🍆' },
    { name: 'pets', displayName: 'Pets & Animals', icon: '🐾' },
    { name: 'alcohol', displayName: 'Drinks & Nightlife', icon: '🍺' },
    { name: 'coffee', displayName: 'Coffee Addiction', icon: '☕' },
    { name: 'tech', displayName: 'Gadgets & Electronics', icon: '💻' },
    { name: 'gaming', displayName: 'Gaming', icon: '🎮' },
    { name: 'home', displayName: 'Home & Garden', icon: '🏡' },
    { name: 'subscriptions', displayName: 'Streaming & Subscriptions', icon: '📺' },
    { name: 'gifts', displayName: 'Gifts & Generosity', icon: '🎁' },
    { name: 'charity', displayName: 'Charity & Donations', icon: '🤝' },
    { name: 'hobbies', displayName: 'Hobbies & Crafts', icon: '🎨' },
    { name: 'sports', displayName: 'Sports & Fitness', icon: '🏋️' },
    { name: 'beauty', displayName: 'Beauty & Personal Care', icon: '💅' },
    { name: 'dating', displayName: 'Dating & Romance', icon: '💘' },
    { name: 'therapy', displayName: 'Therapy & Self Care', icon: '🛋️' },
    { name: 'kids', displayName: 'Children & Babysitting', icon: '🍼' },
    { name: 'clubbing', displayName: 'Clubbing & Bad Decisions', icon: '💃' },
    { name: 'lottery', displayName: 'Lottery Tickets & Regret', icon: '🎰' },
    { name: 'junk_food', displayName: 'Midnight Snacks', icon: '🌭' },
    { name: 'hangover', displayName: 'Hangover Recovery Supplies', icon: '🥤' },
    { name: 'impulse', displayName: 'Impulse Purchases', icon: '🤷' },
    { name: 'side_hustle', displayName: 'Side Hustle Expenses', icon: '💼' },
    { name: 'bribery', displayName: 'Bribes (Totally Legal)', icon: '🤑' },
    { name: 'lawsuits', displayName: 'Legal Trouble', icon: '⚖️' },
    { name: 'weird_stuff', displayName: 'Weird Stuff Off the Internet', icon: '🦄' },
    { name: 'other', displayName: 'Other', icon: '❓' },
];

// ========================================================================
// Configuration Types - Used by webapp for API client
// ========================================================================

/**
 * Firebase client SDK configuration.
 * These values are used by the Firebase JavaScript SDK in the client application.
 *
 * NOTE: In development/emulator mode, these values are not actually used by Firebase
 * since the emulator provides its own auth and storage services. We populate them
 * with dummy values to satisfy the SDK initialization requirements.
 */
export interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
}

export interface EnvironmentConfig {
    warningBanner?: string;
}

export interface FormDefaults {
    displayName?: string;
    email?: string;
    password?: string;
}

export interface ThemeConfig {
    hash: string;
    generatedAtEpochMs?: number;
}

export interface AppConfiguration {
    firebase: FirebaseConfig;
    environment: EnvironmentConfig;
    formDefaults: FormDefaults;
    tenant?: TenantConfig;
    theme?: ThemeConfig | null;
    /**
     * URL for Firebase Auth emulator - only populated in development.
     * Used by the client to connect to the local auth emulator instead of production Firebase Auth.
     * Format: http://localhost:xxxx (or whatever port the auth emulator is running on)
     */
    firebaseAuthUrl?: string;
    /**
     * URL for Firestore emulator - only populated in development.
     * Used by the client to connect to the local Firestore emulator instead of production Firestore.
     * Format: http://localhost:xxxx (or whatever port the Firestore emulator is running on)
     */
    firebaseFirestoreUrl?: string;
}

// ========================================================================
// User Types
// ========================================================================

export interface UserThemeColor {
    light: string;
    dark: string;
    name: string;
    pattern: ColorPattern;
    assignedAt: ISOString;
    colorIndex: number;
}

export interface BaseUser {
    displayName: DisplayName;
}

export interface UserRegistration extends BaseUser {
    email: Email;
    password: string;
    termsAccepted: boolean;
    cookiePolicyAccepted: boolean;
    privacyPolicyAccepted: boolean;
}

export interface FirebaseUser extends BaseUser {
    uid: UserId;
}

export interface PooledTestUser extends UserToken {
    password: string;
    email: Email;
}

export interface UserToken {
    uid: UserId;
    token: string;
}

export interface AuthenticatedFirebaseUser extends FirebaseUser, UserToken {}

/**
 * Registered user type for client-side code.
 * Uses ISO 8601 string timestamps consistent with the DTO-everywhere architecture.
 *
 * Note: The canonical storage type is UserDocument in firebase/functions/src/schemas/user.ts
 */
export interface RegisteredUser extends FirebaseUser {
    email: Email;
    // Firebase Auth fields
    photoURL?: string | null; // Profile photo URL from Firebase Auth
    emailVerified: boolean; // Email verification status

    // System administration
    role?: SystemUserRole; // Role field for admin access control

    // Policy acceptance tracking
    termsAcceptedAt?: ISOString;
    cookiePolicyAcceptedAt?: ISOString;
    privacyPolicyAcceptedAt?: ISOString;
    acceptedPolicies?: Record<string, string>; // Map of policyId -> versionHash

    // User preferences
    preferredLanguage?: string; // User's preferred language code (e.g., 'en', 'es', 'fr')

    // Security tracking
    passwordChangedAt?: ISOString; // Last password change timestamp

    // Document timestamps
    createdAt?: ISOString;
    updatedAt?: ISOString;
}

/**
 * Minimal user data for authentication context.
 * Used in middleware and request context where only auth fields are needed.
 */
export interface AuthenticatedUser {
    uid: UserId;
    displayName: DisplayName;
    role?: SystemUserRole;
}

/**
 * Extended Express Request with authenticated user information.
 * Used throughout the backend for type-safe request handling.
 *
 * Note: This requires the 'express' package to be imported where used.
 */
export interface AuthenticatedRequest {
    user?: AuthenticatedUser;
    body: any;
    params: any;
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
}

/**
 * User data for client-side applications.
 * Contains all fields needed by the frontend, excluding sensitive server-only data.
 */
export interface ClientUser {
    uid: UserId;
    email: Email;
    displayName: DisplayName;
    emailVerified: boolean;
    photoURL?: string | null;
    preferredLanguage?: string;
    role?: SystemUserRole;
}

// Base interface for document types with common timestamp fields
interface BaseDTO<T> {
    id: T;
    createdAt: ISOString;
    updatedAt: ISOString;
}

export interface PolicyVersion {
    text: string;
    createdAt: ISOString;
}

interface Policy {
    policyName: string;
    currentVersionHash: string;
    versions: Record<string, PolicyVersion>; // Map of versionHash -> PolicyVersion
}

export interface PolicyDTO extends Policy, BaseDTO<PolicyId> {}

// ========================================================================
// Balance Types
// ========================================================================

export interface UserBalance {
    uid: UserId;
    owes: Record<UserId, Amount>;
    owedBy: Record<UserId, Amount>;
    netBalance: Amount;
}

export interface CurrencyBalance {
    currency: CurrencyISOCode;
    netBalance: Amount;
    totalOwed: Amount;
    totalOwing: Amount;
}

// ========================================================================
// Group Types
// ========================================================================

/**
 * GroupMembership business fields (without metadata)
 *
 * Represents the pure membership document stored in Firestore.
 * This is the minimal data needed to track a user's membership in a group.
 */
export interface GroupMembership {
    uid: UserId;
    groupId: GroupId; // For collectionGroup queries
    memberRole: MemberRole;
    memberStatus: MemberStatus;
    joinedAt: ISOString;
    invitedBy?: UserId; // UID of the user who created the share link that was used to join
    theme: UserThemeColor;
    groupDisplayName: string; // Custom display name for this group (set on join, can be changed later)
}

/**
 * GroupMembership DTO = Business fields (no additional metadata for subcollection docs)
 *
 * This is the wire format for membership documents. All timestamps are ISO 8601 strings.
 * The canonical storage format is GroupMemberDocument in firebase/functions/src/schemas/group.ts
 * which uses Firestore Timestamp objects.
 *
 * Note: Unlike other DTOs, this does NOT extend BaseDTO because membership documents
 * in the subcollection (groups/{groupId}/members/{uid}) don't have id/createdAt/updatedAt fields.
 */
export type GroupMembershipDTO = GroupMembership;

/**
 * Lean DTO for API responses containing only essential fields for group member display.
 * Prevents over-exposure of sensitive user data (acceptedPolicies, timestamps, etc.)
 *
 * Note: This is a composite view (User + GroupMembership), not a stored document,
 * so it does NOT extend BaseDTO (no id/createdAt/updatedAt metadata).
 *
 * Used in:
 * - Group member lists
 * - Permissions calculations
 * - UI components requiring basic user info
 */
export interface GroupMember {
    // User identification
    uid: UserId;
    initials: string;

    // User display properties
    themeColor: UserThemeColor;

    // Group-specific customization
    groupDisplayName: string; // Custom display name for this group (set on join, can be changed later)

    // Group membership metadata (required for permissions)
    memberRole: MemberRole;
    memberStatus: MemberStatus;
    joinedAt: ISOString;
    invitedBy?: UserId; // UID of the user who invited this member
}

/**
 * ShareLink business fields (without metadata)
 */
interface ShareLink {
    token: ShareLinkToken; // The actual share token used in URLs
    createdBy: UserId; // UID of the user who created this share link
    expiresAt: ISOString;
}

/**
 * ShareLink DTO = Business fields + Metadata
 *
 * This is the wire format returned by API endpoints. All timestamps are ISO 8601 strings.
 * The canonical storage format is ShareLinkDocument in firebase/functions/src/schemas/sharelink.ts
 * which uses Firestore Timestamp objects.
 *
 * Note: The `id` field is the Firestore document ID (ShareLinkId), while `token` is the
 * actual share token used in URLs (ShareLinkToken). These are separate concepts.
 */
export interface ShareLinkDTO extends ShareLink, BaseDTO<ShareLinkId> {}

/**
 * Group business fields (without metadata)
 *
 * This is the wire format returned by API endpoints. All timestamps are ISO 8601 strings.
 * The canonical storage format is GroupDocument in firebase/functions/src/schemas/group.ts
 * which uses Firestore Timestamp objects.
 *
 * This type includes computed fields (balance, lastActivity) that are added by the API layer
 * and do not exist in the storage format.
 */
interface Group {
    // Core fields
    name: GroupName;
    description?: string;

    createdBy: UserId;

    // Individual permission settings (customizable after preset selection)
    permissions: GroupPermissions;

    // Permission change history
    permissionHistory?: PermissionChangeLog[];

    // Invite link configuration
    inviteLinks?: Record<string, InviteLink>;

    // Computed fields (API-only - not in storage)
    balance?: {
        balancesByCurrency: Record<string, CurrencyBalance>;
    };
    lastActivity?: string;
}

/**
 * Group DTO = Business fields + Metadata
 */
export interface GroupDTO extends Group, BaseDTO<GroupId> {
    deletedAt: ISOString | null;
}

// Request/Response types
export interface CreateGroupRequest {
    name: GroupName;
    groupDisplayName: DisplayName;
    description?: string;
}

export interface UpdateGroupRequest {
    name?: GroupName;
    description?: string;
}

export interface UpdateDisplayNameRequest {
    displayName: DisplayName;
}

// Validation schemas
export const CreateGroupRequestSchema = z.object({
    name: z.string().trim().min(1, 'Group name is required').max(100, 'Group name must be less than 100 characters').transform(toGroupName),
    groupDisplayName: createDisplayNameSchema({
        minMessage: 'Enter a display name.',
        maxMessage: 'Display name must be 50 characters or fewer.',
        patternMessage: 'Display name can only use letters, numbers, spaces, hyphens, underscores, and periods.',
    }),
    description: z.string().trim().max(500).optional(),
});

export const UpdateGroupRequestSchema = z
    .object({
        name: z.string().trim().min(1).max(100).transform(toGroupName).optional(),
        description: z.string().trim().max(500).optional(),
    })
    .refine((data) => data.name !== undefined || data.description !== undefined, {
        message: 'At least one field (name or description) must be provided',
    });

export const UpdateDisplayNameRequestSchema = z.object({
    displayName: z
        .string()
        .min(1, 'Display name is required')
        .max(50, 'Display name must be 50 characters or less')
        .trim(),
});

// Metadata for real-time change tracking
export interface ChangeMetadata {
    lastChangeTimestamp: number;
    changeCount: number;
    serverTime: number;
}

// List groups response
export interface ListGroupsResponse {
    groups: GroupDTO[];
    count: number;
    hasMore: boolean;
    nextCursor?: string;
    pagination: {
        limit: number;
        order: string;
    };
    metadata?: ChangeMetadata;
}

// Group members response
export interface GroupMembersResponse {
    members: GroupMember[];
    hasMore: boolean;
    nextCursor?: string;
}

// ========================================================================
// Expense Types
// ========================================================================

export interface ExpenseSplit {
    uid: UserId;
    amount: Amount;
    percentage?: number;
}

/**
 * Expense business fields (without metadata)
 */
interface Expense extends SoftDeletable {
    groupId: GroupId;
    createdBy: UserId;
    paidBy: UserId;
    amount: Amount;
    currency: CurrencyISOCode;
    description: string;
    label: string;
    date: ISOString;
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
    participants: UserId[];
    splits: ExpenseSplit[];
    receiptUrl?: string;
}

/**
 * Expense DTO = Business fields + Metadata
 *
 * This is the wire format returned by API endpoints. All timestamps are ISO 8601 strings.
 * The canonical storage format is ExpenseDocument in firebase/functions/src/schemas/expense.ts
 * which uses Firestore Timestamp objects.
 */
export interface ExpenseDTO extends Expense, BaseDTO<ExpenseId> {
    isLocked?: boolean; // True if any participant has left the group
}

export interface CreateExpenseRequest {
    groupId: GroupId;
    description: string;
    amount: Amount;
    currency: CurrencyISOCode;
    paidBy: UserId;
    label: string;
    date: ISOString;
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
    participants: UserId[];
    splits: ExpenseSplit[];
    receiptUrl?: string;
}

export type UpdateExpenseRequest = Partial<Omit<CreateExpenseRequest, 'groupId'>>;

// ========================================================================
// Settlement Types
// ========================================================================

/**
 * Settlement business fields (without metadata)
 */
interface Settlement extends SoftDeletable {
    groupId: GroupId;
    payerId: UserId;
    payeeId: UserId;
    amount: Amount;
    currency: CurrencyISOCode;
    date: ISOString;
    note?: string;
    createdBy: UserId;
}

/**
 * Settlement DTO = Business fields + Metadata
 *
 * This is the wire format returned by API endpoints. All timestamps are ISO 8601 strings.
 * The canonical storage format is SettlementDocument in firebase/functions/src/schemas/settlement.ts
 * which uses Firestore Timestamp objects.
 */
export interface SettlementDTO extends Settlement, BaseDTO<SettlementId> {
    isLocked?: boolean; // True if payer or payee has left the group
}

export interface CreateSettlementRequest {
    groupId: GroupId;
    payerId: UserId;
    payeeId: UserId;
    amount: Amount;
    currency: CurrencyISOCode;
    date?: ISOString;
    note?: string;
}

export type UpdateSettlementRequest = Partial<Omit<CreateSettlementRequest, 'groupId' | 'payerId' | 'payeeId'>>;

/**
 * Enriched settlement for API responses with resolved member details.
 *
 * This is a composite view (Settlement + resolved GroupMembers), not a stored document,
 * so it does NOT extend BaseDTO (note: only has id and createdAt, missing updatedAt).
 *
 * The payer and payee fields are resolved from UIDs to full GroupMember objects
 * by the SettlementService for convenient display in UI components. This eliminates
 * the need for client-side lookups to display member names, avatars, and theme colors.
 *
 * Used in:
 * - Settlement history displays
 * - Settlement list endpoints (`/api/settlements`, `/api/groups/:id/settlements`)
 * - UI components requiring member details with settlements
 *
 * Relationship to other types:
 * - Settlement: Business fields only (payerId/payeeId as UIDs)
 * - SettlementDTO: Settlement + BaseDTO metadata (wire format for individual settlements)
 * - SettlementWithMembers: Settlement + resolved members (wire format for settlement lists)
 */
export interface SettlementWithMembers extends SoftDeletable {
    id: SettlementId;
    groupId: GroupId;
    payer: GroupMember;
    payee: GroupMember;
    amount: Amount;
    currency: CurrencyISOCode;
    date: ISOString;
    note?: string;
    createdAt: ISOString;
    isLocked?: boolean; // True if payer or payee has left the group
}

// ========================================================================
// Full Details Response Types
// ========================================================================

export interface GroupFullDetailsDTO {
    group: GroupDTO;
    members: ListMembersResponse;
    expenses: ListExpensesResponse;
    balances: GroupBalances;
    settlements: ListSettlementsResponse;
    comments: ListCommentsResponse;
}

export interface ExpenseFullDetailsDTO {
    expense: ExpenseDTO;
    group: GroupDTO;
    members: { members: GroupMember[]; };
}

// ========================================================================
// API Response Types
// ========================================================================

export interface MessageResponse {
    message: string;
}

export interface ShareLinkResponse {
    shareToken: ShareLinkToken;
    shareablePath: string;
    expiresAt: ISOString;
}

export interface GenerateShareLinkRequest {
    groupId: GroupId;
    expiresAt?: ISOString;
}

export interface PreviewGroupResponse {
    groupId: GroupId;
    groupName: GroupName;
    groupDescription: string;
    memberCount: number;
    isAlreadyMember: boolean;
}

export interface JoinGroupResponse {
    groupId: GroupId;
    groupName: GroupName;
    success: boolean;
    memberStatus: MemberStatus;
}

export interface RegisterResponse {
    success: boolean;
    message: string;
    user: {
        uid: UserId;
        displayName: DisplayName;
    };
}

export interface CurrentPolicyResponse {
    id: string;
    policyName: string;
    currentVersionHash: string;
    text: string;
    createdAt: ISOString;
}

export interface UserProfileResponse {
    displayName: DisplayName;
    role: SystemUserRole;
    email: Email;
    emailVerified: boolean;
}

export interface AcceptMultiplePoliciesResponse {
    success: boolean;
    message: string;
    acceptedPolicies: Array<{
        policyId: PolicyId;
        versionHash: VersionHash;
        acceptedAt: string;
    }>;
}

export interface PolicyAcceptanceStatusDTO {
    policyId: PolicyId;
    currentVersionHash: string;
    userAcceptedHash?: string;
    needsAcceptance: boolean;
    policyName: string;
}

export interface UserPolicyStatusResponse {
    needsAcceptance: boolean;
    policies: PolicyAcceptanceStatusDTO[];
    totalPending: number;
}

export interface AcceptPolicyRequest {
    policyId: PolicyId;
    versionHash: VersionHash;
}

// ========================================================================
// Balance calculation types
// ========================================================================

export interface SimplifiedDebt {
    from: {
        uid: UserId;
    };
    to: {
        uid: UserId;
    };
    amount: Amount;
    currency: CurrencyISOCode;
}

export interface GroupBalances {
    groupId: GroupId;
    userBalances: Record<UserId, UserBalance>;
    simplifiedDebts: SimplifiedDebt[];
    lastUpdated: ISOString;
    balancesByCurrency: Record<string, Record<UserId, UserBalance>>;
}

// ========================================================================
// Comments types
// ========================================================================

/**
 * Comment business fields (without metadata)
 */
interface Comment {
    authorId: UserId;
    authorName: string;
    authorAvatar?: string;
    text: CommentText;
}

/**
 * Comment DTO = Business fields + Metadata
 */
export interface CommentDTO extends Comment, BaseDTO<CommentId> {}

interface BaseCreateCommentRequest {
    text: CommentText;
}

export interface CreateGroupCommentRequest extends BaseCreateCommentRequest {
    groupId: GroupId;
}

export interface CreateExpenseCommentRequest extends BaseCreateCommentRequest {
    expenseId: ExpenseId;
}

export interface ListMembersResponse { // todo: there should be no pagination - all members are returned
    members: GroupMember[];
    hasMore: boolean;
    nextCursor?: string;
}

export interface ListExpensesResponse {
    expenses: ExpenseDTO[];
    hasMore: boolean;
    nextCursor?: string;
}

export interface ListSettlementsResponse {
    settlements: SettlementWithMembers[];
    hasMore: boolean;
    nextCursor?: string;
}

export interface ListCommentsResponse {
    comments: CommentDTO[];
    hasMore: boolean;
    nextCursor?: string;
}

// ========================================================================
// Policy Admin Response Types
// ========================================================================

export interface UpdatePolicyResponse {
    success: boolean;
    versionHash: VersionHash;
    published: boolean;
    currentVersionHash: string | undefined;
    message: string;
}

export interface PublishPolicyResponse {
    success: boolean;
    message: string;
    currentVersionHash: string;
}

export interface CreatePolicyResponse {
    success: boolean;
    id: string;
    versionHash: VersionHash;
    message: string;
}

export interface DeletePolicyVersionResponse {
    success: boolean;
    message: string;
}

// ========================================================================
// Policy Admin Request Types
// ========================================================================

export interface CreatePolicyRequest {
    policyName: string;
    text: string;
}

export interface UpdatePolicyRequest {
    text: string;
    publish?: boolean;
}

export interface ListPoliciesResponse {
    policies: PolicyDTO[];
    count: number;
}

export interface GetPendingMembersResponse {
    members: GroupMembershipDTO[];
}

// ========================================================================
// Test Pool Response Types
// ========================================================================

export interface ReturnTestUserResponse {
    message: string;
    email: Email;
}

// ========================================================================
// Test Endpoint Response Types
// ========================================================================

export interface TestErrorResponse {
    error: {
        code: string;
        message: string;
    };
}

export interface TestSuccessResponse {
    success: boolean;
    message: string;
}

// ========================================================================
// UI Form Data Types (for client-side forms and E2E tests)
// ========================================================================

/**
 * Form data for creating groups in UI
 * Used in E2E tests and client-side form submission
 */
export interface CreateGroupFormData {
    name?: string;
    description?: string;
}

/**
 * Form data for expense creation in UI
 * Used in E2E tests for form submission payloads
 */
export interface ExpenseFormData {
    description: string;
    amount: Amount;
    currency: CurrencyISOCode;
    paidByDisplayName: DisplayName; // Display name (not the uid)
    splitType: 'equal' | 'exact' | 'percentage';
    participants: DisplayName[]; // Participant names (not the uids)
}

/**
 * Form data for settlement creation in UI
 * Used in E2E tests for settlement form submission payloads
 */
export interface SettlementFormData {
    payerName: DisplayName; // Display name of who paid
    payeeName: DisplayName; // Display name of who received payment
    amount: string;
    currency: CurrencyISOCode;
    note: string;
}

/**
 * Draft expense stored in local storage
 * Used by webapp to persist unsaved expense forms
 */
export interface ExpenseDraft {
    description: string;
    amount: Amount;
    currency: CurrencyISOCode;
    date: string; // YYYY-MM-DD format
    time: string; // HH:MM format
    paidBy: UserId;
    label: string;
    splitType: string;
    participants: UserId[];
    splits: Array<{ userId: UserId; amount: Amount; percentage?: number; }>;
    timestamp: number;
}

/**
 * Options for listing groups
 * Used by API clients for group list queries
 */
export interface ListGroupsOptions {
    limit?: number;
    cursor?: string;
    order?: 'asc' | 'desc';
    includeMetadata?: boolean;
    statusFilter?: MemberStatus | MemberStatus[];
}

/**
 * Options for getting group full details
 * Used by API clients for fetching complete group information
 */
export interface GetGroupFullDetailsOptions {
    expenseLimit?: number;
    expenseCursor?: string;
    includeDeletedExpenses?: boolean;
    settlementLimit?: number;
    settlementCursor?: string;
    includeDeletedSettlements?: boolean;
    commentLimit?: number;
    commentCursor?: string;
}

/**
 * Query parameters for comment pagination
 * Used in comment listing endpoints
 */
export interface CommentQuery {
    cursor?: string;
    limit?: string;
}

/**
 * Options for listing comments
 * Used by API clients for comment list queries
 */
export interface ListCommentsOptions {
    cursor?: string;
    limit?: number;
}

/**
 * Options for getting activity feed
 * Used by API clients for activity feed queries
 */
export interface GetActivityFeedOptions {
    cursor?: string;
    limit?: number;
}

/**
 * Options for listing Firestore users (admin endpoint)
 * Used by API clients for user management queries
 */
export interface ListFirestoreUsersOptions {
    limit?: number;
    cursor?: string;
    email?: Email;
    uid?: UserId;
    displayName?: DisplayName;
}

/**
 * Options for listing Auth users (admin endpoint)
 * Used by API clients for user management queries
 */
export interface ListAuthUsersOptions {
    limit?: number;
    pageToken?: string;
    email?: Email;
    uid?: UserId;
}

/**
 * User profile update request
 * Used for updating user profile information
 */
export interface UpdateUserRequest {
    displayName?: DisplayName;
    email?: Email;
    phoneNumber?: string | null;
    photoURL?: string | null;
    password?: Password;
    emailVerified?: boolean;
    disabled?: boolean;
    preferredLanguage?: string;
}

/**
 * Password change request
 * Used for changing user passwords
 */
export interface PasswordChangeRequest {
    currentPassword: Password;
    newPassword: Password;
}

/**
 * Email change request
 * Used for changing user email addresses
 */
export interface ChangeEmailRequest {
    currentPassword: Password;
    newEmail: Email;
}

/**
 * User profile update request
 * Used for updating user profile information (display name, etc.)
 */
export interface UpdateUserProfileRequest {
    displayName?: string;
}

/**
 * Tenant settings response
 * Returned by GET /settings/tenant endpoint
 */
export interface TenantSettingsResponse {
    tenantId: TenantId;
    config: TenantConfig;
    domains: TenantDomainName[];
    primaryDomain: TenantDomainName;
}

/**
 * Tenant branding update request
 * Used for PUT /settings/tenant/branding endpoint
 */
export interface UpdateTenantBrandingRequest {
    appName?: TenantAppName;
    logoUrl?: TenantLogoUrl;
    faviconUrl?: TenantFaviconUrl;
    primaryColor?: TenantPrimaryColor;
    secondaryColor?: TenantSecondaryColor;
    accentColor?: TenantAccentColor;
    themePalette?: TenantThemePaletteName;
    customCSS?: TenantCustomCss;
    marketingFlags?: Partial<BrandingMarketingFlags>;
}

/**
 * Tenant domains list response
 * Returned by GET /settings/tenant/domains endpoint
 */
export interface TenantDomainsResponse {
    domains: TenantDomainName[];
    primaryDomain: TenantDomainName;
}

/**
 * Add tenant domain request
 * Used for POST /settings/tenant/domains endpoint
 */
export interface AddTenantDomainRequest {
    domain: TenantDomainName;
}
