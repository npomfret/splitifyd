import type { RequestHandler } from 'express';
import { HTTP_STATUS } from '../constants';
import { AdminUpsertTenantRequestSchema } from '../schemas/tenant';
import { TenantAdminService } from '../services/tenant/TenantAdminService';
import { ApiError } from '../utils/errors';

export class TenantAdminHandlers {
    constructor(private readonly tenantAdminService: TenantAdminService) {}

    upsertTenant: RequestHandler = async (req, res) => {
        const parseResult = AdminUpsertTenantRequestSchema.safeParse(req.body);

        if (!parseResult.success) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_TENANT_PAYLOAD', 'Tenant payload failed validation', {
                issues: parseResult.error.issues,
            });
        }

        const result = await this.tenantAdminService.upsertTenant(parseResult.data);

        res.status(result.created ? HTTP_STATUS.CREATED : HTTP_STATUS.OK).json({
            tenantId: result.id,
            created: result.created,
        });
    };
}
