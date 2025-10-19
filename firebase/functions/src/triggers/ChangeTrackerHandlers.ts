import {DocumentSnapshot} from 'firebase-admin/firestore';
import {ParamsOf} from 'firebase-functions';
import {Change, FirestoreEvent, onDocumentWritten} from 'firebase-functions/v2/firestore';
import {getAuth, getFirestore} from '../firebase';
import {logger} from '../logger';
import {ApplicationBuilder} from '../services/ApplicationBuilder';
import type {IFirestoreReader} from '../services/firestore/IFirestoreReader';
import type {NotificationService} from '../services/notification-service';
import {ChangeType} from '../utils/change-detection';
import {FirestoreCollections} from '../constants';
import {measureTrigger} from '../monitoring/measure';

export class ChangeTrackerHandlers {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly notificationService: NotificationService,
    ) {
    }

    static createChangeTrackerHandlers(
        applicationBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth()),
    ) {
        const firestoreReader = applicationBuilder.buildFirestoreReader();
        const notificationService = applicationBuilder.buildNotificationService();
        return new ChangeTrackerHandlers(firestoreReader, notificationService);
    }

    async handleGroupChange(event: FirestoreEvent<Change<DocumentSnapshot> | undefined, ParamsOf<string>>) {
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

    getTrackGroupChanges = () =>
        onDocumentWritten(
            {
                document: `${FirestoreCollections.GROUPS}/{groupId}`,
                region: 'us-central1',
            },
            async (event) => {
                return measureTrigger('trackGroupChanges', async () => {
                    await this.handleGroupChange(event);
                });
            },
        );

    async handleExpenseChange(event: FirestoreEvent<Change<DocumentSnapshot> | undefined, ParamsOf<string>>) {
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

    getTrackExpenseChanges = () =>
        onDocumentWritten(
            {
                document: `${FirestoreCollections.EXPENSES}/{expenseId}`,
                region: 'us-central1',
            },
            async (event) => {
                return measureTrigger('trackExpenseChanges', async () => {
                    await this.handleExpenseChange(event);
                });
            },
        );

    handleSettlementChange = async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, ParamsOf<string>>) => {
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

    getTrackSettlementChanges = () =>
        onDocumentWritten(
            {
                document: `${FirestoreCollections.SETTLEMENTS}/{settlementId}`,
                region: 'us-central1',
            },
            async (event) => {
                return measureTrigger('trackSettlementChanges', async () => {
                    await this.handleSettlementChange(event);
                });
            },
        );

    async handleGroupCommentChange(event: FirestoreEvent<Change<DocumentSnapshot> | undefined, ParamsOf<string>>) {
        const groupId = event.params.groupId;
        const commentId = event.params.commentId;

        const affectedUsers = await this.firestoreReader.getAllGroupMemberIds(groupId);

        if (affectedUsers.length > 0) {
            await this.notificationService.batchUpdateNotifications(affectedUsers, groupId, 'comment');
        }

        logger.info('group-comment-changed', {id: commentId, groupId, usersNotified: affectedUsers.length});
    };

    getTrackGroupCommentChanges = () =>
        onDocumentWritten(
            {
                document: `${FirestoreCollections.GROUPS}/{groupId}/comments/{commentId}`,
                region: 'us-central1',
            },
            async (event) => {
                return measureTrigger('trackGroupCommentChanges', async () => {
                    await this.handleGroupCommentChange(event);
                });
            },
        );

    async handleExpenseCommentChange(event: FirestoreEvent<Change<DocumentSnapshot> | undefined, ParamsOf<string>>) {
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

    getTrackExpenseCommentChanges = () =>
        onDocumentWritten(
            {
                document: `${FirestoreCollections.EXPENSES}/{expenseId}/comments/{commentId}`,
                region: 'us-central1',
            },
            async (event) => {
                return measureTrigger('trackExpenseCommentChanges', async () => {
                    await this.handleExpenseCommentChange(event);
                });
            },
        );

    private extractDataChange(event: FirestoreEvent<Change<DocumentSnapshot> | undefined, ParamsOf<string>>) {
        const before = event.data?.before;
        const after = event.data?.after;

        let changeType: ChangeType;
        if (!before?.exists && after?.exists) {
            changeType = 'created';
        } else if (before?.exists && !after?.exists) {
            changeType = 'deleted';
        } else {
            changeType = 'updated';
        }

        return {before, after, changeType};
    }
}
