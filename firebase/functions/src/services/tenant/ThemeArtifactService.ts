import type { BrandingTokens } from '@splitifyd/shared';
import { computeSha256, ThemeArtifactStorage } from '../storage/ThemeArtifactStorage';

export interface ThemeArtifactResult {
    hash: string;
    cssContent: string;
    tokensJson: string;
    cssUrl: string;
    tokensUrl: string;
    generatedAtEpochMs: number;
    bytes: {
        css: number;
        tokens: number;
    };
}

export class ThemeArtifactService {
    constructor(private readonly storage: ThemeArtifactStorage) {}

    async generate(tenantId: string, tokens: BrandingTokens): Promise<ThemeArtifactResult> {
        const tokensJson = JSON.stringify(tokens, null, 2);
        const cssContent = this.buildCss(tokens);
        const hash = computeSha256(cssContent + tokensJson);
        const { cssUrl, tokensUrl } = await this.storage.save({
            tenantId,
            hash,
            cssContent,
            tokensJson,
        });

        const generatedAtEpochMs = Date.now();

        return {
            hash,
            cssContent,
            tokensJson,
            cssUrl,
            tokensUrl,
            generatedAtEpochMs,
            bytes: {
                css: Buffer.byteLength(cssContent, 'utf8'),
                tokens: Buffer.byteLength(tokensJson, 'utf8'),
            },
        };
    }

    private buildCss(tokens: BrandingTokens): string {
        const sections: string[] = [];
        sections.push('/* Auto-generated theme CSS */');
        sections.push(':root {');

        for (const [name, value] of this.flattenTokens(tokens)) {
            sections.push(`  --${name}: ${value};`);
        }

        sections.push('}');

        return sections.join('\n') + '\n';
    }

    private flattenTokens(tokens: BrandingTokens): Array<[string, string]> {
        const entries: Array<[string, string]> = [];

        const walk = (obj: any, prefix: string[]) => {
            Object.entries(obj).forEach(([key, value]) => {
                const nextPrefix = [...prefix, key]
                    .map((segment) => segment.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase())
                    .filter(Boolean);

                if (value === null || value === undefined) {
                    return;
                }

                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                    const normalizedValue = typeof value === 'string' ? value : String(value);
                    entries.push([nextPrefix.join('-'), normalizedValue]);
                    return;
                }

                if (Array.isArray(value)) {
                    value.forEach((item, index) => walk(item, [...prefix, `${key}-${index}`]));
                    return;
                }

                walk(value, [...prefix, key]);
            });
        };

        walk(tokens, []);

        entries.sort((a, b) => a[0].localeCompare(b[0]));
        return entries;
    }
}
