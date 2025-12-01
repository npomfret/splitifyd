import type { AcceptPolicyRequest, PolicyId, VersionHash } from '@billsplit-wl/shared';
import { toPolicyId, toVersionHash } from '@billsplit-wl/shared';

/**
 * Builder for AcceptPolicyRequest objects used in policy acceptance tests.
 */
export class AcceptPolicyRequestBuilder {
    private request: AcceptPolicyRequest;

    constructor() {
        this.request = {
            policyId: toPolicyId('default-policy-id'),
            versionHash: toVersionHash('default-version-hash'),
        };
    }

    withPolicyId(policyId: string | PolicyId): this {
        this.request.policyId = typeof policyId === 'string' ? toPolicyId(policyId) : policyId;
        return this;
    }

    withVersionHash(versionHash: string | VersionHash): this {
        this.request.versionHash = typeof versionHash === 'string' ? toVersionHash(versionHash) : versionHash;
        return this;
    }

    /**
     * Set policyId and versionHash from a policy object
     */
    forPolicy(policy: { id: PolicyId; versionHash: VersionHash }): this {
        this.request.policyId = policy.id;
        this.request.versionHash = policy.versionHash;
        return this;
    }

    build(): AcceptPolicyRequest {
        return { ...this.request };
    }
}
