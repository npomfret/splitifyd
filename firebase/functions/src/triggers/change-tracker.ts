import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { ChangeTrackerHandlers } from './ChangeTrackerHandlers';

const changeTrackerHandlers = ChangeTrackerHandlers.createChangeTrackerHandlers(getAppBuilder());

export const trackGroupChanges = changeTrackerHandlers.getTrackGroupChanges();
export const trackExpenseChanges = changeTrackerHandlers.getTrackExpenseChanges();
export const trackSettlementChanges = changeTrackerHandlers.getTrackSettlementChanges();
export const trackGroupCommentChanges = changeTrackerHandlers.getTrackGroupCommentChanges();
export const trackExpenseCommentChanges = changeTrackerHandlers.getTrackExpenseCommentChanges();
