import { ISOString, PolicyDTO, PolicyId, PolicyName, toPolicyName, VersionHash } from '@billsplit-wl/shared';
import { toPolicyId } from '@billsplit-wl/shared';
import { convertToISOString, generateShortId } from '../test-helpers';
import {PolicyText, toPolicyText} from "@billsplit-wl/shared";
import {toVersionHash} from "@billsplit-wl/shared";

/**
 * Builder for creating PolicyDTO objects for tests
 * Builds the actual PolicyDTO structure used in the application
 */
export class PolicyDocumentBuilder {
    private policy: PolicyDTO;

    constructor() {
        const versionHash = toVersionHash('v1-hash');
        this.policy = {
            id: toPolicyId(`policy-${generateShortId()}`),
            policyName: toPolicyName('privacy'),
            currentVersionHash: versionHash,
            versions: {
                [versionHash]: {
                    text: toPolicyText('Default policy content for testing...'),
                    createdAt: convertToISOString(new Date()),
                },
            },
            createdAt: convertToISOString(new Date()),
            updatedAt: convertToISOString(new Date()),
        };
    }

    withId(id: PolicyId | string): this {
        this.policy.id = typeof id === 'string' ? toPolicyId(id) : id;
        return this;
    }

    withPolicyName(name: PolicyName  | string): this {
        this.policy.policyName = typeof name === 'string' ? toPolicyName(name) : name;
        return this;
    }

    withVersionText(versionHash: VersionHash, text: PolicyText | string): this {
        this.policy.currentVersionHash = versionHash;
        this.policy.versions = {
            [versionHash]: {
                text: typeof text === 'string' ? toPolicyText(text) : text,
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
