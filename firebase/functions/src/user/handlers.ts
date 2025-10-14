import { getAppBuilder } from "../ApplicationBuilderSingleton";
import {UserHandlers} from "./UserHandlers";

const userHandlers = UserHandlers.createUserHandlers(getAppBuilder());

export const updateUserProfile = userHandlers.updateUserProfile;
export const changePassword = userHandlers.changePassword;
