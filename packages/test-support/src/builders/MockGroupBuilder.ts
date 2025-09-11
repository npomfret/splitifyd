import { Timestamp } from 'firebase-admin/firestore';
import { PermissionLevels } from '@splitifyd/shared';
import { randomString, randomChoice, generateShortId } from '../test-helpers';

/**
 * Builder for creating mock group objects for testing
 * Used primarily for balance calculation tests that need realistic group data
 */
export class MockGroupBuilder {
    private group: any;

    constructor() {
        const groupId = `group-${generateShortId()}`;
        const userId1 = `user1-${generateShortId()}`;
        const userId2 = `user2-${generateShortId()}`;

        this.group = {
            id: groupId,
            data: {
                name: `${randomChoice(['Team', 'Group', 'Squad', 'Club', 'Circle'])} ${randomString(6)}`,
                createdBy: userId1,
                description: `${randomChoice(['Fun', 'Cool', 'Awesome', 'Great', 'Nice'])} group for ${randomString(8)}`,
                members: {
                    [userId1]: {
                        role: randomChoice(['admin', 'member']),
                        status: randomChoice(['active', 'pending']),
                    },
                    [userId2]: {
                        role: randomChoice(['admin', 'member']),
                        status: randomChoice(['active', 'pending']),
                    },
                },
                permissions: {
                    expenseEditing: randomChoice([PermissionLevels.ANYONE, PermissionLevels.ADMIN_ONLY]),
                    expenseDeletion: randomChoice([PermissionLevels.ANYONE, PermissionLevels.ADMIN_ONLY]),
                    memberInvitation: randomChoice([PermissionLevels.ANYONE, PermissionLevels.ADMIN_ONLY]),
                    memberApproval: randomChoice(['automatic', 'manual']),
                    settingsManagement: randomChoice([PermissionLevels.ANYONE, PermissionLevels.ADMIN_ONLY]),
                },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            },
        };
    }

    build(): any {
        return { ...this.group };
    }
}
