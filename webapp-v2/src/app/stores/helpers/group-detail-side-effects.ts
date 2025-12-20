import { permissionsStore } from '@/stores/permissions-store.ts';
import type { GroupDTO, GroupId, GroupMember, UserId } from '@billsplit-wl/shared';
import { themeStore } from '../theme-store';

/**
 * Centralises side effects that keep auxiliary stores in sync with the group detail data.
 */
export class GroupDetailSideEffectsManager {
    constructor(
        private readonly permissions = permissionsStore,
        private readonly theme = themeStore,
    ) {}

    syncMemberThemes(members: GroupMember[]): void {
        for (const member of members) {
            this.theme.setUserTheme(member.uid, member.themeColor);
        }
    }

    updatePermissionsSnapshot(group: GroupDTO, members: GroupMember[], emailVerified?: boolean): void {
        this.permissions.updateGroupData(group, members, emailVerified);
    }

    registerPermissions(groupId: GroupId, userId: UserId): void {
        this.permissions.registerComponent(groupId, userId);
    }

    deregisterPermissions(groupId: GroupId): void {
        this.permissions.deregisterComponent(groupId);
    }
}
