import { buildBrandingTokensFromForm, EMPTY_TENANT_DATA, extractFormDataFromTokens } from '@/components/admin/tenant-editor';
import type { TenantData } from '@/components/admin/tenant-editor';
import type { BrandingTokens } from '@billsplit-wl/shared';
import { describe, expect, it } from 'vitest';

function createFullBrandingTokens(): BrandingTokens {
    return {
        version: 1,
        palette: {
            primary: '#1a73e8',
            primaryVariant: '#1557b0',
            secondary: '#5f6368',
            secondaryVariant: '#3c4043',
            accent: '#fbbc04',
            neutral: '#9aa0a6',
            neutralVariant: '#80868b',
            success: '#34a853',
            warning: '#fbbc04',
            danger: '#ea4335',
            info: '#4285f4',
        },
        typography: {
            fontFamily: {
                sans: 'Inter, sans-serif',
                serif: 'Georgia, serif',
                mono: 'Monaco, monospace',
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
                tight: '-0.02rem',
                normal: '0rem',
                wide: '0.02rem',
            },
            semantics: {
                body: 'md',
                bodyStrong: 'md',
                caption: 'sm',
                button: 'sm',
                eyebrow: 'xs',
                heading: '2xl',
                display: '4xl',
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
            none: '0px',
            sm: '4px',
            md: '8px',
            lg: '12px',
            pill: '9999px',
            full: '9999px',
        },
        shadows: {
            sm: '0 1px 2px rgba(0,0,0,0.05)',
            md: '0 4px 6px rgba(0,0,0,0.1)',
            lg: '0 10px 15px rgba(0,0,0,0.1)',
        },
        assets: {
            logoUrl: 'https://example.com/logo.png',
            faviconUrl: 'https://example.com/favicon.ico',
        },
        legal: {
            appName: 'Test App',
            companyName: 'Test Company',
            supportEmail: 'support@test.com',
        },
        semantics: {
            colors: {
                surface: {
                    base: '#ffffff',
                    raised: '#f8f9fa',
                    sunken: '#f1f3f4',
                    overlay: 'rgba(0,0,0,0.5)',
                    warning: '#fef7e0',
                    muted: '#f5f5f5',
                },
                text: {
                    primary: '#202124',
                    secondary: '#5f6368',
                    muted: '#80868b',
                    inverted: '#ffffff',
                    accent: '#1a73e8',
                },
                interactive: {
                    primary: '#1a73e8',
                    primaryHover: '#1557b0',
                    primaryActive: '#174ea6',
                    primaryForeground: '#ffffff',
                    secondary: '#5f6368',
                    secondaryHover: '#3c4043',
                    secondaryActive: '#202124',
                    secondaryForeground: '#ffffff',
                    accent: '#fbbc04',
                    destructive: '#ea4335',
                    destructiveHover: '#c5221f',
                    destructiveActive: '#a50e0e',
                    destructiveForeground: '#ffffff',
                },
                border: {
                    subtle: '#e8eaed',
                    default: '#dadce0',
                    strong: '#bdc1c6',
                    focus: '#1a73e8',
                    warning: '#fbbc04',
                },
                status: {
                    success: '#34a853',
                    warning: '#fbbc04',
                    danger: '#ea4335',
                    info: '#4285f4',
                },
                gradient: {},
            },
            spacing: {
                pagePadding: '1.5rem',
                sectionGap: '2rem',
                cardPadding: '1.5rem',
                componentGap: '1rem',
            },
            typography: {
                body: 'md',
                bodyStrong: 'md',
                caption: 'sm',
                button: 'sm',
                eyebrow: 'xs',
                heading: '2xl',
                display: '4xl',
            },
        },
        motion: {
            duration: {
                instant: 50,
                fast: 100,
                base: 200,
                slow: 300,
                glacial: 500,
            },
            easing: {
                standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
                decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
                accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
                spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            },
            enableParallax: true,
            enableMagneticHover: true,
            enableScrollReveal: false,
        },
    };
}

function createValidFormData(): TenantData {
    return {
        ...EMPTY_TENANT_DATA,
        tenantId: 'test-tenant',
        appName: 'Test App',
        domains: ['test.example.com'],
        logoUrl: 'https://example.com/logo.png',
        faviconUrl: 'https://example.com/favicon.ico',
        primaryColor: '#1a73e8',
        primaryVariantColor: '#1557b0',
        secondaryColor: '#5f6368',
        secondaryVariantColor: '#3c4043',
        accentColor: '#fbbc04',
        neutralColor: '#9aa0a6',
        neutralVariantColor: '#80868b',
        successColor: '#34a853',
        warningColor: '#fbbc04',
        dangerColor: '#ea4335',
        infoColor: '#4285f4',
        surfaceBaseColor: '#ffffff',
        surfaceRaisedColor: '#f8f9fa',
        surfaceSunkenColor: '#f1f3f4',
        surfaceOverlayColor: 'rgba(0,0,0,0.5)',
        surfaceWarningColor: '#fef7e0',
        surfaceMutedColor: '#f5f5f5',
        textPrimaryColor: '#202124',
        textSecondaryColor: '#5f6368',
        textMutedColor: '#80868b',
        textInvertedColor: '#ffffff',
        textAccentColor: '#1a73e8',
        interactivePrimaryColor: '#1a73e8',
        interactivePrimaryHoverColor: '#1557b0',
        interactivePrimaryActiveColor: '#174ea6',
        interactivePrimaryForegroundColor: '#ffffff',
        interactiveSecondaryColor: '#5f6368',
        interactiveSecondaryHoverColor: '#3c4043',
        interactiveSecondaryActiveColor: '#202124',
        interactiveSecondaryForegroundColor: '#ffffff',
        interactiveAccentColor: '#fbbc04',
        interactiveDestructiveColor: '#ea4335',
        interactiveDestructiveHoverColor: '#c5221f',
        interactiveDestructiveActiveColor: '#a50e0e',
        interactiveDestructiveForegroundColor: '#ffffff',
        borderSubtleColor: '#e8eaed',
        borderDefaultColor: '#dadce0',
        borderStrongColor: '#bdc1c6',
        borderFocusColor: '#1a73e8',
        borderWarningColor: '#fbbc04',
        statusSuccessColor: '#34a853',
        statusWarningColor: '#fbbc04',
        statusDangerColor: '#ea4335',
        statusInfoColor: '#4285f4',
        fontFamilySans: 'Inter, sans-serif',
        fontFamilySerif: 'Georgia, serif',
        fontFamilyMono: 'Monaco, monospace',
        typographySizeXs: '0.75rem',
        typographySizeSm: '0.875rem',
        typographySizeMd: '1rem',
        typographySizeLg: '1.125rem',
        typographySizeXl: '1.25rem',
        typographySize2xl: '1.5rem',
        typographySize3xl: '1.875rem',
        typographySize4xl: '2.25rem',
        typographySize5xl: '3rem',
        fontWeightRegular: 400,
        fontWeightMedium: 500,
        fontWeightSemibold: 600,
        fontWeightBold: 700,
        lineHeightCompact: '1.25rem',
        lineHeightStandard: '1.5rem',
        lineHeightSpacious: '1.75rem',
        letterSpacingTight: '-0.02rem',
        letterSpacingNormal: '0rem',
        letterSpacingWide: '0.02rem',
        typographySemanticBody: 'md',
        typographySemanticBodyStrong: 'md',
        typographySemanticCaption: 'sm',
        typographySemanticButton: 'sm',
        typographySemanticEyebrow: 'xs',
        typographySemanticHeading: '2xl',
        typographySemanticDisplay: '4xl',
        spacing2xs: '0.25rem',
        spacingXs: '0.5rem',
        spacingSm: '0.75rem',
        spacingMd: '1rem',
        spacingLg: '1.5rem',
        spacingXl: '2rem',
        spacing2xl: '3rem',
        spacingPagePadding: '1.5rem',
        spacingSectionGap: '2rem',
        spacingCardPadding: '1.5rem',
        spacingComponentGap: '1rem',
        radiiNone: '0px',
        radiiSm: '4px',
        radiiMd: '8px',
        radiiLg: '12px',
        radiiPill: '9999px',
        radiiFull: '9999px',
        shadowSm: '0 1px 2px rgba(0,0,0,0.05)',
        shadowMd: '0 4px 6px rgba(0,0,0,0.1)',
        shadowLg: '0 10px 15px rgba(0,0,0,0.1)',
        legalCompanyName: 'Test Company',
        legalSupportEmail: 'support@test.com',
        motionDurationInstant: 50,
        motionDurationFast: 100,
        motionDurationBase: 200,
        motionDurationSlow: 300,
        motionDurationGlacial: 500,
        motionEasingStandard: 'cubic-bezier(0.4, 0, 0.2, 1)',
        motionEasingDecelerate: 'cubic-bezier(0, 0, 0.2, 1)',
        motionEasingAccelerate: 'cubic-bezier(0.4, 0, 1, 1)',
        motionEasingSpring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        enableParallax: true,
        enableMagneticHover: true,
        enableScrollReveal: false,
        showMarketingContent: true,
        showPricingPage: false,
        showAppNameInHeader: true,
        auroraGradient: [],
        glassColor: '',
        glassBorderColor: '',
    };
}

describe('extractFormDataFromTokens', () => {
    it('extracts all palette colors', () => {
        const tokens = createFullBrandingTokens();
        const result = extractFormDataFromTokens(tokens);

        expect(result.primaryColor).toBe('#1a73e8');
        expect(result.primaryVariantColor).toBe('#1557b0');
        expect(result.secondaryColor).toBe('#5f6368');
        expect(result.accentColor).toBe('#fbbc04');
        expect(result.successColor).toBe('#34a853');
        expect(result.dangerColor).toBe('#ea4335');
    });

    it('extracts typography settings', () => {
        const tokens = createFullBrandingTokens();
        const result = extractFormDataFromTokens(tokens);

        expect(result.fontFamilySans).toBe('Inter, sans-serif');
        expect(result.fontFamilyMono).toBe('Monaco, monospace');
        expect(result.typographySizeXs).toBe('0.75rem');
        expect(result.fontWeightBold).toBe(700);
    });

    it('extracts surface colors', () => {
        const tokens = createFullBrandingTokens();
        const result = extractFormDataFromTokens(tokens);

        expect(result.surfaceBaseColor).toBe('#ffffff');
        expect(result.surfaceRaisedColor).toBe('#f8f9fa');
        expect(result.surfaceOverlayColor).toBe('rgba(0,0,0,0.5)');
    });

    it('extracts motion settings', () => {
        const tokens = createFullBrandingTokens();
        const result = extractFormDataFromTokens(tokens);

        expect(result.motionDurationFast).toBe(100);
        expect(result.motionEasingStandard).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
        expect(result.enableParallax).toBe(true);
        expect(result.enableMagneticHover).toBe(true);
    });

    it('extracts legal information', () => {
        const tokens = createFullBrandingTokens();
        const result = extractFormDataFromTokens(tokens);

        expect(result.legalCompanyName).toBe('Test Company');
        expect(result.legalSupportEmail).toBe('support@test.com');
    });

    it('handles missing optional fields gracefully', () => {
        const tokens: BrandingTokens = {
            version: 1,
            palette: {} as BrandingTokens['palette'],
            typography: {} as BrandingTokens['typography'],
            spacing: {} as BrandingTokens['spacing'],
            radii: {} as BrandingTokens['radii'],
            shadows: {} as BrandingTokens['shadows'],
            semantics: {} as BrandingTokens['semantics'],
            motion: {} as BrandingTokens['motion'],
            assets: {} as BrandingTokens['assets'],
            legal: {} as BrandingTokens['legal'],
        };
        const result = extractFormDataFromTokens(tokens);

        expect(result.primaryColor).toBe('');
        expect(result.fontFamilySans).toBe('');
        expect(result.enableParallax).toBe(false);
    });

    it('extracts assets correctly', () => {
        const tokens = createFullBrandingTokens();
        const result = extractFormDataFromTokens(tokens);

        expect(result.logoUrl).toBe('https://example.com/logo.png');
        expect(result.faviconUrl).toBe('https://example.com/favicon.ico');
    });
});

describe('buildBrandingTokensFromForm', () => {
    it('builds valid branding tokens structure', () => {
        const formData = createValidFormData();
        const result = buildBrandingTokensFromForm(formData);

        expect(result.tokens).toBeDefined();
        expect(result.tokens.version).toBe(1);
    });

    it('includes all palette colors', () => {
        const formData = createValidFormData();
        const result = buildBrandingTokensFromForm(formData);

        expect(result.tokens.palette?.primary).toBe('#1a73e8');
        expect(result.tokens.palette?.secondary).toBe('#5f6368');
        expect(result.tokens.palette?.accent).toBe('#fbbc04');
    });

    it('includes typography configuration', () => {
        const formData = createValidFormData();
        const result = buildBrandingTokensFromForm(formData);

        expect(result.tokens.typography?.fontFamily?.sans).toBe('Inter, sans-serif');
        expect(result.tokens.typography?.sizes?.md).toBe('1rem');
        expect(result.tokens.typography?.weights?.bold).toBe(700);
    });

    it('includes semantic colors', () => {
        const formData = createValidFormData();
        const result = buildBrandingTokensFromForm(formData);

        expect(result.tokens.semantics?.colors?.surface?.base).toBe('#ffffff');
        expect(result.tokens.semantics?.colors?.text?.primary).toBe('#202124');
        expect(result.tokens.semantics?.colors?.interactive?.primary).toBe('#1a73e8');
    });

    it('includes motion settings', () => {
        const formData = createValidFormData();
        const result = buildBrandingTokensFromForm(formData);

        expect(result.tokens.motion?.duration?.fast).toBe(100);
        expect(result.tokens.motion?.enableParallax).toBe(true);
    });

    it('includes legal information', () => {
        const formData = createValidFormData();
        const result = buildBrandingTokensFromForm(formData);

        expect(result.tokens.legal?.companyName).toBe('Test Company');
        expect(result.tokens.legal?.supportEmail).toBe('support@test.com');
    });

    it('includes aurora gradient when parallax is enabled', () => {
        const formData = createValidFormData();
        formData.enableParallax = true;
        formData.auroraGradient = ['#ff0000', '#00ff00', '#0000ff'];
        const result = buildBrandingTokensFromForm(formData);

        expect(result.tokens.semantics?.colors?.gradient?.aurora).toEqual(['#ff0000', '#00ff00', '#0000ff']);
    });

    it('excludes aurora gradient when parallax is disabled', () => {
        const formData = createValidFormData();
        formData.enableParallax = false;
        formData.auroraGradient = ['#ff0000', '#00ff00'];
        const result = buildBrandingTokensFromForm(formData);

        expect(result.tokens.semantics?.colors?.gradient?.aurora).toBeUndefined();
    });

    it('includes glass colors when glassColor is set', () => {
        const formData = createValidFormData();
        formData.glassColor = 'rgba(255,255,255,0.1)';
        formData.glassBorderColor = 'rgba(255,255,255,0.2)';
        const result = buildBrandingTokensFromForm(formData);

        expect(result.tokens.semantics?.colors?.surface?.glass).toBe('rgba(255,255,255,0.1)');
        expect(result.tokens.semantics?.colors?.surface?.glassBorder).toBe('rgba(255,255,255,0.2)');
    });

    it('excludes glass colors when glassColor is empty', () => {
        const formData = createValidFormData();
        formData.glassColor = '';
        const result = buildBrandingTokensFromForm(formData);

        expect(result.tokens.semantics?.colors?.surface?.glass).toBeUndefined();
    });
});

describe('round-trip conversion', () => {
    it('preserves data through extract -> build cycle', () => {
        const originalTokens = createFullBrandingTokens();
        const extracted = extractFormDataFromTokens(originalTokens);

        const formData: TenantData = {
            ...EMPTY_TENANT_DATA,
            ...extracted,
            tenantId: 'test',
            appName: 'Test',
            domains: ['test.com'],
            enableParallax: originalTokens.motion?.enableParallax ?? false,
            enableMagneticHover: originalTokens.motion?.enableMagneticHover ?? false,
            enableScrollReveal: originalTokens.motion?.enableScrollReveal ?? false,
        };

        const rebuilt = buildBrandingTokensFromForm(formData);

        expect(rebuilt.tokens.palette?.primary).toBe(originalTokens.palette?.primary);
        expect(rebuilt.tokens.typography?.fontFamily?.sans).toBe(originalTokens.typography?.fontFamily?.sans);
        expect(rebuilt.tokens.semantics?.colors?.surface?.base).toBe(originalTokens.semantics?.colors?.surface?.base);
    });
});
