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

    withMembers(members: Record<string, any>): MockGroupBuilder {
        // Ensure all members have required fields
        const validMembers: Record<string, any> = {};
        for (const [userId, member] of Object.entries(members)) {
            validMembers[userId] = {
                memberRole: member.memberRole || 'member', // Default to 'member' if not specified
                status: member.status || 'active', // Default to 'active' if not specified
                ...member // Allow override of defaults
            };
        }
        this.group.data.members = validMembers;
        return this;
    }

    build(): any {
        return { ...this.group };
    }
}