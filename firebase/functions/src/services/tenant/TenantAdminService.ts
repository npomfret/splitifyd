import { type BrandingArtifactMetadata, type PublishTenantThemeResult, type TenantId, toTenantId } from '@billsplit-wl/shared';
import type { AdminUpsertTenantRequest } from '../../schemas/tenant';
import { Errors } from '../../errors';
import { ErrorDetail } from '../../errors';
import type { IFirestoreReader, IFirestoreWriter } from '../firestore';
import { ThemeArtifactService } from './ThemeArtifactService';

export class TenantAdminService {
    constructor(
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly firestoreReader: IFirestoreReader,
        private readonly themeArtifactService: ThemeArtifactService,
    ) {}

    async upsertTenant(request: AdminUpsertTenantRequest) {
        const { tenantId, ...rest } = request;

        // brandingTokens are required - no auto-generation
        // All design values must come from explicit configuration
        if (!rest.brandingTokens) {
            throw Errors.invalidRequest('brandingTokens must be provided - no auto-generation allowed');
        }

        return this.firestoreWriter.upsertTenant(tenantId, rest);
    }

    async publishTenantTheme(tenantId: TenantId, operatorId: string): Promise<PublishTenantThemeResult> {
        const record = await this.firestoreReader.getTenantById(toTenantId(tenantId));
        if (!record) {
            throw Errors.notFound('Tenant', ErrorDetail.TENANT_NOT_FOUND, tenantId);
        }

        const brandingTokens = record.tenant.brandingTokens;
        if (!brandingTokens?.tokens) {
            throw Errors.invalidRequest('Tenant is missing branding tokens');
        }

        const artifactResult = await this.themeArtifactService.generate(record.tenant.tenantId, brandingTokens.tokens);

        const nextVersion = (brandingTokens.artifact?.version ?? 0) + 1;
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
