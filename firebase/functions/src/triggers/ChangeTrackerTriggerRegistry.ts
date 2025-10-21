import {
    TriggerDefinition,
    TriggerOperation,
    FirestoreTriggerHandler,
    FirestoreProdTrigger,
    toProdTrigger,
} from '@splitifyd/firebase-simulator';
import { FirestoreCollections } from '../constants';
import { measureTrigger } from '../monitoring/measure';
import { ChangeTrackerHandlers } from './ChangeTrackerHandlers';
import { GroupId } from "@splitifyd/shared";

export type TriggerName =
    | 'trackGroupChanges'
    | 'trackExpenseChanges'
    | 'trackSettlementChanges'
    | 'trackGroupCommentChanges'
    | 'trackExpenseCommentChanges';

type HandlerNameByTrigger = {
    trackGroupChanges: 'handleGroupChange';
    trackExpenseChanges: 'handleExpenseChange';
    trackSettlementChanges: 'handleSettlementChange';
    trackGroupCommentChanges: 'handleGroupCommentChange';
    trackExpenseCommentChanges: 'handleExpenseCommentChange';
};

export type HandlerName = HandlerNameByTrigger[TriggerName];

type TriggerParamsByName = {
    trackGroupChanges: { groupId: GroupId; };
    trackExpenseChanges: { expenseId: string; };
    trackSettlementChanges: { settlementId: string; };
    trackGroupCommentChanges: { groupId: GroupId; commentId: string; };
    trackExpenseCommentChanges: { expenseId: string; commentId: string; };
};

export interface ChangeTrackerTriggerDefinition<
    TName extends TriggerName = TriggerName,
> extends TriggerDefinition<TName, TriggerParamsByName[TName]> {
    name: TName;
    document: string;
    handlerName: HandlerNameByTrigger[TName];
    operations: TriggerOperation[];
    metricName: string;
}

const changeTrackerTriggerDefinitions: ReadonlyArray<ChangeTrackerTriggerDefinition> = [
    toProdTrigger<'trackGroupChanges', TriggerParamsByName['trackGroupChanges'], { handlerName: HandlerNameByTrigger['trackGroupChanges']; metricName: string; }>({
        name: 'trackGroupChanges',
        document: `${FirestoreCollections.GROUPS}/{groupId}`,
        handlerName: 'handleGroupChange',
        operations: ['create', 'update', 'delete'],
        metricName: 'trackGroupChanges',
        mapParams: ({groupId}) => ({groupId}),
    }),
    toProdTrigger<'trackExpenseChanges', TriggerParamsByName['trackExpenseChanges'], { handlerName: HandlerNameByTrigger['trackExpenseChanges']; metricName: string; }>({
        name: 'trackExpenseChanges',
        document: `${FirestoreCollections.EXPENSES}/{expenseId}`,
        handlerName: 'handleExpenseChange',
        operations: ['create', 'update'],
        metricName: 'trackExpenseChanges',
        mapParams: ({expenseId}) => ({expenseId}),
    }),
    toProdTrigger<'trackSettlementChanges', TriggerParamsByName['trackSettlementChanges'], { handlerName: HandlerNameByTrigger['trackSettlementChanges']; metricName: string; }>({
        name: 'trackSettlementChanges',
        document: `${FirestoreCollections.SETTLEMENTS}/{settlementId}`,
        handlerName: 'handleSettlementChange',
        operations: ['create', 'update'],
        metricName: 'trackSettlementChanges',
        mapParams: ({settlementId}) => ({settlementId}),
    }),
    toProdTrigger<'trackGroupCommentChanges', TriggerParamsByName['trackGroupCommentChanges'], { handlerName: HandlerNameByTrigger['trackGroupCommentChanges']; metricName: string; }>({
        name: 'trackGroupCommentChanges',
        document: `${FirestoreCollections.GROUPS}/{groupId}/comments/{commentId}`,
        handlerName: 'handleGroupCommentChange',
        operations: ['create', 'update'],
        metricName: 'trackGroupCommentChanges',
        mapParams: ({groupId, commentId}) => ({groupId, commentId}),
    }),
    toProdTrigger<'trackExpenseCommentChanges', TriggerParamsByName['trackExpenseCommentChanges'], { handlerName: HandlerNameByTrigger['trackExpenseCommentChanges']; metricName: string; }>({
        name: 'trackExpenseCommentChanges',
        document: `${FirestoreCollections.EXPENSES}/{expenseId}/comments/{commentId}`,
        handlerName: 'handleExpenseCommentChange',
        operations: ['create', 'update'],
        metricName: 'trackExpenseCommentChanges',
        mapParams: ({expenseId, commentId}) => ({expenseId, commentId}),
    }),
] as const;

export { changeTrackerTriggerDefinitions };

const bindHandler = (
    handlers: ChangeTrackerHandlers,
    definition: ChangeTrackerTriggerDefinition,
): FirestoreTriggerHandler => {
    const handler = handlers[definition.handlerName] as FirestoreTriggerHandler;
    return handler.bind(handlers);
};

export type ChangeTrackerTriggerExports = Record<TriggerName, FirestoreProdTrigger>;

export const createChangeTrackerTriggerExports = (handlers: ChangeTrackerHandlers,): ChangeTrackerTriggerExports => {
    const triggers = {} as Record<TriggerName, FirestoreProdTrigger>;

    for (const definition of changeTrackerTriggerDefinitions) {
        const handler = bindHandler(handlers, definition);
        const measuredHandler: FirestoreTriggerHandler = (event) =>
            measureTrigger(definition.metricName, () => handler(event));
        triggers[definition.name] = definition.createProdTrigger(measuredHandler);
    }

    return triggers;
};
