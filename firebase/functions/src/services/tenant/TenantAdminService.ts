import { type BrandingArtifactMetadata, type PublishTenantThemeResult, type TenantId, toTenantId } from '@billsplit-wl/shared';
import { HTTP_STATUS } from '../../constants';
import type { AdminUpsertTenantRequest } from '../../schemas/tenant';
import { ApiError } from '../../utils/errors';
import type { IFirestoreReader, IFirestoreWriter } from '../firestore';
import { generateBrandingTokens } from './BrandingTokensGenerator';
import { ThemeArtifactService } from './ThemeArtifactService';

export class TenantAdminService {
    constructor(
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly firestoreReader: IFirestoreReader,
        private readonly themeArtifactService: ThemeArtifactService,
    ) {}

    async upsertTenant(request: AdminUpsertTenantRequest) {
        const { tenantId, ...rest } = request;

        // If brandingTokens are not provided, generate them from branding colors
        // This ensures tokens are always in sync with branding configuration
        const dataToUpsert = {
            ...rest,
            brandingTokens: rest.brandingTokens || generateBrandingTokens(rest.branding),
        };

        return this.firestoreWriter.upsertTenant(tenantId, dataToUpsert);
    }

    async publishTenantTheme(tenantId: TenantId, operatorId: string): Promise<PublishTenantThemeResult> {
        const record = await this.firestoreReader.getTenantById(toTenantId(tenantId));
        if (!record) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'TENANT_NOT_FOUND', 'Tenant not found');
        }

        if (!record.brandingTokens?.tokens) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'TENANT_TOKENS_MISSING', 'Tenant is missing branding tokens');
        }

        const artifactResult = await this.themeArtifactService.generate(record.tenant.tenantId, record.brandingTokens.tokens);

        const nextVersion = (record.brandingTokens.artifact?.version ?? 0) + 1;
        const metadata: BrandingArtifactMetadata = {
            hash: artifactResult.hash,
            cssUrl: artifactResult.cssUrl,
            tokensUrl: artifactResult.tokensUrl,
            version: nextVersion,
            generatedAtEpochMs: artifactResult.generatedAtEpochMs,
            generatedBy: operatorId,
        };

        await this.firestoreWriter.updateTenantThemeArtifact(record.tenant.tenantId, metadata);

        return {
            artifact: metadata,
            cssUrl: artifactResult.cssUrl,
            tokensUrl: artifactResult.tokensUrl,
        };
    }
}
