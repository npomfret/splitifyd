// Single shared type file for webapp
// This file contains all type definitions used by the webapp client
import type { ColorPattern } from './user-colors';

// ========================================================================
// Type aliases for Firebase types (browser-safe)
// ========================================================================

// Browser-safe type for Firestore Timestamp
// In runtime, this will be either Date or firebase.firestore.Timestamp
export type FirestoreTimestamp = Date | { toDate(): Date; seconds: number; nanoseconds: number };

// ========================================================================
// Constants
// ========================================================================

export const FirestoreCollections = {
    GROUPS: 'groups',
    EXPENSES: 'expenses',
    SETTLEMENTS: 'settlements',
    USERS: 'users',
    POLICIES: 'policies',
    COMMENTS: 'comments',
    // Change tracking collections
    GROUP_CHANGES: 'group-changes',
    TRANSACTION_CHANGES: 'transaction-changes',
    BALANCE_CHANGES: 'balance-changes',
} as const;

// Type-safe collection names
export type FirestoreCollectionName = (typeof FirestoreCollections)[keyof typeof FirestoreCollections];
export type ChangeCollectionName = typeof FirestoreCollections.GROUP_CHANGES | typeof FirestoreCollections.TRANSACTION_CHANGES | typeof FirestoreCollections.BALANCE_CHANGES;

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

export interface PermissionChangeLog {
    timestamp: string; // ISO string
    changedBy: string;
    changeType: 'preset' | 'custom' | 'role';
    changes: Record<string, any>;
}

export interface InviteLink {
    createdAt: string; // ISO string
    createdBy: string;
    expiresAt?: string; // Optional expiry for managed groups (ISO string)
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
    assignedAt: string; // ISO timestamp
    colorIndex: number;
}

export interface BaseUser {
    email: string;
    displayName: string;
}

export interface UserRegistration extends BaseUser {
    password: string;
    termsAccepted: boolean;
    cookiePolicyAccepted: boolean;
}

export interface FirebaseUser extends BaseUser {
    uid: string;
}

export interface AuthenticatedFirebaseUser extends FirebaseUser {
    token: string;
}

export interface RegisteredUser extends FirebaseUser {
    role?: SystemUserRole; // Role field for admin access control
    termsAcceptedAt?: Date | FirestoreTimestamp; // Legacy timestamp field
    cookiePolicyAcceptedAt?: Date | FirestoreTimestamp; // Legacy timestamp field
    acceptedPolicies?: Record<string, string>; // Map of policyId -> versionHash
    themeColor?: UserThemeColor; // Automatic theme color assignment
    preferredLanguage?: string; // User's preferred language code (e.g., 'en', 'es', 'fr')
}

// ========================================================================
// Policy Types - For versioned terms and cookie policy acceptance
// ========================================================================

// Base interface for document types with common timestamp fields
export interface BaseDocument {
    id: string;
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
}

// Utility type to convert FirestoreTimestamp fields to string for API responses
export type WithStringTimestamps<T> = {
    [K in keyof T]: T[K] extends FirestoreTimestamp ? string : T[K];
};

export interface PolicyVersion {
    text: string;
    createdAt: string; // ISO string
}

export interface Policy {
    policyName: string;
    currentVersionHash: string;
    versions: Record<string, PolicyVersion>; // Map of versionHash -> PolicyVersion
}

export interface PolicyDocument extends Policy, BaseDocument {}

// Admin Policy Management Types
export interface CreatePolicyRequest {
    policyName: string;
    text: string;
}

export interface UpdatePolicyRequest {
    text: string;
    publish?: boolean; // If true, immediately set as current version
}

export interface PublishPolicyRequest {
    versionHash: string;
}

// ========================================================================
// Balance Types
// ========================================================================

export interface UserBalance {
    userId: string;
    owes: Record<string, number>;
    owedBy: Record<string, number>;
    netBalance: number;
}

export interface CurrencyBalance {
    currency: string;
    netBalance: number;
    totalOwed: number;
    totalOwing: number;
}

export interface GroupBalance {
    userBalance?: {
        netBalance: number;
        totalOwed: number;
        totalOwing: number;
    } | null;
    balancesByCurrency: Record<string, CurrencyBalance>;
}

// ========================================================================
// Group Types - Single unified interface for both storage and API
// ========================================================================

export interface GroupMember {
    joinedAt: string; // ISO string
    memberRole: MemberRole;
    theme: UserThemeColor;
    invitedBy?: string; // UID of the user who created the share link that was used to join
    memberStatus: MemberStatus;
    lastPermissionChange?: string; // ISO string - Track permission updates
}

export type GroupMemberWithProfile = RegisteredUser & Omit<GroupMember, 'theme'> & {
    // Additional user display properties for UI
    initials: string;   // Auto-generated from displayName
    // Note: theme is inherited from RegisteredUser.themeColor, not duplicated
};

/**
 * Document structure for storing members in the subcollection: groups/{groupId}/members/{userId}
 * This replaces the embedded members map for scalable queries
 */
export interface GroupMemberDocument {
    userId: string;
    groupId: string; // For collectionGroup queries
    memberRole: MemberRole;
    theme: UserThemeColor;
    joinedAt: string; // ISO string
    memberStatus: MemberStatus;
    invitedBy?: string; // UID of the user who created the share link that was used to join
    lastPermissionChange?: string; // ISO string - Track permission updates
}

export interface ShareLink {
    id: string;
    token: string; // The actual share token used in URLs
    createdBy: string; // UID of the user who created this share link
    createdAt: string; // ISO timestamp
    expiresAt?: string; // Future: expiration support (ISO timestamp)
    isActive: boolean; // For soft deletion/deactivation
}

export interface Group {
    // Always present
    id: string;
    name: string;
    description?: string;

    createdBy: string;
    createdAt: string; // ISO string
    updatedAt: string; // ISO string

    // Security Configuration
    securityPreset: SecurityPreset; // default: 'open'
    presetAppliedAt?: string; // ISO string - Track when preset was last applied

    // Individual permission settings (customizable after preset selection)
    permissions: GroupPermissions;

    // Permission change history
    permissionHistory?: PermissionChangeLog[];

    // Invite link configuration
    inviteLinks?: Record<string, InviteLink>;

    // Computed fields (only in API responses)
    balance?: {
        balancesByCurrency: Record<string, CurrencyBalance>;
    };
    lastActivity?: string;
    lastActivityRaw?: string;
}

// Request/Response types
export interface CreateGroupRequest {
    name: string;
    description?: string;
}

// Permission-related request/response types
export interface ApplySecurityPresetRequest {
    preset: SecurityPreset;
}

export interface UpdateGroupPermissionsRequest {
    permissions: Partial<GroupPermissions>;
}

export interface SetMemberRoleRequest {
    targetUserId: string;
    role: MemberRole;
}

export interface CreateInviteLinkRequest {
    expiresAt?: string; // ISO string
    maxUses?: number;
}

export interface PermissionCheckResult {
    allowed: boolean;
    reason?: string;
    userRole?: MemberRole;
}

export interface PendingMembersResponse {
    pendingMembers: Array<{
        user: RegisteredUser;
        requestedAt: string;
        invitedBy?: string;
    }>;
    count: number;
}

export interface PermissionHistoryResponse {
    history: PermissionChangeLog[];
    count: number;
}

// Metadata for real-time change tracking
export interface ChangeMetadata {
    lastChangeTimestamp: number;
    changeCount: number;
    serverTime: number;
    hasRecentChanges: boolean;
}

// List groups response
export interface ListGroupsResponse {
    groups: Group[];
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
    members: GroupMemberWithProfile[];
    hasMore: boolean;
    nextCursor?: string;
}

// ========================================================================
// Expense Types
// ========================================================================

export interface ExpenseSplit {
    userId: string;
    amount: number;
    percentage?: number;
}

export interface ExpenseData {
    id: string;
    groupId: string;
    createdBy: string;
    paidBy: string;
    amount: number;
    currency: string;
    description: string;
    category: string;
    date: string; // ISO string
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
    participants: string[];
    splits: ExpenseSplit[];
    receiptUrl?: string;
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
    deletedAt: string | null; // ISO string
    deletedBy: string | null;
}

export interface CreateExpenseRequest {
    groupId: string;
    description: string;
    amount: number;
    currency: string;
    paidBy: string;
    category: string;
    date: string;
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
    participants: string[];
    splits?: ExpenseSplit[];
    receiptUrl?: string;
}

export type UpdateExpenseRequest = Partial<Omit<CreateExpenseRequest, 'groupId'>>;

// ========================================================================
// Settlement Types
// ========================================================================

export interface Settlement {
    id: string;
    groupId: string;
    payerId: string;
    payeeId: string;
    amount: number;
    currency: string;
    date: string; // ISO string
    note?: string | undefined;
    createdBy: string;
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
}

export interface CreateSettlementRequest {
    groupId: string;
    payerId: string;
    payeeId: string;
    amount: number;
    currency: string;
    date?: string; // ISO string, defaults to today
    note?: string;
}

export type UpdateSettlementRequest = Partial<Omit<CreateSettlementRequest, 'groupId' | 'payerId' | 'payeeId'>>;

export interface SettlementListItem {
    id: string;
    groupId: string;
    payer: RegisteredUser;
    payee: RegisteredUser;
    amount: number;
    currency: string;
    date: string;
    note?: string;
    createdAt: string;
}

// ========================================================================
// Full Details Response Types
// ========================================================================

export interface GroupFullDetails {
    group: Group;
    members: { members: GroupMemberWithProfile[] };
    expenses: { expenses: ExpenseData[]; hasMore: boolean; nextCursor?: string };
    balances: GroupBalances;
    settlements: { settlements: SettlementListItem[]; hasMore: boolean; nextCursor?: string };
}

export interface ExpenseFullDetails {
    expense: ExpenseData;
    group: Group;
    members: { members: GroupMemberWithProfile[] };
}

// ========================================================================
// List Response Types
// ========================================================================

export interface ListExpensesResponse {
    expenses: ExpenseData[];
    hasMore: boolean;
    nextCursor?: string;
    count?: number;
}

export interface ListSettlementsResponse {
    settlements: SettlementListItem[];
    count: number;
    hasMore: boolean;
    nextCursor?: string;
}

// ========================================================================
// API Response Types
// ========================================================================

export interface MessageResponse {
    message: string;
    resetLink?: string;
}

export interface SuccessResponse {
    success: boolean;
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
}

export interface RegisterResponse {
    success: boolean;
    message: string;
    user: {
        uid: string;
        email: string;
        displayName: string;
    };
}

export interface HealthCheckResponse {
    checks: {
        firestore: {
            status: 'healthy' | 'unhealthy';
            responseTime?: number;
        };
        auth: {
            status: 'healthy' | 'unhealthy';
            responseTime?: number;
        };
    };
}

export interface UserPoliciesResponse {
    policies: Record<string, { policyName: string; currentVersionHash: string }>;
    count: number;
}

export interface CurrentPolicyResponse {
    id: string;
    policyName: string;
    currentVersionHash: string;
    text: string;
    createdAt: string;
}

export interface UserProfileResponse {
    uid: string;
    email: string;
    displayName: string;
    updatedAt?: string;
    createdAt?: string;
    photoURL?: string | null;
    themeColor?: UserThemeColor;
    preferredLanguage?: string;
}

export interface AcceptPolicyResponse {
    success: boolean;
    message: string;
    acceptedPolicy: {
        policyId: string;
        versionHash: string;
        acceptedAt: string;
    };
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

export interface PolicyAcceptanceStatus {
    policyId: string;
    currentVersionHash: string;
    userAcceptedHash?: string;
    needsAcceptance: boolean;
    policyName: string;
}

export interface UserPolicyStatusResponse {
    needsAcceptance: boolean;
    policies: PolicyAcceptanceStatus[];
    totalPending: number;
}

export interface AcceptPolicyRequest {
    policyId: string;
    versionHash: string;
}

export interface CreateSettlementResponse {
    success: boolean;
    data: Settlement;
}

export interface UpdateSettlementResponse {
    success: boolean;
    data: SettlementListItem;
}

export interface GetSettlementResponse {
    success: boolean;
    data: SettlementListItem;
}

export interface DeleteSettlementResponse {
    success: boolean;
    message: string;
}

export interface ListSettlementsApiResponse {
    success: boolean;
    data: ListSettlementsResponse;
}

export interface ExpenseHistoryItem {
    id: string;
    modifiedAt: string;
    modifiedBy: string;
    changeType: string;
    changes: string[];
    previousAmount?: number;
    previousDescription?: string;
    previousCategory?: string;
    previousDate?: string;
    previousParticipants?: string[];
}

export interface ExpenseHistoryResponse {
    history: ExpenseHistoryItem[];
    count: number;
}

// ========================================================================
// Balance calculation types
// ========================================================================

export interface SimplifiedDebt {
    from: {
        userId: string;
    };
    to: {
        userId: string;
    };
    amount: number;
    currency: string;
}

export interface GroupBalances {
    groupId: string;
    userBalances: Record<string, UserBalance>;
    simplifiedDebts: SimplifiedDebt[];
    lastUpdated: string; // ISO string
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

export interface Comment {
    id: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    text: string;
    createdAt: FirestoreTimestamp;
    updatedAt: FirestoreTimestamp;
}

export type CommentApiResponse = WithStringTimestamps<Comment>;

export interface CreateCommentRequest {
    text: string;
    targetType: CommentTargetType;
    targetId: string;
    groupId?: string; // Required for expense comments
}

export interface ListCommentsResponse {
    comments: CommentApiResponse[];
    hasMore: boolean;
    nextCursor?: string;
}

export interface CreateCommentResponse {
    success: boolean;
    data: CommentApiResponse;
}

export interface ListCommentsApiResponse {
    success: boolean;
    data: ListCommentsResponse;
}
