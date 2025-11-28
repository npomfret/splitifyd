import type { PolicyAcceptanceStatusDTO, PolicyId, PolicyName, VersionHash } from '@billsplit-wl/shared';
import { toPolicyId, toPolicyName, toVersionHash } from '@billsplit-wl/shared';
import { generateShortId } from '../test-helpers';

export class PolicyAcceptanceStatusDTOBuilder {
    private status: PolicyAcceptanceStatusDTO;

    constructor() {
        const uniqueId = generateShortId();
        this.status = {
            policyId: toPolicyId(`policy-${uniqueId}`),
            policyName: toPolicyName(`Test Policy ${uniqueId}`),
            currentVersionHash: toVersionHash(`hash-v1-${uniqueId}`),
            needsAcceptance: false,
        };
    }

    withPolicyId(policyId: PolicyId | string): this {
        this.status.policyId = typeof policyId === 'string' ? toPolicyId(policyId) : policyId;
        return this;
    }

    withPolicyName(policyName: PolicyName | string): this {
        this.status.policyName = typeof policyName === 'string' ? toPolicyName(policyName) : policyName;
        return this;
    }

    withCurrentVersionHash(hash: VersionHash | string): this {
        this.status.currentVersionHash = typeof hash === 'string' ? toVersionHash(hash) : hash;
        return this;
    }

    withUserAcceptedHash(hash: VersionHash | string | undefined): this {
        this.status.userAcceptedHash = hash ? (typeof hash === 'string' ? toVersionHash(hash) : hash) : undefined;
        return this;
    }

    withNeedsAcceptance(needsAcceptance: boolean): this {
        this.status.needsAcceptance = needsAcceptance;
        return this;
    }

    /** Creates a policy that needs acceptance (user has older version) */
    needingAcceptance(): this {
        this.status.needsAcceptance = true;
        if (!this.status.userAcceptedHash) {
            this.status.userAcceptedHash = toVersionHash(`${this.status.currentVersionHash}-old`);
        }
        return this;
    }

    /** Creates a policy that has been accepted (user has current version) */
    alreadyAccepted(): this {
        this.status.needsAcceptance = false;
        this.status.userAcceptedHash = this.status.currentVersionHash;
        return this;
    }

    build(): PolicyAcceptanceStatusDTO {
        return { ...this.status };
    }
}
