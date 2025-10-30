import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { UserBrowserHandlers } from './UserBrowserHandlers';

const userBrowserHandlers = UserBrowserHandlers.createUserBrowserHandlers(getAppBuilder());

export const listAuthUsers = userBrowserHandlers.listAuthUsers;
export const listFirestoreUsers = userBrowserHandlers.listFirestoreUsers;
