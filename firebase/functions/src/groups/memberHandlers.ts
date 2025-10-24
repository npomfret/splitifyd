import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { GroupMemberHandlers } from './GroupMemberHandlers';

const groupMemberHandlers = GroupMemberHandlers.createGroupMemberHandlers(getAppBuilder());

export const leaveGroup = groupMemberHandlers.leaveGroup;
export const removeGroupMember = groupMemberHandlers.removeGroupMember;
export const archiveGroupForUser = groupMemberHandlers.archiveGroupForUser;
export const unarchiveGroupForUser = groupMemberHandlers.unarchiveGroupForUser;
