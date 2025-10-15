import {GroupShareHandlers} from "./GroupShareHandlers";
import {getAppBuilder} from "../ApplicationBuilderSingleton";

const groupShareHandlers = GroupShareHandlers.createGroupShareHandlers(getAppBuilder());

export const generateShareableLink = groupShareHandlers.generateShareableLink;
export const previewGroupByLink = groupShareHandlers.previewGroupByLink;
export const joinGroupByLink = groupShareHandlers.joinGroupByLink;