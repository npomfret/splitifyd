import type { CreatePolicyRequest, PolicyName, PolicyText } from '@billsplit-wl/shared';
import { toPolicyName, toPolicyText } from '@billsplit-wl/shared';

/**
 * Builder for CreatePolicyRequest objects used in policy creation tests
 */
export class CreatePolicyRequestBuilder {
    private request: CreatePolicyRequest;

    constructor() {
        this.request = {
            policyName: toPolicyName('Test Policy'),
            text: toPolicyText('Default policy text for testing.'),
        };
    }

    withPolicyName(name: string | PolicyName): this {
        this.request.policyName = typeof name === 'string' ? toPolicyName(name) : name;
        return this;
    }

    withText(text: string | PolicyText): this {
        this.request.text = typeof text === 'string' ? toPolicyText(text) : text;
        return this;
    }

    build(): CreatePolicyRequest {
        return { ...this.request };
    }
}
