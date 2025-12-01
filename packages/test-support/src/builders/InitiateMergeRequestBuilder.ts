import type { InitiateMergeRequest, UserId } from '@billsplit-wl/shared';
import { toUserId } from '@billsplit-wl/shared';

/**
 * Builder for InitiateMergeRequest objects used in account merge tests
 */
export class InitiateMergeRequestBuilder {
    private request: InitiateMergeRequest;

    constructor() {
        this.request = {
            secondaryUserId: toUserId('secondary-user-id'),
        };
    }

    static empty(): InitiateMergeRequestBuilder {
        return new InitiateMergeRequestBuilder();
    }

    withSecondaryUserId(userId: string | UserId): this {
        this.request.secondaryUserId = typeof userId === 'string' ? toUserId(userId) : userId;
        return this;
    }

    build(): InitiateMergeRequest {
        return { ...this.request };
    }
}
