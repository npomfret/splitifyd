import {logger} from '../logger';
import {ApplicationBuilder} from '../services/ApplicationBuilder';
import {GroupShareHandlers} from "./GroupShareHandlers";
import {GroupMemberService} from "../services/GroupMemberService";
import {getAppBuilder} from "../ApplicationBuilderSingleton";
import {GroupMemberHandlers} from "./GroupMemberHandlers";

const groupMemberHandlers = GroupMemberHandlers.createGroupMemberHandlers(getAppBuilder())

export const leaveGroup = groupMemberHandlers.leaveGroup;
export const removeGroupMember = groupMemberHandlers.removeGroupMember;