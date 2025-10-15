// Single shared type file for webapp
// This file contains all type definitions used by the webapp client
import { z } from 'zod';
import type { ColorPattern } from './user-colors';

// ========================================================================
// Type aliases for Firebase types (browser-safe)
// ========================================================================

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
export type ISOString = string;

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
export const ZERO: Amount = "0";

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

export const DELETED_AT_FIELD = 'deletedAt';

// ========================================================================
// Soft Delete Interface
// ========================================================================

/**
 * Common soft delete metadata fields.
 * All soft-deletable financial entities must include these fields.
 * Applies to: Expenses, Settlements
 * Does NOT apply to: Comments (hard delete), Groups (hard delete)
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
    deletedBy: string | null;
}

// ========================================================================
// System User Roles (App-level)
// ========================================================================

// System-level roles for the entire application
// These control admin panel access and system-wide features
export const SystemUserRoles = {
    SYSTEM_ADMIN: 'system_admin', // Can access admin panel, manage all users
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
    createdBy: string;
    expiresAt?: ISOString;
    maxUses?: number; // Optional usage limit
    usedCount: number;
}

// ========================================================================
// Expense Category Types and Constants
// ========================================================================

export interface ExpenseCategory {
    name: string;
    displayName: string;
    icon: string;
}

export const PREDEFINED_EXPENSE_CATEGORIES: ExpenseCategory[] = [
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

export interface AppConfiguration {
    firebase: FirebaseConfig;
    environment: EnvironmentConfig;
    formDefaults: FormDefaults;
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
    displayName: string;
}

export interface UserRegistration extends BaseUser {
    email: string;
    password: string;
    termsAccepted: boolean;
    cookiePolicyAccepted: boolean;
}

export interface FirebaseUser extends BaseUser {
    uid: string;
}

export interface PooledTestUser extends UserToken {
    password: string;
    email: string;
}

export interface UserToken {
    uid: string;
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
    // Firebase Auth fields
    photoURL?: string | null; // Profile photo URL from Firebase Auth
    emailVerified: boolean; // Email verification status

    // System administration
    role?: SystemUserRole; // Role field for admin access control

    // Policy acceptance tracking
    termsAcceptedAt?: ISOString;
    cookiePolicyAcceptedAt?: ISOString;
    acceptedPolicies?: Record<string, string>; // Map of policyId -> versionHash

    // User preferences
    themeColor?: UserThemeColor; // Automatic theme color assignment
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
    uid: string;
    displayName: string;
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
    uid: string;
    email: string;
    displayName: string;
    emailVerified: boolean;
    photoURL?: string | null;
    themeColor?: UserThemeColor;
    preferredLanguage?: string;
}

interface HasFirebaseMetadatwaFields {
    createdAt: ISOString;
    updatedAt: ISOString;
}

// Base interface for document types with common timestamp fields
export interface BaseDTO {
    id: string;
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

export interface PolicyDTO extends Policy, BaseDTO {}

// ========================================================================
// Balance Types
// ========================================================================

export interface UserBalance {
    uid: string;
    owes: Record<string, Amount>;
    owedBy: Record<string, Amount>;
    netBalance: Amount;
}

export interface CurrencyBalance {
    currency: string;
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
    uid: string;
    groupId: string; // For collectionGroup queries
    memberRole: MemberRole;
    memberStatus: MemberStatus;
    joinedAt: ISOString;
    invitedBy?: string; // UID of the user who created the share link that was used to join
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
    uid: string;
    displayName: string;
    initials: string;

    // User display properties
    themeColor: UserThemeColor;

    // Group-specific customization
    groupDisplayName: string; // Custom display name for this group (set on join, can be changed later)

    // Group membership metadata (required for permissions)
    memberRole: MemberRole;
    memberStatus: MemberStatus;
    joinedAt: ISOString;
    invitedBy?: string; // UID of the user who invited this member
}

/**
 * ShareLink business fields (without metadata)
 */
interface ShareLink {
    token: string; // The actual share token used in URLs
    createdBy: string; // UID of the user who created this share link
    expiresAt?: ISOString;
    isActive: boolean; // For soft deletion/deactivation
}

/**
 * ShareLink DTO = Business fields + Metadata
 *
 * This is the wire format returned by API endpoints. All timestamps are ISO 8601 strings.
 * The canonical storage format is ShareLinkDocument in firebase/functions/src/schemas/sharelink.ts
 * which uses Firestore Timestamp objects.
 */
export interface ShareLinkDTO extends ShareLink, BaseDTO {}

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
    name: string;
    description?: string;

    createdBy: string;

    // Security Configuration
    securityPreset: SecurityPreset; // default: 'open'
    presetAppliedAt?: ISOString;

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
export interface GroupDTO extends Group, BaseDTO {}

// Request/Response types
export interface CreateGroupRequest {
    name: string;
    description?: string;
}

export interface UpdateGroupRequest {
    name?: string;
    description?: string;
}

export interface UpdateDisplayNameRequest {
    displayName: string;
}

// Validation schemas
export const CreateGroupRequestSchema = z.object({
    name: z.string().trim().min(1, 'Group name is required').max(100, 'Group name must be less than 100 characters'),
    description: z.string().trim().max(500).optional(),
});

export const UpdateGroupRequestSchema = z
    .object({
        name: z.string().trim().min(1).max(100).optional(),
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
    uid: string;
    amount: Amount;
    percentage?: number;
}

/**
 * Expense business fields (without metadata)
 */
interface Expense extends SoftDeletable {
    groupId: string;
    createdBy: string;
    paidBy: string;
    amount: Amount;
    currency: string;
    description: string;
    category: string;
    date: ISOString;
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
    participants: string[];
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
export interface ExpenseDTO extends Expense, BaseDTO {
    isLocked?: boolean; // True if any participant has left the group
}

export interface CreateExpenseRequest {
    groupId: string;
    description: string;
    amount: Amount;
    currency: string;
    paidBy: string;
    category: string;
    date: string;
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
    participants: string[];
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
    groupId: string;
    payerId: string;
    payeeId: string;
    amount: Amount;
    currency: string;
    date: ISOString;
    note?: string;
    createdBy: string;
}

/**
 * Settlement DTO = Business fields + Metadata
 *
 * This is the wire format returned by API endpoints. All timestamps are ISO 8601 strings.
 * The canonical storage format is SettlementDocument in firebase/functions/src/schemas/settlement.ts
 * which uses Firestore Timestamp objects.
 */
export interface SettlementDTO extends Settlement, BaseDTO {
    isLocked?: boolean; // True if payer or payee has left the group
}

export interface CreateSettlementRequest {
    groupId: string;
    payerId: string;
    payeeId: string;
    amount: Amount;
    currency: string;
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
    id: string;
    groupId: string;
    payer: GroupMember;
    payee: GroupMember;
    amount: Amount;
    currency: string;
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
    members: { members: GroupMember[]; };
    expenses: { expenses: ExpenseDTO[]; hasMore: boolean; nextCursor?: string; };
    balances: GroupBalances;
    settlements: { settlements: SettlementWithMembers[]; hasMore: boolean; nextCursor?: string; };
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

export interface LeaveGroupResponse {
    success: boolean;
    message: string;
}

export interface RemoveGroupMemberResponse {
    success: boolean;
    message: string;
}

export interface ShareLinkResponse {
    linkId: string;
    shareablePath: string;
}

export interface PreviewGroupResponse {
    groupId: string;
    groupName: string;
    groupDescription: string;
    memberCount: number;
    isAlreadyMember: boolean;
}

export interface JoinGroupResponse {
    groupId: string;
    groupName: string;
    success: boolean;
    displayNameConflict: boolean; // True if user's display name conflicts with existing member
}

export interface RegisterResponse {
    success: boolean;
    message: string;
    user: {
        uid: string;
        displayName: string;
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
    displayName: string;
}

export interface AcceptMultiplePoliciesResponse {
    success: boolean;
    message: string;
    acceptedPolicies: Array<{
        policyId: string;
        versionHash: string;
        acceptedAt: string;
    }>;
}

export interface PolicyAcceptanceStatusDTO {
    policyId: string;
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
    policyId: string;
    versionHash: string;
}

export interface CreateSettlementResponse {
    success: boolean;
    data: SettlementDTO;
}

export interface UpdateSettlementResponse {
    success: boolean;
    data: SettlementWithMembers;
}

export interface DeleteSettlementResponse {
    success: boolean;
    message: string;
}

// ========================================================================
// Balance calculation types
// ========================================================================

export interface SimplifiedDebt {
    from: {
        uid: string;
    };
    to: {
        uid: string;
    };
    amount: Amount;
    currency: string;
}

export interface GroupBalances {
    groupId: string;
    userBalances: Record<string, UserBalance>;
    simplifiedDebts: SimplifiedDebt[];
    lastUpdated: ISOString;
    balancesByCurrency: Record<string, Record<string, UserBalance>>;
}

// ========================================================================
// Comments types
// ========================================================================

export const CommentTargetTypes = {
    GROUP: 'group',
    EXPENSE: 'expense',
} as const;

export type CommentTargetType = (typeof CommentTargetTypes)[keyof typeof CommentTargetTypes];

/**
 * Comment business fields (without metadata)
 */
interface Comment {
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    text: string;
}

/**
 * Comment DTO = Business fields + Metadata
 */
export interface CommentDTO extends Comment, BaseDTO {}

export interface CreateCommentRequest {
    text: string;
    targetType: CommentTargetType;
    targetId: string;
    groupId?: string; // Required for expense comments
}

export interface ListCommentsResponse {
    comments: CommentDTO[];
    hasMore: boolean;
    nextCursor?: string;
}

export interface CreateCommentResponse {
    success: boolean;
    data: CommentDTO;
}

// ========================================================================
// Policy Admin Response Types
// ========================================================================

export interface UpdatePolicyResponse {
    success: boolean;
    versionHash: string;
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
    versionHash: string;
    message: string;
}

export interface DeletePolicyVersionResponse {
    success: boolean;
    message: string;
}

// ========================================================================
// Test Pool Response Types
// ========================================================================

export interface ReturnTestUserResponse {
    message: string;
    email: string;
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

export interface TestPromoteToAdminResponse {
    success: boolean;
    message: string;
    userId: string;
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
    currency: string;
    paidByDisplayName: string; // Display name (not the uid)
    splitType: 'equal' | 'exact' | 'percentage';
    participants: string[]; // Participant names (not the uids)
}

/**
 * Form data for settlement creation in UI
 * Used in E2E tests for settlement form submission payloads
 */
export interface SettlementFormData {
    payerName: string; // Display name of who paid
    payeeName: string; // Display name of who received payment
    amount: string;
    currency: string;
    note: string;
}

/**
 * Draft expense stored in local storage
 * Used by webapp to persist unsaved expense forms
 */
export interface ExpenseDraft {
    description: string;
    amount: Amount;
    currency: string;
    date: string; // YYYY-MM-DD format
    time: string; // HH:MM format
    paidBy: string;
    category: string;
    splitType: string;
    participants: string[];
    splits: Array<{ userId: string; amount: Amount; percentage?: number; }>;
    timestamp: number;
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
 * User profile update request
 * Used for updating user profile information
 */
export interface UpdateUserRequest {
    displayName?: string;
    email?: string;
    phoneNumber?: string | null;
    photoURL?: string | null;
    password?: string;
    emailVerified?: boolean;
    disabled?: boolean;
    preferredLanguage?: string;
}

/**
 * Password change request
 * Used for changing user passwords
 */
export interface PasswordChangeRequest {
    currentPassword?: string;
    newPassword?: string;
}
