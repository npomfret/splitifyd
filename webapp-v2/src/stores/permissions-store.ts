import { signal, computed } from '@preact/signals';
import { Group, MemberRole, GroupPermissions, GroupMemberDTO } from '@splitifyd/shared';

/**
 * Permission cache with TTL
 */
class PermissionCache {
    private cache = new Map<string, { value: boolean; expires: number }>();
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
    static checkPermission(group: Group, members: GroupMemberDTO[], userId: string, action: keyof GroupPermissions | 'viewGroup', options: { expense?: any } = {}): boolean {
        const member = members.find((m) => m.uid === userId);
        if (!member) {
            return false;
        }

        // Inactive members can't do anything except view
        if (member.memberStatus !== 'active' && action !== 'viewGroup') {
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

    private static evaluatePermission(permission: string, userRole: MemberRole, userId: string, options: { expense?: any }): boolean {
        switch (permission) {
            case 'anyone':
                return userRole !== 'viewer';

            case 'owner-and-admin':
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

    static getUserPermissions(group: Group, members: GroupMemberDTO[], userId: string): Record<string, boolean> {
        return {
            canEditAnyExpense: this.checkPermission(group, members, userId, 'expenseEditing'),
            canDeleteAnyExpense: this.checkPermission(group, members, userId, 'expenseDeletion'),
            canInviteMembers: this.checkPermission(group, members, userId, 'memberInvitation'),
            canManageSettings: this.checkPermission(group, members, userId, 'settingsManagement'),
            canApproveMembers: this.checkPermission(group, members, userId, 'memberApproval'),
            canViewGroup: this.checkPermission(group, members, userId, 'viewGroup'),
        };
    }
}

/**
 * Reactive permissions store for frontend
 */
export class PermissionsStore {
    private currentUserId: string | null = null;
    private currentGroup: Group | null = null;
    private currentMembers: GroupMemberDTO[] = [];
    private cache = new PermissionCache();

    // Reference counting infrastructure
    readonly #subscriberCounts = new Map<string, number>();

    // Reactive signals
    private groupSignal = signal<Group | null>(null);
    private membersSignal = signal<GroupMemberDTO[]>([]);
    private userIdSignal = signal<string | null>(null);
    private permissionsSignal = signal<Record<string, boolean>>({});

    // Computed permissions
    permissions = computed(() => this.permissionsSignal.value);

    // NEW REFERENCE-COUNTED API

    /**
     * Register a component that needs permissions for this group.
     * Uses reference counting to manage state efficiently.
     */
    registerComponent(groupId: string, userId: string): void {
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
    deregisterComponent(groupId: string): void {
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
    setCurrentUser(userId: string | null): void {
        this.currentUserId = userId;
        this.userIdSignal.value = userId;
        this.updatePermissions();
    }

    // Update group data (called by group detail store)
    updateGroupData(group: Group, members?: GroupMemberDTO[]): void {
        this.groupSignal.value = group;
        this.currentGroup = group;

        if (members) {
            this.membersSignal.value = members;
            this.currentMembers = members;
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

        const permissions = ClientPermissionEngine.getUserPermissions(this.currentGroup, this.currentMembers, this.currentUserId);

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
        this.groupSignal.value = null;
        this.membersSignal.value = [];
        this.userIdSignal.value = null;
        this.permissionsSignal.value = {};
        this.cache.invalidate();
        // Note: Don't clear subscriber counts here as other components might still be registered
    }
}

// Singleton instance
export const permissionsStore = new PermissionsStore();
