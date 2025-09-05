import { Timestamp } from 'firebase-admin/firestore';
import { PermissionLevels } from '@splitifyd/shared';

/**
 * Builder for creating mock group objects for testing
 * Used primarily for balance calculation tests that need realistic group data
 */
export class MockGroupBuilder {
    private group: any = {
        id: 'group-1',
        data: {
            name: 'Test Group',
            createdBy: 'user-1', // Required field
            description: 'Test group for balance calculations',
            members: {
                'user-1': { 
                    role: 'admin',  // Valid role
                    status: 'active'  // Required status field
                },
                'user-2': { 
                    role: 'member',  // Valid role  
                    status: 'active'  // Required status field
                },
            },
            permissions: {
                expenseEditing: PermissionLevels.ANYONE,
                expenseDeletion: PermissionLevels.ANYONE,
                memberInvitation: PermissionLevels.ANYONE,
                memberApproval: 'automatic' as const,
                settingsManagement: PermissionLevels.ANYONE,
            }, // Use default OPEN permissions
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        },
    };

    build(): any {
        return { ...this.group };
    }
}