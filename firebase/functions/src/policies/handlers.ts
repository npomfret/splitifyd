import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { PolicyHandlers } from './PolicyHandlers';

const policyHandlers = PolicyHandlers.createPolicyHandlers(getAppBuilder());

export const listPolicies = policyHandlers.listPolicies;
export const getPolicy = policyHandlers.getPolicy;
export const getPolicyVersion = policyHandlers.getPolicyVersion;
export const updatePolicy = policyHandlers.updatePolicy;
export const publishPolicy = policyHandlers.publishPolicy;
export const createPolicy = policyHandlers.createPolicy;
export const deletePolicyVersion = policyHandlers.deletePolicyVersion;
