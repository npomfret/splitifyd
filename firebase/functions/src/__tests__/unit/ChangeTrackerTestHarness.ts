import { attachTriggersToStub, type FirestoreTriggerHandler, StubFirestoreDatabase } from '@splitifyd/firebase-simulator';
import { ChangeTrackerHandlers } from '../../triggers/ChangeTrackerHandlers';
import { changeTrackerTriggerDefinitions } from '../../triggers/ChangeTrackerTriggerRegistry';

/**
 * Wires the ChangeTrackerHandlers into the stub database so changes propagate
 * through the same handler methods that production triggers use.
 */
export const registerChangeTrackerTriggers = (db: StubFirestoreDatabase, handlers: ChangeTrackerHandlers,): (() => void) => {
    return attachTriggersToStub(db, changeTrackerTriggerDefinitions, (definition) =>
        (handlers[definition.handlerName] as FirestoreTriggerHandler).bind(handlers),
    );
};
