import { PolicyDTO, VersionHash } from '@splitifyd/shared';
import { BuilderTimestamp, generateShortId, timestampToISOString } from '../test-helpers';

/**
 * Builder for creating PolicyDTO objects for tests
 * Builds the actual PolicyDTO structure used in the application
 */
export class PolicyDocumentBuilder {
    private policy: PolicyDTO;

    constructor() {
        const versionHash = 'v1-hash';
        this.policy = {
            id: `policy-${generateShortId()}`,
            policyName: 'privacy',
            currentVersionHash: versionHash,
            versions: {
                [versionHash]: {
                    text: 'Default policy content for testing...',
                    createdAt: new Date().toISOString(),
                },
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    withId(id: string): this {
        this.policy.id = id;
        return this;
    }

    withPolicyName(name: string): this {
        this.policy.policyName = name;
        return this;
    }

    withVersionText(versionHash: VersionHash, text: string): this {
        this.policy.currentVersionHash = versionHash;
        this.policy.versions = {
            [versionHash]: {
                text,
                createdAt: new Date().toISOString(),
            },
        };
        return this;
    }

    withCreatedAt(timestamp: BuilderTimestamp): this {
        this.policy.createdAt = timestampToISOString(timestamp);
        return this;
    }

    withUpdatedAt(timestamp: BuilderTimestamp): this {
        this.policy.updatedAt = timestampToISOString(timestamp);
        return this;
    }

    build(): PolicyDTO {
        return {
            ...this.policy,
            versions: { ...this.policy.versions },
        };
    }
}
