import { toPolicyId } from '@billsplit-wl/shared';
import type { Request, RequestHandler } from 'express';
import { ErrorDetail } from '../errors';
import { Errors } from '../errors';
import type { PolicyService } from '../services/PolicyService';
import type { TenantRegistryService } from '../services/tenant/TenantRegistryService';
import { brandingLegalToTokens, type PolicyTemplateTokens, substitutePolicyTokens } from '../utils/template-substitution';

export class PolicyTextHandlers {
    constructor(
        private readonly policyService: PolicyService,
        private readonly tenantRegistry: TenantRegistryService,
    ) {}

    private async resolveTokens(req: Request): Promise<PolicyTemplateTokens> {
        const host = (req.headers['x-forwarded-host'] as string | undefined)
            ?? req.headers.host
            ?? req.hostname
            ?? null;

        const tenantContext = await this.tenantRegistry.resolveTenant({ host });
        const legal = tenantContext.config?.brandingTokens?.tokens?.legal;
        if (!legal) {
            throw Errors.serviceError(ErrorDetail.TENANT_MISSING_CONFIG);
        }
        return brandingLegalToTokens(legal);
    }

    getPrivacyPolicyText: RequestHandler = async (req, res) => {
        const result = await this.policyService.getCurrentPolicy(toPolicyId('privacy-policy'));
        const tokens = await this.resolveTokens(req);
        const substitutedText = substitutePolicyTokens(result.text, tokens);
        res.type('text/plain').send(substitutedText);
    };

    getTermsOfServiceText: RequestHandler = async (req, res) => {
        const result = await this.policyService.getCurrentPolicy(toPolicyId('terms-of-service'));
        const tokens = await this.resolveTokens(req);
        const substitutedText = substitutePolicyTokens(result.text, tokens);
        res.type('text/plain').send(substitutedText);
    };

    getCookiePolicyText: RequestHandler = async (req, res) => {
        const result = await this.policyService.getCurrentPolicy(toPolicyId('cookie-policy'));
        const tokens = await this.resolveTokens(req);
        const substitutedText = substitutePolicyTokens(result.text, tokens);
        res.type('text/plain').send(substitutedText);
    };
}
