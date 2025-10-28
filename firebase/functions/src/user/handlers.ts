import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { UserHandlers } from './UserHandlers';

const userHandlers = UserHandlers.createUserHandlers(getAppBuilder());

export const updateUserProfile = userHandlers.updateUserProfile;
export const getUserProfile = userHandlers.getUserProfile;
export const changePassword = userHandlers.changePassword;
export const changeEmail = userHandlers.changeEmail;
