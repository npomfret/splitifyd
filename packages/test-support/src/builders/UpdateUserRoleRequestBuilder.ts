import type { SystemUserRole, UpdateUserRoleRequest } from '@billsplit-wl/shared';
import { SystemUserRoles } from '@billsplit-wl/shared';

/**
 * Builder for UpdateUserRoleRequest objects used in user admin tests
 */
export class UpdateUserRoleRequestBuilder {
    private request: UpdateUserRoleRequest;

    constructor() {
        this.request = {
            role: SystemUserRoles.SYSTEM_USER,
        };
    }

    static empty(): UpdateUserRoleRequestBuilder {
        return new UpdateUserRoleRequestBuilder();
    }

    withRole(role: SystemUserRole | null): this {
        this.request.role = role;
        return this;
    }

    asSystemAdmin(): this {
        this.request.role = SystemUserRoles.SYSTEM_ADMIN;
        return this;
    }

    asTenantAdmin(): this {
        this.request.role = SystemUserRoles.TENANT_ADMIN;
        return this;
    }

    asSystemUser(): this {
        this.request.role = SystemUserRoles.SYSTEM_USER;
        return this;
    }

    asNoRole(): this {
        this.request.role = null;
        return this;
    }

    build(): UpdateUserRoleRequest {
        return { ...this.request };
    }
}
