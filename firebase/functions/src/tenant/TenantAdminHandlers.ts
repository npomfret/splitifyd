import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { AdminUpsertTenantRequestSchema, PublishTenantThemeRequestSchema } from '../schemas/tenant';
import type { IFirestoreReader } from '../services/firestore/IFirestoreReader';
import type { TenantAssetStorage } from '../services/storage/TenantAssetStorage';
import { TenantAdminService } from '../services/tenant/TenantAdminService';
import { ApiError } from '../utils/errors';
import { validateFaviconImage, validateLogoImage } from '../utils/validation/imageValidation';
import { validateUploadTenantAssetParams } from './validation';

export class TenantAdminHandlers {
    constructor(
        private readonly tenantAdminService: TenantAdminService,
        private readonly tenantAssetStorage: TenantAssetStorage,
        private readonly firestoreReader: IFirestoreReader,
    ) {}

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

    publishTenantTheme: RequestHandler = async (req, res) => {
        const parseResult = PublishTenantThemeRequestSchema.safeParse(req.body);

        if (!parseResult.success) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_TENANT_ID', 'Tenant ID is required', {
                issues: parseResult.error.issues,
            });
        }

        const operatorId = (req as AuthenticatedRequest).user?.uid ?? 'system';

        const result = await this.tenantAdminService.publishTenantTheme(parseResult.data.tenantId, operatorId);

        res.status(HTTP_STATUS.OK).json(result);
    };

    uploadTenantImage: RequestHandler = async (req, res) => {
        // Validate params using schema
        const { tenantId, assetType } = validateUploadTenantAssetParams(req.params);

        // Validate request has file data
        if (!req.body || req.body.length === 0) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_FILE', 'No file data provided');
        }

        const contentType = req.headers['content-type'];
        const buffer = req.body as Buffer;

        // Validate image based on asset type
        if (assetType === 'logo') {
            validateLogoImage(buffer, contentType);
        } else {
            validateFaviconImage(buffer, contentType);
        }

        // Fetch current tenant to get old URL for cleanup
        let oldUrl: string | undefined;
        try {
            const tenantRecord = await this.firestoreReader.getTenantById(tenantId as any);
            if (tenantRecord) {
                oldUrl = assetType === 'logo' ? tenantRecord.tenant.branding.logoUrl : tenantRecord.tenant.branding.faviconUrl;
            }
        } catch (error) {
            // Non-fatal - continue without cleanup if tenant lookup fails
        }

        // Upload to storage (with automatic cleanup of old asset)
        const url = await this.tenantAssetStorage.uploadAsset(tenantId, assetType, buffer, contentType!, oldUrl);

        res.status(HTTP_STATUS.OK).json({ url });
    };
}
