import type { TenantBranding } from '@billsplit-wl/shared';

export type CreationMode = 'empty' | 'copy';

export interface TenantData {
    tenantId: string;
    appName: string;
    domains: string[];

    logoUrl: string;
    faviconUrl: string;

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

    surfaceBaseColor: string;
    surfaceRaisedColor: string;
    surfaceSunkenColor: string;
    surfaceOverlayColor: string;
    surfaceWarningColor: string;
    surfaceMutedColor: string;
    surfacePopoverColor: string;

    textPrimaryColor: string;
    textSecondaryColor: string;
    textMutedColor: string;
    textInvertedColor: string;
    textAccentColor: string;

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
    interactiveGhostColor: string;
    interactiveMagneticColor: string;
    interactiveGlowColor: string;

    borderSubtleColor: string;
    borderDefaultColor: string;
    borderStrongColor: string;
    borderFocusColor: string;
    borderWarningColor: string;

    statusSuccessColor: string;
    statusWarningColor: string;
    statusDangerColor: string;
    statusInfoColor: string;

    fontFamilySans: string;
    fontFamilySerif: string;
    fontFamilyMono: string;

    typographySizeXs: string;
    typographySizeSm: string;
    typographySizeMd: string;
    typographySizeLg: string;
    typographySizeXl: string;
    typographySize2xl: string;
    typographySize3xl: string;
    typographySize4xl: string;
    typographySize5xl: string;

    fontWeightRegular: number;
    fontWeightMedium: number;
    fontWeightSemibold: number;
    fontWeightBold: number;

    lineHeightCompact: string;
    lineHeightStandard: string;
    lineHeightSpacious: string;

    letterSpacingTight: string;
    letterSpacingNormal: string;
    letterSpacingWide: string;

    typographySemanticBody: string;
    typographySemanticBodyStrong: string;
    typographySemanticCaption: string;
    typographySemanticButton: string;
    typographySemanticEyebrow: string;
    typographySemanticHeading: string;
    typographySemanticDisplay: string;

    spacing2xs: string;
    spacingXs: string;
    spacingSm: string;
    spacingMd: string;
    spacingLg: string;
    spacingXl: string;
    spacing2xl: string;

    spacingPagePadding: string;
    spacingSectionGap: string;
    spacingCardPadding: string;
    spacingComponentGap: string;

    radiiNone: string;
    radiiSm: string;
    radiiMd: string;
    radiiLg: string;
    radiiPill: string;
    radiiFull: string;

    shadowSm: string;
    shadowMd: string;
    shadowLg: string;

    legalCompanyName: string;
    legalSupportEmail: string;

    motionDurationInstant: number;
    motionDurationFast: number;
    motionDurationBase: number;
    motionDurationSlow: number;
    motionDurationGlacial: number;

    motionEasingStandard: string;
    motionEasingDecelerate: string;
    motionEasingAccelerate: string;
    motionEasingSpring: string;

    enableParallax: boolean;
    enableMagneticHover: boolean;
    enableScrollReveal: boolean;

    showMarketingContent: boolean;
    showPricingPage: boolean;

    showAppNameInHeader: boolean;

    gradientPrimary: string[];
    gradientAccent: string[];
    auroraGradient: string[];
    glassColor: string;
    glassBorderColor: string;

    // Derivation options (used in Basic mode to control color generation)
    derivationThemeMode: 'light' | 'medium' | 'dark';
    derivationStyle: 'balanced' | 'bold' | 'soft' | 'vibrant' | 'elegant';
    derivationIntensity: number;
}

export interface TenantConfig {
    tenantId: string;
    branding: {
        primaryColor?: string;
        secondaryColor?: string;
        accentColor?: string;
        showAppNameInHeader?: boolean;
    };
    brandingTokens: TenantBranding;
    marketingFlags?: {
        showMarketingContent?: boolean;
        showPricingPage?: boolean;
    };
    createdAt: string;
    updatedAt: string;
}

export interface FullTenant {
    tenant: TenantConfig;
    domains: string[];
    isDefault: boolean;
}

export interface TenantEditorModalProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    tenant?: FullTenant;
    mode: 'create' | 'edit';
}
