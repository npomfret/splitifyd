import type { UpdateUserStatusRequest } from '@billsplit-wl/shared';

/**
 * Builder for UpdateUserStatusRequest objects used in user admin tests
 */
export class UpdateUserStatusRequestBuilder {
    private request: UpdateUserStatusRequest;

    constructor() {
        this.request = {
            disabled: false,
        };
    }

    static empty(): UpdateUserStatusRequestBuilder {
        return new UpdateUserStatusRequestBuilder();
    }

    withDisabled(disabled: boolean): this {
        this.request.disabled = disabled;
        return this;
    }

    asDisabled(): this {
        this.request.disabled = true;
        return this;
    }

    asEnabled(): this {
        this.request.disabled = false;
        return this;
    }

    build(): UpdateUserStatusRequest {
        return { ...this.request };
    }
}
