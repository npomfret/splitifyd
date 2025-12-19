// Single shared type file for webapp
// This file contains all type definitions used by the webapp client
import { z } from 'zod';
import type { TenantBranding } from './types/branding';
import type { ColorPattern } from './user-colors';

// ========================================================================
// Type aliases for Firebase types (browser-safe)
// ========================================================================

// Utility to create branded primitive types for stronger nominal typing
type Brand<K, T> = K & { __brand: T; };
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
export const toAmount = (value: string | number): Amount => typeof value === 'number' ? value.toString() as Amount : value as Amount;

export const ZERO: Amount = '0';

export type GroupId = Brand<string, 'GroupId'>;
export const toGroupId = (value: string): GroupId => value as GroupId;

export type ExpenseId = Brand<string, 'ExpenseId'>;
export const toExpenseId = (value: string): ExpenseId => value as ExpenseId;

export type SettlementId = Brand<string, 'SettlementId'>;
export const toSettlementId = (value: string): SettlementId => value as SettlementId;

export type CommentId = Brand<string, 'CommentId'>;
export const toCommentId = (value: string): CommentId => value as CommentId;

export type ReactionId = Brand<string, 'ReactionId'>;
export const toReactionId = (value: string): ReactionId => value as ReactionId;

export type AttachmentId = Brand<string, 'AttachmentId'>;
export const toAttachmentId = (value: string): AttachmentId => value as AttachmentId;

export type TenantId = Brand<string, 'TenantId'>;
export const toTenantId = (value: string): TenantId => value as TenantId;

export type OrganizationId = Brand<string, 'OrganizationId'>;
export const toOrganizationId = (value: string): OrganizationId => value as OrganizationId;

export type TenantPrimaryColor = BrandedString<'TenantPrimaryColor'>;
export const toTenantPrimaryColor = (value: string): TenantPrimaryColor => value as TenantPrimaryColor;

export type TenantSecondaryColor = BrandedString<'TenantSecondaryColor'>;
export const toTenantSecondaryColor = (value: string): TenantSecondaryColor => value as TenantSecondaryColor;

export type TenantAccentColor = BrandedString<'TenantAccentColor'>;
export const toTenantAccentColor = (value: string): TenantAccentColor => value as TenantAccentColor;

export type TenantDomainName = BrandedString<'TenantDomainName'>;
export const toTenantDomainName = (value: string): TenantDomainName => value as TenantDomainName;

export type TenantDefaultFlag = BrandedBoolean<'TenantDefaultFlag'>;
export const toTenantDefaultFlag = (value: boolean): TenantDefaultFlag => value as TenantDefaultFlag;

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

export type DisplayName = Brand<string, 'DisplayName'>;
export const toDisplayName = (value: string): DisplayName => value as DisplayName;

export type PolicyId = Brand<string, 'PolicyId'>;
export const toPolicyId = (value: string): PolicyId => value as PolicyId;

export type PolicyName = Brand<string, 'PolicyName'>;
export const toPolicyName = (value: string): PolicyName => value as PolicyName;

export type PolicyText = Brand<string, 'PolicyText'>;
export const toPolicyText = (value: string): PolicyText => value as PolicyText;

export type VersionHash = Brand<string, 'VersionHash'>;
export const toVersionHash = (value: string): VersionHash => value as VersionHash;

export type CurrencyISOCode = Brand<string, 'CurrencyISOCode'>;
export const toCurrencyISOCode = (value: string): CurrencyISOCode => value as CurrencyISOCode;

/**
 * Recent amount with its associated currency, used for localStorage caching
 * of recently entered expense amounts in the expense form.
 */
export interface RecentAmount {
    amount: Amount;
    currency: CurrencyISOCode;
}

export type UserId = Brand<string, 'UserId'>;
export const toUserId = (value: string): UserId => value as UserId;

export type Email = Brand<string, 'Email'>;
export const toEmail = (value: string): Email => value as Email;

export type Description = string;

export type ActivityFeedItemId = Brand<string, 'ActivityFeedItemId'>;
export const toActivityFeedItemId = (value: string): ActivityFeedItemId => value as ActivityFeedItemId;

export type ExpenseLabel = Brand<string, 'ExpenseLabel'>;
export const toExpenseLabel = (value: string): ExpenseLabel => value as ExpenseLabel;

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
    TERMS_OF_SERVICE: toPolicyId('terms-of-service'),
    COOKIE_POLICY: toPolicyId('cookie-policy'),
    PRIVACY_POLICY: toPolicyId('privacy-policy'),
} as const;

/**
 * Fixed set of quick reaction emojis.
 * These are the only emojis that can be used for reactions.
 */
export const ReactionEmojis = {
    THUMBS_UP: '👍',
    HEART: '❤️',
    LAUGH: '😂',
    WOW: '😮',
    SAD: '😢',
    CELEBRATE: '🎉',
} as const;

export type ReactionEmoji = (typeof ReactionEmojis)[keyof typeof ReactionEmojis];

/**
 * Ordered array of reaction emojis for UI display.
 */
export const REACTION_EMOJI_ORDER: ReactionEmoji[] = [
    ReactionEmojis.THUMBS_UP,
    ReactionEmojis.HEART,
    ReactionEmojis.LAUGH,
    ReactionEmojis.WOW,
    ReactionEmojis.SAD,
    ReactionEmojis.CELEBRATE,
];

// ========================================================================
// Activity Feed Types
// ========================================================================

export const ActivityFeedEventTypes = {
    GROUP_CREATED: 'group-created',
    GROUP_UPDATED: 'group-updated',
    GROUP_LOCKED: 'group-locked',
    GROUP_UNLOCKED: 'group-unlocked',
    PERMISSIONS_UPDATED: 'permissions-updated',
    MEMBER_ROLE_CHANGED: 'member-role-changed',
    EXPENSE_CREATED: 'expense-created',
    EXPENSE_UPDATED: 'expense-updated',
    EXPENSE_DELETED: 'expense-deleted',
    MEMBER_JOINED: 'member-joined',
    MEMBER_LEFT: 'member-left',
    COMMENT_ADDED: 'comment-added',
    SETTLEMENT_CREATED: 'settlement-created',
    SETTLEMENT_UPDATED: 'settlement-updated',
    SETTLEMENT_DELETED: 'settlement-deleted',
    REACTION_ADDED: 'reaction-added',
    REACTION_REMOVED: 'reaction-removed',
} as const;

export type ActivityFeedEventType = (typeof ActivityFeedEventTypes)[keyof typeof ActivityFeedEventTypes];

export const ActivityFeedActions = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    COMMENT: 'comment',
    JOIN: 'join',
    LEAVE: 'leave',
    ADD: 'add',
    REMOVE: 'remove',
} as const;

export type ActivityFeedAction = (typeof ActivityFeedActions)[keyof typeof ActivityFeedActions];

/**
 * Reactable resource types for activity feed events.
 */
export const ReactableResourceTypes = {
    EXPENSE: 'expense',
    GROUP_COMMENT: 'group-comment',
    EXPENSE_COMMENT: 'expense-comment',
    SETTLEMENT: 'settlement',
} as const;

export type ReactableResourceType = (typeof ReactableResourceTypes)[keyof typeof ReactableResourceTypes];

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
    newRole?: MemberRole;
    // Reaction-specific fields
    reactionEmoji?: ReactionEmoji;
    reactableResourceType?: ReactableResourceType;
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
    createdAt: ISOString; // Always present - set via AuditFieldsSchema in backend
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
    showMarketingContent?: ShowMarketingContentFlag;
    showPricingPage?: ShowPricingPageFlag;
}

/**
 * Runtime theming configuration provided per-tenant.
 *
 * Color values are intentionally light on validation for MVP. Accessibility
 * review happens out-of-band.
 *
 * Note: appName, logoUrl, faviconUrl are in brandingTokens.tokens (not here).
 */
export interface BrandingConfig {
    primaryColor: TenantPrimaryColor;
    secondaryColor: TenantSecondaryColor;
    accentColor?: TenantAccentColor;
    showAppNameInHeader?: boolean;
}

export interface TenantConfig {
    tenantId: TenantId;
    branding: BrandingConfig;
    brandingTokens: TenantBranding;
    marketingFlags?: BrandingMarketingFlags;
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
    CREATOR_AND_ADMIN: 'creator-and-admin',
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

export interface FormDefaults {
    displayName?: string;
    email?: string;
    password?: string;
}

export interface ThemeConfig {
    hash: string;
    generatedAtEpochMs?: number;
}

export interface ClientAppConfiguration {
    firebase: FirebaseConfig;
    warningBanner?: string;
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
    password: Password;
    displayName: DisplayName;
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

/**
 * Request to create an admin user (test/emulator only).
 * Used during bootstrap to create the initial admin before policies exist.
 */
export interface CreateAdminUserRequest {
    email: Email;
    password: string;
    displayName: DisplayName;
}

export interface UserToken {
    uid: UserId;
    token: string;
}

export interface AuthenticatedFirebaseUser extends FirebaseUser, UserToken {}

// ========================================================================
// Focused User Types
// ========================================================================
// Note: ClientUser is defined later in this file (see line ~720)

/**
 * Server-side internal user profile for backend business logic.
 *
 * This represents the complete user data from both Firebase Auth and Firestore.
 * Used internally by backend services for business logic and operations.
 *
 * **Used by:**
 * - UserService internal methods
 * - Service-to-service communication
 * - Backend business logic
 *
 * **Note:** createdAt/updatedAt are optional because user documents can be created
 * incrementally (Firebase Auth user created first, Firestore doc created later).
 *
 * @see ClientUser for client-facing minimal profile
 * @see AdminUserProfile for admin endpoints with Firebase Auth admin fields
 */
export interface UserProfile {
    uid: UserId;
    displayName: DisplayName;
    email: Email;
    emailVerified: boolean;
    photoURL: string | null;
    role: SystemUserRole;

    // Firestore audit fields (optional - may not exist for newly created users)
    createdAt?: ISOString;
    updatedAt?: ISOString;

    // Optional user data
    preferredLanguage?: string;
    acceptedPolicies?: Record<PolicyId, Record<VersionHash, ISOString>>;
}

/**
 * Admin-facing user profile with Firebase Auth administrative fields.
 *
 * This extends UserProfile with Firebase Auth admin-only fields like disabled
 * status and metadata. These fields are only available to system administrators
 * and are not exposed to regular users.
 *
 * **Used by:**
 * - Admin API endpoints (PUT /admin/users/:uid)
 * - User management UI (AdminUsersTab)
 * - Browser/admin endpoints (/browser/users)
 *
 * **Firebase Auth guarantees:** disabled and metadata are always present when
 * fetching user records via the Admin SDK.
 *
 * @see UserProfile for server-side internal user data
 * @see ClientUser for client-facing minimal profile
 */
export interface AdminUserProfile extends UserProfile {
    /** Whether the user account is disabled */
    disabled: boolean;
    /** Firebase Auth metadata */
    metadata: {
        /** When the user account was created */
        creationTime: string;
        /** When the user last signed in (may not exist if never signed in) */
        lastSignInTime?: string;
    };
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
 * Client-facing user profile returned to authenticated clients.
 *
 * This is the minimal user profile that clients receive from regular API endpoints.
 * All fields except optional preferences are guaranteed to be present.
 *
 * **Used by:**
 * - GET /api/users/:uid (regular user profile endpoint)
 * - Frontend user context/state
 * - Non-admin API responses
 *
 * **Design principle:** If the field might not be present, it shouldn't be required in this type.
 * Only truly optional user preferences are marked optional.
 *
 * **Phase 2 Update (2025-01-17):** Made photoURL and role required to match backend guarantees.
 * The backend always provides these fields (photoURL is null if not set, role defaults to SYSTEM_USER).
 *
 * @see UserProfile for server-side internal user data
 * @see AdminUserProfile for admin-facing user data with Firebase Auth admin fields
 */
export interface ClientUser {
    uid: UserId;
    email: Email;
    displayName: DisplayName;
    emailVerified: boolean;
    /** Profile photo URL (always present - null if not set) */
    photoURL: string | null;
    /** User's system role (optional on client-side during auth, always provided by backend API) */
    role?: SystemUserRole;
    /** User's preferred language code (e.g., 'en', 'es', 'fr') - truly optional */
    preferredLanguage?: string;
}

// Base interface for document types with common timestamp fields
interface BaseDTO<T> {
    id: T;
    createdAt: ISOString;
    updatedAt: ISOString;
}

export interface PolicyVersion {
    text: PolicyText;
    createdAt: ISOString;
}

interface Policy {
    policyName: PolicyName;
    currentVersionHash: VersionHash;
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
    groupDisplayName: DisplayName; // Custom display name for this group (set on join, can be changed later)
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
    groupDisplayName: DisplayName; // Custom display name for this group (set on join, can be changed later)

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

/**
 * Currency settings for a group - allows admins to restrict which currencies
 * can be used for expenses and set a default currency.
 */
export interface GroupCurrencySettings {
    /** Array of permitted ISO currency codes (e.g., ['USD', 'EUR']) */
    permitted: CurrencyISOCode[];
    /** The default currency for new expenses in this group */
    default: CurrencyISOCode;
}

interface Group {
    // Core fields
    name: GroupName;
    description?: string;

    // Individual permission settings (customizable after preset selection)
    permissions: GroupPermissions;

    // Permission change history
    permissionHistory?: PermissionChangeLog[];

    // Invite link configuration
    inviteLinks?: Record<string, InviteLink>;

    // Currency restrictions for this group
    currencySettings?: GroupCurrencySettings;

    // Recently used expense labels for autocomplete (label -> last used timestamp)
    recentlyUsedLabels?: Record<ExpenseLabel, ISOString>;

    // Group locking - when true, group is read-only for all members (defaults to false)
    locked: boolean;

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
    description?: Description;
    currencySettings?: GroupCurrencySettings;
}

export interface UpdateGroupRequest {
    name?: GroupName;
    description?: Description;
    currencySettings?: GroupCurrencySettings | null; // null to clear settings
    locked?: boolean; // Only admins can set this
}

export interface UpdateDisplayNameRequest {
    displayName: DisplayName;
}

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
    description: Description;
    labels: ExpenseLabel[]; // 0-3 freeform labels
    date: ISOString;
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
    participants: UserId[];
    splits: ExpenseSplit[];
    receiptUrl?: string;
    location?: ExpenseLocation; // Optional location with name and optional URL
    supersededBy: ExpenseId | null; // Non-null if this expense was edited (replaced by newer version)
}

/**
 * Location data for an expense.
 * Can include just a name, or a name with the original Google Maps URL.
 */
export interface ExpenseLocation {
    name: string; // The place name (e.g., "Starbucks", "Café de Flore")
    url?: string; // Optional Google Maps URL for linking back
}

/**
 * Expense DTO = Business fields + Metadata
 *
 * This is the wire format returned by API endpoints. All timestamps are ISO 8601 strings.
 * The canonical storage format is ExpenseDocument in firebase/functions/src/schemas/expense.ts
 * which uses Firestore Timestamp objects.
 */
export interface ExpenseDTO extends Expense, BaseDTO<ExpenseId> {
    isLocked: boolean; // True if any participant has left the group (computed field, always present)
    reactionCounts?: ReactionCounts; // Aggregated reaction counts (optional, included when reactions exist)
    userReactions?: ReactionEmoji[]; // Current user's reactions on this expense (optional, included when user has reacted)
    commentCount?: number; // Number of comments on this expense (optional, 0 means no comments)
}

export interface CreateExpenseRequest {
    groupId: GroupId;
    description: Description;
    amount: Amount;
    currency: CurrencyISOCode;
    paidBy: UserId;
    labels: ExpenseLabel[]; // 0-3 freeform labels
    date: ISOString;
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
    participants: UserId[];
    splits: ExpenseSplit[];
    receiptUrl?: string;
    location?: ExpenseLocation;
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
    supersededBy: SettlementId | null; // Non-null if this settlement was edited (replaced by newer version)
}

/**
 * Settlement DTO = Business fields + Metadata
 *
 * This is the wire format returned by API endpoints. All timestamps are ISO 8601 strings.
 * The canonical storage format is SettlementDocument in firebase/functions/src/schemas/settlement.ts
 * which uses Firestore Timestamp objects.
 */
export interface SettlementDTO extends Settlement, BaseDTO<SettlementId> {
    isLocked: boolean; // True if payer or payee has left the group (computed field, always present)
    reactionCounts?: ReactionCounts; // Aggregated reaction counts (optional, included when reactions exist)
    userReactions?: ReactionEmoji[]; // Current user's reactions on this settlement (optional, included when user has reacted)
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
    isLocked: boolean; // True if payer or payee has left the group (computed field, always present)
    supersededBy: SettlementId | null; // Non-null if this settlement was edited (replaced by newer version)
    reactionCounts?: ReactionCounts;
    userReactions?: ReactionEmoji[]; // Current user's reactions on this settlement
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
    groupDescription: Description;
    memberCount: number;
    isAlreadyMember: boolean;
}

export interface JoinGroupResponse {
    groupId: GroupId;
    groupName: GroupName;
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

// ========================================================================
// Login & Password Reset Types
// ========================================================================

/**
 * Login request payload.
 * Used for POST /api/login endpoint.
 */
export interface LoginRequest {
    email: Email;
    password: Password;
}

/**
 * Login response payload.
 * Contains a custom token that the client uses to sign in with Firebase Auth.
 */
export interface LoginResponse {
    success: boolean;
    customToken: string;
}

/**
 * Password reset request payload.
 * Used for POST /api/password-reset endpoint.
 * Returns 204 No Content (even for non-existent emails to prevent enumeration).
 */
export interface PasswordResetRequest {
    email: Email;
}

export type HealthStatus = 'healthy' | 'unhealthy';

export interface HealthCheckResult {
    status: HealthStatus;
    responseTime?: number;
    error?: string;
}

export interface HealthResponse {
    status: HealthStatus;
    timestamp: ISOString;
    checks: {
        firestore: HealthCheckResult;
        auth: HealthCheckResult;
    };
}

export interface UserProfileResponse {
    displayName: DisplayName;
    role: SystemUserRole;
    email: Email;
    emailVerified: boolean;
    preferredLanguage?: string;
}

export interface AcceptMultiplePoliciesResponse {
    acceptedPolicies: Array<{
        policyId: PolicyId;
        versionHash: VersionHash;
        acceptedAt: ISOString;
    }>;
}

export interface PolicyAcceptanceStatusDTO {
    policyId: PolicyId;
    currentVersionHash: VersionHash;
    userAcceptedHash?: VersionHash;
    needsAcceptance: boolean;
    policyName: PolicyName;
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

/**
 * Response from getCurrentPolicy - returns the current published version of a policy
 * Used by the policy acceptance modal to display policy content to users
 */
export interface CurrentPolicyResponse {
    id: PolicyId;
    policyName: PolicyName;
    currentVersionHash: VersionHash;
    text: PolicyText;
    createdAt: ISOString;
}

// ========================================================================
// Account Merge types
// ========================================================================

/**
 * Status of a merge job
 */
export type MergeJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Request to initiate an account merge
 * The authenticated user becomes the primary account
 */
export interface InitiateMergeRequest {
    secondaryUserId: UserId;
}

/**
 * Response after initiating a merge
 */
export interface InitiateMergeResponse {
    jobId: string;
    status: MergeJobStatus;
}

/**
 * Merge job status response (returned by GET /merge/:jobId)
 */
export interface MergeJobResponse {
    id: string;
    primaryUserId: UserId;
    secondaryUserId: UserId;
    status: MergeJobStatus;
    createdAt: ISOString;
    startedAt?: ISOString;
    completedAt?: ISOString;
    error?: string;
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
    balancesByCurrency: Record<CurrencyISOCode, Record<UserId, UserBalance>>;
}

// ========================================================================
// Comments types
// ========================================================================

/**
 * Reference to an attachment stored in comment documents.
 * Contains denormalized metadata for display without fetching the attachment.
 */
export interface CommentAttachmentRef {
    attachmentId: AttachmentId;
    fileName: string;
    contentType: string;
    sizeBytes: number;
}

/**
 * Comment business fields (without metadata)
 */
interface Comment {
    authorId: UserId;
    authorName: string;
    authorAvatar?: string;
    text: CommentText;
    attachments?: CommentAttachmentRef[];
}

/**
 * Comment DTO = Business fields + Metadata
 */
export interface CommentDTO extends Comment, BaseDTO<CommentId> {
    reactionCounts?: ReactionCounts; // Aggregated reaction counts (optional, included when reactions exist)
    userReactions?: ReactionEmoji[]; // Current user's reactions on this comment (optional, included when user has reacted)
}

interface BaseCreateCommentRequest {
    text: CommentText;
    attachmentIds?: AttachmentId[];
}

export interface CreateGroupCommentRequest extends BaseCreateCommentRequest {
    groupId: GroupId;
}

export interface CreateExpenseCommentRequest extends BaseCreateCommentRequest {
    expenseId: ExpenseId;
}

// ========================================================================
// Reaction Types
// ========================================================================

/**
 * Aggregated reaction counts for display.
 * Map of emoji -> count.
 */
export type ReactionCounts = Partial<Record<ReactionEmoji, number>>;

/**
 * Individual reaction stored in Firestore subcollection.
 * Document ID format: {userId}_{emoji}
 */
export interface ReactionDTO {
    id: ReactionId;
    userId: UserId;
    emoji: ReactionEmoji;
    createdAt: ISOString;
}

/**
 * Summary of reactions for a resource, including the current user's reactions.
 */
export interface ReactionSummary {
    counts: ReactionCounts;
    userReactions: ReactionEmoji[];
}

/**
 * Response from toggling a reaction.
 */
export interface ReactionToggleResponse {
    action: 'added' | 'removed';
    emoji: ReactionEmoji;
    newCount: number;
}

/**
 * Request to toggle a reaction on a resource.
 */
export interface ToggleReactionRequest {
    emoji: ReactionEmoji;
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
// Attachment types
// ========================================================================

/**
 * Attachment DTO returned from upload endpoint.
 * Contains metadata about an uploaded file.
 */
export interface AttachmentDTO {
    id: AttachmentId;
    fileName: string;
    contentType: string;
    sizeBytes: number;
}

/**
 * Response from uploading an attachment.
 * Returns the attachment metadata and the proxy URL to access it.
 */
export interface UploadAttachmentResponse {
    attachment: AttachmentDTO;
    url: string;
}

// ========================================================================
// Policy Admin Response Types
// ========================================================================

export interface UpdatePolicyResponse {
    versionHash: VersionHash;
    published: boolean;
    currentVersionHash: VersionHash | undefined;
}

export interface PublishPolicyResponse {
    currentVersionHash: VersionHash;
}

export interface CreatePolicyResponse {
    id: PolicyId;
    versionHash: VersionHash;
}

export interface DeletePolicyVersionResponse {
}

// ========================================================================
// Policy Admin Request Types
// ========================================================================

export interface CreatePolicyRequest {
    policyName: PolicyName;
    text: PolicyText;
}

export interface UpdatePolicyRequest {
    text: PolicyText;
    publish?: boolean;
}

export interface ListPoliciesResponse {
    policies: PolicyDTO[];
    count: number;
}

// ========================================================================
// Policy Service Result Types
// ========================================================================
// These are simpler return types for service-level methods,
// distinct from API response types which include success/message wrappers

export interface PolicyVersionResponse extends PolicyVersion {
    versionHash: VersionHash;
}

export interface UpdatePolicyResult {
    versionHash: VersionHash;
    currentVersionHash?: VersionHash;
}

export interface PublishPolicyResult {
    currentVersionHash: VersionHash;
}

export interface CreatePolicyResult {
    id: PolicyId;
    currentVersionHash: VersionHash;
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
    description?: Description;
}

/**
 * Form data for expense creation in UI
 * Used in E2E tests for form submission payloads
 */
export interface ExpenseFormData {
    description: Description;
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
    description: Description;
    amount: Amount;
    currency: CurrencyISOCode;
    date: string; // YYYY-MM-DD format
    time: string; // HH:MM format
    paidBy: UserId;
    labels: ExpenseLabel[]; // 0-3 freeform labels
    location?: ExpenseLocation;
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
 * Options for listing settlements
 * Used by API clients for settlement list queries
 */
export interface ListSettlementsOptions {
    cursor?: string;
    limit?: number;
    uid?: UserId;
    startDate?: ISOString;
    endDate?: ISOString;
    includeDeleted?: boolean;
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
    preferredLanguage?: string;
}

/**
 * Tenant settings response
 * Returned by GET /settings/tenant endpoint
 */
export interface TenantSettingsResponse {
    tenantId: TenantId;
    config: TenantConfig;
    domains: TenantDomainName[];
}

/**
 * Tenant branding update request
 * Used for PUT /settings/tenant/branding endpoint
 *
 * appName, logoUrl, faviconUrl are written to brandingTokens.tokens.* by the backend.
 */
export interface UpdateTenantBrandingRequest {
    appName?: string;
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: TenantPrimaryColor;
    secondaryColor?: TenantSecondaryColor;
    accentColor?: TenantAccentColor;
    showAppNameInHeader?: boolean;
    marketingFlags?: Partial<BrandingMarketingFlags>;
}

/**
 * Tenant domains list response
 * Returned by GET /settings/tenant/domains endpoint
 */
export interface TenantDomainsResponse {
    domains: TenantDomainName[];
}

/**
 * Add tenant domain request
 * Used for POST /settings/tenant/domains endpoint
 */
export interface AddTenantDomainRequest {
    domain: TenantDomainName;
}

// ========================================================================
// Environment Diagnostics Types (Admin)
// ========================================================================

/**
 * Memory summary in the environment diagnostics status
 */
export interface EnvironmentMemorySummary {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
}

/**
 * V8 heap space information
 */
export interface EnvironmentHeapSpace {
    spaceName: string;
    spaceSize: string;
    spaceUsed: string;
    spaceAvailable: string;
    physicalSize: string;
}

/**
 * File information in environment diagnostics
 */
export interface EnvironmentFileInfo {
    name: string;
    type?: string;
    size?: string | null;
    modified?: string;
    mode?: string;
    isSymbolicLink?: boolean;
    error?: string;
}

/**
 * Environment diagnostics response
 * Returned by GET /api/env endpoint (admin-only)
 */
export interface EnvironmentDiagnosticsResponse {
    status: {
        timestamp: string;
        environment: string;
        nodeVersion: string;
        uptimeSeconds: number;
        memorySummary: EnvironmentMemorySummary;
    };
    env: Record<string, string | undefined>;
    build: {
        timestamp: string;
        date: string;
        version: string;
    };
    runtime: {
        startTime: string;
        uptime: number;
        uptimeHuman: string;
    };
    memory: {
        rss: string;
        heapTotal: string;
        heapUsed: string;
        external: string;
        arrayBuffers: string;
        heapAvailable: string;
        heapLimit: string;
        totalHeapSize: string;
        totalHeapExecutableSize: string;
        totalPhysicalSize: string;
        totalAvailableSize: string;
        mallocedMemory: string;
        peakMallocedMemory: string;
        heapSpaces: EnvironmentHeapSpace[];
    };
    filesystem: {
        currentDirectory: string;
        files: EnvironmentFileInfo[];
    };
}

/**
 * Admin upsert tenant request (create or update full tenant configuration)
 * Used for POST /api/admin/tenants endpoint (system admin only)
 *
 * NOTE: appName, logoUrl, faviconUrl are in brandingTokens.tokens.legal/assets
 */
export interface AdminUpsertTenantRequest {
    tenantId: string;
    branding: {
        primaryColor: string;
        secondaryColor: string;
        accentColor?: string;
        showAppNameInHeader?: boolean;
    };
    marketingFlags?: {
        showMarketingContent?: boolean;
        showPricingPage?: boolean;
    };
    brandingTokens: TenantBranding;
    domains: string[];
    defaultTenant?: boolean;
}

/**
 * Admin upsert tenant response
 * Returned by POST /api/admin/tenants endpoint
 */
export interface AdminUpsertTenantResponse {
    tenantId: string;
    created: boolean;
}

/**
 * Upload tenant image response
 * Returned by POST /api/admin/tenants/:tenantId/assets/:assetType endpoint
 */
export interface UploadTenantImageResponse {
    url: string;
}

/**
 * List Auth users response
 * Returned by GET /admin/browser/users/auth endpoint (system_admin only)
 */
export interface ListAuthUsersResponse {
    users: AdminUserProfile[];
    nextPageToken?: string;
    hasMore: boolean;
}

/**
 * List Firestore users response
 * Returned by GET /admin/browser/users/firestore endpoint (system_admin only)
 */
export interface ListFirestoreUsersResponse {
    users: UserProfile[];
    nextCursor?: string;
    hasMore: boolean;
}

export interface TenantFullRecord {
    tenant: TenantConfig;
    domains: TenantDomainName[];
    isDefault: TenantDefaultFlag;
}

/**
 * List all tenants response
 * Returned by GET /admin/browser/tenants endpoint (system_admin only)
 */
export interface ListAllTenantsResponse {
    tenants: TenantFullRecord[];
    count: number;
}

/**
 * Publish tenant theme response
 * Returned by POST /admin/tenants/publish endpoint (system_admin only)
 */
export interface PublishTenantThemeResponse {
    success: boolean;
    message: string;
    publicUrl?: string;
    cssUrl: string;
    tokensUrl: string;
    artifact: {
        version: number;
        hash: string;
        generatedBy: UserId;
        cssUrl: string;
        tokensUrl: string;
    };
}

/**
 * Publish tenant theme request
 * Used for POST /admin/tenants/publish endpoint (system_admin only)
 */
export interface PublishTenantThemeRequest {
    tenantId: string;
}

// ========================================================================
// Tenant Image Library Types
// ========================================================================

/**
 * Branded type for tenant image IDs
 */
export type TenantImageId = string & { readonly __brand: 'TenantImageId'; };

export function toTenantImageId(id: string): TenantImageId {
    return id as TenantImageId;
}

/**
 * Tenant image DTO
 * Represents an image in a tenant's image library
 */
export interface TenantImageDTO {
    id: TenantImageId;
    name: string;
    url: string;
    contentType: string;
    sizeBytes: number;
    uploadedAt: ISOString;
    uploadedBy: UserId;
}

/**
 * Upload tenant library image response
 * Returned by POST /admin/tenants/:tenantId/images endpoint
 */
export interface UploadTenantLibraryImageResponse {
    image: TenantImageDTO;
}

/**
 * List tenant library images response
 * Returned by GET /admin/tenants/:tenantId/images endpoint
 */
export interface ListTenantImagesResponse {
    images: TenantImageDTO[];
}

/**
 * Rename tenant library image request
 * Used for PATCH /admin/tenants/:tenantId/images/:imageId endpoint
 */
export interface RenameTenantImageRequest {
    name: string;
}

/**
 * Update user status request
 * Used for PUT /admin/users/:uid endpoint (system_admin only)
 */
export interface UpdateUserStatusRequest {
    disabled: boolean;
}

/**
 * Update user role request
 * Used for PUT /admin/users/:uid/role endpoint (system_admin only)
 */
export interface UpdateUserRoleRequest {
    role: SystemUserRole | null;
}

/**
 * Update user profile request (admin)
 * Used for PUT /admin/users/:uid/profile endpoint (system_admin only)
 */
export interface UpdateUserProfileAdminRequest {
    displayName?: DisplayName;
    email?: Email;
}

// ========================================================================
// URL Redirect Resolution Types
// ========================================================================

/**
 * Request to resolve a shortened URL by following redirects.
 * Used by the location input to expand maps.app.goo.gl and similar short URLs.
 */
export interface ResolveRedirectRequest {
    url: string;
}

/**
 * Response from resolving a shortened URL.
 * Returns the final URL after following all redirects.
 */
export interface ResolveRedirectResponse {
    resolvedUrl: string;
}

// ========================================================================
// Email Template Types
// ========================================================================

/**
 * Variables for password reset email interpolation.
 * Used by EmailTemplateService to generate password reset emails.
 */
export interface PasswordResetEmailVariables {
    appName: string;
    domain: string;
    resetLink: string;
}

/**
 * Variables for welcome email interpolation.
 * Used by EmailTemplateService to generate welcome emails.
 */
export interface WelcomeEmailVariables {
    appName: string;
    displayName: string;
    dashboardLink: string;
}
