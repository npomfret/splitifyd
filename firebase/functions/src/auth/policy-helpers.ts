import { logger } from '../logger';
import { ApiError } from '../utils/errors';
import { db } from '../firebase';
import { HTTP_STATUS } from '../constants';
import { FirestoreCollections } from '../shared/shared-types';

/**
 * Get current version hashes for all policies
 * Used during user registration to capture what policies they're accepting
 */
export async function getCurrentPolicyVersions(): Promise<Record<string, string>> {
    try {
        const firestore = db;
        const policiesSnapshot = await firestore.collection(FirestoreCollections.POLICIES).get();

        const acceptedPolicies: Record<string, string> = {};

        policiesSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.currentVersionHash) {
                acceptedPolicies[doc.id] = data.currentVersionHash;
            }
        });

        return acceptedPolicies;
    } catch (error) {
        logger.error('Failed to get current policy versions', error);
        // Registration must fail if policies cannot be retrieved - compliance requirement
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_SERVICE_UNAVAILABLE', 'Registration temporarily unavailable - unable to retrieve policy versions');
    }
}
