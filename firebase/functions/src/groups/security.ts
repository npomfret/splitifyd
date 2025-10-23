import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { GroupSecurityHandlers } from './GroupSecurityHandlers';

const securityHandlers = GroupSecurityHandlers.createGroupSecurityHandlers(getAppBuilder());

export const updateGroupPermissions = securityHandlers.updateGroupPermissions;
export const updateMemberRole = securityHandlers.updateMemberRole;
export const approveMember = securityHandlers.approveMember;
export const rejectMember = securityHandlers.rejectMember;
export const getPendingMembers = securityHandlers.getPendingMembers;
