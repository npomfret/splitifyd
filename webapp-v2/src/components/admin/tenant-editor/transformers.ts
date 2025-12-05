import type { BrandingTokens, TenantBranding } from '@billsplit-wl/shared';
import type { TenantData } from './types';

export function extractFormDataFromTokens(tokens: BrandingTokens): Partial<TenantData> {
    return {
        logoUrl: tokens.assets?.logoUrl || '',
        faviconUrl: tokens.assets?.faviconUrl || '',

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

        surfaceBaseColor: tokens.semantics?.colors?.surface?.base || '',
        surfaceRaisedColor: tokens.semantics?.colors?.surface?.raised || '',
        surfaceSunkenColor: tokens.semantics?.colors?.surface?.sunken || '',
        surfaceOverlayColor: tokens.semantics?.colors?.surface?.overlay || '',
        surfaceWarningColor: tokens.semantics?.colors?.surface?.warning || '',
        surfaceMutedColor: tokens.semantics?.colors?.surface?.muted || '',

        textPrimaryColor: tokens.semantics?.colors?.text?.primary || '',
        textSecondaryColor: tokens.semantics?.colors?.text?.secondary || '',
        textMutedColor: tokens.semantics?.colors?.text?.muted || '',
        textInvertedColor: tokens.semantics?.colors?.text?.inverted || '',
        textAccentColor: tokens.semantics?.colors?.text?.accent || '',

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

        borderSubtleColor: tokens.semantics?.colors?.border?.subtle || '',
        borderDefaultColor: tokens.semantics?.colors?.border?.default || '',
        borderStrongColor: tokens.semantics?.colors?.border?.strong || '',
        borderFocusColor: tokens.semantics?.colors?.border?.focus || '',
        borderWarningColor: tokens.semantics?.colors?.border?.warning || '',

        statusSuccessColor: tokens.semantics?.colors?.status?.success || '',
        statusWarningColor: tokens.semantics?.colors?.status?.warning || '',
        statusDangerColor: tokens.semantics?.colors?.status?.danger || '',
        statusInfoColor: tokens.semantics?.colors?.status?.info || '',

        fontFamilySans: tokens.typography?.fontFamily?.sans || '',
        fontFamilySerif: tokens.typography?.fontFamily?.serif || '',
        fontFamilyMono: tokens.typography?.fontFamily?.mono || '',

        typographySizeXs: tokens.typography?.sizes?.xs || '',
        typographySizeSm: tokens.typography?.sizes?.sm || '',
        typographySizeMd: tokens.typography?.sizes?.md || '',
        typographySizeLg: tokens.typography?.sizes?.lg || '',
        typographySizeXl: tokens.typography?.sizes?.xl || '',
        typographySize2xl: tokens.typography?.sizes?.['2xl'] || '',
        typographySize3xl: tokens.typography?.sizes?.['3xl'] || '',
        typographySize4xl: tokens.typography?.sizes?.['4xl'] || '',
        typographySize5xl: tokens.typography?.sizes?.['5xl'] || '',

        fontWeightRegular: tokens.typography?.weights?.regular || 0,
        fontWeightMedium: tokens.typography?.weights?.medium || 0,
        fontWeightSemibold: tokens.typography?.weights?.semibold || 0,
        fontWeightBold: tokens.typography?.weights?.bold || 0,

        lineHeightCompact: tokens.typography?.lineHeights?.compact || '',
        lineHeightStandard: tokens.typography?.lineHeights?.standard || '',
        lineHeightSpacious: tokens.typography?.lineHeights?.spacious || '',

        letterSpacingTight: tokens.typography?.letterSpacing?.tight || '',
        letterSpacingNormal: tokens.typography?.letterSpacing?.normal || '',
        letterSpacingWide: tokens.typography?.letterSpacing?.wide || '',

        typographySemanticBody: tokens.typography?.semantics?.body || '',
        typographySemanticBodyStrong: tokens.typography?.semantics?.bodyStrong || '',
        typographySemanticCaption: tokens.typography?.semantics?.caption || '',
        typographySemanticButton: tokens.typography?.semantics?.button || '',
        typographySemanticEyebrow: tokens.typography?.semantics?.eyebrow || '',
        typographySemanticHeading: tokens.typography?.semantics?.heading || '',
        typographySemanticDisplay: tokens.typography?.semantics?.display || '',

        spacing2xs: tokens.spacing?.['2xs'] || '',
        spacingXs: tokens.spacing?.xs || '',
        spacingSm: tokens.spacing?.sm || '',
        spacingMd: tokens.spacing?.md || '',
        spacingLg: tokens.spacing?.lg || '',
        spacingXl: tokens.spacing?.xl || '',
        spacing2xl: tokens.spacing?.['2xl'] || '',

        spacingPagePadding: tokens.semantics?.spacing?.pagePadding || '',
        spacingSectionGap: tokens.semantics?.spacing?.sectionGap || '',
        spacingCardPadding: tokens.semantics?.spacing?.cardPadding || '',
        spacingComponentGap: tokens.semantics?.spacing?.componentGap || '',

        radiiNone: tokens.radii?.none || '',
        radiiSm: tokens.radii?.sm || '',
        radiiMd: tokens.radii?.md || '',
        radiiLg: tokens.radii?.lg || '',
        radiiPill: tokens.radii?.pill || '',
        radiiFull: tokens.radii?.full || '',

        shadowSm: tokens.shadows?.sm || '',
        shadowMd: tokens.shadows?.md || '',
        shadowLg: tokens.shadows?.lg || '',

        legalCompanyName: tokens.legal?.companyName || '',
        legalSupportEmail: tokens.legal?.supportEmail || '',
        legalPrivacyPolicyUrl: tokens.legal?.privacyPolicyUrl || '',
        legalTermsOfServiceUrl: tokens.legal?.termsOfServiceUrl || '',

        motionDurationInstant: tokens.motion?.duration?.instant || 0,
        motionDurationFast: tokens.motion?.duration?.fast || 0,
        motionDurationBase: tokens.motion?.duration?.base || 0,
        motionDurationSlow: tokens.motion?.duration?.slow || 0,
        motionDurationGlacial: tokens.motion?.duration?.glacial || 0,

        motionEasingStandard: tokens.motion?.easing?.standard || '',
        motionEasingDecelerate: tokens.motion?.easing?.decelerate || '',
        motionEasingAccelerate: tokens.motion?.easing?.accelerate || '',
        motionEasingSpring: tokens.motion?.easing?.spring || '',

        enableParallax: tokens.motion?.enableParallax ?? false,
        enableMagneticHover: tokens.motion?.enableMagneticHover ?? false,
        enableScrollReveal: tokens.motion?.enableScrollReveal ?? false,

        enableButtonGradient: !!(tokens.semantics?.colors?.gradient?.primary),
        enableGlassmorphism: !!(tokens.semantics?.colors?.surface?.glass),
        auroraGradient: Array.isArray(tokens.semantics?.colors?.gradient?.aurora)
            ? tokens.semantics.colors.gradient.aurora
            : [],
        glassColor: tokens.semantics?.colors?.surface?.glass || '',
        glassBorderColor: tokens.semantics?.colors?.surface?.glassBorder || '',
    };
}

type TypographySize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';

export function buildBrandingTokensFromForm(formData: TenantData): TenantBranding {
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
                body: formData.typographySemanticBody as TypographySize,
                bodyStrong: formData.typographySemanticBodyStrong as TypographySize,
                caption: formData.typographySemanticCaption as TypographySize,
                button: formData.typographySemanticButton as TypographySize,
                eyebrow: formData.typographySemanticEyebrow as TypographySize,
                heading: formData.typographySemanticHeading as TypographySize,
                display: formData.typographySemanticDisplay as TypographySize,
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
                body: formData.typographySemanticBody as TypographySize,
                bodyStrong: formData.typographySemanticBodyStrong as TypographySize,
                caption: formData.typographySemanticCaption as TypographySize,
                button: formData.typographySemanticButton as TypographySize,
                eyebrow: formData.typographySemanticEyebrow as TypographySize,
                heading: formData.typographySemanticHeading as TypographySize,
                display: formData.typographySemanticDisplay as TypographySize,
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
