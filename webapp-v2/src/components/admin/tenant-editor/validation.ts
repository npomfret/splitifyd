import type { TFunction } from 'i18next';
import type { TenantData } from './types';

type FieldType = 'string' | 'number' | 'domains';

interface FieldValidation {
    path: keyof TenantData;
    label: string;
    type: FieldType;
    i18nKey?: string;
}

const REQUIRED_STRING_FIELDS: FieldValidation[] = [
    { path: 'tenantId', label: 'Tenant ID', type: 'string', i18nKey: 'admin.tenantEditor.fields.tenantId' },
    { path: 'appName', label: 'App name', type: 'string', i18nKey: 'admin.tenantEditor.fields.appName' },
    { path: 'logoUrl', label: 'Logo URL', type: 'string', i18nKey: 'admin.tenantEditor.fields.logoUrl' },

    { path: 'primaryColor', label: 'Primary color', type: 'string', i18nKey: 'admin.tenantEditor.fields.primaryColor' },
    { path: 'primaryVariantColor', label: 'Primary variant color', type: 'string', i18nKey: 'admin.tenantEditor.fields.primaryVariantColor' },
    { path: 'secondaryColor', label: 'Secondary color', type: 'string', i18nKey: 'admin.tenantEditor.fields.secondaryColor' },
    { path: 'secondaryVariantColor', label: 'Secondary variant color', type: 'string', i18nKey: 'admin.tenantEditor.fields.secondaryVariantColor' },
    { path: 'accentColor', label: 'Accent color', type: 'string', i18nKey: 'admin.tenantEditor.fields.accentColor' },
    { path: 'neutralColor', label: 'Neutral color', type: 'string', i18nKey: 'admin.tenantEditor.fields.neutralColor' },
    { path: 'neutralVariantColor', label: 'Neutral variant color', type: 'string', i18nKey: 'admin.tenantEditor.fields.neutralVariantColor' },
    { path: 'successColor', label: 'Success color', type: 'string', i18nKey: 'admin.tenantEditor.fields.successColor' },
    { path: 'warningColor', label: 'Warning color', type: 'string', i18nKey: 'admin.tenantEditor.fields.warningColor' },
    { path: 'dangerColor', label: 'Danger color', type: 'string', i18nKey: 'admin.tenantEditor.fields.dangerColor' },
    { path: 'infoColor', label: 'Info color', type: 'string', i18nKey: 'admin.tenantEditor.fields.infoColor' },

    { path: 'surfaceBaseColor', label: 'Surface base color', type: 'string' },
    { path: 'surfaceRaisedColor', label: 'Surface raised color', type: 'string' },
    { path: 'surfaceSunkenColor', label: 'Surface sunken color', type: 'string' },
    { path: 'surfaceOverlayColor', label: 'Surface overlay color', type: 'string' },
    { path: 'surfaceWarningColor', label: 'Surface warning color', type: 'string' },
    { path: 'surfaceMutedColor', label: 'Surface muted color', type: 'string' },

    { path: 'textPrimaryColor', label: 'Text primary color', type: 'string' },
    { path: 'textSecondaryColor', label: 'Text secondary color', type: 'string' },
    { path: 'textMutedColor', label: 'Text muted color', type: 'string' },
    { path: 'textInvertedColor', label: 'Text inverted color', type: 'string' },
    { path: 'textAccentColor', label: 'Text accent color', type: 'string' },

    { path: 'interactivePrimaryColor', label: 'Interactive primary color', type: 'string' },
    { path: 'interactivePrimaryHoverColor', label: 'Interactive primary hover color', type: 'string' },
    { path: 'interactivePrimaryActiveColor', label: 'Interactive primary active color', type: 'string' },
    { path: 'interactivePrimaryForegroundColor', label: 'Interactive primary foreground color', type: 'string' },
    { path: 'interactiveSecondaryColor', label: 'Interactive secondary color', type: 'string' },
    { path: 'interactiveSecondaryHoverColor', label: 'Interactive secondary hover color', type: 'string' },
    { path: 'interactiveSecondaryActiveColor', label: 'Interactive secondary active color', type: 'string' },
    { path: 'interactiveSecondaryForegroundColor', label: 'Interactive secondary foreground color', type: 'string' },
    { path: 'interactiveAccentColor', label: 'Interactive accent color', type: 'string' },
    { path: 'interactiveDestructiveColor', label: 'Interactive destructive color', type: 'string' },
    { path: 'interactiveDestructiveHoverColor', label: 'Interactive destructive hover color', type: 'string' },
    { path: 'interactiveDestructiveActiveColor', label: 'Interactive destructive active color', type: 'string' },
    { path: 'interactiveDestructiveForegroundColor', label: 'Interactive destructive foreground color', type: 'string' },

    { path: 'borderSubtleColor', label: 'Border subtle color', type: 'string' },
    { path: 'borderDefaultColor', label: 'Border default color', type: 'string' },
    { path: 'borderStrongColor', label: 'Border strong color', type: 'string' },
    { path: 'borderFocusColor', label: 'Border focus color', type: 'string' },
    { path: 'borderWarningColor', label: 'Border warning color', type: 'string' },

    { path: 'statusSuccessColor', label: 'Status success color', type: 'string' },
    { path: 'statusWarningColor', label: 'Status warning color', type: 'string' },
    { path: 'statusDangerColor', label: 'Status danger color', type: 'string' },
    { path: 'statusInfoColor', label: 'Status info color', type: 'string' },

    { path: 'fontFamilySans', label: 'Sans font family', type: 'string' },
    { path: 'fontFamilyMono', label: 'Mono font family', type: 'string' },

    { path: 'typographySizeXs', label: 'Typography size xs', type: 'string' },
    { path: 'typographySizeSm', label: 'Typography size sm', type: 'string' },
    { path: 'typographySizeMd', label: 'Typography size md', type: 'string' },
    { path: 'typographySizeLg', label: 'Typography size lg', type: 'string' },
    { path: 'typographySizeXl', label: 'Typography size xl', type: 'string' },
    { path: 'typographySize2xl', label: 'Typography size 2xl', type: 'string' },
    { path: 'typographySize3xl', label: 'Typography size 3xl', type: 'string' },
    { path: 'typographySize4xl', label: 'Typography size 4xl', type: 'string' },
    { path: 'typographySize5xl', label: 'Typography size 5xl', type: 'string' },

    { path: 'lineHeightCompact', label: 'Line height compact', type: 'string' },
    { path: 'lineHeightStandard', label: 'Line height standard', type: 'string' },
    { path: 'lineHeightSpacious', label: 'Line height spacious', type: 'string' },

    { path: 'letterSpacingTight', label: 'Letter spacing tight', type: 'string' },
    { path: 'letterSpacingNormal', label: 'Letter spacing normal', type: 'string' },
    { path: 'letterSpacingWide', label: 'Letter spacing wide', type: 'string' },

    { path: 'spacing2xs', label: 'Spacing 2xs', type: 'string' },
    { path: 'spacingXs', label: 'Spacing xs', type: 'string' },
    { path: 'spacingSm', label: 'Spacing sm', type: 'string' },
    { path: 'spacingMd', label: 'Spacing md', type: 'string' },
    { path: 'spacingLg', label: 'Spacing lg', type: 'string' },
    { path: 'spacingXl', label: 'Spacing xl', type: 'string' },
    { path: 'spacing2xl', label: 'Spacing 2xl', type: 'string' },
    { path: 'spacingPagePadding', label: 'Page padding', type: 'string' },
    { path: 'spacingSectionGap', label: 'Section gap', type: 'string' },
    { path: 'spacingCardPadding', label: 'Card padding', type: 'string' },
    { path: 'spacingComponentGap', label: 'Component gap', type: 'string' },

    { path: 'radiiNone', label: 'Radius none', type: 'string' },
    { path: 'radiiSm', label: 'Radius sm', type: 'string' },
    { path: 'radiiMd', label: 'Radius md', type: 'string' },
    { path: 'radiiLg', label: 'Radius lg', type: 'string' },
    { path: 'radiiPill', label: 'Radius pill', type: 'string' },
    { path: 'radiiFull', label: 'Radius full', type: 'string' },

    { path: 'shadowSm', label: 'Shadow sm', type: 'string' },
    { path: 'shadowMd', label: 'Shadow md', type: 'string' },
    { path: 'shadowLg', label: 'Shadow lg', type: 'string' },

    { path: 'legalCompanyName', label: 'Company name', type: 'string' },
    { path: 'legalSupportEmail', label: 'Support email', type: 'string' },

    { path: 'motionEasingStandard', label: 'Motion easing standard', type: 'string' },
    { path: 'motionEasingDecelerate', label: 'Motion easing decelerate', type: 'string' },
    { path: 'motionEasingAccelerate', label: 'Motion easing accelerate', type: 'string' },
    { path: 'motionEasingSpring', label: 'Motion easing spring', type: 'string' },
];

const REQUIRED_NUMBER_FIELDS: FieldValidation[] = [
    { path: 'fontWeightRegular', label: 'Font weight regular', type: 'number' },
    { path: 'fontWeightMedium', label: 'Font weight medium', type: 'number' },
    { path: 'fontWeightSemibold', label: 'Font weight semibold', type: 'number' },
    { path: 'fontWeightBold', label: 'Font weight bold', type: 'number' },
    { path: 'motionDurationInstant', label: 'Motion duration instant', type: 'number' },
    { path: 'motionDurationFast', label: 'Motion duration fast', type: 'number' },
    { path: 'motionDurationBase', label: 'Motion duration base', type: 'number' },
    { path: 'motionDurationSlow', label: 'Motion duration slow', type: 'number' },
    { path: 'motionDurationGlacial', label: 'Motion duration glacial', type: 'number' },
];

export function validateTenantData(formData: TenantData, t: TFunction): string | null {
    const required = (field: string) => t('validation.required', { field });

    if (!/^[a-z0-9-]+$/.test(formData.tenantId)) {
        return t('admin.tenantEditor.validation.tenantIdFormat');
    }

    if (formData.domains.length === 0) {
        return t('admin.tenantEditor.validation.domainRequired');
    }

    for (const field of REQUIRED_STRING_FIELDS) {
        const value = formData[field.path];
        if (typeof value === 'string' && !value.trim()) {
            const label = field.i18nKey ? t(field.i18nKey) : field.label;
            return required(label);
        }
    }

    for (const field of REQUIRED_NUMBER_FIELDS) {
        const value = formData[field.path];
        if (typeof value === 'number' && !value && value !== 0) {
            return required(field.label);
        }
    }

    return null;
}
