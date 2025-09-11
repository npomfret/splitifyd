import { PermissionEngine } from '../../permissions/permission-engine';
import { SecurityPresets, PermissionLevels } from '@splitifyd/shared';

describe('PermissionEngine', () => {
    describe('getDefaultPermissions', () => {
        it('should return open collaboration permissions', () => {
            const permissions = PermissionEngine.getDefaultPermissions(SecurityPresets.OPEN);

            expect(permissions).toEqual({
                expenseEditing: PermissionLevels.ANYONE,
                expenseDeletion: PermissionLevels.ANYONE,
                memberInvitation: PermissionLevels.ANYONE,
                memberApproval: 'automatic',
                settingsManagement: PermissionLevels.ANYONE,
            });
        });

        it('should return managed group permissions', () => {
            const permissions = PermissionEngine.getDefaultPermissions(SecurityPresets.MANAGED);

            expect(permissions).toEqual({
                expenseEditing: PermissionLevels.OWNER_AND_ADMIN,
                expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
                memberInvitation: PermissionLevels.ADMIN_ONLY,
                memberApproval: 'admin-required',
                settingsManagement: PermissionLevels.ADMIN_ONLY,
            });
        });
    });
});
