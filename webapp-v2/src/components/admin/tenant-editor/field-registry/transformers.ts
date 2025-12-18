import type { BrandingTokens, TenantBranding } from '@billsplit-wl/shared';
import type { TenantData } from '../types';
import type { AnyFieldDef } from './field-types';
import { FIELD_REGISTRY } from './registry';

function getByPath(obj: unknown, path: string): unknown {
    return path.split('.').reduce((cur: unknown, key: string) => {
        if (cur === null || cur === undefined) return undefined;
        return (cur as Record<string, unknown>)[key];
    }, obj);
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    const last = keys.pop()!;
    const target = keys.reduce((cur: Record<string, unknown>, k: string) => {
        if (!(k in cur)) {
            cur[k] = {};
        }
        return cur[k] as Record<string, unknown>;
    }, obj);
    target[last] = value;
}

export function extractFormDataFromTokens(tokens: BrandingTokens): Partial<TenantData> {
    const result: Partial<TenantData> = {};

    for (const field of FIELD_REGISTRY) {
        // Skip marketing flags - they're handled separately
        if (field.tokenPath.startsWith('_marketingFlags')) {
            continue;
        }

        const value = getByPath(tokens, field.tokenPath);

        if (field.type === 'colorArray') {
            (result as Record<string, unknown>)[field.key] = Array.isArray(value) ? value : [];
        } else if (field.type === 'number') {
            (result as Record<string, unknown>)[field.key] = typeof value === 'number' ? value : 0;
        } else if (field.type === 'boolean') {
            (result as Record<string, unknown>)[field.key] = value ?? field.default;
        } else {
            (result as Record<string, unknown>)[field.key] = value ?? '';
        }
    }

    // Handle legacy appName location
    result.appName = tokens.legal?.appName || '';

    // Handle assets (not in registry)
    result.logoUrl = tokens.assets?.logoUrl || '';
    result.faviconUrl = tokens.assets?.faviconUrl || '';

    return result;
}

type TypographySize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';

function shouldIncludeOptionalField(field: AnyFieldDef, value: unknown): boolean {
    if (field.required) return true;

    if (field.type === 'colorArray') {
        return Array.isArray(value) && value.length >= (field.minColors || 0);
    }

    if (field.type === 'string' || field.type === 'color' || field.type === 'rgba') {
        return typeof value === 'string' && value.trim() !== '';
    }

    return value !== undefined && value !== null && value !== '';
}

export function buildBrandingTokensFromForm(formData: TenantData): TenantBranding {
    const tokens: Record<string, unknown> = {
        version: 1,
    };

    for (const field of FIELD_REGISTRY) {
        // Skip marketing flags - they're handled separately
        if (field.tokenPath.startsWith('_marketingFlags')) {
            continue;
        }

        const value = formData[field.key as keyof TenantData];

        // Skip optional fields with empty values
        if (!shouldIncludeOptionalField(field, value)) {
            continue;
        }

        // Handle special cases for type casting
        if (field.type === 'colorArray') {
            // Special handling for aurora - only include if parallax is enabled
            if (field.key === 'auroraGradient') {
                if (formData.enableParallax && Array.isArray(value) && value.length >= 2) {
                    setByPath(tokens, field.tokenPath, value);
                }
            } else if (Array.isArray(value) && value.length === 2) {
                setByPath(tokens, field.tokenPath, value);
            }
        } else if (field.type === 'select') {
            // Typography semantic sizes need to be cast
            setByPath(tokens, field.tokenPath, value as TypographySize);
        } else {
            setByPath(tokens, field.tokenPath, value);
        }
    }

    // Handle assets specially (not in registry)
    tokens.assets = {
        logoUrl: formData.logoUrl,
        ...(formData.faviconUrl ? { faviconUrl: formData.faviconUrl } : {}),
    };

    // Handle legal specially - appName goes here
    if (!tokens.legal) {
        tokens.legal = {};
    }
    (tokens.legal as Record<string, unknown>).appName = formData.appName;

    // Copy typography.semantics to semantics.typography (server expects both)
    const typographySemantics = getByPath(tokens, 'typography.semantics') as Record<string, unknown> | undefined;
    if (typographySemantics) {
        setByPath(tokens, 'semantics.typography', { ...typographySemantics });
    }

    return { tokens: tokens as BrandingTokens };
}
