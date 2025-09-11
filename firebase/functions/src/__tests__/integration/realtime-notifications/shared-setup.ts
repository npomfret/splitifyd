// Shared setup for real-time notification integration tests
// Contains common utilities, beforeEach/afterEach hooks, and test data builders

import { beforeEach, afterEach } from 'vitest';
import { ApiDriver, borrowTestUsers, CreateGroupRequestBuilder, CreateExpenseRequestBuilder, NotificationDriver } from '@splitifyd/test-support';
import { PooledTestUser } from '@splitifyd/shared';
import { getFirestore } from '../../../firebase';

// Global test state
export let user1: PooledTestUser;
export let user2: PooledTestUser;
export let user3: PooledTestUser;
export let testGroup: any;
export const apiDriver = new ApiDriver();
export const notificationDriver = new NotificationDriver(getFirestore());

// Common beforeEach setup for all notification tests
export const setupNotificationTest = beforeEach(async () => {
    [user1, user2, user3] = await borrowTestUsers(3);
    testGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), user1.token);
});

// Common afterEach cleanup for all notification tests
export const cleanupNotificationTest = afterEach(() => {
    // Cleanup any remaining listeners
    notificationDriver.stopAllListeners();
});

/**
 * @deprecated use AprDirver.apiDriver.createBasicExpense instead
 */
export function createBasicExpense(groupId: string, amount: number = 10.0, userIndex: number = 0) {
    const users = [user1, user2, user3];
    return new CreateExpenseRequestBuilder().withGroupId(groupId).withAmount(amount).withPaidBy(users[userIndex].uid).withParticipants([users[userIndex].uid]).build();
}

/**
 * @deprecated use ApiDriver.createMultiUserExpense instead
 */
export function createMultiUserExpense(groupId: string, amount: number = 10.0, participantIndices: number[] = [0, 1]) {
    const users = [user1, user2, user3];
    return new CreateExpenseRequestBuilder()
        .withGroupId(groupId)
        .withAmount(amount)
        .withPaidBy(users[participantIndices[0]].uid)
        .withParticipants(participantIndices.map((i) => users[i].uid))
        .build();
}

/**
 * @deprecated use AprDriver.createGroupWithMembers instead
 */
export async function createMultiMemberGroup(memberIndices: number[] = [0, 1], creatorToken?: string) {
    const users = [user1, user2, user3];
    const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorToken || users[memberIndices[0]].token);

    // Add other members if more than just creator
    if (memberIndices.length > 1) {
        const shareResponse = await apiDriver.generateShareLink(group.id, users[memberIndices[0]].token);

        for (let i = 1; i < memberIndices.length; i++) {
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, users[memberIndices[i]].token);
        }
    }

    return group;
}
