import { signal, computed } from '@preact/signals';
import { onSnapshot, doc } from 'firebase/firestore';
import { Group, MemberRole, GroupPermissions } from '@splitifyd/shared';
import { getDb } from '../app/firebase';

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

    generateKey(groupId: string, userId: string, action: string, resourceId?: string): string {
        const parts = ['group', groupId, 'user', userId, 'action', action];
        if (resourceId) {
            parts.push('resource', resourceId);
        }
        return parts.join(':');
    }
}

/**
 * Client-side permission engine
 * Mirrors the backend permission logic for immediate UI feedback
 */
class ClientPermissionEngine {
    static checkPermission(group: Group, userId: string, action: keyof GroupPermissions | 'viewGroup', options: { expense?: any } = {}): boolean {
        const member = group.members[userId];
        if (!member) {
            return false;
        }

        // Inactive members can't do anything except view
        if (member.status !== 'active' && action !== 'viewGroup') {
            return false;
        }

        // Handle view permission
        if (action === 'viewGroup') {
            return member.status === 'active';
        }

        // Viewer role can only read
        if (member.role === 'viewer' && ['expenseEditing', 'expenseDeletion', 'memberInvitation', 'settingsManagement'].includes(action as string)) {
            return false;
        }

        const permission = group.permissions[action];
        return this.evaluatePermission(permission, member.role, userId, options);
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

    static getUserPermissions(group: Group, userId: string): Record<string, boolean> {
        return {
            canEditAnyExpense: this.checkPermission(group, userId, 'expenseEditing'),
            canDeleteAnyExpense: this.checkPermission(group, userId, 'expenseDeletion'),
            canInviteMembers: this.checkPermission(group, userId, 'memberInvitation'),
            canManageSettings: this.checkPermission(group, userId, 'settingsManagement'),
            canApproveMembers: this.checkPermission(group, userId, 'memberApproval'),
            canViewGroup: this.checkPermission(group, userId, 'viewGroup'),
        };
    }
}

/**
 * Reactive permissions store for frontend
 */
export class PermissionsStore {
    private currentUserId: string | null = null;
    private currentGroup: Group | null = null;
    private cache = new PermissionCache();
    private unsubscribe: (() => void) | null = null;

    // Reactive signals
    private groupSignal = signal<Group | null>(null);
    private userIdSignal = signal<string | null>(null);
    private permissionsSignal = signal<Record<string, boolean>>({});

    // Computed permissions
    permissions = computed(() => this.permissionsSignal.value);
    userRole = computed(() => {
        const group = this.groupSignal.value;
        const userId = this.userIdSignal.value;
        if (!group || !userId) return null;
        return group.members[userId]?.role || null;
    });

    // Initialize with user ID
    setCurrentUser(userId: string | null): void {
        this.currentUserId = userId;
        this.userIdSignal.value = userId;
        this.updatePermissions();
    }

    // Subscribe to group permission changes
    subscribeToGroup(groupId: string): void {
        // Cleanup previous subscription
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        this.unsubscribe = onSnapshot(
            doc(getDb(), 'groups', groupId),
            (snapshot) => {
                if (snapshot.exists()) {
                    const group = snapshot.data() as Group;
                    this.groupSignal.value = group;
                    this.currentGroup = group;

                    // Invalidate cache for this group
                    this.cache.invalidate(groupId);

                    // Update computed permissions
                    this.updatePermissions();

                    // Notify UI if user's permissions changed
                    this.notifyPermissionChanges();
                }
            },
            (error) => {
                console.error('Error subscribing to group permissions:', error);
            },
        );
    }

    // Check specific permission with caching
    checkPermission(action: keyof GroupPermissions | 'viewGroup', options: { expense?: any } = {}): boolean {
        if (!this.currentGroup || !this.currentUserId) {
            return false;
        }

        const cacheKey = this.cache.generateKey(this.currentGroup.id, this.currentUserId, action as string, options.expense?.id);

        return this.cache.check(cacheKey, () => {
            return ClientPermissionEngine.checkPermission(this.currentGroup!, this.currentUserId!, action, options);
        });
    }

    // Update all computed permissions
    private updatePermissions(): void {
        if (!this.currentGroup || !this.currentUserId) {
            this.permissionsSignal.value = {};
            return;
        }

        const permissions = ClientPermissionEngine.getUserPermissions(this.currentGroup, this.currentUserId);

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

    // Cleanup subscriptions
    dispose(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    // Get current group data
    getCurrentGroup(): Group | null {
        return this.currentGroup;
    }

    // Force refresh permissions (useful after API calls)
    refreshPermissions(): void {
        this.cache.invalidate();
        this.updatePermissions();
    }
}

// Singleton instance
export const permissionsStore = new PermissionsStore();
