import { GroupDTO, GroupMember, GroupPermissions, MemberRole, UserId } from '@billsplit-wl/shared';
import { GroupId } from '@billsplit-wl/shared';
import { computed, signal } from '@preact/signals';

/**
 * Permission cache with TTL
 */
class PermissionCache {
    private cache = new Map<string, { value: boolean; expires: number; }>();
    private ttl = 60000; // 1 minute TTL

    check(key: string, compute: () => boolean): boolean {
        const cached = this.cache.get(key);
        const now = Date.now();

        if (cached && cached.expires > now) {
            return cached.value;
        }

        const value = compute();
        this.cache.set(key, { value, expires: now + this.ttl });
        return value;
    }

    invalidate(pattern?: string): void {
        if (!pattern) {
            this.cache.clear();
            return;
        }

        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }
}

/**
 * Client-side permission engine
 * Mirrors the backend permission logic for immediate UI feedback
 */
class ClientPermissionEngine {
    static checkPermission(group: GroupDTO, members: GroupMember[], userId: UserId, action: keyof GroupPermissions | 'viewGroup', options: { expense?: any; emailVerified?: boolean; } = {}): boolean {
        const member = members.find((m) => m.uid === userId);
        if (!member) {
            return false;
        }

        // Inactive members can't do anything except view
        if (member.memberStatus !== 'active' && action !== 'viewGroup') {
            return false;
        }

        // Block all write actions if group is locked
        if (group.locked === true && action !== 'viewGroup') {
            return false;
        }

        // Block all write actions if email is not verified (fail-safe: undefined = not verified)
        if (options.emailVerified !== true && action !== 'viewGroup') {
            return false;
        }

        // Handle view permission
        if (action === 'viewGroup') {
            return member.memberStatus === 'active';
        }

        // Viewer role can only read
        if (member.memberRole === 'viewer' && ['expenseEditing', 'expenseDeletion', 'memberInvitation', 'settingsManagement'].includes(action as string)) {
            return false;
        }

        const permission = group.permissions[action];
        return this.evaluatePermission(permission, member.memberRole, userId, options);
    }

    private static evaluatePermission(permission: string, userRole: MemberRole, userId: UserId, options: { expense?: any; }): boolean {
        switch (permission) {
            case 'anyone':
                return userRole !== 'viewer';

            case 'creator-and-admin':
                if (userRole === 'admin') return true;
                if (options.expense && options.expense.createdBy === userId) return true;
                return false;

            case 'admin-only':
                return userRole === 'admin';

            case 'automatic':
                return true;

            case 'admin-required':
                return userRole === 'admin';

            default:
                return false;
        }
    }

    static getUserPermissions(group: GroupDTO, members: GroupMember[], userId: UserId, emailVerified?: boolean): Record<string, boolean> {
        const options = { emailVerified };
        return {
            canEditAnyExpense: this.checkPermission(group, members, userId, 'expenseEditing', options),
            canDeleteAnyExpense: this.checkPermission(group, members, userId, 'expenseDeletion', options),
            canInviteMembers: this.checkPermission(group, members, userId, 'memberInvitation', options),
            canManageSettings: this.checkPermission(group, members, userId, 'settingsManagement', options),
            canApproveMembers: this.checkPermission(group, members, userId, 'memberApproval', options),
            canViewGroup: this.checkPermission(group, members, userId, 'viewGroup', options),
        };
    }
}

/**
 * Reactive permissions store for frontend
 */
class PermissionsStore {
    private currentUserId: UserId | null = null;
    private currentGroup: GroupDTO | null = null;
    private currentMembers: GroupMember[] = [];
    private currentEmailVerified: boolean | undefined;
    private cache = new PermissionCache();

    // Reference counting infrastructure
    readonly #subscriberCounts = new Map<string, number>();

    // Reactive signals
    private groupSignal = signal<GroupDTO | null>(null);
    private membersSignal = signal<GroupMember[]>([]);
    private userIdSignal = signal<string | null>(null);
    private permissionsSignal = signal<Record<string, boolean>>({});
    private emailVerifiedSignal = signal<boolean | undefined>(undefined);

    // Computed permissions
    permissions = computed(() => this.permissionsSignal.value);

    // Computed: true when user's email is not verified (used for tooltip display)
    emailVerificationRequired = computed(() => this.emailVerifiedSignal.value !== true);

    // NEW REFERENCE-COUNTED API

    /**
     * Register a component that needs permissions for this group.
     * Uses reference counting to manage state efficiently.
     */
    registerComponent(groupId: GroupId, userId: UserId): void {
        const currentCount = this.#subscriberCounts.get(groupId) || 0;
        this.#subscriberCounts.set(groupId, currentCount + 1);

        if (currentCount === 0) {
            // First component for this group
            this.setCurrentUser(userId);
        }
    }

    /**
     * Deregister a component that no longer needs permissions for this group.
     */
    deregisterComponent(groupId: GroupId): void {
        const currentCount = this.#subscriberCounts.get(groupId) || 0;

        if (currentCount <= 1) {
            // Last component for this group - clean up
            this.#subscriberCounts.delete(groupId);
            // Only clear if this was the group we were tracking
            if (this.currentGroup?.id === groupId) {
                this.dispose();
            }
        } else {
            this.#subscriberCounts.set(groupId, currentCount - 1);
        }
    }

    // LEGACY API (for backward compatibility)

    /**
     * Initialize with user ID
     * @deprecated Use registerComponent instead for proper reference counting
     */
    setCurrentUser(userId: UserId | null): void {
        this.currentUserId = userId;
        this.userIdSignal.value = userId;
        this.updatePermissions();
    }

    // Update group data (called by group detail store)
    updateGroupData(group: GroupDTO, members?: GroupMember[], emailVerified?: boolean): void {
        this.groupSignal.value = group;
        this.currentGroup = group;

        if (members) {
            this.membersSignal.value = members;
            this.currentMembers = members;
        }

        if (emailVerified !== undefined) {
            this.currentEmailVerified = emailVerified;
            this.emailVerifiedSignal.value = emailVerified;
        }

        // Invalidate cache for this group
        this.cache.invalidate(group.id);

        // Update computed permissions
        this.updatePermissions();

        // Notify UI if user's permissions changed
        this.notifyPermissionChanges();
    }

    // Update all computed permissions
    private updatePermissions(): void {
        if (!this.currentGroup || !this.currentUserId || !this.currentMembers.length) {
            this.permissionsSignal.value = {};
            return;
        }

        const permissions = ClientPermissionEngine.getUserPermissions(
            this.currentGroup,
            this.currentMembers,
            this.currentUserId,
            this.currentEmailVerified
        );

        this.permissionsSignal.value = permissions;
    }

    // Notify UI of permission changes
    private notifyPermissionChanges(): void {
        // Show toast notification for permission changes
        // This could be expanded to show specific messages
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            const event = new CustomEvent('permissions-updated', {
                detail: { permissions: this.permissionsSignal.value },
            });
            window.dispatchEvent(event);
        }
    }

    // Cleanup
    dispose(): void {
        this.currentGroup = null;
        this.currentMembers = [];
        this.currentUserId = null;
        this.currentEmailVerified = undefined;
        this.groupSignal.value = null;
        this.membersSignal.value = [];
        this.userIdSignal.value = null;
        this.permissionsSignal.value = {};
        this.emailVerifiedSignal.value = undefined;
        this.cache.invalidate();
        // Note: Don't clear subscriber counts here as other components might still be registered
    }
}

// Singleton instance
export const permissionsStore = new PermissionsStore();
