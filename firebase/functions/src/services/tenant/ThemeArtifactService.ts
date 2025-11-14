import type { BrandingTokens } from '@splitifyd/shared';
import { computeSha256, ThemeArtifactStorage } from '../storage/ThemeArtifactStorage';

interface ThemeArtifactResult {
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

        const allVariables: Array<[string, string]> = [];

        for (const [name, value] of this.flattenTokens(tokens)) {
            allVariables.push([name, value]);
        }

        for (const [name, rgbValue] of this.generateRgbVariants(tokens)) {
            allVariables.push([`${name}-rgb`, rgbValue]);
        }

        allVariables.sort((a, b) => a[0].localeCompare(b[0]));

        for (const [name, value] of allVariables) {
            sections.push(`  --${name}: ${value};`);
        }

        sections.push('}');

        return sections.join('\n') + '\n';
    }

    private hexToRgb(hex: string): string {
        const clean = hex.replace('#', '');
        const chunk = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
        const r = parseInt(chunk.slice(0, 2), 16);
        const g = parseInt(chunk.slice(2, 4), 16);
        const b = parseInt(chunk.slice(4, 6), 16);
        return `${r} ${g} ${b}`;
    }

    private generateRgbVariants(tokens: BrandingTokens): Array<[string, string]> {
        const entries: Array<[string, string]> = [];
        const { colors } = tokens.semantics;

        const generateFromObject = (obj: any, prefix: string[]) => {
            Object.entries(obj).forEach(([key, value]) => {
                const kebabKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

                if (typeof value === 'string' && value.startsWith('#')) {
                    const varName = [...prefix, kebabKey].join('-');
                    entries.push([varName, this.hexToRgb(value)]);
                } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                    generateFromObject(value, [...prefix, kebabKey]);
                }
            });
        };

        generateFromObject(colors, []);

        entries.push(['semantic-success', this.hexToRgb(colors.status.success)]);
        entries.push(['semantic-warning', this.hexToRgb(colors.status.warning)]);
        entries.push(['surface-muted', this.hexToRgb(colors.surface.raised)]);

        return entries;
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
