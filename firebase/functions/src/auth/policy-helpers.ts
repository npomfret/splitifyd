import * as admin from 'firebase-admin';
import { logger } from '../logger';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { FirestoreCollections } from '../shared/shared-types';

/**
 * Get current version hashes for all policies
 * Used during user registration to capture what policies they're accepting
 */
export async function getCurrentPolicyVersions(): Promise<Record<string, string>> {
  try {
    const firestore = admin.firestore();
    const policiesSnapshot = await firestore.collection(FirestoreCollections.POLICIES).get();
    
    const acceptedPolicies: Record<string, string> = {};
    
    policiesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.currentVersionHash) {
        acceptedPolicies[doc.id] = data.currentVersionHash;
      } else {
        logger.warn('Policy document missing currentVersionHash', { policyId: doc.id });
      }
    });
    
    logger.info('Retrieved current policy versions for registration', { 
      policyCount: Object.keys(acceptedPolicies).length,
      policies: Object.keys(acceptedPolicies) 
    });
    
    return acceptedPolicies;
  } catch (error) {
    logger.errorWithContext('Failed to get current policy versions', error as Error);
    // Registration must fail if policies cannot be retrieved - compliance requirement
    throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_SERVICE_UNAVAILABLE', 
      'Registration temporarily unavailable - unable to retrieve policy versions');
  }
}