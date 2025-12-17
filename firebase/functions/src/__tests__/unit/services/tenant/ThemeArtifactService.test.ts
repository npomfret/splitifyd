import type { BrandingTokens } from '@billsplit-wl/shared';
import { BrandingTokensBuilder } from '@billsplit-wl/test-support';
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
    let mockTokens: BrandingTokens;

    beforeEach(() => {
        mockTokens = new BrandingTokensBuilder().build();
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

            const differentTokens = new BrandingTokensBuilder()
                .withPrimaryColor('#ff0000')
                .build();
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

            // Palette colors should be flattened (using builder defaults)
            expect(result.cssContent).toContain('--palette-primary: #2563eb');
            expect(result.cssContent).toContain('--palette-secondary: #7c3aed');

            // Typography should be flattened
            expect(result.cssContent).toContain('--typography-sizes-md: 1rem');
            expect(result.cssContent).toContain('--typography-weights-bold: 700');

            // Spacing should be flattened (builder default for md is 0.75rem)
            expect(result.cssContent).toContain('--spacing-md: 0.75rem');
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

            // Semantics colors are deeply nested (using builder defaults)
            expect(result.cssContent).toContain('--semantics-colors-surface-base: #f8fafc');
            expect(result.cssContent).toContain('--semantics-colors-text-primary: #0f172a');
            expect(result.cssContent).toContain('--semantics-colors-interactive-primary: #2563eb');
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

        it('should skip undefined optional values', async () => {
            const tokens = new BrandingTokensBuilder().build();
            const result = await service.generate('test-tenant', tokens);

            // CSS should not contain undefined/null string values
            expect(result.cssContent).not.toContain('undefined');
            expect(result.cssContent).not.toContain('null');
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
            const tokensWithMotion = new BrandingTokensBuilder()
                .withMotionFlags({
                    enableParallax: true,
                    enableMagneticHover: false,
                    enableScrollReveal: true,
                })
                .build();

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
            const minimalTokens = new BrandingTokensBuilder()
                .withAllPaletteColors('#000000')
                .build();

            const result = await service.generate('test-tenant', minimalTokens);

            expect(result.cssContent).toContain(':root {');
            expect(result.cssContent).toContain('--palette-primary: #000000');
        });

        it('should generate skeleton shimmer animation CSS', async () => {
            const result = await service.generate('test-tenant', mockTokens);

            // Skeleton animation is always generated (uses fallback colors if not defined)
            expect(result.cssContent).toContain('@keyframes shimmer');
            expect(result.cssContent).toContain('.skeleton {');
            expect(result.cssContent).toContain('animation: shimmer');
        });

        it('should use explicit skeleton colors when defined', async () => {
            const tokensWithSkeletonColors = new BrandingTokensBuilder()
                .withSkeletonColors('#1e293b', '#334155')
                .build();

            const result = await service.generate('test-tenant', tokensWithSkeletonColors);

            expect(result.cssContent).toContain('#1e293b');
            expect(result.cssContent).toContain('#334155');
        });

        it('should disable skeleton animation when prefers-reduced-motion', async () => {
            const result = await service.generate('test-tenant', mockTokens);

            expect(result.cssContent).toContain('@media (prefers-reduced-motion: reduce)');
            expect(result.cssContent).toContain('.skeleton {');
            expect(result.cssContent).toContain('animation: none');
        });

        it('should always generate body background color even without aurora', async () => {
            // Tokens with motion disabled (no aurora animation)
            const tokensWithoutAurora = new BrandingTokensBuilder()
                .withMotionFlags({
                    enableParallax: false,
                    enableMagneticHover: false,
                    enableScrollReveal: false,
                })
                .build();

            const result = await service.generate('test-tenant', tokensWithoutAurora);

            // Body background should always be set
            expect(result.cssContent).toContain('body {');
            expect(result.cssContent).toContain('background-color:');
            // Should contain the surface base color from the builder
            expect(result.cssContent).toContain('background-color: #f8fafc');
        });
    });
});
