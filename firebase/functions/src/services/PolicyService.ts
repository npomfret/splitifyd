import * as crypto from 'crypto';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { createOptimisticTimestamp, timestampToISO } from '../utils/dateHelpers';
import { logger } from '../logger';
import { LoggerContext } from '../utils/logger-context';
import { PolicyDTO, PolicyVersion } from '@splitifyd/shared';
import { measureDb } from '../monitoring/measure';
import { PolicyDocumentSchema, PolicyDataSchema } from '../schemas';
import { z } from 'zod';
import { IFirestoreReader } from './firestore';
import { IFirestoreWriter } from './firestore';

/**
 * Service for managing policy operations
 */
export class PolicyService {
    constructor(
        private firestoreReader: IFirestoreReader,
        private firestoreWriter: IFirestoreWriter,
    ) {}

    /**
     * Validates that a policy document remains valid after an update operation
     */
    private async validatePolicyAfterUpdate(policyId: string, operationType: 'update' | 'publish' | 'version deletion', additionalContext: Record<string, any> = {}): Promise<void> {
        const updatedDoc = await this.firestoreReader.getRawPolicyDocument(policyId);
        if (!updatedDoc) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', `Policy not found after ${operationType}`);
        }

        try {
            const rawData = updatedDoc.data();
            if (!rawData) {
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_DATA_NULL', `Policy document data is null after ${operationType}`);
            }
            // Add document ID to data for validation
            const dataWithId = { ...rawData, id: updatedDoc.id };
            PolicyDocumentSchema.parse(dataWithId);
        } catch (validationError) {
            logger.error(`Policy document validation failed after ${operationType}`, validationError as Error, {
                policyId,
                ...additionalContext,
                validationErrors: validationError instanceof z.ZodError ? validationError.issues : undefined,
            });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, `INVALID_POLICY_AFTER_${operationType.replace(' ', '_').toUpperCase()}`, `Policy document became invalid after ${operationType}`);
        }
    }

    /**
     * Calculate SHA-256 hash of policy text
     */
    private calculatePolicyHash(text: string): string {
        return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
    }

    /**
     * List all policies
     */
    async listPolicies(): Promise<{ policies: PolicyDTO[]; count: number }> {
        try {
            const policies = await this.firestoreReader.getAllPolicies();

            logger.info('Policies listed', { count: policies.length });

            return {
                policies: policies as PolicyDTO[],
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
    async getPolicy(id: string): Promise<PolicyDTO> {
        try {
            const policy = await this.firestoreReader.getPolicy(id);

            if (!policy) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
            }

            logger.info('Policy retrieved', { policyId: id });

            return policy as PolicyDTO;
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
            const policy = await this.firestoreReader.getPolicy(id);

            if (!policy) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
            }

            if (!policy.versions) {
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'CORRUPT_POLICY_DATA', 'Policy document is missing versions data');
            }

            const version = policy.versions[hash];
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
        return measureDb('PolicyService.updatePolicy', async () => this._updatePolicy(id, text, publish));
    }

    private async _updatePolicy(id: string, text: string, publish: boolean = false): Promise<{ versionHash: string; currentVersionHash?: string }> {
        LoggerContext.update({ policyId: id, operation: 'update-policy', publish });

        try {
            const doc = await this.firestoreReader.getRawPolicyDocument(id);

            if (!doc) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
            }

            const versionHash = this.calculatePolicyHash(text);
            const now = timestampToISO(createOptimisticTimestamp());

            const newVersion: PolicyVersion = {
                text,
                createdAt: now,
            };

            const data = doc.data();
            if (!data || !data.versions) {
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'CORRUPT_POLICY_DATA', 'Policy document is missing versions data');
            }

            const versions = { ...data.versions };

            // Check if this exact version already exists
            if (versions[versionHash]) {
                throw new ApiError(HTTP_STATUS.CONFLICT, 'VERSION_ALREADY_EXISTS', 'A version with this content already exists');
            }

            versions[versionHash] = newVersion;

            const updates: any = {
                versions,
                updatedAt: createOptimisticTimestamp(),
            };

            // If publish is true, also update currentVersionHash
            let currentVersionHash: string | undefined;
            if (publish) {
                updates.currentVersionHash = versionHash;
                currentVersionHash = versionHash;
            }

            await this.firestoreWriter.updatePolicy(id, updates);

            // Validate the updated document to ensure it's still valid
            await this.validatePolicyAfterUpdate(id, 'update');

            logger.info('Policy updated', {
                policyId: id,
                versionHash,
                published: publish,
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
            const doc = await this.firestoreReader.getRawPolicyDocument(id);

            if (!doc) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
            }

            const data = doc.data();
            if (!data || !data.versions) {
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'CORRUPT_POLICY_DATA', 'Policy document is missing versions data');
            }

            // Verify the version exists
            if (!data.versions[versionHash]) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'VERSION_NOT_FOUND', 'Policy version not found');
            }

            // Update current version hash
            await this.firestoreWriter.updatePolicy(id, {
                currentVersionHash: versionHash,
                updatedAt: createOptimisticTimestamp(),
            });

            // Validate the updated document to ensure it's still valid
            await this.validatePolicyAfterUpdate(id, 'publish', { versionHash });

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
        return measureDb('PolicyService.publishPolicy', async () => this._publishPolicy(id, versionHash));
    }

    private async _publishPolicy(id: string, versionHash: string): Promise<{ currentVersionHash: string }> {
        LoggerContext.update({ policyId: id, operation: 'publish-policy', versionHash });

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
            const existingDoc = await this.firestoreReader.getRawPolicyDocument(id);
            if (existingDoc) {
                throw new ApiError(HTTP_STATUS.CONFLICT, 'POLICY_EXISTS', 'Policy already exists');
            }

            const versionHash = this.calculatePolicyHash(text);
            const now = createOptimisticTimestamp();

            const initialVersion: PolicyVersion = {
                text,
                createdAt: timestampToISO(now),
            };

            const policyData: Omit<PolicyDTO, 'id'> = {
                policyName,
                currentVersionHash: versionHash,
                versions: {
                    [versionHash]: initialVersion,
                },
                createdAt: timestampToISO(now),
                updatedAt: timestampToISO(now),
            };

            // Validate policy data before writing to Firestore
            try {
                const validatedPolicyData = PolicyDataSchema.parse(policyData);
                await this.firestoreWriter.createPolicy(id, validatedPolicyData);
            } catch (validationError) {
                logger.error('Policy data validation failed before creation', validationError as Error, {
                    policyName,
                    customId,
                    validationErrors: validationError instanceof z.ZodError ? validationError.issues : undefined,
                });
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_POLICY_DATA', 'Failed to create policy due to invalid data structure');
            }

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
        return measureDb('PolicyService.createPolicy', async () => this._createPolicy(policyName, text, customId));
    }

    private async _createPolicy(policyName: string, text: string, customId?: string): Promise<{ id: string; currentVersionHash: string }> {
        LoggerContext.update({ operation: 'create-policy', policyName, customId });

        return this.createPolicyInternal(policyName, text, customId);
    }

    /**
     * Delete a policy version
     */
    async deletePolicyVersion(id: string, hash: string): Promise<void> {
        try {
            const doc = await this.firestoreReader.getRawPolicyDocument(id);

            if (!doc) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
            }

            const data = doc.data();
            if (!data || !data.versions) {
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'CORRUPT_POLICY_DATA', 'Policy document is missing versions data');
            }

            const versions = data.versions;

            // Cannot delete current version
            if (data.currentVersionHash === hash) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'CANNOT_DELETE_CURRENT', 'Cannot delete the current published version');
            }

            // Cannot delete if it's the only version
            if (Object.keys(versions).length <= 1) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'CANNOT_DELETE_ONLY', 'Cannot delete the only version of a policy');
            }

            // Version must exist
            if (!versions[hash]) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'VERSION_NOT_FOUND', 'Version not found');
            }

            // Remove the version from the versions object
            const updatedVersions = { ...versions };
            delete updatedVersions[hash];

            await this.firestoreWriter.updatePolicy(id, {
                versions: updatedVersions,
                updatedAt: createOptimisticTimestamp(),
            });

            // Validate the updated document to ensure it's still valid
            await this.validatePolicyAfterUpdate(id, 'version deletion', { deletedVersionHash: hash });

            logger.info('Policy version deleted', { policyId: id, versionHash: hash });
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to delete policy version', error as Error, { policyId: id, versionHash: hash });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'VERSION_DELETE_FAILED', 'Failed to delete policy version');
        }
    }

    /**
     * Get current version of a specific policy (public endpoint)
     */
    async getCurrentPolicy(id: string): Promise<{
        id: string;
        policyName: string;
        currentVersionHash: string;
        text: string;
        createdAt: any;
    }> {
        try {
            const policy = await this.firestoreReader.getPolicy(id);

            if (!policy) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
            }

            if (!policy.currentVersionHash || !policy.versions || !policy.policyName) {
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'CORRUPT_POLICY_DATA', 'Policy document is missing required fields');
            }

            const currentVersion = policy.versions[policy.currentVersionHash];
            if (!currentVersion) {
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'VERSION_NOT_FOUND', 'Current policy version not found in versions map');
            }

            logger.info('policy-retrieved', { id });

            return {
                id,
                policyName: policy.policyName,
                currentVersionHash: policy.currentVersionHash,
                text: currentVersion.text,
                createdAt: currentVersion.createdAt,
            };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to get current policy', error as Error, { policyId: id });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_GET_FAILED', 'Failed to retrieve current policy');
        }
    }
}
