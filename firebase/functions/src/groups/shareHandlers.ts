import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { GroupShareHandlers } from './GroupShareHandlers';

const groupShareHandlers = GroupShareHandlers.createGroupShareHandlers(getAppBuilder());

export const generateShareableLink = groupShareHandlers.generateShareableLink;
export const previewGroupByLink = groupShareHandlers.previewGroupByLink;
export const joinGroupByLink = groupShareHandlers.joinGroupByLink;
