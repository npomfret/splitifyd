import type { PolicyAcceptanceStatusDTO, UserPolicyStatusResponse } from '@billsplit-wl/shared';

export class UserPolicyStatusResponseBuilder {
    private response: UserPolicyStatusResponse;

    constructor() {
        this.response = {
            needsAcceptance: false,
            policies: [],
            totalPending: 0,
        };
    }

    withPolicies(policies: PolicyAcceptanceStatusDTO[]): this {
        this.response.policies = policies;
        this.response.totalPending = policies.filter(p => p.needsAcceptance).length;
        this.response.needsAcceptance = this.response.totalPending > 0;
        return this;
    }

    withNeedsAcceptance(needsAcceptance: boolean): this {
        this.response.needsAcceptance = needsAcceptance;
        return this;
    }

    withTotalPending(totalPending: number): this {
        this.response.totalPending = totalPending;
        return this;
    }

    /** Creates a response indicating all policies are accepted */
    allAccepted(): this {
        this.response.needsAcceptance = false;
        this.response.totalPending = 0;
        return this;
    }

    /** Creates a response indicating some policies need acceptance */
    hasPending(): this {
        this.response.needsAcceptance = true;
        if (this.response.totalPending === 0) {
            this.response.totalPending = this.response.policies.filter(p => p.needsAcceptance).length || 1;
        }
        return this;
    }

    build(): UserPolicyStatusResponse {
        return {
            needsAcceptance: this.response.needsAcceptance,
            policies: [...this.response.policies],
            totalPending: this.response.totalPending,
        };
    }
}
