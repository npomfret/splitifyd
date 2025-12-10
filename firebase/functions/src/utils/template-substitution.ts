import type { BrandingLegal } from '@billsplit-wl/shared';

export interface PolicyTemplateTokens {
    appName: string;
    companyName: string;
    supportEmail: string;
}

export const DEFAULT_POLICY_TOKENS: PolicyTemplateTokens = {
    appName: 'BillSplit',
    companyName: 'BillSplit',
    supportEmail: 'support@billsplit.app',
};

export function substitutePolicyTokens(text: string, tokens: PolicyTemplateTokens): string {
    return text
        .replace(/\{\{appName\}\}/g, tokens.appName)
        .replace(/\{\{companyName\}\}/g, tokens.companyName)
        .replace(/\{\{supportEmail\}\}/g, tokens.supportEmail);
}

export function brandingLegalToTokens(legal: BrandingLegal | undefined): PolicyTemplateTokens {
    if (!legal) return DEFAULT_POLICY_TOKENS;
    return {
        appName: legal.appName || DEFAULT_POLICY_TOKENS.appName,
        companyName: legal.companyName || DEFAULT_POLICY_TOKENS.companyName,
        supportEmail: legal.supportEmail || DEFAULT_POLICY_TOKENS.supportEmail,
    };
}
