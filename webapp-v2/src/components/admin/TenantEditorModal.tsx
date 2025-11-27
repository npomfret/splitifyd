import { apiClient } from '@/app/apiClient';
import { Alert, Button, ImageUploadField, Input, Modal } from '@/components/ui';
import { logError } from '@/utils/browser-logger';
import type { AdminUpsertTenantRequest, BrandingTokens, TenantBranding } from '@billsplit-wl/shared';
import { useEffect, useState } from 'preact/hooks';

type CreationMode = 'empty' | 'copy';

interface TenantData {
    // Basic info
    tenantId: string;
    appName: string;
    domains: string[];

    // Assets
    logoUrl: string;
    faviconUrl: string;

    // Palette colors (11 required)
    primaryColor: string;
    primaryVariantColor: string;
    secondaryColor: string;
    secondaryVariantColor: string;
    accentColor: string;
    neutralColor: string;
    neutralVariantColor: string;
    successColor: string;
    warningColor: string;
    dangerColor: string;
    infoColor: string;

    // Surface colors (6 required)
    surfaceBaseColor: string;
    surfaceRaisedColor: string;
    surfaceSunkenColor: string;
    surfaceOverlayColor: string;
    surfaceWarningColor: string;
    surfaceMutedColor: string;

    // Text colors (5 required)
    textPrimaryColor: string;
    textSecondaryColor: string;
    textMutedColor: string;
    textInvertedColor: string;
    textAccentColor: string;

    // Interactive colors (13 required)
    interactivePrimaryColor: string;
    interactivePrimaryHoverColor: string;
    interactivePrimaryActiveColor: string;
    interactivePrimaryForegroundColor: string;
    interactiveSecondaryColor: string;
    interactiveSecondaryHoverColor: string;
    interactiveSecondaryActiveColor: string;
    interactiveSecondaryForegroundColor: string;
    interactiveAccentColor: string;
    interactiveDestructiveColor: string;
    interactiveDestructiveHoverColor: string;
    interactiveDestructiveActiveColor: string;
    interactiveDestructiveForegroundColor: string;

    // Border colors (5 required)
    borderSubtleColor: string;
    borderDefaultColor: string;
    borderStrongColor: string;
    borderFocusColor: string;
    borderWarningColor: string;

    // Status colors (4 required)
    statusSuccessColor: string;
    statusWarningColor: string;
    statusDangerColor: string;
    statusInfoColor: string;

    // Typography - Font families (2 required, 1 optional)
    fontFamilySans: string;
    fontFamilySerif: string;
    fontFamilyMono: string;

    // Typography - Sizes (9 required)
    typographySizeXs: string;
    typographySizeSm: string;
    typographySizeMd: string;
    typographySizeLg: string;
    typographySizeXl: string;
    typographySize2xl: string;
    typographySize3xl: string;
    typographySize4xl: string;
    typographySize5xl: string;

    // Typography - Weights (4 required)
    fontWeightRegular: number;
    fontWeightMedium: number;
    fontWeightSemibold: number;
    fontWeightBold: number;

    // Typography - Line heights (3 required)
    lineHeightCompact: string;
    lineHeightStandard: string;
    lineHeightSpacious: string;

    // Typography - Letter spacing (3 required)
    letterSpacingTight: string;
    letterSpacingNormal: string;
    letterSpacingWide: string;

    // Typography - Semantics (7 required)
    typographySemanticBody: string;
    typographySemanticBodyStrong: string;
    typographySemanticCaption: string;
    typographySemanticButton: string;
    typographySemanticEyebrow: string;
    typographySemanticHeading: string;
    typographySemanticDisplay: string;

    // Spacing scale (7 required)
    spacing2xs: string;
    spacingXs: string;
    spacingSm: string;
    spacingMd: string;
    spacingLg: string;
    spacingXl: string;
    spacing2xl: string;

    // Spacing semantic (4 required)
    spacingPagePadding: string;
    spacingSectionGap: string;
    spacingCardPadding: string;
    spacingComponentGap: string;

    // Radii (6 required)
    radiiNone: string;
    radiiSm: string;
    radiiMd: string;
    radiiLg: string;
    radiiPill: string;
    radiiFull: string;

    // Shadows (3 required)
    shadowSm: string;
    shadowMd: string;
    shadowLg: string;

    // Legal (4 required)
    legalCompanyName: string;
    legalSupportEmail: string;
    legalPrivacyPolicyUrl: string;
    legalTermsOfServiceUrl: string;

    // Motion - Durations (5 optional)
    motionDurationInstant: number;
    motionDurationFast: number;
    motionDurationBase: number;
    motionDurationSlow: number;
    motionDurationGlacial: number;

    // Motion - Easings (4 optional)
    motionEasingStandard: string;
    motionEasingDecelerate: string;
    motionEasingAccelerate: string;
    motionEasingSpring: string;

    // Motion - Feature flags
    enableParallax: boolean;
    enableMagneticHover: boolean;
    enableScrollReveal: boolean;

    // Marketing flags
    showLandingPage: boolean;
    showMarketingContent: boolean;
    showPricingPage: boolean;

    // Optional advanced features
    enableButtonGradient: boolean;
    enableGlassmorphism: boolean;
    auroraGradient: string[];
    glassColor: string;
    glassBorderColor: string;
}

interface TenantConfig {
    tenantId: string;
    branding: {
        appName: string;
        logoUrl?: string;
        faviconUrl?: string;
        primaryColor?: string;
        secondaryColor?: string;
        accentColor?: string;
        marketingFlags?: {
            showLandingPage?: boolean;
            showMarketingContent?: boolean;
            showPricingPage?: boolean;
        };
    };
    createdAt: string;
    updatedAt: string;
}

interface FullTenant {
    tenant: TenantConfig;
    domains: string[];
    isDefault: boolean;
    brandingTokens?: TenantBranding;
}

interface TenantEditorModalProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    tenant?: FullTenant;
    mode: 'create' | 'edit';
}

// Collapsible Section Component
function Section({ title, description, defaultOpen = false, testId, children }: {
    title: string;
    description?: string;
    defaultOpen?: boolean;
    testId?: string;
    children: preact.ComponentChildren;
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div class='border border-border-default rounded-lg overflow-hidden'>
            <button
                type='button'
                onClick={() => setIsOpen(!isOpen)}
                class='w-full flex items-center justify-between px-4 py-3 bg-surface-raised hover:bg-surface-base transition-colors'
                data-testid={testId}
                data-expanded={isOpen}
            >
                <div class='text-left'>
                    <h3 class='text-sm font-semibold text-text-primary'>{title}</h3>
                    {description && <p class='text-xs text-text-muted mt-0.5'>{description}</p>}
                </div>
                <svg
                    class={`w-5 h-5 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                >
                    <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7' />
                </svg>
            </button>
            {isOpen && <div class='px-4 py-4 space-y-4 border-t border-border-subtle'>{children}</div>}
        </div>
    );
}

// Color Input Component with placeholder showing expected format
function ColorInput({ id, label, value, onChange, disabled, testId, placeholder = '#RRGGBB' }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    testId: string;
    placeholder?: string;
}) {
    return (
        <div>
            <label for={id} class='block text-xs font-medium text-text-secondary mb-1'>{label}</label>
            <div class='flex items-center gap-2'>
                <input
                    id={id}
                    type='color'
                    value={value || '#000000'}
                    onInput={(e) => onChange((e.target as HTMLInputElement).value)}
                    disabled={disabled}
                    class='h-8 w-12 rounded border border-border-default bg-surface-base cursor-pointer'
                    data-testid={testId}
                />
                <input
                    type='text'
                    value={value}
                    onInput={(e) => onChange((e.target as HTMLInputElement).value)}
                    disabled={disabled}
                    placeholder={placeholder}
                    class='flex-1 text-xs text-text-muted font-mono rounded border border-border-default bg-surface-base px-2 py-1'
                />
            </div>
        </div>
    );
}

// Toggle Component
function Toggle({ label, description, checked, onChange, disabled, testId }: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    testId: string;
}) {
    return (
        <label class='flex items-start gap-3 cursor-pointer'>
            <input
                type='checkbox'
                checked={checked}
                onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
                disabled={disabled}
                class='h-4 w-4 mt-0.5 rounded border-border-default'
                data-testid={testId}
            />
            <div>
                <span class='text-sm font-medium text-text-primary'>{label}</span>
                {description && <p class='text-xs text-text-muted'>{description}</p>}
            </div>
        </label>
    );
}

function extractFormDataFromTokens(tokens: BrandingTokens): Partial<TenantData> {
    return {
        // Assets
        logoUrl: tokens.assets?.logoUrl || '',
        faviconUrl: tokens.assets?.faviconUrl || '',

        // Palette colors
        primaryColor: tokens.palette?.primary || '',
        primaryVariantColor: tokens.palette?.primaryVariant || '',
        secondaryColor: tokens.palette?.secondary || '',
        secondaryVariantColor: tokens.palette?.secondaryVariant || '',
        accentColor: tokens.palette?.accent || '',
        neutralColor: tokens.palette?.neutral || '',
        neutralVariantColor: tokens.palette?.neutralVariant || '',
        successColor: tokens.palette?.success || '',
        warningColor: tokens.palette?.warning || '',
        dangerColor: tokens.palette?.danger || '',
        infoColor: tokens.palette?.info || '',

        // Surface colors
        surfaceBaseColor: tokens.semantics?.colors?.surface?.base || '',
        surfaceRaisedColor: tokens.semantics?.colors?.surface?.raised || '',
        surfaceSunkenColor: tokens.semantics?.colors?.surface?.sunken || '',
        surfaceOverlayColor: tokens.semantics?.colors?.surface?.overlay || '',
        surfaceWarningColor: tokens.semantics?.colors?.surface?.warning || '',
        surfaceMutedColor: tokens.semantics?.colors?.surface?.muted || '',

        // Text colors
        textPrimaryColor: tokens.semantics?.colors?.text?.primary || '',
        textSecondaryColor: tokens.semantics?.colors?.text?.secondary || '',
        textMutedColor: tokens.semantics?.colors?.text?.muted || '',
        textInvertedColor: tokens.semantics?.colors?.text?.inverted || '',
        textAccentColor: tokens.semantics?.colors?.text?.accent || '',

        // Interactive colors
        interactivePrimaryColor: tokens.semantics?.colors?.interactive?.primary || '',
        interactivePrimaryHoverColor: tokens.semantics?.colors?.interactive?.primaryHover || '',
        interactivePrimaryActiveColor: tokens.semantics?.colors?.interactive?.primaryActive || '',
        interactivePrimaryForegroundColor: tokens.semantics?.colors?.interactive?.primaryForeground || '',
        interactiveSecondaryColor: tokens.semantics?.colors?.interactive?.secondary || '',
        interactiveSecondaryHoverColor: tokens.semantics?.colors?.interactive?.secondaryHover || '',
        interactiveSecondaryActiveColor: tokens.semantics?.colors?.interactive?.secondaryActive || '',
        interactiveSecondaryForegroundColor: tokens.semantics?.colors?.interactive?.secondaryForeground || '',
        interactiveAccentColor: tokens.semantics?.colors?.interactive?.accent || '',
        interactiveDestructiveColor: tokens.semantics?.colors?.interactive?.destructive || '',
        interactiveDestructiveHoverColor: tokens.semantics?.colors?.interactive?.destructiveHover || '',
        interactiveDestructiveActiveColor: tokens.semantics?.colors?.interactive?.destructiveActive || '',
        interactiveDestructiveForegroundColor: tokens.semantics?.colors?.interactive?.destructiveForeground || '',

        // Border colors
        borderSubtleColor: tokens.semantics?.colors?.border?.subtle || '',
        borderDefaultColor: tokens.semantics?.colors?.border?.default || '',
        borderStrongColor: tokens.semantics?.colors?.border?.strong || '',
        borderFocusColor: tokens.semantics?.colors?.border?.focus || '',
        borderWarningColor: tokens.semantics?.colors?.border?.warning || '',

        // Status colors
        statusSuccessColor: tokens.semantics?.colors?.status?.success || '',
        statusWarningColor: tokens.semantics?.colors?.status?.warning || '',
        statusDangerColor: tokens.semantics?.colors?.status?.danger || '',
        statusInfoColor: tokens.semantics?.colors?.status?.info || '',

        // Typography - Font families
        fontFamilySans: tokens.typography?.fontFamily?.sans || '',
        fontFamilySerif: tokens.typography?.fontFamily?.serif || '',
        fontFamilyMono: tokens.typography?.fontFamily?.mono || '',

        // Typography - Sizes
        typographySizeXs: tokens.typography?.sizes?.xs || '',
        typographySizeSm: tokens.typography?.sizes?.sm || '',
        typographySizeMd: tokens.typography?.sizes?.md || '',
        typographySizeLg: tokens.typography?.sizes?.lg || '',
        typographySizeXl: tokens.typography?.sizes?.xl || '',
        typographySize2xl: tokens.typography?.sizes?.['2xl'] || '',
        typographySize3xl: tokens.typography?.sizes?.['3xl'] || '',
        typographySize4xl: tokens.typography?.sizes?.['4xl'] || '',
        typographySize5xl: tokens.typography?.sizes?.['5xl'] || '',

        // Typography - Weights
        fontWeightRegular: tokens.typography?.weights?.regular || 0,
        fontWeightMedium: tokens.typography?.weights?.medium || 0,
        fontWeightSemibold: tokens.typography?.weights?.semibold || 0,
        fontWeightBold: tokens.typography?.weights?.bold || 0,

        // Typography - Line heights
        lineHeightCompact: tokens.typography?.lineHeights?.compact || '',
        lineHeightStandard: tokens.typography?.lineHeights?.standard || '',
        lineHeightSpacious: tokens.typography?.lineHeights?.spacious || '',

        // Typography - Letter spacing
        letterSpacingTight: tokens.typography?.letterSpacing?.tight || '',
        letterSpacingNormal: tokens.typography?.letterSpacing?.normal || '',
        letterSpacingWide: tokens.typography?.letterSpacing?.wide || '',

        // Typography - Semantics
        typographySemanticBody: tokens.typography?.semantics?.body || '',
        typographySemanticBodyStrong: tokens.typography?.semantics?.bodyStrong || '',
        typographySemanticCaption: tokens.typography?.semantics?.caption || '',
        typographySemanticButton: tokens.typography?.semantics?.button || '',
        typographySemanticEyebrow: tokens.typography?.semantics?.eyebrow || '',
        typographySemanticHeading: tokens.typography?.semantics?.heading || '',
        typographySemanticDisplay: tokens.typography?.semantics?.display || '',

        // Spacing scale
        spacing2xs: tokens.spacing?.['2xs'] || '',
        spacingXs: tokens.spacing?.xs || '',
        spacingSm: tokens.spacing?.sm || '',
        spacingMd: tokens.spacing?.md || '',
        spacingLg: tokens.spacing?.lg || '',
        spacingXl: tokens.spacing?.xl || '',
        spacing2xl: tokens.spacing?.['2xl'] || '',

        // Spacing semantic
        spacingPagePadding: tokens.semantics?.spacing?.pagePadding || '',
        spacingSectionGap: tokens.semantics?.spacing?.sectionGap || '',
        spacingCardPadding: tokens.semantics?.spacing?.cardPadding || '',
        spacingComponentGap: tokens.semantics?.spacing?.componentGap || '',

        // Radii
        radiiNone: tokens.radii?.none || '',
        radiiSm: tokens.radii?.sm || '',
        radiiMd: tokens.radii?.md || '',
        radiiLg: tokens.radii?.lg || '',
        radiiPill: tokens.radii?.pill || '',
        radiiFull: tokens.radii?.full || '',

        // Shadows
        shadowSm: tokens.shadows?.sm || '',
        shadowMd: tokens.shadows?.md || '',
        shadowLg: tokens.shadows?.lg || '',

        // Legal
        legalCompanyName: tokens.legal?.companyName || '',
        legalSupportEmail: tokens.legal?.supportEmail || '',
        legalPrivacyPolicyUrl: tokens.legal?.privacyPolicyUrl || '',
        legalTermsOfServiceUrl: tokens.legal?.termsOfServiceUrl || '',

        // Motion - Durations
        motionDurationInstant: tokens.motion?.duration?.instant || 0,
        motionDurationFast: tokens.motion?.duration?.fast || 0,
        motionDurationBase: tokens.motion?.duration?.base || 0,
        motionDurationSlow: tokens.motion?.duration?.slow || 0,
        motionDurationGlacial: tokens.motion?.duration?.glacial || 0,

        // Motion - Easings
        motionEasingStandard: tokens.motion?.easing?.standard || '',
        motionEasingDecelerate: tokens.motion?.easing?.decelerate || '',
        motionEasingAccelerate: tokens.motion?.easing?.accelerate || '',
        motionEasingSpring: tokens.motion?.easing?.spring || '',

        // Motion - Feature flags
        enableParallax: tokens.motion?.enableParallax ?? false,
        enableMagneticHover: tokens.motion?.enableMagneticHover ?? false,
        enableScrollReveal: tokens.motion?.enableScrollReveal ?? false,

        // Optional features
        enableButtonGradient: !!(tokens.semantics?.colors?.gradient?.primary),
        enableGlassmorphism: !!(tokens.semantics?.colors?.surface?.glass),
        auroraGradient: Array.isArray(tokens.semantics?.colors?.gradient?.aurora)
            ? tokens.semantics.colors.gradient.aurora
            : [],
        glassColor: tokens.semantics?.colors?.surface?.glass || '',
        glassBorderColor: tokens.semantics?.colors?.surface?.glassBorder || '',
    };
}

// Build branding tokens from form data - NO FALLBACK VALUES
// All values must come from formData. Schema validation will catch missing fields.
function buildBrandingTokensFromForm(formData: TenantData): TenantBranding {
    const tokens: BrandingTokens = {
        version: 1,
        palette: {
            primary: formData.primaryColor as `#${string}`,
            primaryVariant: formData.primaryVariantColor as `#${string}`,
            secondary: formData.secondaryColor as `#${string}`,
            secondaryVariant: formData.secondaryVariantColor as `#${string}`,
            accent: formData.accentColor as `#${string}`,
            neutral: formData.neutralColor as `#${string}`,
            neutralVariant: formData.neutralVariantColor as `#${string}`,
            success: formData.successColor as `#${string}`,
            warning: formData.warningColor as `#${string}`,
            danger: formData.dangerColor as `#${string}`,
            info: formData.infoColor as `#${string}`,
        },
        typography: {
            fontFamily: {
                sans: formData.fontFamilySans,
                serif: formData.fontFamilySerif,
                mono: formData.fontFamilyMono,
            },
            sizes: {
                xs: formData.typographySizeXs as `${number}rem`,
                sm: formData.typographySizeSm as `${number}rem`,
                md: formData.typographySizeMd as `${number}rem`,
                lg: formData.typographySizeLg as `${number}rem`,
                xl: formData.typographySizeXl as `${number}rem`,
                '2xl': formData.typographySize2xl as `${number}rem`,
                '3xl': formData.typographySize3xl as `${number}rem`,
                '4xl': formData.typographySize4xl as `${number}rem`,
                '5xl': formData.typographySize5xl as `${number}rem`,
            },
            weights: {
                regular: formData.fontWeightRegular,
                medium: formData.fontWeightMedium,
                semibold: formData.fontWeightSemibold,
                bold: formData.fontWeightBold,
            },
            lineHeights: {
                compact: formData.lineHeightCompact as `${number}rem`,
                standard: formData.lineHeightStandard as `${number}rem`,
                spacious: formData.lineHeightSpacious as `${number}rem`,
            },
            letterSpacing: {
                tight: formData.letterSpacingTight as `${number}rem`,
                normal: formData.letterSpacingNormal as `${number}rem`,
                wide: formData.letterSpacingWide as `${number}rem`,
            },
            semantics: {
                body: formData.typographySemanticBody as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
                bodyStrong: formData.typographySemanticBodyStrong as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
                caption: formData.typographySemanticCaption as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
                button: formData.typographySemanticButton as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
                eyebrow: formData.typographySemanticEyebrow as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
                heading: formData.typographySemanticHeading as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
                display: formData.typographySemanticDisplay as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
            },
        },
        spacing: {
            '2xs': formData.spacing2xs as `${number}rem`,
            xs: formData.spacingXs as `${number}rem`,
            sm: formData.spacingSm as `${number}rem`,
            md: formData.spacingMd as `${number}rem`,
            lg: formData.spacingLg as `${number}rem`,
            xl: formData.spacingXl as `${number}rem`,
            '2xl': formData.spacing2xl as `${number}rem`,
        },
        radii: {
            none: formData.radiiNone as `${number}px`,
            sm: formData.radiiSm as `${number}px`,
            md: formData.radiiMd as `${number}px`,
            lg: formData.radiiLg as `${number}px`,
            pill: formData.radiiPill as `${number}px`,
            full: formData.radiiFull as `${number}px`,
        },
        shadows: {
            sm: formData.shadowSm,
            md: formData.shadowMd,
            lg: formData.shadowLg,
        },
        assets: {
            logoUrl: formData.logoUrl,
            faviconUrl: formData.faviconUrl || undefined,
        },
        legal: {
            companyName: formData.legalCompanyName,
            supportEmail: formData.legalSupportEmail,
            privacyPolicyUrl: formData.legalPrivacyPolicyUrl,
            termsOfServiceUrl: formData.legalTermsOfServiceUrl,
        },
        semantics: {
            colors: {
                surface: {
                    base: formData.surfaceBaseColor as `#${string}`,
                    raised: formData.surfaceRaisedColor as `#${string}`,
                    sunken: formData.surfaceSunkenColor as `#${string}`,
                    overlay: formData.surfaceOverlayColor as `rgba(${string})`,
                    warning: formData.surfaceWarningColor as `#${string}`,
                    muted: formData.surfaceMutedColor as `#${string}`,
                    ...(formData.enableGlassmorphism && formData.glassColor
                        ? {
                            glass: formData.glassColor as `rgba(${string})`,
                            glassBorder: formData.glassBorderColor as `rgba(${string})`,
                        }
                        : {}),
                },
                text: {
                    primary: formData.textPrimaryColor as `#${string}`,
                    secondary: formData.textSecondaryColor as `#${string}`,
                    muted: formData.textMutedColor as `#${string}`,
                    inverted: formData.textInvertedColor as `#${string}`,
                    accent: formData.textAccentColor as `#${string}`,
                },
                interactive: {
                    primary: formData.interactivePrimaryColor as `#${string}`,
                    primaryHover: formData.interactivePrimaryHoverColor as `#${string}`,
                    primaryActive: formData.interactivePrimaryActiveColor as `#${string}`,
                    primaryForeground: formData.interactivePrimaryForegroundColor as `#${string}`,
                    secondary: formData.interactiveSecondaryColor as `#${string}`,
                    secondaryHover: formData.interactiveSecondaryHoverColor as `#${string}`,
                    secondaryActive: formData.interactiveSecondaryActiveColor as `#${string}`,
                    secondaryForeground: formData.interactiveSecondaryForegroundColor as `#${string}`,
                    accent: formData.interactiveAccentColor as `#${string}`,
                    destructive: formData.interactiveDestructiveColor as `#${string}`,
                    destructiveHover: formData.interactiveDestructiveHoverColor as `#${string}`,
                    destructiveActive: formData.interactiveDestructiveActiveColor as `#${string}`,
                    destructiveForeground: formData.interactiveDestructiveForegroundColor as `#${string}`,
                },
                border: {
                    subtle: formData.borderSubtleColor as `#${string}`,
                    default: formData.borderDefaultColor as `#${string}`,
                    strong: formData.borderStrongColor as `#${string}`,
                    focus: formData.borderFocusColor as `#${string}`,
                    warning: formData.borderWarningColor as `#${string}`,
                },
                status: {
                    success: formData.statusSuccessColor as `#${string}`,
                    warning: formData.statusWarningColor as `#${string}`,
                    danger: formData.statusDangerColor as `#${string}`,
                    info: formData.statusInfoColor as `#${string}`,
                },
                gradient: {
                    ...(formData.enableParallax && formData.auroraGradient.length >= 2
                        ? {
                            aurora: formData.auroraGradient as `#${string}`[],
                        }
                        : {}),
                    ...(formData.enableButtonGradient && formData.interactivePrimaryColor && formData.interactivePrimaryHoverColor
                        ? {
                            primary: [formData.interactivePrimaryColor, formData.interactivePrimaryHoverColor] as [`#${string}`, `#${string}`],
                        }
                        : {}),
                },
            },
            spacing: {
                pagePadding: formData.spacingPagePadding,
                sectionGap: formData.spacingSectionGap,
                cardPadding: formData.spacingCardPadding,
                componentGap: formData.spacingComponentGap,
            },
            typography: {
                body: formData.typographySemanticBody as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
                bodyStrong: formData.typographySemanticBodyStrong as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
                caption: formData.typographySemanticCaption as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
                button: formData.typographySemanticButton as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
                eyebrow: formData.typographySemanticEyebrow as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
                heading: formData.typographySemanticHeading as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
                display: formData.typographySemanticDisplay as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl',
            },
        },
        motion: {
            duration: {
                instant: formData.motionDurationInstant,
                fast: formData.motionDurationFast,
                base: formData.motionDurationBase,
                slow: formData.motionDurationSlow,
                glacial: formData.motionDurationGlacial,
            },
            easing: {
                standard: formData.motionEasingStandard,
                decelerate: formData.motionEasingDecelerate,
                accelerate: formData.motionEasingAccelerate,
                spring: formData.motionEasingSpring,
            },
            enableParallax: formData.enableParallax,
            enableMagneticHover: formData.enableMagneticHover,
            enableScrollReveal: formData.enableScrollReveal,
        },
    };

    return { tokens };
}

// Empty form data - no hardcoded design values, just structure
const EMPTY_TENANT_DATA: TenantData = {
    // Basic info
    tenantId: '',
    appName: '',
    domains: [],

    // Assets
    logoUrl: '',
    faviconUrl: '',

    // Palette colors
    primaryColor: '',
    primaryVariantColor: '',
    secondaryColor: '',
    secondaryVariantColor: '',
    accentColor: '',
    neutralColor: '',
    neutralVariantColor: '',
    successColor: '',
    warningColor: '',
    dangerColor: '',
    infoColor: '',

    // Surface colors
    surfaceBaseColor: '',
    surfaceRaisedColor: '',
    surfaceSunkenColor: '',
    surfaceOverlayColor: '',
    surfaceWarningColor: '',
    surfaceMutedColor: '',

    // Text colors
    textPrimaryColor: '',
    textSecondaryColor: '',
    textMutedColor: '',
    textInvertedColor: '',
    textAccentColor: '',

    // Interactive colors
    interactivePrimaryColor: '',
    interactivePrimaryHoverColor: '',
    interactivePrimaryActiveColor: '',
    interactivePrimaryForegroundColor: '',
    interactiveSecondaryColor: '',
    interactiveSecondaryHoverColor: '',
    interactiveSecondaryActiveColor: '',
    interactiveSecondaryForegroundColor: '',
    interactiveAccentColor: '',
    interactiveDestructiveColor: '',
    interactiveDestructiveHoverColor: '',
    interactiveDestructiveActiveColor: '',
    interactiveDestructiveForegroundColor: '',

    // Border colors
    borderSubtleColor: '',
    borderDefaultColor: '',
    borderStrongColor: '',
    borderFocusColor: '',
    borderWarningColor: '',

    // Status colors
    statusSuccessColor: '',
    statusWarningColor: '',
    statusDangerColor: '',
    statusInfoColor: '',

    // Typography - Font families
    fontFamilySans: '',
    fontFamilySerif: '',
    fontFamilyMono: '',

    // Typography - Sizes
    typographySizeXs: '',
    typographySizeSm: '',
    typographySizeMd: '',
    typographySizeLg: '',
    typographySizeXl: '',
    typographySize2xl: '',
    typographySize3xl: '',
    typographySize4xl: '',
    typographySize5xl: '',

    // Typography - Weights
    fontWeightRegular: 0,
    fontWeightMedium: 0,
    fontWeightSemibold: 0,
    fontWeightBold: 0,

    // Typography - Line heights
    lineHeightCompact: '',
    lineHeightStandard: '',
    lineHeightSpacious: '',

    // Typography - Letter spacing
    letterSpacingTight: '',
    letterSpacingNormal: '',
    letterSpacingWide: '',

    // Typography - Semantics
    typographySemanticBody: '',
    typographySemanticBodyStrong: '',
    typographySemanticCaption: '',
    typographySemanticButton: '',
    typographySemanticEyebrow: '',
    typographySemanticHeading: '',
    typographySemanticDisplay: '',

    // Spacing scale
    spacing2xs: '',
    spacingXs: '',
    spacingSm: '',
    spacingMd: '',
    spacingLg: '',
    spacingXl: '',
    spacing2xl: '',

    // Spacing semantic
    spacingPagePadding: '',
    spacingSectionGap: '',
    spacingCardPadding: '',
    spacingComponentGap: '',

    // Radii
    radiiNone: '',
    radiiSm: '',
    radiiMd: '',
    radiiLg: '',
    radiiPill: '',
    radiiFull: '',

    // Shadows
    shadowSm: '',
    shadowMd: '',
    shadowLg: '',

    // Legal
    legalCompanyName: '',
    legalSupportEmail: '',
    legalPrivacyPolicyUrl: '',
    legalTermsOfServiceUrl: '',

    // Motion - Durations
    motionDurationInstant: 0,
    motionDurationFast: 0,
    motionDurationBase: 0,
    motionDurationSlow: 0,
    motionDurationGlacial: 0,

    // Motion - Easings
    motionEasingStandard: '',
    motionEasingDecelerate: '',
    motionEasingAccelerate: '',
    motionEasingSpring: '',

    // Motion - Feature flags
    enableParallax: false,
    enableMagneticHover: false,
    enableScrollReveal: false,

    // Marketing flags
    showLandingPage: true,
    showMarketingContent: true,
    showPricingPage: false,

    // Optional advanced features
    enableButtonGradient: false,
    enableGlassmorphism: false,
    auroraGradient: [],
    glassColor: '',
    glassBorderColor: '',
};

export function TenantEditorModal({ open, onClose, onSave, tenant, mode }: TenantEditorModalProps) {
    const [formData, setFormData] = useState<TenantData>(EMPTY_TENANT_DATA);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);
    const [newDomain, setNewDomain] = useState('');

    // For "Copy from existing tenant" functionality
    const [creationMode, setCreationMode] = useState<CreationMode>('empty');
    const [existingTenants, setExistingTenants] = useState<FullTenant[]>([]);
    const [selectedSourceTenantId, setSelectedSourceTenantId] = useState<string>('');
    const [isLoadingTenants, setIsLoadingTenants] = useState(false);

    // Load existing tenants when modal opens in create mode
    useEffect(() => {
        if (open && mode === 'create') {
            setIsLoadingTenants(true);
            apiClient
                .listAllTenants()
                .then((response) => {
                    setExistingTenants(response.tenants);
                })
                .catch((err) => {
                    logError('Failed to load tenants for copy', err);
                })
                .finally(() => {
                    setIsLoadingTenants(false);
                });
        }
    }, [open, mode]);

    // When selecting a source tenant to copy from
    useEffect(() => {
        if (creationMode === 'copy' && selectedSourceTenantId) {
            const sourceTenant = existingTenants.find(t => t.tenant.tenantId === selectedSourceTenantId);
            if (sourceTenant?.brandingTokens?.tokens) {
                const tokenData = extractFormDataFromTokens(sourceTenant.brandingTokens.tokens);
                setFormData({
                    ...EMPTY_TENANT_DATA,
                    ...tokenData,
                    tenantId: '', // Don't copy tenant ID
                    appName: '', // Don't copy app name
                    domains: [], // Don't copy domains
                    showLandingPage: sourceTenant.tenant.branding?.marketingFlags?.showLandingPage ?? true,
                    showMarketingContent: sourceTenant.tenant.branding?.marketingFlags?.showMarketingContent ?? true,
                    showPricingPage: sourceTenant.tenant.branding?.marketingFlags?.showPricingPage ?? false,
                });
            }
        }
    }, [creationMode, selectedSourceTenantId, existingTenants]);

    useEffect(() => {
        if (mode === 'edit' && tenant) {
            const tokens = tenant.brandingTokens?.tokens;
            if (tokens) {
                const tokenData = extractFormDataFromTokens(tokens);
                setFormData({
                    ...EMPTY_TENANT_DATA,
                    ...tokenData,
                    tenantId: tenant.tenant.tenantId,
                    appName: tenant.tenant.branding?.appName ?? '',
                    showLandingPage: tenant.tenant.branding?.marketingFlags?.showLandingPage ?? false,
                    showMarketingContent: tenant.tenant.branding?.marketingFlags?.showMarketingContent ?? false,
                    showPricingPage: tenant.tenant.branding?.marketingFlags?.showPricingPage ?? false,
                    domains: tenant.domains ?? [],
                });
            } else {
                setFormData({
                    ...EMPTY_TENANT_DATA,
                    tenantId: tenant.tenant.tenantId,
                    appName: tenant.tenant.branding?.appName ?? '',
                    showLandingPage: tenant.tenant.branding?.marketingFlags?.showLandingPage ?? false,
                    showMarketingContent: tenant.tenant.branding?.marketingFlags?.showMarketingContent ?? false,
                    showPricingPage: tenant.tenant.branding?.marketingFlags?.showPricingPage ?? false,
                    domains: tenant.domains ?? [],
                });
            }
        } else if (mode === 'create') {
            setFormData({ ...EMPTY_TENANT_DATA });
            setCreationMode('empty');
            setSelectedSourceTenantId('');
        }
        setErrorMessage('');
        setSuccessMessage('');
    }, [tenant, mode]);

    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage('');
                setErrorMessage('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    // Check if all required fields are filled - removed since we now require ALL fields

    // Validate all required fields - NO fallback values allowed
    const validateAllRequiredFields = (): string | null => {
        // Basic info
        if (!formData.tenantId.trim()) return 'Tenant ID is required';
        if (!/^[a-z0-9-]+$/.test(formData.tenantId)) return 'Invalid Tenant ID: must contain only lowercase letters, numbers, and hyphens';
        if (!formData.appName.trim()) return 'App name is required';
        if (formData.domains.length === 0) return 'At least one domain is required';

        // Palette colors (11)
        if (!formData.primaryColor.trim()) return 'Primary color is required';
        if (!formData.primaryVariantColor.trim()) return 'Primary variant color is required';
        if (!formData.secondaryColor.trim()) return 'Secondary color is required';
        if (!formData.secondaryVariantColor.trim()) return 'Secondary variant color is required';
        if (!formData.accentColor.trim()) return 'Accent color is required';
        if (!formData.neutralColor.trim()) return 'Neutral color is required';
        if (!formData.neutralVariantColor.trim()) return 'Neutral variant color is required';
        if (!formData.successColor.trim()) return 'Success color is required';
        if (!formData.warningColor.trim()) return 'Warning color is required';
        if (!formData.dangerColor.trim()) return 'Danger color is required';
        if (!formData.infoColor.trim()) return 'Info color is required';

        // Surface colors (6)
        if (!formData.surfaceBaseColor.trim()) return 'Surface base color is required';
        if (!formData.surfaceRaisedColor.trim()) return 'Surface raised color is required';
        if (!formData.surfaceSunkenColor.trim()) return 'Surface sunken color is required';
        if (!formData.surfaceOverlayColor.trim()) return 'Surface overlay color is required';
        if (!formData.surfaceWarningColor.trim()) return 'Surface warning color is required';
        if (!formData.surfaceMutedColor.trim()) return 'Surface muted color is required';

        // Text colors (5)
        if (!formData.textPrimaryColor.trim()) return 'Text primary color is required';
        if (!formData.textSecondaryColor.trim()) return 'Text secondary color is required';
        if (!formData.textMutedColor.trim()) return 'Text muted color is required';
        if (!formData.textInvertedColor.trim()) return 'Text inverted color is required';
        if (!formData.textAccentColor.trim()) return 'Text accent color is required';

        // Interactive colors (13)
        if (!formData.interactivePrimaryColor.trim()) return 'Interactive primary color is required';
        if (!formData.interactivePrimaryHoverColor.trim()) return 'Interactive primary hover color is required';
        if (!formData.interactivePrimaryActiveColor.trim()) return 'Interactive primary active color is required';
        if (!formData.interactivePrimaryForegroundColor.trim()) return 'Interactive primary foreground color is required';
        if (!formData.interactiveSecondaryColor.trim()) return 'Interactive secondary color is required';
        if (!formData.interactiveSecondaryHoverColor.trim()) return 'Interactive secondary hover color is required';
        if (!formData.interactiveSecondaryActiveColor.trim()) return 'Interactive secondary active color is required';
        if (!formData.interactiveSecondaryForegroundColor.trim()) return 'Interactive secondary foreground color is required';
        if (!formData.interactiveAccentColor.trim()) return 'Interactive accent color is required';
        if (!formData.interactiveDestructiveColor.trim()) return 'Interactive destructive color is required';
        if (!formData.interactiveDestructiveHoverColor.trim()) return 'Interactive destructive hover color is required';
        if (!formData.interactiveDestructiveActiveColor.trim()) return 'Interactive destructive active color is required';
        if (!formData.interactiveDestructiveForegroundColor.trim()) return 'Interactive destructive foreground color is required';

        // Border colors (5)
        if (!formData.borderSubtleColor.trim()) return 'Border subtle color is required';
        if (!formData.borderDefaultColor.trim()) return 'Border default color is required';
        if (!formData.borderStrongColor.trim()) return 'Border strong color is required';
        if (!formData.borderFocusColor.trim()) return 'Border focus color is required';
        if (!formData.borderWarningColor.trim()) return 'Border warning color is required';

        // Status colors (4)
        if (!formData.statusSuccessColor.trim()) return 'Status success color is required';
        if (!formData.statusWarningColor.trim()) return 'Status warning color is required';
        if (!formData.statusDangerColor.trim()) return 'Status danger color is required';
        if (!formData.statusInfoColor.trim()) return 'Status info color is required';

        // Typography
        if (!formData.fontFamilySans.trim()) return 'Sans font family is required';
        if (!formData.fontFamilyMono.trim()) return 'Mono font family is required';
        if (!formData.typographySizeXs.trim()) return 'Typography size xs is required';
        if (!formData.typographySizeSm.trim()) return 'Typography size sm is required';
        if (!formData.typographySizeMd.trim()) return 'Typography size md is required';
        if (!formData.typographySizeLg.trim()) return 'Typography size lg is required';
        if (!formData.typographySizeXl.trim()) return 'Typography size xl is required';
        if (!formData.typographySize2xl.trim()) return 'Typography size 2xl is required';
        if (!formData.typographySize3xl.trim()) return 'Typography size 3xl is required';
        if (!formData.typographySize4xl.trim()) return 'Typography size 4xl is required';
        if (!formData.typographySize5xl.trim()) return 'Typography size 5xl is required';
        if (!formData.fontWeightRegular) return 'Font weight regular is required';
        if (!formData.fontWeightMedium) return 'Font weight medium is required';
        if (!formData.fontWeightSemibold) return 'Font weight semibold is required';
        if (!formData.fontWeightBold) return 'Font weight bold is required';
        if (!formData.lineHeightCompact.trim()) return 'Line height compact is required';
        if (!formData.lineHeightStandard.trim()) return 'Line height standard is required';
        if (!formData.lineHeightSpacious.trim()) return 'Line height spacious is required';
        if (!formData.letterSpacingTight.trim()) return 'Letter spacing tight is required';
        if (!formData.letterSpacingNormal.trim()) return 'Letter spacing normal is required';
        if (!formData.letterSpacingWide.trim()) return 'Letter spacing wide is required';

        // Spacing
        if (!formData.spacing2xs.trim()) return 'Spacing 2xs is required';
        if (!formData.spacingXs.trim()) return 'Spacing xs is required';
        if (!formData.spacingSm.trim()) return 'Spacing sm is required';
        if (!formData.spacingMd.trim()) return 'Spacing md is required';
        if (!formData.spacingLg.trim()) return 'Spacing lg is required';
        if (!formData.spacingXl.trim()) return 'Spacing xl is required';
        if (!formData.spacing2xl.trim()) return 'Spacing 2xl is required';
        if (!formData.spacingPagePadding.trim()) return 'Page padding is required';
        if (!formData.spacingSectionGap.trim()) return 'Section gap is required';
        if (!formData.spacingCardPadding.trim()) return 'Card padding is required';
        if (!formData.spacingComponentGap.trim()) return 'Component gap is required';

        // Radii
        if (!formData.radiiNone.trim()) return 'Radius none is required';
        if (!formData.radiiSm.trim()) return 'Radius sm is required';
        if (!formData.radiiMd.trim()) return 'Radius md is required';
        if (!formData.radiiLg.trim()) return 'Radius lg is required';
        if (!formData.radiiPill.trim()) return 'Radius pill is required';
        if (!formData.radiiFull.trim()) return 'Radius full is required';

        // Shadows
        if (!formData.shadowSm.trim()) return 'Shadow sm is required';
        if (!formData.shadowMd.trim()) return 'Shadow md is required';
        if (!formData.shadowLg.trim()) return 'Shadow lg is required';

        // Legal
        if (!formData.legalCompanyName.trim()) return 'Legal company name is required';
        if (!formData.legalSupportEmail.trim()) return 'Legal support email is required';
        if (!formData.legalPrivacyPolicyUrl.trim()) return 'Legal privacy policy URL is required';
        if (!formData.legalTermsOfServiceUrl.trim()) return 'Legal terms of service URL is required';

        // Motion (durations and easings)
        if (!formData.motionDurationInstant && formData.motionDurationInstant !== 0) return 'Motion duration instant is required';
        if (!formData.motionDurationFast && formData.motionDurationFast !== 0) return 'Motion duration fast is required';
        if (!formData.motionDurationBase && formData.motionDurationBase !== 0) return 'Motion duration base is required';
        if (!formData.motionDurationSlow && formData.motionDurationSlow !== 0) return 'Motion duration slow is required';
        if (!formData.motionDurationGlacial && formData.motionDurationGlacial !== 0) return 'Motion duration glacial is required';
        if (!formData.motionEasingStandard.trim()) return 'Motion easing standard is required';
        if (!formData.motionEasingDecelerate.trim()) return 'Motion easing decelerate is required';
        if (!formData.motionEasingAccelerate.trim()) return 'Motion easing accelerate is required';
        if (!formData.motionEasingSpring.trim()) return 'Motion easing spring is required';

        // Logo URL
        if (!formData.logoUrl.trim()) return 'Logo URL is required';

        return null;
    };

    const handleSave = async () => {
        const validationError = validateAllRequiredFields();
        if (validationError) {
            setErrorMessage(validationError);
            return;
        }

        const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
        for (const domain of formData.domains) {
            if (!domainRegex.test(domain)) {
                setErrorMessage(`Invalid domain: ${domain}`);
                return;
            }
        }

        setIsSaving(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const normalizedDomains = Array.from(new Set(formData.domains.map(d => d.trim().toLowerCase().replace(/:\d+$/, ''))));

            const branding: Record<string, unknown> = {
                appName: formData.appName,
                logoUrl: formData.logoUrl,
                faviconUrl: formData.faviconUrl || formData.logoUrl,
                primaryColor: formData.primaryColor,
                secondaryColor: formData.secondaryColor,
                accentColor: formData.accentColor,
                marketingFlags: {
                    showLandingPage: formData.showLandingPage,
                    showMarketingContent: formData.showMarketingContent,
                    showPricingPage: formData.showPricingPage,
                },
            };

            const brandingTokens = buildBrandingTokensFromForm(formData);

            const requestData = {
                tenantId: formData.tenantId,
                branding,
                brandingTokens,
                domains: normalizedDomains,
            } as AdminUpsertTenantRequest;

            const result = await apiClient.adminUpsertTenant(requestData);
            const action = result.created ? 'created' : 'updated';

            try {
                await apiClient.publishTenantTheme({ tenantId: formData.tenantId });
                setSuccessMessage(`Tenant ${action} and theme published successfully!`);
            } catch (publishError: any) {
                setSuccessMessage(`Tenant ${action} successfully, but theme publish failed. Click "Publish Theme" manually.`);
                logError('Auto-publish after save failed', publishError);
            }

            onSave();
            setTimeout(() => {
                onClose();
                setFormData({ ...EMPTY_TENANT_DATA });
            }, 1500);
        } catch (error: any) {
            const userFriendlyMessage = error.code === 'INVALID_TENANT_PAYLOAD'
                ? 'Invalid tenant data. Please check all fields and try again.'
                : error.code === 'PERMISSION_DENIED'
                ? 'You do not have permission to modify tenant settings.'
                : error.code === 'DUPLICATE_DOMAIN'
                ? error.message || 'One or more domains are already assigned to another tenant.'
                : error.message || 'Failed to save tenant. Please try again.';
            setErrorMessage(userFriendlyMessage);
            logError('Failed to save tenant', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!formData.tenantId) {
            setErrorMessage('Tenant ID is required for publishing');
            return;
        }
        setIsPublishing(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await apiClient.publishTenantTheme({ tenantId: formData.tenantId });
            setSuccessMessage('Theme published successfully!');
        } catch (error: any) {
            const userFriendlyMessage = error.code === 'TENANT_NOT_FOUND'
                ? 'Tenant does not exist. Save it before publishing.'
                : error.code === 'TENANT_TOKENS_MISSING'
                ? 'Tenant is missing branding tokens. Please configure branding and save first.'
                : error.message || 'Failed to publish theme. Please try again.';
            setErrorMessage(userFriendlyMessage);
            logError('Failed to publish tenant theme', error);
        } finally {
            setIsPublishing(false);
        }
    };

    const handleCancel = () => {
        setFormData({ ...EMPTY_TENANT_DATA });
        setErrorMessage('');
        setNewDomain('');
        setCreationMode('empty');
        setSelectedSourceTenantId('');
        onClose();
    };

    const handleAddDomain = () => {
        const domain = newDomain.trim().toLowerCase();
        if (domain && !formData.domains.includes(domain)) {
            setFormData({ ...formData, domains: [...formData.domains, domain] });
            setNewDomain('');
        }
    };

    const handleRemoveDomain = (index: number) => {
        const updated = [...formData.domains];
        updated.splice(index, 1);
        setFormData({ ...formData, domains: updated });
    };

    const handleLogoUpload = async (file: File) => {
        if (!formData.tenantId) {
            setErrorMessage('Please save the tenant first before uploading images');
            return;
        }
        try {
            const result = await apiClient.uploadTenantImage(formData.tenantId, 'logo', file);
            setFormData({ ...formData, logoUrl: result.url });
            setSuccessMessage('Logo uploaded successfully!');
        } catch (error: any) {
            setErrorMessage(error.message || 'Failed to upload logo');
            logError('Failed to upload logo', error);
        }
    };

    const handleFaviconUpload = async (file: File) => {
        if (!formData.tenantId) {
            setErrorMessage('Please save the tenant first before uploading images');
            return;
        }
        try {
            const result = await apiClient.uploadTenantImage(formData.tenantId, 'favicon', file);
            setFormData({ ...formData, faviconUrl: result.url });
            setSuccessMessage('Favicon uploaded successfully!');
        } catch (error: any) {
            setErrorMessage(error.message || 'Failed to upload favicon');
            logError('Failed to upload favicon', error);
        }
    };

    const update = (partial: Partial<TenantData>) => setFormData({ ...formData, ...partial });

    return (
        <Modal open={open} onClose={handleCancel} size='lg' data-testid='tenant-editor-modal'>
            <div class='flex flex-col max-h-[90vh]'>
                {/* Header */}
                <div class='flex items-center justify-between border-b border-border-default px-6 py-4'>
                    <div>
                        <h2 class='text-xl font-semibold text-text-primary'>
                            {mode === 'create' ? 'Create New Tenant' : 'Edit Tenant'}
                        </h2>
                        <p class='mt-1 text-sm text-text-muted'>
                            {mode === 'create' ? 'Configure a new tenant with branding and domains' : 'Update tenant configuration'}
                        </p>
                    </div>
                    <button onClick={handleCancel} class='text-text-muted hover:text-text-primary' data-testid='close-modal-button'>
                        <svg class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div class='flex-1 overflow-y-auto px-6 py-4'>
                    <div class='space-y-4'>
                        {successMessage && <Alert type='success' message={successMessage} data-testid='tenant-editor-success-message' />}
                        {errorMessage && <Alert type='error' message={errorMessage} />}

                        {/* Creation Mode Selection - Create Mode Only */}
                        {mode === 'create' && (
                            <Section title='Getting Started' description='Choose how to initialize your tenant' defaultOpen={true} testId='section-creation-mode'>
                                <div class='space-y-4'>
                                    <div class='flex gap-4'>
                                        <label class='flex items-center gap-2 cursor-pointer'>
                                            <input
                                                type='radio'
                                                name='creationMode'
                                                value='empty'
                                                checked={creationMode === 'empty'}
                                                onChange={() => {
                                                    setCreationMode('empty');
                                                    setSelectedSourceTenantId('');
                                                    setFormData({ ...EMPTY_TENANT_DATA });
                                                }}
                                                class='h-4 w-4'
                                                data-testid='creation-mode-empty'
                                            />
                                            <span class='text-sm font-medium text-text-primary'>Start from empty</span>
                                        </label>
                                        <label class='flex items-center gap-2 cursor-pointer'>
                                            <input
                                                type='radio'
                                                name='creationMode'
                                                value='copy'
                                                checked={creationMode === 'copy'}
                                                onChange={() => setCreationMode('copy')}
                                                disabled={existingTenants.length === 0}
                                                class='h-4 w-4'
                                                data-testid='creation-mode-copy'
                                            />
                                            <span class='text-sm font-medium text-text-primary'>Copy from existing tenant</span>
                                        </label>
                                    </div>

                                    {creationMode === 'empty' && (
                                        <div class='bg-surface-raised border border-border-subtle rounded-lg p-4'>
                                            <p class='text-sm text-text-secondary'>
                                                You will need to fill in all required fields. Colors should be in <code class='font-mono text-xs bg-surface-sunken px-1 rounded'>#RRGGBB</code> format.
                                            </p>
                                        </div>
                                    )}

                                    {creationMode === 'copy' && (
                                        <div class='space-y-3'>
                                            {isLoadingTenants
                                                ? <p class='text-sm text-text-muted'>Loading tenants...</p>
                                                : existingTenants.length === 0
                                                ? <p class='text-sm text-text-muted'>No existing tenants to copy from.</p>
                                                : (
                                                    <select
                                                        value={selectedSourceTenantId}
                                                        onChange={(e) => setSelectedSourceTenantId((e.target as HTMLSelectElement).value)}
                                                        class='w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm'
                                                        data-testid='source-tenant-select'
                                                    >
                                                        <option value=''>Select a tenant to copy...</option>
                                                        {existingTenants.map((t) => (
                                                            <option key={t.tenant.tenantId} value={t.tenant.tenantId}>
                                                                {t.tenant.tenantId} - {t.tenant.branding?.appName || 'Unnamed'}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            {selectedSourceTenantId && (
                                                <div class='bg-surface-raised border border-border-subtle rounded-lg p-4'>
                                                    <p class='text-sm text-text-secondary'>
                                                        All theme settings will be copied from{' '}
                                                        <strong>{selectedSourceTenantId}</strong>. You will still need to set a unique Tenant ID, App Name, and domains.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Section>
                        )}

                        {/* Basic Info - Always Open */}
                        <Section title='Basic Info' description='Tenant ID, name, and domains' defaultOpen={true} testId='section-basic-info'>
                            <Input
                                label='Tenant ID'
                                value={formData.tenantId}
                                onChange={(value) => update({ tenantId: value })}
                                placeholder='my-tenant-id'
                                disabled={mode === 'edit' || isSaving}
                                required
                                data-testid='tenant-id-input'
                            />
                            {mode === 'edit' && <p class='text-xs text-text-muted -mt-2'>Tenant ID cannot be changed</p>}

                            <Input
                                label='App Name'
                                value={formData.appName}
                                onChange={(value) => update({ appName: value })}
                                placeholder='My Expense App'
                                disabled={isSaving}
                                required
                                data-testid='app-name-input'
                            />

                            {/* Domains */}
                            <div class='space-y-2'>
                                <label class='block text-sm font-medium text-text-primary'>Domains</label>
                                {formData.domains.length > 0 && (
                                    <div class='flex flex-wrap gap-2'>
                                        {formData.domains.map((domain, index) => (
                                            <span key={index} class='inline-flex items-center gap-1 px-2 py-1 bg-surface-raised border border-border-default rounded text-sm font-mono'>
                                                {domain}
                                                <button
                                                    onClick={() =>
                                                        handleRemoveDomain(index)}
                                                    class='text-text-muted hover:text-status-danger'
                                                    data-testid={`remove-domain-${index}`}
                                                >
                                                    <svg class='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                                        <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
                                                    </svg>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div class='flex gap-2'>
                                    <input
                                        type='text'
                                        value={newDomain}
                                        onInput={(e) => setNewDomain((e.target as HTMLInputElement).value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddDomain()}
                                        placeholder='app.example.com'
                                        disabled={isSaving}
                                        class='flex-1 rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm'
                                        data-testid='new-domain-input'
                                    />
                                    <Button onClick={handleAddDomain} disabled={!newDomain.trim() || isSaving} variant='secondary' data-testid='add-domain-button'>Add</Button>
                                </div>
                            </div>
                        </Section>

                        {/* Required Fields Notice for Empty Slate */}
                        {mode === 'create' && creationMode === 'empty' && (
                            <div class='bg-semantic-warning-subtle border border-semantic-warning rounded-lg p-4'>
                                <p class='text-sm text-semantic-warning-emphasis'>
                                    <strong>Required:</strong> You must fill in ALL fields below before saving. There are no defaults.
                                </p>
                            </div>
                        )}

                        {/* Logo & Branding */}
                        <Section title='Logo & Assets' description='Logo and favicon images' testId='section-logo-assets'>
                            <div class='grid grid-cols-2 gap-4'>
                                <ImageUploadField
                                    label='Logo'
                                    accept='image/*'
                                    maxSizeMB={2}
                                    currentImageUrl={formData.logoUrl}
                                    onFileSelect={handleLogoUpload}
                                    onClear={() => update({ logoUrl: '' })}
                                    disabled={isSaving || !formData.tenantId}
                                    helperText={!formData.tenantId ? 'Save tenant first' : 'PNG, JPG, SVG'}
                                    allowUrlInput={true}
                                    data-testid='logo-upload-field'
                                />
                                <ImageUploadField
                                    label='Favicon'
                                    accept='image/x-icon,image/png,image/svg+xml'
                                    maxSizeMB={0.5}
                                    currentImageUrl={formData.faviconUrl}
                                    onFileSelect={handleFaviconUpload}
                                    onClear={() => update({ faviconUrl: '' })}
                                    disabled={isSaving || !formData.tenantId}
                                    helperText={!formData.tenantId ? 'Save tenant first' : 'ICO, PNG, SVG'}
                                    allowUrlInput={true}
                                    data-testid='favicon-upload-field'
                                />
                            </div>
                        </Section>

                        {/* Palette Colors */}
                        <Section title='Palette Colors' description='Core color palette (11 required)' defaultOpen={mode === 'create' && creationMode === 'empty'} testId='section-palette'>
                            <div class='space-y-4'>
                                <div class='grid grid-cols-2 gap-4'>
                                    <ColorInput
                                        id='primary-color'
                                        label='Primary *'
                                        value={formData.primaryColor}
                                        onChange={(v) => update({ primaryColor: v })}
                                        disabled={isSaving}
                                        testId='primary-color-input'
                                    />
                                    <ColorInput
                                        id='primary-variant'
                                        label='Primary Variant *'
                                        value={formData.primaryVariantColor}
                                        onChange={(v) => update({ primaryVariantColor: v })}
                                        disabled={isSaving}
                                        testId='primary-variant-color-input'
                                    />
                                </div>
                                <div class='grid grid-cols-2 gap-4'>
                                    <ColorInput
                                        id='secondary-color'
                                        label='Secondary *'
                                        value={formData.secondaryColor}
                                        onChange={(v) => update({ secondaryColor: v })}
                                        disabled={isSaving}
                                        testId='secondary-color-input'
                                    />
                                    <ColorInput
                                        id='secondary-variant'
                                        label='Secondary Variant *'
                                        value={formData.secondaryVariantColor}
                                        onChange={(v) => update({ secondaryVariantColor: v })}
                                        disabled={isSaving}
                                        testId='secondary-variant-color-input'
                                    />
                                </div>
                                <ColorInput
                                    id='accent-color'
                                    label='Accent *'
                                    value={formData.accentColor}
                                    onChange={(v) => update({ accentColor: v })}
                                    disabled={isSaving}
                                    testId='accent-color-input'
                                />
                                <div class='grid grid-cols-2 gap-4'>
                                    <ColorInput
                                        id='neutral-color'
                                        label='Neutral *'
                                        value={formData.neutralColor}
                                        onChange={(v) => update({ neutralColor: v })}
                                        disabled={isSaving}
                                        testId='neutral-color-input'
                                    />
                                    <ColorInput
                                        id='neutral-variant'
                                        label='Neutral Variant *'
                                        value={formData.neutralVariantColor}
                                        onChange={(v) => update({ neutralVariantColor: v })}
                                        disabled={isSaving}
                                        testId='neutral-variant-color-input'
                                    />
                                </div>
                                <div class='grid grid-cols-4 gap-4'>
                                    <ColorInput
                                        id='success-color'
                                        label='Success *'
                                        value={formData.successColor}
                                        onChange={(v) => update({ successColor: v })}
                                        disabled={isSaving}
                                        testId='success-color-input'
                                    />
                                    <ColorInput
                                        id='warning-color'
                                        label='Warning *'
                                        value={formData.warningColor}
                                        onChange={(v) => update({ warningColor: v })}
                                        disabled={isSaving}
                                        testId='warning-color-input'
                                    />
                                    <ColorInput
                                        id='danger-color'
                                        label='Danger *'
                                        value={formData.dangerColor}
                                        onChange={(v) => update({ dangerColor: v })}
                                        disabled={isSaving}
                                        testId='danger-color-input'
                                    />
                                    <ColorInput id='info-color' label='Info *' value={formData.infoColor} onChange={(v) => update({ infoColor: v })} disabled={isSaving} testId='info-color-input' />
                                </div>
                            </div>
                        </Section>

                        {/* Surface Colors */}
                        <Section
                            title='Surface Colors'
                            description='Background, card, and overlay colors (6 required)'
                            defaultOpen={mode === 'create' && creationMode === 'empty'}
                            testId='section-surfaces'
                        >
                            <div class='grid grid-cols-3 gap-4'>
                                <ColorInput
                                    id='surface-base'
                                    label='Base *'
                                    value={formData.surfaceBaseColor}
                                    onChange={(v) => update({ surfaceBaseColor: v })}
                                    disabled={isSaving}
                                    testId='surface-base-color-input'
                                />
                                <ColorInput
                                    id='surface-raised'
                                    label='Raised *'
                                    value={formData.surfaceRaisedColor}
                                    onChange={(v) => update({ surfaceRaisedColor: v })}
                                    disabled={isSaving}
                                    testId='surface-raised-color-input'
                                />
                                <ColorInput
                                    id='surface-sunken'
                                    label='Sunken *'
                                    value={formData.surfaceSunkenColor}
                                    onChange={(v) => update({ surfaceSunkenColor: v })}
                                    disabled={isSaving}
                                    testId='surface-sunken-color-input'
                                />
                            </div>
                            <div class='grid grid-cols-3 gap-4 mt-4'>
                                <div>
                                    <label class='block text-xs font-medium text-text-secondary mb-1'>Overlay * (rgba)</label>
                                    <input
                                        type='text'
                                        value={formData.surfaceOverlayColor}
                                        onInput={(e) => update({ surfaceOverlayColor: (e.target as HTMLInputElement).value })}
                                        placeholder='rgba(0, 0, 0, 0.5)'
                                        disabled={isSaving}
                                        class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        data-testid='surface-overlay-color-input'
                                    />
                                </div>
                                <ColorInput
                                    id='surface-warning'
                                    label='Warning *'
                                    value={formData.surfaceWarningColor}
                                    onChange={(v) => update({ surfaceWarningColor: v })}
                                    disabled={isSaving}
                                    testId='surface-warning-color-input'
                                />
                                <ColorInput
                                    id='surface-muted'
                                    label='Muted *'
                                    value={formData.surfaceMutedColor}
                                    onChange={(v) => update({ surfaceMutedColor: v })}
                                    disabled={isSaving}
                                    testId='surface-muted-color-input'
                                />
                            </div>
                        </Section>

                        {/* Text Colors */}
                        <Section title='Text Colors' description='Text color hierarchy (5 required)' defaultOpen={mode === 'create' && creationMode === 'empty'} testId='section-text'>
                            <div class='grid grid-cols-5 gap-4'>
                                <ColorInput
                                    id='text-primary'
                                    label='Primary *'
                                    value={formData.textPrimaryColor}
                                    onChange={(v) => update({ textPrimaryColor: v })}
                                    disabled={isSaving}
                                    testId='text-primary-color-input'
                                />
                                <ColorInput
                                    id='text-secondary'
                                    label='Secondary *'
                                    value={formData.textSecondaryColor}
                                    onChange={(v) => update({ textSecondaryColor: v })}
                                    disabled={isSaving}
                                    testId='text-secondary-color-input'
                                />
                                <ColorInput
                                    id='text-muted'
                                    label='Muted *'
                                    value={formData.textMutedColor}
                                    onChange={(v) => update({ textMutedColor: v })}
                                    disabled={isSaving}
                                    testId='text-muted-color-input'
                                />
                                <ColorInput
                                    id='text-inverted'
                                    label='Inverted *'
                                    value={formData.textInvertedColor}
                                    onChange={(v) => update({ textInvertedColor: v })}
                                    disabled={isSaving}
                                    testId='text-inverted-color-input'
                                />
                                <ColorInput
                                    id='text-accent'
                                    label='Accent *'
                                    value={formData.textAccentColor}
                                    onChange={(v) => update({ textAccentColor: v })}
                                    disabled={isSaving}
                                    testId='text-accent-color-input'
                                />
                            </div>
                        </Section>

                        {/* Interactive Colors */}
                        <Section title='Interactive Colors' description='Button and link states (13 required)' testId='section-interactive'>
                            <div class='space-y-4'>
                                <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide'>Primary</h4>
                                <div class='grid grid-cols-4 gap-4'>
                                    <ColorInput
                                        id='interactive-primary'
                                        label='Default *'
                                        value={formData.interactivePrimaryColor}
                                        onChange={(v) => update({ interactivePrimaryColor: v })}
                                        disabled={isSaving}
                                        testId='interactive-primary-color-input'
                                    />
                                    <ColorInput
                                        id='interactive-primary-hover'
                                        label='Hover *'
                                        value={formData.interactivePrimaryHoverColor}
                                        onChange={(v) => update({ interactivePrimaryHoverColor: v })}
                                        disabled={isSaving}
                                        testId='interactive-primary-hover-color-input'
                                    />
                                    <ColorInput
                                        id='interactive-primary-active'
                                        label='Active *'
                                        value={formData.interactivePrimaryActiveColor}
                                        onChange={(v) => update({ interactivePrimaryActiveColor: v })}
                                        disabled={isSaving}
                                        testId='interactive-primary-active-color-input'
                                    />
                                    <ColorInput
                                        id='interactive-primary-fg'
                                        label='Foreground *'
                                        value={formData.interactivePrimaryForegroundColor}
                                        onChange={(v) => update({ interactivePrimaryForegroundColor: v })}
                                        disabled={isSaving}
                                        testId='interactive-primary-foreground-color-input'
                                    />
                                </div>
                                <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide'>Secondary</h4>
                                <div class='grid grid-cols-4 gap-4'>
                                    <ColorInput
                                        id='interactive-secondary'
                                        label='Default *'
                                        value={formData.interactiveSecondaryColor}
                                        onChange={(v) => update({ interactiveSecondaryColor: v })}
                                        disabled={isSaving}
                                        testId='interactive-secondary-color-input'
                                    />
                                    <ColorInput
                                        id='interactive-secondary-hover'
                                        label='Hover *'
                                        value={formData.interactiveSecondaryHoverColor}
                                        onChange={(v) => update({ interactiveSecondaryHoverColor: v })}
                                        disabled={isSaving}
                                        testId='interactive-secondary-hover-color-input'
                                    />
                                    <ColorInput
                                        id='interactive-secondary-active'
                                        label='Active *'
                                        value={formData.interactiveSecondaryActiveColor}
                                        onChange={(v) => update({ interactiveSecondaryActiveColor: v })}
                                        disabled={isSaving}
                                        testId='interactive-secondary-active-color-input'
                                    />
                                    <ColorInput
                                        id='interactive-secondary-fg'
                                        label='Foreground *'
                                        value={formData.interactiveSecondaryForegroundColor}
                                        onChange={(v) => update({ interactiveSecondaryForegroundColor: v })}
                                        disabled={isSaving}
                                        testId='interactive-secondary-foreground-color-input'
                                    />
                                </div>
                                <ColorInput
                                    id='interactive-accent'
                                    label='Accent *'
                                    value={formData.interactiveAccentColor}
                                    onChange={(v) => update({ interactiveAccentColor: v })}
                                    disabled={isSaving}
                                    testId='interactive-accent-color-input'
                                />
                                <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide'>Destructive</h4>
                                <div class='grid grid-cols-4 gap-4'>
                                    <ColorInput
                                        id='interactive-destructive'
                                        label='Default *'
                                        value={formData.interactiveDestructiveColor}
                                        onChange={(v) => update({ interactiveDestructiveColor: v })}
                                        disabled={isSaving}
                                        testId='interactive-destructive-color-input'
                                    />
                                    <ColorInput
                                        id='interactive-destructive-hover'
                                        label='Hover *'
                                        value={formData.interactiveDestructiveHoverColor}
                                        onChange={(v) => update({ interactiveDestructiveHoverColor: v })}
                                        disabled={isSaving}
                                        testId='interactive-destructive-hover-color-input'
                                    />
                                    <ColorInput
                                        id='interactive-destructive-active'
                                        label='Active *'
                                        value={formData.interactiveDestructiveActiveColor}
                                        onChange={(v) => update({ interactiveDestructiveActiveColor: v })}
                                        disabled={isSaving}
                                        testId='interactive-destructive-active-color-input'
                                    />
                                    <ColorInput
                                        id='interactive-destructive-fg'
                                        label='Foreground *'
                                        value={formData.interactiveDestructiveForegroundColor}
                                        onChange={(v) => update({ interactiveDestructiveForegroundColor: v })}
                                        disabled={isSaving}
                                        testId='interactive-destructive-foreground-color-input'
                                    />
                                </div>
                                <Toggle
                                    label='Gradient buttons'
                                    checked={formData.enableButtonGradient}
                                    onChange={(v) => update({ enableButtonGradient: v })}
                                    disabled={isSaving}
                                    testId='enable-button-gradient-checkbox'
                                />
                            </div>
                        </Section>

                        {/* Border Colors */}
                        <Section title='Border Colors' description='Border color levels (5 required)' defaultOpen={mode === 'create' && creationMode === 'empty'} testId='section-borders'>
                            <div class='grid grid-cols-5 gap-4'>
                                <ColorInput
                                    id='border-subtle'
                                    label='Subtle *'
                                    value={formData.borderSubtleColor}
                                    onChange={(v) => update({ borderSubtleColor: v })}
                                    disabled={isSaving}
                                    testId='border-subtle-color-input'
                                />
                                <ColorInput
                                    id='border-default'
                                    label='Default *'
                                    value={formData.borderDefaultColor}
                                    onChange={(v) => update({ borderDefaultColor: v })}
                                    disabled={isSaving}
                                    testId='border-default-color-input'
                                />
                                <ColorInput
                                    id='border-strong'
                                    label='Strong *'
                                    value={formData.borderStrongColor}
                                    onChange={(v) => update({ borderStrongColor: v })}
                                    disabled={isSaving}
                                    testId='border-strong-color-input'
                                />
                                <ColorInput
                                    id='border-focus'
                                    label='Focus *'
                                    value={formData.borderFocusColor}
                                    onChange={(v) => update({ borderFocusColor: v })}
                                    disabled={isSaving}
                                    testId='border-focus-color-input'
                                />
                                <ColorInput
                                    id='border-warning'
                                    label='Warning *'
                                    value={formData.borderWarningColor}
                                    onChange={(v) => update({ borderWarningColor: v })}
                                    disabled={isSaving}
                                    testId='border-warning-color-input'
                                />
                            </div>
                        </Section>

                        {/* Status Colors */}
                        <Section title='Status Colors' description='Semantic status colors (4 required)' testId='section-status-colors'>
                            <div class='grid grid-cols-4 gap-4'>
                                <ColorInput
                                    id='status-success'
                                    label='Success *'
                                    value={formData.statusSuccessColor}
                                    onChange={(v) => update({ statusSuccessColor: v })}
                                    disabled={isSaving}
                                    testId='status-success-color-input'
                                />
                                <ColorInput
                                    id='status-warning'
                                    label='Warning *'
                                    value={formData.statusWarningColor}
                                    onChange={(v) => update({ statusWarningColor: v })}
                                    disabled={isSaving}
                                    testId='status-warning-color-input'
                                />
                                <ColorInput
                                    id='status-danger'
                                    label='Danger *'
                                    value={formData.statusDangerColor}
                                    onChange={(v) => update({ statusDangerColor: v })}
                                    disabled={isSaving}
                                    testId='status-danger-color-input'
                                />
                                <ColorInput
                                    id='status-info'
                                    label='Info *'
                                    value={formData.statusInfoColor}
                                    onChange={(v) => update({ statusInfoColor: v })}
                                    disabled={isSaving}
                                    testId='status-info-color-input'
                                />
                            </div>
                        </Section>

                        {/* Motion & Effects */}
                        <Section title='Motion & Effects' description='Animation settings and feature flags' testId='section-motion-effects'>
                            <div class='space-y-4'>
                                <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide'>Feature Flags</h4>
                                <div class='space-y-3'>
                                    <Toggle
                                        label='Parallax / Aurora Background'
                                        description='Animated gradient background'
                                        checked={formData.enableParallax}
                                        onChange={(v) => update({ enableParallax: v })}
                                        disabled={isSaving}
                                        testId='enable-parallax-checkbox'
                                    />
                                    <Toggle
                                        label='Glassmorphism'
                                        description='Frosted glass effect'
                                        checked={formData.enableGlassmorphism}
                                        onChange={(v) => update({ enableGlassmorphism: v })}
                                        disabled={isSaving}
                                        testId='enable-glassmorphism-checkbox'
                                    />
                                    <Toggle
                                        label='Magnetic Hover'
                                        description='Buttons follow cursor'
                                        checked={formData.enableMagneticHover}
                                        onChange={(v) => update({ enableMagneticHover: v })}
                                        disabled={isSaving}
                                        testId='enable-magnetic-hover-checkbox'
                                    />
                                    <Toggle
                                        label='Scroll Reveal'
                                        description='Animate elements on scroll'
                                        checked={formData.enableScrollReveal}
                                        onChange={(v) => update({ enableScrollReveal: v })}
                                        disabled={isSaving}
                                        testId='enable-scroll-reveal-checkbox'
                                    />
                                </div>
                                <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide'>Durations (ms)</h4>
                                <div class='grid grid-cols-5 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Instant</label>
                                        <input
                                            type='number'
                                            value={formData.motionDurationInstant}
                                            onInput={(e) => update({ motionDurationInstant: parseInt((e.target as HTMLInputElement).value) || 0 })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                            data-testid='motion-duration-instant-input'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Fast</label>
                                        <input
                                            type='number'
                                            value={formData.motionDurationFast}
                                            onInput={(e) => update({ motionDurationFast: parseInt((e.target as HTMLInputElement).value) || 0 })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                            data-testid='motion-duration-fast-input'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Base</label>
                                        <input
                                            type='number'
                                            value={formData.motionDurationBase}
                                            onInput={(e) => update({ motionDurationBase: parseInt((e.target as HTMLInputElement).value) || 0 })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                            data-testid='motion-duration-base-input'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Slow</label>
                                        <input
                                            type='number'
                                            value={formData.motionDurationSlow}
                                            onInput={(e) => update({ motionDurationSlow: parseInt((e.target as HTMLInputElement).value) || 0 })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                            data-testid='motion-duration-slow-input'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Glacial</label>
                                        <input
                                            type='number'
                                            value={formData.motionDurationGlacial}
                                            onInput={(e) => update({ motionDurationGlacial: parseInt((e.target as HTMLInputElement).value) || 0 })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                            data-testid='motion-duration-glacial-input'
                                        />
                                    </div>
                                </div>
                                <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide'>Easing Curves</h4>
                                <div class='grid grid-cols-2 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Standard</label>
                                        <input
                                            type='text'
                                            value={formData.motionEasingStandard}
                                            onInput={(e) => update({ motionEasingStandard: (e.target as HTMLInputElement).value })}
                                            placeholder='cubic-bezier(0.4, 0, 0.2, 1)'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                            data-testid='motion-easing-standard-input'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Decelerate</label>
                                        <input
                                            type='text'
                                            value={formData.motionEasingDecelerate}
                                            onInput={(e) => update({ motionEasingDecelerate: (e.target as HTMLInputElement).value })}
                                            placeholder='cubic-bezier(0, 0, 0.2, 1)'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                            data-testid='motion-easing-decelerate-input'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Accelerate</label>
                                        <input
                                            type='text'
                                            value={formData.motionEasingAccelerate}
                                            onInput={(e) => update({ motionEasingAccelerate: (e.target as HTMLInputElement).value })}
                                            placeholder='cubic-bezier(0.4, 0, 1, 1)'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                            data-testid='motion-easing-accelerate-input'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Spring</label>
                                        <input
                                            type='text'
                                            value={formData.motionEasingSpring}
                                            onInput={(e) => update({ motionEasingSpring: (e.target as HTMLInputElement).value })}
                                            placeholder='cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                            data-testid='motion-easing-spring-input'
                                        />
                                    </div>
                                </div>
                            </div>
                        </Section>

                        {/* Aurora Gradient */}
                        {formData.enableParallax && (
                            <Section title='Aurora Gradient' description='2-4 colors for the aurora animation' testId='section-aurora-gradient' defaultOpen={true}>
                                <div class='grid grid-cols-4 gap-4'>
                                    {[0, 1, 2, 3].map((i) => (
                                        <ColorInput
                                            key={i}
                                            id={`aurora-${i}`}
                                            label={`Color ${i + 1}${i < 2 ? ' *' : ''}`}
                                            value={formData.auroraGradient[i] || ''}
                                            onChange={(v) => {
                                                const newGradient = [...formData.auroraGradient];
                                                newGradient[i] = v;
                                                update({ auroraGradient: newGradient });
                                            }}
                                            disabled={isSaving}
                                            testId={`aurora-gradient-color-${i + 1}-input`}
                                        />
                                    ))}
                                </div>
                            </Section>
                        )}

                        {/* Glassmorphism Settings */}
                        {formData.enableGlassmorphism && (
                            <Section title='Glassmorphism Settings' description='Glass effect colors (RGBA)' testId='section-glassmorphism-settings' defaultOpen={true}>
                                <div class='grid grid-cols-2 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Glass Color</label>
                                        <input
                                            type='text'
                                            value={formData.glassColor}
                                            onInput={(e) => update({ glassColor: (e.target as HTMLInputElement).value })}
                                            placeholder='rgba(25, 30, 50, 0.45)'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                            data-testid='glass-color-input'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Glass Border</label>
                                        <input
                                            type='text'
                                            value={formData.glassBorderColor}
                                            onInput={(e) => update({ glassBorderColor: (e.target as HTMLInputElement).value })}
                                            placeholder='rgba(255, 255, 255, 0.12)'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                            data-testid='glass-border-color-input'
                                        />
                                    </div>
                                </div>
                            </Section>
                        )}

                        {/* Typography */}
                        <Section title='Typography' description='Font families, sizes, weights, and more' testId='section-typography'>
                            <div class='space-y-4'>
                                <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide'>Font Families</h4>
                                <div class='grid grid-cols-3 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Sans *</label>
                                        <input
                                            type='text'
                                            value={formData.fontFamilySans}
                                            onInput={(e) => update({ fontFamilySans: (e.target as HTMLInputElement).value })}
                                            placeholder='Inter, system-ui'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                            data-testid='font-family-sans-input'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Serif</label>
                                        <input
                                            type='text'
                                            value={formData.fontFamilySerif}
                                            onInput={(e) => update({ fontFamilySerif: (e.target as HTMLInputElement).value })}
                                            placeholder='Georgia, serif'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                            data-testid='font-family-serif-input'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Mono *</label>
                                        <input
                                            type='text'
                                            value={formData.fontFamilyMono}
                                            onInput={(e) => update({ fontFamilyMono: (e.target as HTMLInputElement).value })}
                                            placeholder='Monaco, monospace'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                            data-testid='font-family-mono-input'
                                        />
                                    </div>
                                </div>

                                <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide'>Sizes (rem)</h4>
                                <div class='grid grid-cols-5 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>XS *</label>
                                        <input
                                            type='text'
                                            value={formData.typographySizeXs}
                                            onInput={(e) => update({ typographySizeXs: (e.target as HTMLInputElement).value })}
                                            placeholder='0.75rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>SM *</label>
                                        <input
                                            type='text'
                                            value={formData.typographySizeSm}
                                            onInput={(e) => update({ typographySizeSm: (e.target as HTMLInputElement).value })}
                                            placeholder='0.875rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>MD *</label>
                                        <input
                                            type='text'
                                            value={formData.typographySizeMd}
                                            onInput={(e) => update({ typographySizeMd: (e.target as HTMLInputElement).value })}
                                            placeholder='1rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>LG *</label>
                                        <input
                                            type='text'
                                            value={formData.typographySizeLg}
                                            onInput={(e) => update({ typographySizeLg: (e.target as HTMLInputElement).value })}
                                            placeholder='1.125rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>XL *</label>
                                        <input
                                            type='text'
                                            value={formData.typographySizeXl}
                                            onInput={(e) => update({ typographySizeXl: (e.target as HTMLInputElement).value })}
                                            placeholder='1.25rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                </div>
                                <div class='grid grid-cols-4 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>2XL *</label>
                                        <input
                                            type='text'
                                            value={formData.typographySize2xl}
                                            onInput={(e) => update({ typographySize2xl: (e.target as HTMLInputElement).value })}
                                            placeholder='1.5rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>3XL *</label>
                                        <input
                                            type='text'
                                            value={formData.typographySize3xl}
                                            onInput={(e) => update({ typographySize3xl: (e.target as HTMLInputElement).value })}
                                            placeholder='1.875rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>4XL *</label>
                                        <input
                                            type='text'
                                            value={formData.typographySize4xl}
                                            onInput={(e) => update({ typographySize4xl: (e.target as HTMLInputElement).value })}
                                            placeholder='2.25rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>5XL *</label>
                                        <input
                                            type='text'
                                            value={formData.typographySize5xl}
                                            onInput={(e) => update({ typographySize5xl: (e.target as HTMLInputElement).value })}
                                            placeholder='3rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                </div>

                                <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide'>Weights</h4>
                                <div class='grid grid-cols-4 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Regular *</label>
                                        <input
                                            type='number'
                                            value={formData.fontWeightRegular}
                                            onInput={(e) => update({ fontWeightRegular: parseInt((e.target as HTMLInputElement).value) || 0 })}
                                            placeholder='400'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Medium *</label>
                                        <input
                                            type='number'
                                            value={formData.fontWeightMedium}
                                            onInput={(e) => update({ fontWeightMedium: parseInt((e.target as HTMLInputElement).value) || 0 })}
                                            placeholder='500'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Semibold *</label>
                                        <input
                                            type='number'
                                            value={formData.fontWeightSemibold}
                                            onInput={(e) => update({ fontWeightSemibold: parseInt((e.target as HTMLInputElement).value) || 0 })}
                                            placeholder='600'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Bold *</label>
                                        <input
                                            type='number'
                                            value={formData.fontWeightBold}
                                            onInput={(e) => update({ fontWeightBold: parseInt((e.target as HTMLInputElement).value) || 0 })}
                                            placeholder='700'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                        />
                                    </div>
                                </div>

                                <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide'>Line Heights</h4>
                                <div class='grid grid-cols-3 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Compact *</label>
                                        <input
                                            type='text'
                                            value={formData.lineHeightCompact}
                                            onInput={(e) => update({ lineHeightCompact: (e.target as HTMLInputElement).value })}
                                            placeholder='1.25rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Standard *</label>
                                        <input
                                            type='text'
                                            value={formData.lineHeightStandard}
                                            onInput={(e) => update({ lineHeightStandard: (e.target as HTMLInputElement).value })}
                                            placeholder='1.5rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Spacious *</label>
                                        <input
                                            type='text'
                                            value={formData.lineHeightSpacious}
                                            onInput={(e) => update({ lineHeightSpacious: (e.target as HTMLInputElement).value })}
                                            placeholder='1.75rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                </div>

                                <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide'>Letter Spacing</h4>
                                <div class='grid grid-cols-3 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Tight *</label>
                                        <input
                                            type='text'
                                            value={formData.letterSpacingTight}
                                            onInput={(e) => update({ letterSpacingTight: (e.target as HTMLInputElement).value })}
                                            placeholder='-0.02rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Normal *</label>
                                        <input
                                            type='text'
                                            value={formData.letterSpacingNormal}
                                            onInput={(e) => update({ letterSpacingNormal: (e.target as HTMLInputElement).value })}
                                            placeholder='0rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Wide *</label>
                                        <input
                                            type='text'
                                            value={formData.letterSpacingWide}
                                            onInput={(e) => update({ letterSpacingWide: (e.target as HTMLInputElement).value })}
                                            placeholder='0.02rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                </div>

                                <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide'>Semantic Sizes</h4>
                                <div class='grid grid-cols-4 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Body *</label>
                                        <select
                                            value={formData.typographySemanticBody}
                                            onChange={(e) => update({ typographySemanticBody: (e.target as HTMLSelectElement).value })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                        >
                                            <option value='xs'>xs</option>
                                            <option value='sm'>sm</option>
                                            <option value='md'>md</option>
                                            <option value='lg'>lg</option>
                                            <option value='xl'>xl</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Body Strong *</label>
                                        <select
                                            value={formData.typographySemanticBodyStrong}
                                            onChange={(e) => update({ typographySemanticBodyStrong: (e.target as HTMLSelectElement).value })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                        >
                                            <option value='xs'>xs</option>
                                            <option value='sm'>sm</option>
                                            <option value='md'>md</option>
                                            <option value='lg'>lg</option>
                                            <option value='xl'>xl</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Caption *</label>
                                        <select
                                            value={formData.typographySemanticCaption}
                                            onChange={(e) => update({ typographySemanticCaption: (e.target as HTMLSelectElement).value })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                        >
                                            <option value='xs'>xs</option>
                                            <option value='sm'>sm</option>
                                            <option value='md'>md</option>
                                            <option value='lg'>lg</option>
                                            <option value='xl'>xl</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Button *</label>
                                        <select
                                            value={formData.typographySemanticButton}
                                            onChange={(e) => update({ typographySemanticButton: (e.target as HTMLSelectElement).value })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                        >
                                            <option value='xs'>xs</option>
                                            <option value='sm'>sm</option>
                                            <option value='md'>md</option>
                                            <option value='lg'>lg</option>
                                            <option value='xl'>xl</option>
                                        </select>
                                    </div>
                                </div>
                                <div class='grid grid-cols-3 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Eyebrow *</label>
                                        <select
                                            value={formData.typographySemanticEyebrow}
                                            onChange={(e) => update({ typographySemanticEyebrow: (e.target as HTMLSelectElement).value })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                        >
                                            <option value='xs'>xs</option>
                                            <option value='sm'>sm</option>
                                            <option value='md'>md</option>
                                            <option value='lg'>lg</option>
                                            <option value='xl'>xl</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Heading *</label>
                                        <select
                                            value={formData.typographySemanticHeading}
                                            onChange={(e) => update({ typographySemanticHeading: (e.target as HTMLSelectElement).value })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                        >
                                            <option value='xl'>xl</option>
                                            <option value='2xl'>2xl</option>
                                            <option value='3xl'>3xl</option>
                                            <option value='4xl'>4xl</option>
                                            <option value='5xl'>5xl</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Display *</label>
                                        <select
                                            value={formData.typographySemanticDisplay}
                                            onChange={(e) => update({ typographySemanticDisplay: (e.target as HTMLSelectElement).value })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                        >
                                            <option value='2xl'>2xl</option>
                                            <option value='3xl'>3xl</option>
                                            <option value='4xl'>4xl</option>
                                            <option value='5xl'>5xl</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </Section>

                        {/* Spacing */}
                        <Section title='Spacing' description='Scale and semantic spacing values' testId='section-spacing'>
                            <div class='space-y-4'>
                                <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide'>Scale</h4>
                                <div class='grid grid-cols-7 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>2XS *</label>
                                        <input
                                            type='text'
                                            value={formData.spacing2xs}
                                            onInput={(e) => update({ spacing2xs: (e.target as HTMLInputElement).value })}
                                            placeholder='0.25rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>XS *</label>
                                        <input
                                            type='text'
                                            value={formData.spacingXs}
                                            onInput={(e) => update({ spacingXs: (e.target as HTMLInputElement).value })}
                                            placeholder='0.5rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>SM *</label>
                                        <input
                                            type='text'
                                            value={formData.spacingSm}
                                            onInput={(e) => update({ spacingSm: (e.target as HTMLInputElement).value })}
                                            placeholder='0.75rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>MD *</label>
                                        <input
                                            type='text'
                                            value={formData.spacingMd}
                                            onInput={(e) => update({ spacingMd: (e.target as HTMLInputElement).value })}
                                            placeholder='1rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>LG *</label>
                                        <input
                                            type='text'
                                            value={formData.spacingLg}
                                            onInput={(e) => update({ spacingLg: (e.target as HTMLInputElement).value })}
                                            placeholder='1.5rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>XL *</label>
                                        <input
                                            type='text'
                                            value={formData.spacingXl}
                                            onInput={(e) => update({ spacingXl: (e.target as HTMLInputElement).value })}
                                            placeholder='2rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>2XL *</label>
                                        <input
                                            type='text'
                                            value={formData.spacing2xl}
                                            onInput={(e) => update({ spacing2xl: (e.target as HTMLInputElement).value })}
                                            placeholder='3rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                </div>
                                <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide'>Semantic</h4>
                                <div class='grid grid-cols-4 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Page Padding *</label>
                                        <input
                                            type='text'
                                            value={formData.spacingPagePadding}
                                            onInput={(e) => update({ spacingPagePadding: (e.target as HTMLInputElement).value })}
                                            placeholder='1.5rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Section Gap *</label>
                                        <input
                                            type='text'
                                            value={formData.spacingSectionGap}
                                            onInput={(e) => update({ spacingSectionGap: (e.target as HTMLInputElement).value })}
                                            placeholder='2rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Card Padding *</label>
                                        <input
                                            type='text'
                                            value={formData.spacingCardPadding}
                                            onInput={(e) => update({ spacingCardPadding: (e.target as HTMLInputElement).value })}
                                            placeholder='1.5rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Component Gap *</label>
                                        <input
                                            type='text'
                                            value={formData.spacingComponentGap}
                                            onInput={(e) => update({ spacingComponentGap: (e.target as HTMLInputElement).value })}
                                            placeholder='1rem'
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                        />
                                    </div>
                                </div>
                            </div>
                        </Section>

                        {/* Radii */}
                        <Section title='Border Radii' description='Corner radius values' testId='section-radii'>
                            <div class='grid grid-cols-6 gap-4'>
                                <div>
                                    <label class='block text-xs font-medium text-text-secondary mb-1'>None *</label>
                                    <input
                                        type='text'
                                        value={formData.radiiNone}
                                        onInput={(e) => update({ radiiNone: (e.target as HTMLInputElement).value })}
                                        placeholder='0px'
                                        disabled={isSaving}
                                        class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                    />
                                </div>
                                <div>
                                    <label class='block text-xs font-medium text-text-secondary mb-1'>SM *</label>
                                    <input
                                        type='text'
                                        value={formData.radiiSm}
                                        onInput={(e) => update({ radiiSm: (e.target as HTMLInputElement).value })}
                                        placeholder='4px'
                                        disabled={isSaving}
                                        class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                    />
                                </div>
                                <div>
                                    <label class='block text-xs font-medium text-text-secondary mb-1'>MD *</label>
                                    <input
                                        type='text'
                                        value={formData.radiiMd}
                                        onInput={(e) => update({ radiiMd: (e.target as HTMLInputElement).value })}
                                        placeholder='8px'
                                        disabled={isSaving}
                                        class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                    />
                                </div>
                                <div>
                                    <label class='block text-xs font-medium text-text-secondary mb-1'>LG *</label>
                                    <input
                                        type='text'
                                        value={formData.radiiLg}
                                        onInput={(e) => update({ radiiLg: (e.target as HTMLInputElement).value })}
                                        placeholder='12px'
                                        disabled={isSaving}
                                        class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                    />
                                </div>
                                <div>
                                    <label class='block text-xs font-medium text-text-secondary mb-1'>Pill *</label>
                                    <input
                                        type='text'
                                        value={formData.radiiPill}
                                        onInput={(e) => update({ radiiPill: (e.target as HTMLInputElement).value })}
                                        placeholder='9999px'
                                        disabled={isSaving}
                                        class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                    />
                                </div>
                                <div>
                                    <label class='block text-xs font-medium text-text-secondary mb-1'>Full *</label>
                                    <input
                                        type='text'
                                        value={formData.radiiFull}
                                        onInput={(e) => update({ radiiFull: (e.target as HTMLInputElement).value })}
                                        placeholder='9999px'
                                        disabled={isSaving}
                                        class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                    />
                                </div>
                            </div>
                        </Section>

                        {/* Shadows */}
                        <Section title='Shadows' description='Box shadow values' testId='section-shadows'>
                            <div class='grid grid-cols-3 gap-4'>
                                <div>
                                    <label class='block text-xs font-medium text-text-secondary mb-1'>Small *</label>
                                    <input
                                        type='text'
                                        value={formData.shadowSm}
                                        onInput={(e) => update({ shadowSm: (e.target as HTMLInputElement).value })}
                                        placeholder='0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                        disabled={isSaving}
                                        class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                    />
                                </div>
                                <div>
                                    <label class='block text-xs font-medium text-text-secondary mb-1'>Medium *</label>
                                    <input
                                        type='text'
                                        value={formData.shadowMd}
                                        onInput={(e) => update({ shadowMd: (e.target as HTMLInputElement).value })}
                                        placeholder='0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                        disabled={isSaving}
                                        class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                    />
                                </div>
                                <div>
                                    <label class='block text-xs font-medium text-text-secondary mb-1'>Large *</label>
                                    <input
                                        type='text'
                                        value={formData.shadowLg}
                                        onInput={(e) => update({ shadowLg: (e.target as HTMLInputElement).value })}
                                        placeholder='0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                        disabled={isSaving}
                                        class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm font-mono'
                                    />
                                </div>
                            </div>
                        </Section>

                        {/* Legal */}
                        <Section title='Legal' description='Company and policy information' testId='section-legal'>
                            <div class='grid grid-cols-2 gap-4'>
                                <div>
                                    <label class='block text-xs font-medium text-text-secondary mb-1'>Company Name *</label>
                                    <input
                                        type='text'
                                        value={formData.legalCompanyName}
                                        onInput={(e) => update({ legalCompanyName: (e.target as HTMLInputElement).value })}
                                        placeholder='Your Company'
                                        disabled={isSaving}
                                        class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                    />
                                </div>
                                <div>
                                    <label class='block text-xs font-medium text-text-secondary mb-1'>Support Email *</label>
                                    <input
                                        type='email'
                                        value={formData.legalSupportEmail}
                                        onInput={(e) => update({ legalSupportEmail: (e.target as HTMLInputElement).value })}
                                        placeholder='support@example.com'
                                        disabled={isSaving}
                                        class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                    />
                                </div>
                                <div>
                                    <label class='block text-xs font-medium text-text-secondary mb-1'>Privacy Policy URL *</label>
                                    <input
                                        type='url'
                                        value={formData.legalPrivacyPolicyUrl}
                                        onInput={(e) => update({ legalPrivacyPolicyUrl: (e.target as HTMLInputElement).value })}
                                        placeholder='https://example.com/privacy'
                                        disabled={isSaving}
                                        class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                    />
                                </div>
                                <div>
                                    <label class='block text-xs font-medium text-text-secondary mb-1'>Terms of Service URL *</label>
                                    <input
                                        type='url'
                                        value={formData.legalTermsOfServiceUrl}
                                        onInput={(e) => update({ legalTermsOfServiceUrl: (e.target as HTMLInputElement).value })}
                                        placeholder='https://example.com/terms'
                                        disabled={isSaving}
                                        class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                    />
                                </div>
                            </div>
                        </Section>

                        {/* Marketing */}
                        <Section title='Marketing' description='Page visibility flags' testId='section-marketing'>
                            <div class='space-y-3'>
                                <Toggle
                                    label='Landing Page'
                                    checked={formData.showLandingPage}
                                    onChange={(v) => update({ showLandingPage: v })}
                                    disabled={isSaving}
                                    testId='show-landing-page-checkbox'
                                />
                                <Toggle
                                    label='Marketing Content'
                                    checked={formData.showMarketingContent}
                                    onChange={(v) => update({ showMarketingContent: v })}
                                    disabled={isSaving}
                                    testId='show-marketing-content-checkbox'
                                />
                                <Toggle
                                    label='Pricing Page'
                                    checked={formData.showPricingPage}
                                    onChange={(v) => update({ showPricingPage: v })}
                                    disabled={isSaving}
                                    testId='show-pricing-page-checkbox'
                                />
                            </div>
                        </Section>
                    </div>
                </div>

                {/* Footer */}
                <div class='flex items-center justify-end gap-3 border-t border-border-default px-6 py-4'>
                    <Button onClick={handleCancel} variant='secondary' disabled={isSaving || isPublishing} data-testid='cancel-button'>Cancel</Button>
                    {mode === 'edit' && (
                        <Button onClick={handlePublish} variant='primary' disabled={isSaving || isPublishing} loading={isPublishing} data-testid='publish-theme-button'>
                            {isPublishing ? 'Publishing...' : 'Publish Theme'}
                        </Button>
                    )}
                    <Button onClick={handleSave} variant='primary' loading={isSaving} disabled={isSaving} data-testid='save-tenant-button'>
                        {isSaving ? 'Saving...' : (mode === 'create' ? 'Create Tenant' : 'Save Changes')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
