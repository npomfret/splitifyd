import { UploadTenantAssetParamsSchema } from '../schemas/tenant';
import { createRequestValidator, createZodErrorMapper } from '../validation/common';

// Error mapper for upload tenant asset params validation
const mapUploadAssetParamsError = createZodErrorMapper(
    {
        assetType: {
            code: 'INVALID_ASSET_TYPE',
            message: () => 'Asset type must be "logo" or "favicon"',
        },
        tenantId: {
            code: 'INVALID_TENANT_ID',
            message: () => 'Tenant ID is required',
        },
    },
    {
        defaultCode: 'INVALID_REQUEST',
        defaultMessage: (issue) => issue.message,
    },
);

// Validator for upload tenant asset params
export const validateUploadTenantAssetParams = createRequestValidator({
    schema: UploadTenantAssetParamsSchema,
    mapError: (error) => mapUploadAssetParamsError(error),
});
