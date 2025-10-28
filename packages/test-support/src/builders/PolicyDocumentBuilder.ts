import { ISOString, PolicyDTO, VersionHash } from '@splitifyd/shared';
import { convertToISOString, generateShortId } from '../test-helpers';

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
                    createdAt: convertToISOString(new Date()),
                },
            },
            createdAt: convertToISOString(new Date()),
            updatedAt: convertToISOString(new Date()),
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
                createdAt: convertToISOString(new Date()),
            },
        };
        return this;
    }

    withCreatedAt(timestamp: Date | string | ISOString): this {
        this.policy.createdAt = convertToISOString(timestamp);
        return this;
    }

    withUpdatedAt(timestamp: Date | string | ISOString): this {
        this.policy.updatedAt = convertToISOString(timestamp);
        return this;
    }

    build(): PolicyDTO {
        return {
            ...this.policy,
            versions: { ...this.policy.versions },
        };
    }
}
