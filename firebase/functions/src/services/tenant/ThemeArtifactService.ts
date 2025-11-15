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

        // Font face declarations (if custom fonts provided)
        if (tokens.assets.fonts) {
            const fontFaces = this.generateFontFaces(tokens);
            if (fontFaces) {
                sections.push('');
                sections.push(fontFaces);
            }
        }

        // Root CSS variables
        sections.push('');
        sections.push(':root {');

        const allVariables: Array<[string, string]> = [];

        // Flatten all basic tokens
        for (const [name, value] of this.flattenTokens(tokens)) {
            allVariables.push([name, value]);
        }

        // RGB variants for Tailwind opacity utilities
        for (const [name, rgbValue] of this.generateRgbVariants(tokens)) {
            allVariables.push([`${name}-rgb`, rgbValue]);
        }

        // Gradient CSS variables
        for (const [name, gradientValue] of this.generateGradients(tokens)) {
            allVariables.push([name, gradientValue]);
        }

        // Fluid typography CSS variables
        if (tokens.typography.fluidScale) {
            for (const [name, fluidValue] of this.generateFluidTypography(tokens)) {
                allVariables.push([name, fluidValue]);
            }
        }

        allVariables.sort((a, b) => a[0].localeCompare(b[0]));

        for (const [name, value] of allVariables) {
            sections.push(`  --${name}: ${value};`);
        }

        sections.push('}');

        // Aurora background animation
        const auroraAnimation = this.generateAuroraAnimation(tokens);
        if (auroraAnimation) {
            sections.push('');
            sections.push(auroraAnimation);
        }

        // Glassmorphism @supports fallback
        const glassFallback = this.generateGlassmorphismFallback(tokens);
        if (glassFallback) {
            sections.push('');
            sections.push(glassFallback);
        }

        // Motion media query (prefers-reduced-motion)
        const motionQuery = this.generateMotionMediaQuery(tokens);
        if (motionQuery) {
            sections.push('');
            sections.push(motionQuery);
        }

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

    /**
     * Generate gradient CSS variables
     */
    private generateGradients(tokens: BrandingTokens): Array<[string, string]> {
        const entries: Array<[string, string]> = [];
        const gradients = tokens.semantics.colors.gradient;

        if (!gradients) {
            return entries;
        }

        // Primary gradient (2 colors)
        if (gradients.primary && gradients.primary.length === 2) {
            entries.push([
                'gradient-primary',
                `linear-gradient(135deg, ${gradients.primary[0]}, ${gradients.primary[1]})`,
            ]);
        }

        // Accent gradient (2 colors)
        if (gradients.accent && gradients.accent.length === 2) {
            entries.push([
                'gradient-accent',
                `linear-gradient(135deg, ${gradients.accent[0]}, ${gradients.accent[1]})`,
            ]);
        }

        // Text gradient (2 colors) - for webkit-background-clip
        if (gradients.text && gradients.text.length === 2) {
            entries.push([
                'gradient-text',
                `linear-gradient(120deg, ${gradients.text[0]}, ${gradients.text[1]})`,
            ]);
        }

        // Aurora gradient (2-4 colors) - layered radial gradients for background
        if (gradients.aurora && gradients.aurora.length >= 2) {
            const [color1, color2, color3, color4] = gradients.aurora;

            // Create layered radial gradients for atmospheric effect
            const layers: string[] = [];
            layers.push(`radial-gradient(circle at 20% 20%, ${color1}66, transparent 55%)`);
            layers.push(`radial-gradient(circle at 80% 0%, ${color2}59, transparent 60%)`);

            if (color3) {
                layers.push(`radial-gradient(circle at 40% 80%, ${color3}59, transparent 60%)`);
            }
            if (color4) {
                layers.push(`radial-gradient(circle at 80% 60%, ${color4}40, transparent 75%)`);
            }

            entries.push(['gradient-aurora', layers.join(', ')]);
        }

        return entries;
    }

    /**
     * Generate fluid typography CSS variables
     */
    private generateFluidTypography(tokens: BrandingTokens): Array<[string, string]> {
        const entries: Array<[string, string]> = [];
        const fluidScale = tokens.typography.fluidScale;

        if (!fluidScale) {
            return entries;
        }

        // Generate --fluid-{size} variables
        Object.entries(fluidScale).forEach(([size, clampValue]) => {
            if (clampValue) {
                entries.push([`fluid-${size}`, clampValue]);
            }
        });

        return entries;
    }

    /**
     * Generate @font-face rules for custom fonts
     */
    private generateFontFaces(tokens: BrandingTokens): string | null {
        const fonts = tokens.assets.fonts;

        if (!fonts) {
            return null;
        }

        const fontFaces: string[] = [];

        // Heading font (e.g., Space Grotesk)
        if (fonts.headingUrl) {
            fontFaces.push(
                `@font-face {`,
                `  font-family: '${tokens.typography.fontFamily.sans.split(',')[0].trim()}';`,
                `  src: url('${fonts.headingUrl}') format('woff2');`,
                `  font-display: swap;`,
                `  font-weight: 400 700;`,
                `}`
            );
        }

        // Body font (e.g., Inter)
        if (fonts.bodyUrl) {
            fontFaces.push(
                `@font-face {`,
                `  font-family: 'Inter';`,
                `  src: url('${fonts.bodyUrl}') format('woff2');`,
                `  font-display: swap;`,
                `  font-weight: 400 700;`,
                `}`
            );
        }

        // Mono font (e.g., Geist Mono)
        if (fonts.monoUrl) {
            fontFaces.push(
                `@font-face {`,
                `  font-family: '${tokens.typography.fontFamily.mono.split(',')[0].trim()}';`,
                `  src: url('${fonts.monoUrl}') format('woff2');`,
                `  font-display: swap;`,
                `  font-weight: 400 700;`,
                `}`
            );
        }

        return fontFaces.length > 0 ? fontFaces.join('\n') : null;
    }

    /**
     * Generate @supports fallback for glassmorphism
     * Provides solid background for browsers without backdrop-filter support
     */
    private generateGlassmorphismFallback(tokens: BrandingTokens): string | null {
        const glass = tokens.semantics.colors.surface.glass;

        if (!glass) {
            // For themes without glassmorphism, use a simple raised surface
            return [
                '/* Card styling for non-glassmorphic themes */',
                '.glass-panel {',
                `  background: ${tokens.semantics.colors.surface.raised};`,
                '}',
            ].join('\n');
        }

        // For glassmorphic themes, provide fallback and modern styling
        return [
            '/* Glassmorphism fallback for older browsers */',
            '.glass-panel {',
            `  background: ${tokens.semantics.colors.surface.overlay};`,
            '}',
            '',
            '@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {',
            '  .glass-panel {',
            `    background: ${glass};`,
            '    backdrop-filter: blur(24px);',
            '    -webkit-backdrop-filter: blur(24px);',
            '  }',
            '}',
        ].join('\n');
    }

    /**
     * Generate aurora background animation
     * Creates atmospheric animated gradient backgrounds
     */
    private generateAuroraAnimation(tokens: BrandingTokens): string | null {
        const gradient = tokens.semantics.colors.gradient;
        const motion = tokens.motion;

        // Only generate if aurora gradient is defined and motion is enabled
        if (!gradient?.aurora || !motion?.enableParallax) {
            return null;
        }

        const [color1, color2, color3, color4] = gradient.aurora;

        return [
            '/* Atmospheric aurora background */\n',
            'body {',
            `  background-color: ${tokens.semantics.colors.surface.base};`,
            '}\n',
            'body::before,',
            'body::after {',
            '  content: \'\';',
            '  position: fixed;',
            '  inset: 0;',
            '  pointer-events: none;',
            '  z-index: 0;',
            '}\n',
            'body::before {',
            '  background:',
            `    radial-gradient(circle at 20% 20%, ${color1}66, transparent 55%),`,
            `    radial-gradient(circle at 80% 0%, ${color2}59, transparent 60%);`,
            '  filter: blur(25px);',
            '}\n',
            'body::after {',
            '  background:',
            `    radial-gradient(circle at 40% 80%, ${color3 || color2}59, transparent 60%)${color4 ? `,` : `;`}`,
            color4 ? `    radial-gradient(circle at 80% 60%, ${color4}40, transparent 75%);` : '',
            '  animation: aurora 24s ease-in-out infinite alternate;',
            '}\n',
            '@keyframes aurora {',
            '  0%   { transform: translateY(0); opacity: 0.8; }',
            '  50%  { transform: translateY(-40px); opacity: 0.65; }',
            '  100% { transform: translateY(20px); opacity: 0.85; }',
            '}\n',
            '/* Ensure content layers above animated background */',
            '#app > * {',
            '  position: relative;',
            '  z-index: 1;',
            '}',
        ].filter(Boolean).join('\n');
    }

    /**
     * Generate prefers-reduced-motion media query
     * Disables all animations if motion is disabled or user prefers reduced motion
     */
    private generateMotionMediaQuery(tokens: BrandingTokens): string | null {
        const motion = tokens.motion;

        if (!motion) {
            return null;
        }

        // Check if any motion features are enabled
        const hasMotion =
            motion.enableParallax || motion.enableMagneticHover || motion.enableScrollReveal;

        if (!hasMotion) {
            return null;
        }

        return [
            '/* Respect user motion preferences */',
            '@media (prefers-reduced-motion: reduce) {',
            '  body::after {',
            '    animation: none !important;',
            '  }',
            '  *,',
            '  *::before,',
            '  *::after {',
            '    animation-duration: 0.01ms !important;',
            '    animation-iteration-count: 1 !important;',
            '    transition-duration: 0.01ms !important;',
            '    scroll-behavior: auto !important;',
            '  }',
            '}',
        ].join('\n');
    }
}
