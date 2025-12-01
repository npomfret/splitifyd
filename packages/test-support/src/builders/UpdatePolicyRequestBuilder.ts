import type { PolicyText, UpdatePolicyRequest } from '@billsplit-wl/shared';
import { toPolicyText } from '@billsplit-wl/shared';

/**
 * Builder for UpdatePolicyRequest objects used in policy update tests
 */
export class UpdatePolicyRequestBuilder {
    private request: UpdatePolicyRequest;

    constructor() {
        this.request = {
            text: toPolicyText('Updated policy text for testing.'),
        };
    }

    static empty(): UpdatePolicyRequestBuilder {
        return new UpdatePolicyRequestBuilder();
    }

    withText(text: string | PolicyText): this {
        this.request.text = typeof text === 'string' ? toPolicyText(text) : text;
        return this;
    }

    withPublish(publish: boolean): this {
        this.request.publish = publish;
        return this;
    }

    asDraft(): this {
        this.request.publish = false;
        return this;
    }

    asPublished(): this {
        this.request.publish = true;
        return this;
    }

    build(): UpdatePolicyRequest {
        return { ...this.request };
    }
}
