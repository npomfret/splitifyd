import { GroupDetailSideEffectsManager } from '@/app/stores/helpers/group-detail-side-effects';
import type { GroupId } from '@billsplit-wl/shared';
import { toGroupId, toUserId } from '@billsplit-wl/shared';
import { describe, expect, it, vi } from 'vitest';

describe('GroupDetailSideEffectsManager', () => {
    const createManager = () => {
        const permissions = {
            updateGroupData: vi.fn(),
            registerComponent: vi.fn(),
            deregisterComponent: vi.fn(),
        };
        const theme = {
            setUserTheme: vi.fn(),
        };
        const manager = new GroupDetailSideEffectsManager(permissions as any, theme as any);

        return { manager, permissions, theme };
    };

    it('syncs member themes with the theme store', () => {
        const { manager, theme } = createManager();

        manager.syncMemberThemes([
            { uid: 'user-1', themeColor: '#000000' },
            { uid: 'user-2', themeColor: '#ffffff' },
        ] as any);

        expect(theme.setUserTheme).toHaveBeenCalledTimes(2);
        expect(theme.setUserTheme).toHaveBeenCalledWith('user-1', '#000000');
        expect(theme.setUserTheme).toHaveBeenCalledWith('user-2', '#ffffff');
    });

    it('updates permissions snapshots and registration lifecycle', () => {
        const { manager, permissions } = createManager();
        const groupId: GroupId = toGroupId('group-1');
        const group = { id: groupId } as any;
        const members = [{ uid: 'user-1' }] as any;

        manager.updatePermissionsSnapshot(group, members, true);
        manager.registerPermissions(groupId, toUserId('user-1'));
        manager.deregisterPermissions(groupId);

        expect(permissions.updateGroupData).toHaveBeenCalledWith(group, members, true);
        expect(permissions.registerComponent).toHaveBeenCalledWith(groupId, 'user-1');
        expect(permissions.deregisterComponent).toHaveBeenCalledWith(groupId);
    });
});
