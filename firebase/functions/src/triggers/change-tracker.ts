import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { ChangeTrackerHandlers } from './ChangeTrackerHandlers';
import { createChangeTrackerTriggerExports } from './ChangeTrackerTriggerRegistry';

const changeTrackerHandlers = ChangeTrackerHandlers.createChangeTrackerHandlers(getAppBuilder());
const triggerExports = createChangeTrackerTriggerExports(changeTrackerHandlers);

export const trackGroupChanges = triggerExports.trackGroupChanges;
export const trackExpenseChanges = triggerExports.trackExpenseChanges;
export const trackSettlementChanges = triggerExports.trackSettlementChanges;
export const trackGroupCommentChanges = triggerExports.trackGroupCommentChanges;
export const trackExpenseCommentChanges = triggerExports.trackExpenseCommentChanges;
