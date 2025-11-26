import { describe, expect, it } from 'vitest';
import { validateUploadTenantAssetParams } from '../../tenant/validation';
import { HTTP_STATUS } from '../../constants';

describe('tenant/validation', () => {
    describe('validateUploadTenantAssetParams', () => {
        it('returns validated params for logo asset type', () => {
            const result = validateUploadTenantAssetParams({
                tenantId: 'tenant-123',
                assetType: 'logo',
            });

            expect(result.tenantId).toBe('tenant-123');
            expect(result.assetType).toBe('logo');
        });

        it('returns validated params for favicon asset type', () => {
            const result = validateUploadTenantAssetParams({
                tenantId: 'tenant-456',
                assetType: 'favicon',
            });

            expect(result.tenantId).toBe('tenant-456');
            expect(result.assetType).toBe('favicon');
        });

        it('throws ApiError for invalid asset type', () => {
            expect(() =>
                validateUploadTenantAssetParams({
                    tenantId: 'tenant-123',
                    assetType: 'invalid',
                }),
            ).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_ASSET_TYPE',
                }),
            );
        });

        it('throws ApiError for missing tenant ID', () => {
            expect(() =>
                validateUploadTenantAssetParams({
                    tenantId: '',
                    assetType: 'logo',
                }),
            ).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_TENANT_ID',
                }),
            );
        });

        it('throws ApiError when tenant ID is missing entirely', () => {
            expect(() =>
                validateUploadTenantAssetParams({
                    assetType: 'logo',
                }),
            ).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_TENANT_ID',
                }),
            );
        });

        it('throws ApiError when asset type is missing', () => {
            expect(() =>
                validateUploadTenantAssetParams({
                    tenantId: 'tenant-123',
                }),
            ).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_ASSET_TYPE',
                }),
            );
        });
    });
});
