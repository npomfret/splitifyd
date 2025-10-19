import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { FirestoreCollections } from '../constants';
import { measureTrigger } from '../monitoring/measure';
import { ChangeTrackerHandlers } from './ChangeTrackerHandlers';

const changeTrackerHandlers = ChangeTrackerHandlers.createChangeTrackerHandlers(getAppBuilder());

export const trackGroupChanges = onDocumentWritten(
    {
        document: `${FirestoreCollections.GROUPS}/{groupId}`,
        region: 'us-central1',
    },
    async (event) => {
        return measureTrigger('trackGroupChanges', async () => {
            await changeTrackerHandlers.handleGroupChange(event);
        });
    },
);

export const trackExpenseChanges = onDocumentWritten(
    {
        document: `${FirestoreCollections.EXPENSES}/{expenseId}`,
        region: 'us-central1',
    },
    async (event) => {
        return measureTrigger('trackExpenseChanges', async () => {
            await changeTrackerHandlers.handleExpenseChange(event);
        });
    },
);

export const trackSettlementChanges = onDocumentWritten(
    {
        document: `${FirestoreCollections.SETTLEMENTS}/{settlementId}`,
        region: 'us-central1',
    },
    async (event) => {
        return measureTrigger('trackSettlementChanges', async () => {
            await changeTrackerHandlers.handleSettlementChange(event);
        });
    },
);

export const trackGroupCommentChanges = onDocumentWritten(
    {
        document: `${FirestoreCollections.GROUPS}/{groupId}/comments/{commentId}`,
        region: 'us-central1',
    },
    async (event) => {
        return measureTrigger('trackGroupCommentChanges', async () => {
            await changeTrackerHandlers.handleGroupCommentChange(event);
        });
    },
);

export const trackExpenseCommentChanges = onDocumentWritten(
    {
        document: `${FirestoreCollections.EXPENSES}/{expenseId}/comments/{commentId}`,
        region: 'us-central1',
    },
    async (event) => {
        return measureTrigger('trackExpenseCommentChanges', async () => {
            await changeTrackerHandlers.handleExpenseCommentChange(event);
        });
    },
);
