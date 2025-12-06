import {
    CreatePolicyResult,
    CurrentPolicyResponse,
    ListPoliciesResponse,
    PolicyDTO,
    PolicyId,
    PolicyName,
    PolicyVersion,
    PolicyVersionResponse,
    PublishPolicyResult,
    toISOString,
    toPolicyId,
    UpdatePolicyResult,
    VersionHash,
} from '@billsplit-wl/shared';
import { PolicyText } from '@billsplit-wl/shared';
import { toVersionHash } from '@billsplit-wl/shared';
import * as crypto from 'crypto';
import { z } from 'zod';
import { ALLOWED_POLICY_IDS } from '../constants';
import { ApiError, ErrorDetail, Errors } from '../errors';
import { logger } from '../logger';
import { measureDb } from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { PolicyDocumentSchema } from '../schemas';
import { LoggerContext } from '../utils/logger-context';
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
    private async validatePolicyAfterUpdate(policyId: PolicyId, operationType: 'update' | 'publish' | 'version deletion', additionalContext: Record<string, unknown> = {}): Promise<void> {
        const updatedDoc = await this.firestoreReader.getRawPolicyDocument(policyId);
        if (!updatedDoc) {
            throw Errors.notFound('Policy', ErrorDetail.POLICY_NOT_FOUND);
        }

        try {
            const rawData = updatedDoc.data();
            if (!rawData) {
                throw Errors.serviceError(ErrorDetail.DATABASE_ERROR);
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
            throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
        }
    }

    /**
     * Calculate SHA-256 hash of policy text
     */
    private calculatePolicyHash(text: string): VersionHash {
        return PolicyService.makeVersionHash(text);
    }

    static makeVersionHash(text: string) {
        return toVersionHash(crypto.createHash('sha256').update(text, 'utf8').digest('hex'));
    }

    /**
     * List all policies
     */
    async listPolicies(): Promise<ListPoliciesResponse> {
        try {
            const policies = await this.firestoreReader.getAllPolicies();
            return {
                policies: policies as PolicyDTO[],
                count: policies.length,
            };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to list policies', error as Error);
            throw Errors.serviceError(ErrorDetail.POLICY_SERVICE_ERROR);
        }
    }

    /**
     * Get policy details and version history
     */
    async getPolicy(id: PolicyId): Promise<PolicyDTO> {
        try {
            const policy = await this.firestoreReader.getPolicy(id);

            if (!policy) {
                throw Errors.notFound('Policy', ErrorDetail.POLICY_NOT_FOUND);
            }

            return policy as PolicyDTO;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to get policy', error as Error, { policyId: id });
            throw Errors.serviceError(ErrorDetail.POLICY_SERVICE_ERROR);
        }
    }

    /**
     * Get specific version content
     */
    async getPolicyVersion(id: PolicyId, hash: VersionHash): Promise<PolicyVersionResponse> {
        try {
            const policy = await this.firestoreReader.getPolicy(id);

            if (!policy) {
                throw Errors.notFound('Policy', ErrorDetail.POLICY_NOT_FOUND);
            }

            if (!policy.versions) {
                throw Errors.serviceError(ErrorDetail.DATABASE_ERROR);
            }

            const version = policy.versions[hash];
            if (!version) {
                throw Errors.notFound('Policy version', 'VERSION_NOT_FOUND');
            }

            return {
                versionHash: hash,
                ...version,
            };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to get policy version', error as Error, { policyId: id, versionHash: hash });
            throw Errors.serviceError(ErrorDetail.POLICY_SERVICE_ERROR);
        }
    }

    /**
     * Create new draft version (not published)
     */
    async updatePolicy(id: PolicyId, text: PolicyText, publish: boolean = false): Promise<UpdatePolicyResult> {
        return measureDb('PolicyService.updatePolicy', async () => this._updatePolicy(id, text, publish));
    }

    private async _updatePolicy(id: PolicyId, text: PolicyText, publish: boolean = false): Promise<UpdatePolicyResult> {
        LoggerContext.update({ policyId: id, operation: 'update-policy', publish });
        const timer = new PerformanceTimer();

        try {
            timer.startPhase('read');
            const doc = await this.firestoreReader.getRawPolicyDocument(id);
            timer.endPhase();

            if (!doc) {
                throw Errors.notFound('Policy', ErrorDetail.POLICY_NOT_FOUND);
            }

            const versionHash = this.calculatePolicyHash(text);
            const now = toISOString(new Date().toISOString());

            const newVersion: PolicyVersion = {
                text,
                createdAt: now, // DTO with ISO string
            };

            const data = doc.data();
            if (!data || !data.versions) {
                throw Errors.serviceError(ErrorDetail.DATABASE_ERROR);
            }

            const versions = { ...data.versions };

            // Check if this exact version already exists
            if (versions[versionHash]) {
                throw Errors.alreadyExists('Policy version', ErrorDetail.VERSION_EXISTS);
            }

            versions[versionHash] = newVersion;

            const updates: Partial<Pick<PolicyDTO, 'versions' | 'currentVersionHash'>> = {
                versions,
                // updatedAt is automatically added by FirestoreWriter
            };

            // If publish is true, also update currentVersionHash
            let currentVersionHash: VersionHash | undefined;
            if (publish) {
                updates.currentVersionHash = versionHash;
                currentVersionHash = versionHash;
            }

            timer.startPhase('write');
            await this.firestoreWriter.updatePolicy(id, updates);
            timer.endPhase();

            // Validate the updated document to ensure it's still valid
            timer.startPhase('validate');
            await this.validatePolicyAfterUpdate(id, 'update');
            timer.endPhase();

            logger.info('Policy updated', {
                policyId: id,
                versionHash,
                published: publish,
                timings: timer.getTimings(),
            });

            return { versionHash, currentVersionHash };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to update policy', error as Error, { policyId: id });
            throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
        }
    }

    /**
     * Publish a policy version (internal helper)
     */
    async publishPolicyInternal(id: PolicyId, versionHash: VersionHash): Promise<PublishPolicyResult> {
        if (!versionHash) {
            throw Errors.validationError('versionHash', ErrorDetail.MISSING_FIELD);
        }

        try {
            const timer = new PerformanceTimer();

            timer.startPhase('read');
            const doc = await this.firestoreReader.getRawPolicyDocument(id);
            timer.endPhase();

            if (!doc) {
                throw Errors.notFound('Policy', ErrorDetail.POLICY_NOT_FOUND);
            }

            const data = doc.data();
            if (!data || !data.versions) {
                throw Errors.serviceError(ErrorDetail.DATABASE_ERROR);
            }

            // Verify the version exists
            if (!data.versions[versionHash]) {
                throw Errors.notFound('Policy version', 'VERSION_NOT_FOUND');
            }

            // Update current version hash (updatedAt is automatically added by FirestoreWriter)
            timer.startPhase('write');
            await this.firestoreWriter.updatePolicy(id, {
                currentVersionHash: versionHash,
            });
            timer.endPhase();

            // Validate the updated document to ensure it's still valid
            timer.startPhase('validate');
            await this.validatePolicyAfterUpdate(id, 'publish', { versionHash });
            timer.endPhase();

            logger.info('Policy published', { policyId: id, versionHash, timings: timer.getTimings() });

            return { currentVersionHash: versionHash };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to publish policy', error as Error, { policyId: id, versionHash });
            throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
        }
    }

    /**
     * Publish a policy version
     */
    async publishPolicy(id: PolicyId, versionHash: VersionHash): Promise<PublishPolicyResult> {
        return measureDb('PolicyService.publishPolicy', async () => this._publishPolicy(id, versionHash));
    }

    private async _publishPolicy(id: PolicyId, versionHash: VersionHash): Promise<PublishPolicyResult> {
        LoggerContext.update({ policyId: id, operation: 'publish-policy', versionHash });

        return this.publishPolicyInternal(id, versionHash);
    }

    /**
     * Generate ID from policy name (kebab-case)
     */
    private generatePolicyId(policyName: PolicyName): PolicyId {
        return toPolicyId(
            policyName
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, ''),
        );
    }

    /**
     * Create a new policy (internal helper)
     */
    async createPolicyInternal(policyName: PolicyName, text: PolicyText, customId?: PolicyId): Promise<CreatePolicyResult> {
        if (!policyName || !text) {
            throw Errors.validationError('policyName', ErrorDetail.MISSING_FIELD);
        }

        try {
            const timer = new PerformanceTimer();

            // Use custom ID if provided, otherwise generate ID from policy name (kebab-case)
            const id = customId || this.generatePolicyId(policyName);

            // Validate that only standard policies can be created
            if (!ALLOWED_POLICY_IDS.has(id)) {
                throw Errors.invalidRequest(`Only standard policies are allowed. Policy ID '${id}' is not permitted. Allowed policies: ${Array.from(ALLOWED_POLICY_IDS).join(', ')}`);
            }

            // Check if policy already exists
            timer.startPhase('read');
            const existingDoc = await this.firestoreReader.getRawPolicyDocument(id);
            timer.endPhase();
            if (existingDoc) {
                throw Errors.alreadyExists('Policy', ErrorDetail.POLICY_EXISTS);
            }

            const versionHash = this.calculatePolicyHash(text);

            const initialVersion: PolicyVersion = {
                text,
                createdAt: toISOString(new Date().toISOString()), // DTO with ISO string
            };

            // Note: createdAt and updatedAt are added by FirestoreWriter.createPolicy()
            const policyData: Omit<PolicyDTO, 'id' | 'createdAt' | 'updatedAt'> = {
                policyName,
                currentVersionHash: versionHash,
                versions: {
                    [versionHash]: initialVersion,
                },
            };

            // FirestoreWriter will:
            // 1. Convert ISO strings → Timestamps
            // 2. Add createdAt/updatedAt with FieldValue.serverTimestamp()
            // 3. Validate the final data with PolicyDataSchema
            timer.startPhase('write');
            await this.firestoreWriter.createPolicy(id, policyData);
            timer.endPhase();

            logger.info('Policy created successfully', { policyId: id, policyName, versionHash, timings: timer.getTimings() });

            return { id, currentVersionHash: versionHash };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to create policy', error as Error, { policyName, customId });
            throw Errors.serviceError(ErrorDetail.CREATION_FAILED);
        }
    }

    /**
     * Create a new policy
     */
    async createPolicy(policyName: PolicyName, text: PolicyText, customId?: PolicyId): Promise<CreatePolicyResult> {
        return measureDb('PolicyService.createPolicy', async () => this._createPolicy(policyName, text, customId));
    }

    private async _createPolicy(policyName: PolicyName, text: PolicyText, customId?: PolicyId): Promise<CreatePolicyResult> {
        LoggerContext.update({ operation: 'create-policy', policyName, customId });

        return this.createPolicyInternal(policyName, text, customId);
    }

    /**
     * Delete a policy version
     */
    async deletePolicyVersion(id: PolicyId, hash: VersionHash): Promise<void> {
        try {
            const timer = new PerformanceTimer();

            timer.startPhase('read');
            const doc = await this.firestoreReader.getRawPolicyDocument(id);
            timer.endPhase();

            if (!doc) {
                throw Errors.notFound('Policy', ErrorDetail.POLICY_NOT_FOUND);
            }

            const data = doc.data();
            if (!data || !data.versions) {
                throw Errors.serviceError(ErrorDetail.DATABASE_ERROR);
            }

            const versions = data.versions;

            // Cannot delete current version
            if (data.currentVersionHash === hash) {
                throw Errors.invalidRequest('Cannot delete the current published version');
            }

            // Cannot delete if it's the only version
            if (Object.keys(versions).length <= 1) {
                throw Errors.invalidRequest('Cannot delete the only version of a policy');
            }

            // Version must exist
            if (!versions[hash]) {
                throw Errors.notFound('Policy version', 'VERSION_NOT_FOUND');
            }

            // Remove the version from the versions object
            const updatedVersions = { ...versions };
            delete updatedVersions[hash];

            // updatedAt is automatically added by FirestoreWriter
            timer.startPhase('write');
            await this.firestoreWriter.updatePolicy(id, {
                versions: updatedVersions,
            });
            timer.endPhase();

            // Validate the updated document to ensure it's still valid
            timer.startPhase('validate');
            await this.validatePolicyAfterUpdate(id, 'version deletion', { deletedVersionHash: hash });
            timer.endPhase();

            logger.info('Policy version deleted', { policyId: id, versionHash: hash, timings: timer.getTimings() });
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to delete policy version', error as Error, { policyId: id, versionHash: hash });
            throw Errors.serviceError(ErrorDetail.DELETE_FAILED);
        }
    }

    /**
     * Get current version of a specific policy (public endpoint)
     */
    async getCurrentPolicy(id: PolicyId): Promise<CurrentPolicyResponse> {
        try {
            const policy = await this.firestoreReader.getPolicy(id);

            if (!policy) {
                throw Errors.notFound('Policy', ErrorDetail.POLICY_NOT_FOUND);
            }

            if (!policy.currentVersionHash || !policy.versions || !policy.policyName) {
                throw Errors.serviceError(ErrorDetail.DATABASE_ERROR);
            }

            const currentVersion = policy.versions[policy.currentVersionHash];
            if (!currentVersion) {
                throw Errors.serviceError(ErrorDetail.DATABASE_ERROR);
            }

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
            throw Errors.serviceError(ErrorDetail.POLICY_SERVICE_ERROR);
        }
    }
}
