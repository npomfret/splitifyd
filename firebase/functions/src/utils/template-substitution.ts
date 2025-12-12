import type { BrandingLegal } from '@billsplit-wl/shared';

export interface PolicyTemplateTokens {
    appName: string;
    companyName: string;
    supportEmail: string;
}

export function substitutePolicyTokens(text: string, tokens: PolicyTemplateTokens): string {
    return text
        .replace(/\{\{appName\}\}/g, tokens.appName)
        .replace(/\{\{companyName\}\}/g, tokens.companyName)
        .replace(/\{\{supportEmail\}\}/g, tokens.supportEmail);
}

export function brandingLegalToTokens(legal: BrandingLegal): PolicyTemplateTokens {
    if (!legal.appName || !legal.companyName || !legal.supportEmail) {
        throw new Error('BrandingLegal must have appName, companyName, and supportEmail');
    }
    return {
        appName: legal.appName,
        companyName: legal.companyName,
        supportEmail: legal.supportEmail,
    };
}
