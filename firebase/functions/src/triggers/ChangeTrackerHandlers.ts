import type { FirestoreTriggerDocumentSnapshot, FirestoreTriggerEvent } from '@splitifyd/firebase-simulator';
import { getAuth, getFirestore } from '../firebase';
import { logger } from '../logger';
import { ApplicationBuilder } from '../services/ApplicationBuilder';
import type { IFirestoreReader } from '../services/firestore/IFirestoreReader';
import type { NotificationService } from '../services/notification-service';
import { ChangeType } from '../utils/change-detection';

export class ChangeTrackerHandlers {
    constructor(private readonly firestoreReader: IFirestoreReader, private readonly notificationService: NotificationService) {}

    static createChangeTrackerHandlers(applicationBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth()),) {
        const firestoreReader = applicationBuilder.buildFirestoreReader();
        const notificationService = applicationBuilder.buildNotificationService();
        return new ChangeTrackerHandlers(firestoreReader, notificationService);
    }

    async handleGroupChange(event: FirestoreTriggerEvent<{ groupId: string; }>) {
        const groupId = event.params.groupId;
        const {changeType} = this.extractDataChange(event);

        if (changeType === 'deleted') {
            logger.info('group-deleted', {groupId});
            return;
        }

        const affectedUsers = await this.firestoreReader.getAllGroupMemberIds(groupId);

        if (affectedUsers.length > 0) {
            await this.notificationService.batchUpdateNotifications(affectedUsers, groupId, 'group');
        }

        logger.info('group-changed', {id: groupId, groupId, usersNotified: affectedUsers.length});
    };

    async handleExpenseChange(event: FirestoreTriggerEvent<{ expenseId: string; }>) {
        const expenseId = event.params.expenseId;
        const {after} = this.extractDataChange(event);

        const afterData = after?.data();

        const groupId = afterData?.groupId;
        if (!groupId) {
            throw Error(`groupId missing from expense ${expenseId}`);
        }

        const affectedUsers = await this.firestoreReader.getAllGroupMemberIds(groupId);
        await this.notificationService.batchUpdateNotificationsMultipleTypes(affectedUsers, groupId, [
            'transaction',
            'balance',
        ]);

        logger.info('expense-changed', {id: expenseId, groupId, usersNotified: affectedUsers.length});
    };

    handleSettlementChange = async (event: FirestoreTriggerEvent<{ settlementId: string; }>) => {
        const settlementId = event.params.settlementId;
        const {after} = this.extractDataChange(event);

        const afterData = after?.data();

        const groupId = afterData?.groupId;
        if (!groupId) {
            throw Error(`groupId missing from ${JSON.stringify(event)}`);
        }

        const affectedUsers = await this.firestoreReader.getAllGroupMemberIds(groupId);
        await this.notificationService.batchUpdateNotificationsMultipleTypes(affectedUsers, groupId, [
            'transaction',
            'balance',
        ]);

        logger.info('settlement-changed', {id: settlementId, groupId, usersNotified: affectedUsers.length});

        return {groupId, affectedUserCount: affectedUsers.length};
    };

    async handleGroupCommentChange(event: FirestoreTriggerEvent<{ groupId: string; commentId: string; }>) {
        const groupId = event.params.groupId;
        const commentId = event.params.commentId;

        const affectedUsers = await this.firestoreReader.getAllGroupMemberIds(groupId);

        if (affectedUsers.length > 0) {
            await this.notificationService.batchUpdateNotifications(affectedUsers, groupId, 'comment');
        }

        logger.info('group-comment-changed', {id: commentId, groupId, usersNotified: affectedUsers.length});
    };

    async handleExpenseCommentChange(event: FirestoreTriggerEvent<{ expenseId: string; commentId: string; }>) {
        const expenseId = event.params.expenseId;
        const commentId = event.params.commentId;

        const expense = await this.firestoreReader.getExpense(expenseId);
        const groupId = expense?.groupId;

        if (!groupId) {
            throw Error(`groupId missing from expense ${expenseId}`);
        }

        const affectedUsers = await this.firestoreReader.getAllGroupMemberIds(groupId);
        await this.notificationService.batchUpdateNotifications(affectedUsers, groupId, 'comment');

        logger.info('expense-comment-changed', {
            id: commentId,
            expenseId,
            groupId,
            usersNotified: affectedUsers.length,
        });
    };

    private extractDataChange(event: FirestoreTriggerEvent): {
        before?: FirestoreTriggerDocumentSnapshot;
        after?: FirestoreTriggerDocumentSnapshot;
        changeType: ChangeType;
    } {
        const {before, after} = event.data;
        const changeType: ChangeType =
            event.changeType === 'create'
                ? 'created'
                : event.changeType === 'delete'
                    ? 'deleted'
                    : 'updated';

        return {before, after, changeType};
    }
}
