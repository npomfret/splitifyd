import type { BrandingTokens } from '@billsplit-wl/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ThemeArtifactStorage } from '../../../../services/storage/ThemeArtifactStorage';
import { ThemeArtifactService } from '../../../../services/tenant/ThemeArtifactService';

// Simple stub for storage - returns fixed URLs
class StubThemeArtifactStorage implements ThemeArtifactStorage {
    public lastSavedData: { tenantId: string; hash: string; cssContent: string; tokensJson: string; } | null = null;

    async save(data: { tenantId: string; hash: string; cssContent: string; tokensJson: string; }) {
        this.lastSavedData = data;
        return {
            cssUrl: 'https://storage.example.com/theme.css',
            tokensUrl: 'https://storage.example.com/tokens.json',
        };
    }
}

describe('ThemeArtifactService', () => {
    let service: ThemeArtifactService;
    let storage: StubThemeArtifactStorage;

    const mockTokens: BrandingTokens = {
        version: 1,
        palette: {
            primary: '#0066cc',
            primaryVariant: '#0052a3',
            secondary: '#ff6600',
            secondaryVariant: '#cc5200',
            accent: '#00cc99',
            neutral: '#666666',
            neutralVariant: '#888888',
            success: '#28a745',
            warning: '#ffc107',
            danger: '#dc3545',
            info: '#17a2b8',
        },
        typography: {
            fontFamily: {
                sans: 'Inter, system-ui, sans-serif',
                serif: 'Georgia, serif',
                mono: 'Fira Code, monospace',
            },
            sizes: {
                xs: '0.75rem',
                sm: '0.875rem',
                md: '1rem',
                lg: '1.125rem',
                xl: '1.25rem',
                '2xl': '1.5rem',
                '3xl': '1.875rem',
                '4xl': '2.25rem',
                '5xl': '3rem',
            },
            weights: {
                regular: 400,
                medium: 500,
                semibold: 600,
                bold: 700,
            },
            lineHeights: {
                compact: '1.25rem',
                standard: '1.5rem',
                spacious: '1.75rem',
            },
            letterSpacing: {
                tight: '-0.01rem',
                normal: '0rem',
                wide: '0.05rem',
            },
            semantics: {
                body: 'md',
                bodyStrong: 'md',
                caption: 'sm',
                button: 'md',
                eyebrow: 'xs',
                heading: 'xl',
                display: '3xl',
            },
        },
        spacing: {
            '2xs': '0.25rem',
            xs: '0.5rem',
            sm: '0.75rem',
            md: '1rem',
            lg: '1.5rem',
            xl: '2rem',
            '2xl': '3rem',
        },
        radii: {
            none: '0rem',
            sm: '0.125rem',
            md: '0.25rem',
            lg: '0.5rem',
            pill: '9999px',
            full: '50rem',
        },
        shadows: {
            sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        },
        assets: {
            logoUrl: 'https://example.com/logo.svg',
            faviconUrl: 'https://example.com/favicon.ico',
            wordmarkUrl: 'https://example.com/wordmark.svg',
        },
        legal: {
            companyName: 'Test Company',
            supportEmail: 'support@example.com',
            privacyPolicyUrl: 'https://example.com/privacy',
            termsOfServiceUrl: 'https://example.com/terms',
        },
        semantics: {
            colors: {
                surface: {
                    base: '#ffffff',
                    raised: '#f9f9f9',
                    sunken: '#f0f0f0',
                    overlay: '#000000',
                    warning: '#fffacd',
                },
                text: {
                    primary: '#000000',
                    secondary: '#666666',
                    muted: '#999999',
                    inverted: '#ffffff',
                    accent: '#0066cc',
                },
                interactive: {
                    primary: '#0066cc',
                    primaryHover: '#0052a3',
                    primaryActive: '#003d7a',
                    primaryForeground: '#ffffff',
                    secondary: '#f0f0f0',
                    secondaryHover: '#e0e0e0',
                    secondaryActive: '#d0d0d0',
                    secondaryForeground: '#000000',
                    accent: '#22c55e',
                    destructive: '#dc3545',
                    destructiveHover: '#c82333',
                    destructiveActive: '#bd2130',
                    destructiveForeground: '#ffffff',
                },
                border: {
                    subtle: '#f0f0f0',
                    default: '#d0d0d0',
                    strong: '#999999',
                    focus: '#0066cc',
                    warning: '#ffd700',
                },
                status: {
                    success: '#28a745',
                    warning: '#ffc107',
                    danger: '#dc3545',
                    info: '#17a2b8',
                },
            },
            spacing: {
                pagePadding: '1rem',
                sectionGap: '2rem',
                cardPadding: '1.5rem',
                componentGap: '0.5rem',
            },
            typography: {
                body: 'md',
                bodyStrong: 'md',
                caption: 'sm',
                button: 'md',
                eyebrow: 'xs',
                heading: 'xl',
                display: '3xl',
            },
        },
    };

    beforeEach(() => {
        storage = new StubThemeArtifactStorage();
        service = new ThemeArtifactService(storage);
    });

    describe('generate', () => {
        it('should generate CSS and tokens artifacts', async () => {
            const result = await service.generate('test-tenant', mockTokens);

            expect(result).toHaveProperty('hash');
            expect(result).toHaveProperty('cssContent');
            expect(result).toHaveProperty('tokensJson');
            expect(result).toHaveProperty('cssUrl');
            expect(result).toHaveProperty('tokensUrl');
            expect(result).toHaveProperty('generatedAtEpochMs');
            expect(result).toHaveProperty('bytes');
        });

        it('should compute deterministic hash from CSS and tokens', async () => {
            const result1 = await service.generate('test-tenant', mockTokens);
            const result2 = await service.generate('test-tenant', mockTokens);

            expect(result1.hash).toBe(result2.hash);
        });

        it('should produce different hashes for different tokens', async () => {
            const result1 = await service.generate('test-tenant', mockTokens);

            const differentTokens: BrandingTokens = { ...mockTokens, palette: { ...mockTokens.palette, primary: '#ff0000' as `#${string}` } };
            const result2 = await service.generate('test-tenant', differentTokens);

            expect(result1.hash).not.toBe(result2.hash);
        });

        it('should save artifacts via storage', async () => {
            await service.generate('test-tenant', mockTokens);

            expect(storage.lastSavedData).not.toBeNull();
            expect(storage.lastSavedData).toMatchObject({
                tenantId: 'test-tenant',
                hash: expect.any(String),
                cssContent: expect.any(String),
                tokensJson: expect.any(String),
            });
        });

        it('should return URLs from storage', async () => {
            const result = await service.generate('test-tenant', mockTokens);

            expect(result.cssUrl).toBe('https://storage.example.com/theme.css');
            expect(result.tokensUrl).toBe('https://storage.example.com/tokens.json');
        });

        it('should format tokens as pretty-printed JSON', async () => {
            const result = await service.generate('test-tenant', mockTokens);

            const parsed = JSON.parse(result.tokensJson);
            expect(parsed).toEqual(mockTokens);

            // Check it's pretty-printed (has newlines and indentation)
            expect(result.tokensJson).toContain('\n');
            expect(result.tokensJson).toContain('  ');
        });

        it('should generate valid CSS with :root selector', async () => {
            const result = await service.generate('test-tenant', mockTokens);

            expect(result.cssContent).toContain('/* Auto-generated theme CSS */');
            expect(result.cssContent).toContain(':root {');
            expect(result.cssContent).toMatch(/--[\w-]+:\s*[^;]+;/); // CSS variable pattern
            expect(result.cssContent).toContain('}');
        });

        it('should flatten nested tokens into CSS variables', async () => {
            const result = await service.generate('test-tenant', mockTokens);

            // Palette colors should be flattened
            expect(result.cssContent).toContain('--palette-primary: #0066cc');
            expect(result.cssContent).toContain('--palette-secondary: #ff6600');

            // Typography should be flattened
            expect(result.cssContent).toContain('--typography-sizes-md: 1rem');
            expect(result.cssContent).toContain('--typography-weights-bold: 700');

            // Spacing should be flattened
            expect(result.cssContent).toContain('--spacing-md: 1rem');
        });

        it('should sort CSS variables alphabetically', async () => {
            const result = await service.generate('test-tenant', mockTokens);

            const lines = result.cssContent.split('\n').filter((line) => line.includes('--'));
            const variables = lines.map((line) => line.trim().split(':')[0]);

            const sorted = [...variables].sort();
            expect(variables).toEqual(sorted);
        });

        it('should handle nested objects in tokens', async () => {
            const result = await service.generate('test-tenant', mockTokens);

            // Semantics colors are deeply nested
            expect(result.cssContent).toContain('--semantics-colors-surface-base: #ffffff');
            expect(result.cssContent).toContain('--semantics-colors-text-primary: #000000');
            expect(result.cssContent).toContain('--semantics-colors-interactive-primary: #0066cc');
        });

        it('should handle numeric values in tokens', async () => {
            const result = await service.generate('test-tenant', mockTokens);

            // Typography weights are numbers
            expect(result.cssContent).toContain('--typography-weights-regular: 400');
            expect(result.cssContent).toContain('--typography-weights-bold: 700');
        });

        it('should normalize CSS variable names', async () => {
            const result = await service.generate('test-tenant', mockTokens);

            // Special characters should be normalized to hyphens
            expect(result.cssContent).toContain('--spacing-2xs:');
            expect(result.cssContent).toContain('--typography-sizes-2xl:');
        });

        it('should skip null and undefined values', async () => {
            const tokensWithNulls = {
                ...mockTokens,
                assets: {
                    ...mockTokens.assets,
                    wordmarkUrl: undefined,
                },
            };

            const result = await service.generate('test-tenant', tokensWithNulls);

            expect(result.cssContent).not.toContain('wordmark');
        });

        it('should record byte sizes', async () => {
            const result = await service.generate('test-tenant', mockTokens);

            expect(result.bytes.css).toBeGreaterThan(0);
            expect(result.bytes.tokens).toBeGreaterThan(0);
            expect(typeof result.bytes.css).toBe('number');
            expect(typeof result.bytes.tokens).toBe('number');
        });

        it('should record generation timestamp', async () => {
            const before = Date.now();
            const result = await service.generate('test-tenant', mockTokens);
            const after = Date.now();

            expect(result.generatedAtEpochMs).toBeGreaterThanOrEqual(before);
            expect(result.generatedAtEpochMs).toBeLessThanOrEqual(after);
        });

        it('should generate motion feature flag CSS variables when motion is defined', async () => {
            const tokensWithMotion: BrandingTokens = {
                ...mockTokens,
                motion: {
                    enableParallax: true,
                    enableMagneticHover: false,
                    enableScrollReveal: true,
                },
            };

            const result = await service.generate('test-tenant', tokensWithMotion);

            expect(result.cssContent).toContain('--motion-enable-parallax: true');
            expect(result.cssContent).toContain('--motion-enable-magnetic-hover: false');
            expect(result.cssContent).toContain('--motion-enable-scroll-reveal: true');
        });

        it('should propagate storage errors', async () => {
            const error = new Error('Storage failed');
            const failingStorage = new StubThemeArtifactStorage();
            failingStorage.save = async () => {
                throw error;
            };
            const failingService = new ThemeArtifactService(failingStorage);

            await expect(failingService.generate('test-tenant', mockTokens)).rejects.toThrow('Storage failed');
        });

        it('should handle minimal token set', async () => {
            const minimalTokens: BrandingTokens = {
                version: 1,
                palette: {
                    primary: '#000000',
                    primaryVariant: '#000000',
                    secondary: '#000000',
                    secondaryVariant: '#000000',
                    accent: '#000000',
                    neutral: '#000000',
                    neutralVariant: '#000000',
                    success: '#000000',
                    warning: '#000000',
                    danger: '#000000',
                    info: '#000000',
                },
                typography: mockTokens.typography,
                spacing: mockTokens.spacing,
                radii: mockTokens.radii,
                shadows: mockTokens.shadows,
                assets: mockTokens.assets,
                legal: mockTokens.legal,
                semantics: mockTokens.semantics,
            };

            const result = await service.generate('test-tenant', minimalTokens);

            expect(result.cssContent).toContain(':root {');
            expect(result.cssContent).toContain('--palette-primary: #000000');
        });
    });
});
