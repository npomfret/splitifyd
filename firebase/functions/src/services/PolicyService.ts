import * as crypto from 'crypto';
import { firestoreDb } from '../firebase';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { createServerTimestamp, timestampToISO } from '../utils/dateHelpers';
import { logger } from '../logger';
import {
    FirestoreCollections,
    PolicyDocument,
    PolicyVersion,
} from '@splitifyd/shared';

/**
 * Service for managing policy operations
 */
export class PolicyService {
    private policiesCollection = firestoreDb.collection(FirestoreCollections.POLICIES);

    /**
     * Calculate SHA-256 hash of policy text
     */
    private calculatePolicyHash(text: string): string {
        return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
    }

    /**
     * Validate policy document has required fields
     */
    private validatePolicyDocument(data: any, docId: string): void {
        if (!data.policyName || !data.currentVersionHash || !data.versions) {
            throw new ApiError(
                HTTP_STATUS.INTERNAL_ERROR,
                'CORRUPT_POLICY_DATA',
                `Policy document ${docId} is missing required fields`
            );
        }
    }

    /**
     * Transform Firestore document to PolicyDocument interface
     */
    private transformPolicyDocument(doc: FirebaseFirestore.DocumentSnapshot): PolicyDocument {
        const data = doc.data();
        if (!data) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_DATA_NULL', 'Policy document data is null');
        }

        this.validatePolicyDocument(data, doc.id);

        return {
            id: doc.id,
            policyName: data.policyName,
            currentVersionHash: data.currentVersionHash,
            versions: data.versions,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
        };
    }

    /**
     * List all policies
     */
    async listPolicies(): Promise<{ policies: PolicyDocument[]; count: number }> {
        try {
            const snapshot = await this.policiesCollection.get();
            const policies: PolicyDocument[] = [];

            snapshot.forEach((doc) => {
                policies.push(this.transformPolicyDocument(doc));
            });

            logger.info('Policies listed', { count: policies.length });

            return {
                policies,
                count: policies.length,
            };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to list policies', error as Error);
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_LIST_FAILED', 'Failed to retrieve policies');
        }
    }

    /**
     * Get policy details and version history
     */
    async getPolicy(id: string): Promise<PolicyDocument> {
        try {
            const doc = await this.policiesCollection.doc(id).get();

            if (!doc.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
            }

            const policy = this.transformPolicyDocument(doc);

            logger.info('Policy retrieved', { policyId: id });

            return policy;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to get policy', error as Error, { policyId: id });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_GET_FAILED', 'Failed to retrieve policy');
        }
    }

    /**
     * Get specific version content
     */
    async getPolicyVersion(id: string, hash: string): Promise<PolicyVersion & { versionHash: string }> {
        try {
            const doc = await this.policiesCollection.doc(id).get();

            if (!doc.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
            }

            const data = doc.data();
            if (!data) {
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_DATA_NULL', 'Policy document data is null');
            }

            if (!data.versions) {
                throw new ApiError(
                    HTTP_STATUS.INTERNAL_ERROR,
                    'CORRUPT_POLICY_DATA',
                    'Policy document is missing versions data'
                );
            }

            const version = data.versions[hash];
            if (!version) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'VERSION_NOT_FOUND', 'Policy version not found');
            }

            logger.info('Policy version retrieved', { policyId: id, versionHash: hash });

            return {
                versionHash: hash,
                ...version,
            };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to get policy version', error as Error, { policyId: id, versionHash: hash });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'VERSION_GET_FAILED', 'Failed to retrieve policy version');
        }
    }

    /**
     * Create new draft version (not published)
     */
    async updatePolicy(id: string, text: string, publish: boolean = false): Promise<{ versionHash: string; currentVersionHash?: string }> {
        try {
            const doc = await this.policiesCollection.doc(id).get();

            if (!doc.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
            }

            const versionHash = this.calculatePolicyHash(text);
            const now = timestampToISO(createServerTimestamp());

            const newVersion: PolicyVersion = {
                text,
                createdAt: now,
            };

            const data = doc.data();
            if (!data || !data.versions) {
                throw new ApiError(
                    HTTP_STATUS.INTERNAL_ERROR,
                    'CORRUPT_POLICY_DATA',
                    'Policy document is missing versions data'
                );
            }

            const versions = { ...data.versions };
            
            // Check if this exact version already exists
            if (versions[versionHash]) {
                throw new ApiError(
                    HTTP_STATUS.CONFLICT,
                    'VERSION_ALREADY_EXISTS',
                    'A version with this content already exists'
                );
            }

            versions[versionHash] = newVersion;

            const updates: any = {
                versions,
                updatedAt: createServerTimestamp(),
            };

            // If publish is true, also update currentVersionHash
            let currentVersionHash: string | undefined;
            if (publish) {
                updates.currentVersionHash = versionHash;
                currentVersionHash = versionHash;
            }

            await this.policiesCollection.doc(id).update(updates);

            logger.info('Policy updated', { 
                policyId: id, 
                versionHash, 
                published: publish 
            });

            return { versionHash, currentVersionHash };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to update policy', error as Error, { policyId: id });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_UPDATE_FAILED', 'Failed to update policy');
        }
    }

    /**
     * Publish a policy version (internal helper)
     */
    async publishPolicyInternal(id: string, versionHash: string): Promise<{ currentVersionHash: string }> {
        if (!versionHash) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'VERSION_HASH_REQUIRED', 'Version hash is required');
        }

        try {
            const doc = await this.policiesCollection.doc(id).get();

            if (!doc.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
            }

            const data = doc.data();
            if (!data || !data.versions) {
                throw new ApiError(
                    HTTP_STATUS.INTERNAL_ERROR,
                    'CORRUPT_POLICY_DATA',
                    'Policy document is missing versions data'
                );
            }

            // Verify the version exists
            if (!data.versions[versionHash]) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'VERSION_NOT_FOUND', 'Policy version not found');
            }

            // Update current version hash
            await this.policiesCollection.doc(id).update({
                currentVersionHash: versionHash,
                updatedAt: createServerTimestamp(),
            });

            logger.info('Policy published', { policyId: id, versionHash });

            return { currentVersionHash: versionHash };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to publish policy', error as Error, { policyId: id, versionHash });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_PUBLISH_FAILED', 'Failed to publish policy');
        }
    }

    /**
     * Publish a policy version
     */
    async publishPolicy(id: string, versionHash: string): Promise<{ currentVersionHash: string }> {
        return this.publishPolicyInternal(id, versionHash);
    }

    /**
     * Generate ID from policy name (kebab-case)
     */
    private generatePolicyId(policyName: string): string {
        return policyName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }

    /**
     * Create a new policy (internal helper)
     */
    async createPolicyInternal(policyName: string, text: string, customId?: string): Promise<{ id: string; currentVersionHash: string }> {
        if (!policyName || !text) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_FIELDS', 'Policy name and text are required');
        }

        try {
            // Use custom ID if provided, otherwise generate ID from policy name (kebab-case)
            const id = customId || this.generatePolicyId(policyName);

            // Check if policy already exists
            const existingDoc = await this.policiesCollection.doc(id).get();
            if (existingDoc.exists) {
                throw new ApiError(HTTP_STATUS.CONFLICT, 'POLICY_EXISTS', 'Policy already exists');
            }

            const versionHash = this.calculatePolicyHash(text);
            const now = createServerTimestamp();

            const initialVersion: PolicyVersion = {
                text,
                createdAt: timestampToISO(now),
            };

            const policyData: Omit<PolicyDocument, 'id'> = {
                policyName,
                currentVersionHash: versionHash,
                versions: {
                    [versionHash]: initialVersion,
                },
                createdAt: timestampToISO(now),
                updatedAt: timestampToISO(now),
            };

            await this.policiesCollection.doc(id).set(policyData);

            logger.info('Policy created successfully', { policyId: id, policyName, versionHash });

            return { id, currentVersionHash: versionHash };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to create policy', error as Error, { policyName, customId });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_CREATE_FAILED', 'Failed to create policy');
        }
    }

    /**
     * Create a new policy
     */
    async createPolicy(policyName: string, text: string, customId?: string): Promise<{ id: string; currentVersionHash: string }> {
        return this.createPolicyInternal(policyName, text, customId);
    }

    /**
     * Delete a policy version
     */
    async deletePolicyVersion(id: string, hash: string): Promise<void> {
        try {
            const doc = await this.policiesCollection.doc(id).get();

            if (!doc.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
            }

            const data = doc.data();
            if (!data || !data.versions) {
                throw new ApiError(
                    HTTP_STATUS.INTERNAL_ERROR,
                    'CORRUPT_POLICY_DATA',
                    'Policy document is missing versions data'
                );
            }

            const versions = data.versions;

            // Cannot delete current version
            if (data.currentVersionHash === hash) {
                throw new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'CANNOT_DELETE_CURRENT',
                    'Cannot delete the current published version'
                );
            }

            // Cannot delete if it's the only version
            if (Object.keys(versions).length <= 1) {
                throw new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'CANNOT_DELETE_ONLY',
                    'Cannot delete the only version of a policy'
                );
            }

            // Version must exist
            if (!versions[hash]) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'VERSION_NOT_FOUND', 'Version not found');
            }

            // Remove the version from the versions object
            const updatedVersions = { ...versions };
            delete updatedVersions[hash];

            await this.policiesCollection.doc(id).update({
                versions: updatedVersions,
                updatedAt: createServerTimestamp(),
            });

            logger.info('Policy version deleted', { policyId: id, versionHash: hash });
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to delete policy version', error as Error, { policyId: id, versionHash: hash });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'VERSION_DELETE_FAILED', 'Failed to delete policy version');
        }
    }
}