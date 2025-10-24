import type { FirestoreTriggerDocumentSnapshot, FirestoreTriggerEvent } from '@splitifyd/firebase-simulator';
import { GroupId } from '@splitifyd/shared';
import { getIdentityToolkitConfig } from '../client-config';
import { getAuth, getFirestore } from '../firebase';
import { logger } from '../logger';
import { ApplicationBuilder } from '../services/ApplicationBuilder';
import type { IFirestoreReader } from '../services/firestore';
import type { NotificationService } from '../services/notification-service';
import { ChangeType } from '../utils/change-detection';
import type {CommentId} from "@splitifyd/shared";

export class ChangeTrackerHandlers {
    constructor(private readonly firestoreReader: IFirestoreReader, private readonly notificationService: NotificationService) {}

    static createChangeTrackerHandlers(applicationBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth(), getIdentityToolkitConfig())) {
        const firestoreReader = applicationBuilder.buildFirestoreReader();
        const notificationService = applicationBuilder.buildNotificationService();
        return new ChangeTrackerHandlers(firestoreReader, notificationService);
    }

    async handleGroupChange(event: FirestoreTriggerEvent<{ groupId: GroupId; }>) {
        const groupId = event.params.groupId;
        const { changeType } = this.extractDataChange(event);

        if (changeType === 'deleted') {
            logger.info('group-deleted', { groupId });
            return;
        }

        const affectedUsers = await this.firestoreReader.getAllGroupMemberIds(groupId);

        if (affectedUsers.length > 0) {
            await this.notificationService.batchUpdateNotifications(affectedUsers, groupId, 'group');
        }

        logger.info('group-changed', { id: groupId, groupId, usersNotified: affectedUsers.length });
    }

    async handleExpenseChange(event: FirestoreTriggerEvent<{ expenseId: string; }>) {
        const expenseId = event.params.expenseId;
        const { after, changeType } = this.extractDataChange(event);

        // For delete events, we need to use the 'before' snapshot to get groupId
        if (changeType === 'deleted') {
            const { before } = this.extractDataChange(event);
            const beforeData = before?.data();
            const groupId = beforeData?.groupId;

            if (!groupId) {
                logger.warn('groupId missing from deleted expense, skipping notification', {
                    expenseId,
                    changeType,
                    hasBeforeData: !!beforeData,
                });
                return;
            }

            const affectedUsers = await this.firestoreReader.getAllGroupMemberIds(groupId);
            await this.notificationService.batchUpdateNotificationsMultipleTypes(affectedUsers, groupId, [
                'transaction',
                'balance',
            ]);

            logger.info('expense-deleted', { id: expenseId, groupId, usersNotified: affectedUsers.length });
            return;
        }

        const afterData = after?.data();
        const groupId = afterData?.groupId;

        if (!groupId) {
            throw Error(`groupId missing from expense ${expenseId} (changeType: ${changeType}, hasAfterData: ${!!afterData}, fields: ${afterData ? Object.keys(afterData).join(', ') : 'none'})`);
        }

        const affectedUsers = await this.firestoreReader.getAllGroupMemberIds(groupId);
        await this.notificationService.batchUpdateNotificationsMultipleTypes(affectedUsers, groupId, [
            'transaction',
            'balance',
        ]);

        logger.info('expense-changed', { id: expenseId, groupId, usersNotified: affectedUsers.length });
    }

    handleSettlementChange = async (event: FirestoreTriggerEvent<{ settlementId: string; }>) => {
        const settlementId = event.params.settlementId;
        const { after, changeType } = this.extractDataChange(event);

        // For delete events, we need to use the 'before' snapshot to get groupId
        if (changeType === 'deleted') {
            const { before } = this.extractDataChange(event);
            const beforeData = before?.data();
            const groupId = beforeData?.groupId;

            if (!groupId) {
                logger.warn('groupId missing from deleted settlement, skipping notification', {
                    settlementId,
                    changeType,
                    hasBeforeData: !!beforeData,
                });
                return { groupId: '', affectedUserCount: 0 };
            }

            const affectedUsers = await this.firestoreReader.getAllGroupMemberIds(groupId);
            await this.notificationService.batchUpdateNotificationsMultipleTypes(affectedUsers, groupId, [
                'transaction',
                'balance',
            ]);

            logger.info('settlement-deleted', { id: settlementId, groupId, usersNotified: affectedUsers.length });
            return { groupId, affectedUserCount: affectedUsers.length };
        }

        const afterData = after?.data();
        const groupId = afterData?.groupId;

        if (!groupId) {
            throw Error(`groupId missing from settlement ${settlementId} (changeType: ${changeType}, hasAfterData: ${!!afterData}, fields: ${afterData ? Object.keys(afterData).join(', ') : 'none'})`);
        }

        const affectedUsers = await this.firestoreReader.getAllGroupMemberIds(groupId);
        await this.notificationService.batchUpdateNotificationsMultipleTypes(affectedUsers, groupId, [
            'transaction',
            'balance',
        ]);

        logger.info('settlement-changed', { id: settlementId, groupId, usersNotified: affectedUsers.length });

        return { groupId, affectedUserCount: affectedUsers.length };
    };

    async handleGroupCommentChange(event: FirestoreTriggerEvent<{ groupId: GroupId; commentId: CommentId; }>) {
        const groupId = event.params.groupId;
        const commentId = event.params.commentId;

        const affectedUsers = await this.firestoreReader.getAllGroupMemberIds(groupId);

        if (affectedUsers.length > 0) {
            await this.notificationService.batchUpdateNotifications(affectedUsers, groupId, 'comment');
        }

        logger.info('group-comment-changed', { id: commentId, groupId, usersNotified: affectedUsers.length });
    }

    async handleExpenseCommentChange(event: FirestoreTriggerEvent<{ expenseId: string; commentId: CommentId; }>) {
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
    }

    private extractDataChange(event: FirestoreTriggerEvent): {
        before?: FirestoreTriggerDocumentSnapshot;
        after?: FirestoreTriggerDocumentSnapshot;
        changeType: ChangeType;
    } {
        const { before, after } = event.data;
        const changeType: ChangeType = event.changeType === 'create'
            ? 'created'
            : event.changeType === 'delete'
            ? 'deleted'
            : 'updated';

        return { before, after, changeType };
    }
}
