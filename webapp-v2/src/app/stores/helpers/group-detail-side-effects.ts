import type { GroupDTO, GroupId, GroupMember, UserId } from '@splitifyd/shared';
import { permissionsStore } from '@/stores/permissions-store.ts';
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

    updatePermissionsSnapshot(group: GroupDTO, members: GroupMember[]): void {
        this.permissions.updateGroupData(group, members);
    }

    registerPermissions(groupId: GroupId, userId: UserId): void {
        this.permissions.registerComponent(groupId, userId);
    }

    deregisterPermissions(groupId: GroupId): void {
        this.permissions.deregisterComponent(groupId);
    }
}
