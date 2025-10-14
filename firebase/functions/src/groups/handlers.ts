import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { GroupHandlers } from './GroupHandlers';

const groupHandlers = GroupHandlers.createGroupHandlers(getAppBuilder());

export const createGroup = groupHandlers.createGroup;
export const updateGroup = groupHandlers.updateGroup;
export const deleteGroup = groupHandlers.deleteGroup;
export const listGroups = groupHandlers.listGroups;
export const getGroupFullDetails = groupHandlers.getGroupFullDetails;
export const updateGroupMemberDisplayName = groupHandlers.updateGroupMemberDisplayName;
