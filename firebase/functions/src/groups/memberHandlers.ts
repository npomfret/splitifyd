import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { logger } from '../logger';
import { ApplicationBuilder } from '../services/ApplicationBuilder';
import { GroupMemberService } from '../services/GroupMemberService';
import { GroupMemberHandlers } from './GroupMemberHandlers';
import { GroupShareHandlers } from './GroupShareHandlers';

const groupMemberHandlers = GroupMemberHandlers.createGroupMemberHandlers(getAppBuilder());

export const leaveGroup = groupMemberHandlers.leaveGroup;
export const removeGroupMember = groupMemberHandlers.removeGroupMember;
export const archiveGroupForUser = groupMemberHandlers.archiveGroupForUser;
export const unarchiveGroupForUser = groupMemberHandlers.unarchiveGroupForUser;
