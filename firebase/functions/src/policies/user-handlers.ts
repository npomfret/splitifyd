import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { UserHandlers } from './UserHandlers';

const userHandlers = UserHandlers.createUserHandlers(getAppBuilder());

export const acceptMultiplePolicies = userHandlers.acceptMultiplePolicies;
export const getUserPolicyStatus = userHandlers.getUserPolicyStatus;
