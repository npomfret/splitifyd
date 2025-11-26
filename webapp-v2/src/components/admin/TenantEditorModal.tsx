import { apiClient } from '@/app/apiClient';
import { Alert, Button, ImageUploadField, Input, Modal } from '@/components/ui';
import { logError } from '@/utils/browser-logger';
import type { AdminUpsertTenantRequest, BrandingTokens, TenantBranding } from '@billsplit-wl/shared';
import { brandingTokenFixtures } from '@billsplit-wl/shared';
import { useEffect, useState } from 'preact/hooks';

type PresetKey = 'aurora' | 'brutalist' | 'blank';

interface TenantData {
    tenantId: string;
    appName: string;
    logoUrl: string;
    faviconUrl: string;
    primaryColor: string;
    primaryHoverColor: string;
    secondaryColor: string;
    secondaryHoverColor: string;
    accentColor: string;
    surfaceColor: string;
    surfaceRaisedColor: string;
    textPrimaryColor: string;
    textSecondaryColor: string;
    textMutedColor: string;
    textAccentColor: string;
    borderSubtleColor: string;
    borderDefaultColor: string;
    borderStrongColor: string;
    successColor: string;
    warningColor: string;
    errorColor: string;
    infoColor: string;
    showLandingPage: boolean;
    showMarketingContent: boolean;
    showPricingPage: boolean;
    domains: string[];
    enableAuroraAnimation: boolean;
    enableGlassmorphism: boolean;
    enableMagneticHover: boolean;
    enableScrollReveal: boolean;
    enableButtonGradient: boolean;
    fontFamilySans: string;
    fontFamilySerif: string;
    fontFamilyMono: string;
    fontWeightHeadings: number;
    fontWeightBody: number;
    fontWeightUI: number;
    enableFluidTypography: boolean;
    auroraGradient: string[];
    glassColor: string;
    glassBorderColor: string;
    preset: PresetKey;
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

// Color Input Component
function ColorInput({ id, label, value, onChange, disabled, testId }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    testId: string;
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
                <span class='text-xs text-text-muted font-mono'>{value || '#000000'}</span>
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
        primaryColor: tokens.semantics?.colors?.interactive?.primary || tokens.palette?.primary || '',
        primaryHoverColor: tokens.semantics?.colors?.interactive?.primaryHover || '',
        secondaryColor: tokens.semantics?.colors?.interactive?.secondary || tokens.palette?.secondary || '',
        secondaryHoverColor: tokens.semantics?.colors?.interactive?.secondaryHover || '',
        accentColor: tokens.semantics?.colors?.interactive?.accent || tokens.palette?.accent || '',
        surfaceColor: tokens.semantics?.colors?.surface?.base || '',
        surfaceRaisedColor: tokens.semantics?.colors?.surface?.raised || '',
        textPrimaryColor: tokens.semantics?.colors?.text?.primary || '',
        textSecondaryColor: tokens.semantics?.colors?.text?.secondary || '',
        textMutedColor: tokens.semantics?.colors?.text?.muted || '',
        textAccentColor: tokens.semantics?.colors?.text?.accent || '',
        borderSubtleColor: tokens.semantics?.colors?.border?.subtle || '',
        borderDefaultColor: tokens.semantics?.colors?.border?.default || '',
        borderStrongColor: tokens.semantics?.colors?.border?.strong || '',
        successColor: tokens.semantics?.colors?.status?.success || tokens.palette?.success || '',
        warningColor: tokens.semantics?.colors?.status?.warning || tokens.palette?.warning || '',
        errorColor: tokens.semantics?.colors?.status?.danger || tokens.palette?.danger || '',
        infoColor: tokens.semantics?.colors?.status?.info || tokens.palette?.info || '',
        enableAuroraAnimation: tokens.motion?.enableParallax ?? false,
        enableGlassmorphism: !!(tokens.semantics?.colors?.surface?.glass),
        enableMagneticHover: tokens.motion?.enableMagneticHover ?? false,
        enableScrollReveal: tokens.motion?.enableScrollReveal ?? false,
        enableButtonGradient: !!(tokens.semantics?.colors?.gradient?.primary),
        fontFamilySans: tokens.typography?.fontFamily?.sans || '',
        fontFamilySerif: tokens.typography?.fontFamily?.serif || '',
        fontFamilyMono: tokens.typography?.fontFamily?.mono || '',
        fontWeightHeadings: tokens.typography?.weights?.bold || 700,
        fontWeightBody: tokens.typography?.weights?.regular || 400,
        fontWeightUI: tokens.typography?.weights?.medium || 500,
        enableFluidTypography: !!(tokens.typography?.fluidScale),
        auroraGradient: Array.isArray(tokens.semantics?.colors?.gradient?.aurora)
            ? tokens.semantics.colors.gradient.aurora
            : [],
        glassColor: tokens.semantics?.colors?.surface?.glass || '',
        glassBorderColor: tokens.semantics?.colors?.surface?.glassBorder || '',
        logoUrl: tokens.assets?.logoUrl || '',
        faviconUrl: tokens.assets?.faviconUrl || '',
    };
}

function getPresetFormData(preset: PresetKey): Partial<TenantData> {
    if (preset === 'blank') {
        return {
            primaryColor: '#2563eb',
            primaryHoverColor: '#1d4ed8',
            secondaryColor: '#7c3aed',
            secondaryHoverColor: '#6d28d9',
            accentColor: '#f97316',
            surfaceColor: '#ffffff',
            surfaceRaisedColor: '#f9fafb',
            textPrimaryColor: '#111827',
            textSecondaryColor: '#4b5563',
            textMutedColor: '#9ca3af',
            textAccentColor: '#f97316',
            borderSubtleColor: '#e5e7eb',
            borderDefaultColor: '#d1d5db',
            borderStrongColor: '#9ca3af',
            successColor: '#22c55e',
            warningColor: '#eab308',
            errorColor: '#ef4444',
            infoColor: '#38bdf8',
            enableAuroraAnimation: false,
            enableGlassmorphism: false,
            enableMagneticHover: false,
            enableScrollReveal: false,
            enableButtonGradient: false,
            fontFamilySans: 'Inter, system-ui, sans-serif',
            fontFamilySerif: 'Georgia, serif',
            fontFamilyMono: 'Monaco, monospace',
            fontWeightHeadings: 700,
            fontWeightBody: 400,
            fontWeightUI: 500,
            enableFluidTypography: false,
            auroraGradient: [],
            glassColor: '',
            glassBorderColor: '',
        };
    }
    const fixtureKey = preset === 'aurora' ? 'localhost' : 'loopback';
    const tokens = brandingTokenFixtures[fixtureKey];
    return extractFormDataFromTokens(tokens);
}

function buildBrandingTokensFromForm(formData: TenantData, existingTokens?: BrandingTokens): TenantBranding {
    const baseTokens: BrandingTokens = existingTokens
        ? { ...existingTokens }
        : brandingTokenFixtures[formData.preset === 'brutalist' ? 'loopback' : 'localhost'];

    const tokens: BrandingTokens = {
        ...baseTokens,
        version: 1,
        palette: {
            ...baseTokens.palette,
            primary: formData.primaryColor as `#${string}`,
            secondary: formData.secondaryColor as `#${string}`,
            accent: formData.accentColor as `#${string}`,
            neutral: formData.surfaceColor as `#${string}`,
            success: formData.successColor as `#${string}`,
            warning: formData.warningColor as `#${string}`,
            danger: formData.errorColor as `#${string}`,
            info: formData.infoColor as `#${string}`,
        },
        typography: {
            ...baseTokens.typography,
            fontFamily: {
                ...baseTokens.typography.fontFamily,
                sans: formData.fontFamilySans || baseTokens.typography.fontFamily.sans,
                serif: formData.fontFamilySerif || baseTokens.typography.fontFamily.serif,
                mono: formData.fontFamilyMono || baseTokens.typography.fontFamily.mono,
            },
            weights: {
                ...baseTokens.typography.weights,
                bold: formData.fontWeightHeadings,
                regular: formData.fontWeightBody,
                medium: formData.fontWeightUI,
            },
            ...(formData.enableFluidTypography ? {
                fluidScale: baseTokens.typography.fluidScale || {
                    xs: 'clamp(0.75rem, 0.9vw, 0.875rem)',
                    sm: 'clamp(0.875rem, 1vw, 1rem)',
                    base: 'clamp(1rem, 1.2vw, 1.125rem)',
                    lg: 'clamp(1.125rem, 1.5vw, 1.25rem)',
                    xl: 'clamp(1.25rem, 2vw, 1.5rem)',
                    '2xl': 'clamp(1.5rem, 2.5vw, 1.875rem)',
                    '3xl': 'clamp(1.875rem, 3vw, 2.25rem)',
                    '4xl': 'clamp(2.25rem, 4vw, 3rem)',
                    hero: 'clamp(2.5rem, 5vw, 3.75rem)',
                },
            } : { fluidScale: undefined }),
        },
        assets: {
            ...baseTokens.assets,
            logoUrl: formData.logoUrl || baseTokens.assets.logoUrl,
            faviconUrl: formData.faviconUrl || formData.logoUrl || baseTokens.assets.faviconUrl,
        },
        semantics: {
            ...baseTokens.semantics,
            colors: {
                ...baseTokens.semantics.colors,
                surface: {
                    ...baseTokens.semantics.colors.surface,
                    base: formData.surfaceColor as `#${string}`,
                    raised: formData.surfaceRaisedColor as `#${string}`,
                    ...(formData.enableGlassmorphism ? {
                        glass: (formData.glassColor || 'rgba(25, 30, 50, 0.45)') as `rgba(${string})`,
                        glassBorder: (formData.glassBorderColor || 'rgba(255, 255, 255, 0.12)') as `rgba(${string})`,
                    } : { glass: undefined, glassBorder: undefined }),
                },
                text: {
                    ...baseTokens.semantics.colors.text,
                    primary: formData.textPrimaryColor as `#${string}`,
                    secondary: formData.textSecondaryColor as `#${string}`,
                    muted: formData.textMutedColor as `#${string}`,
                    accent: formData.textAccentColor as `#${string}`,
                },
                interactive: {
                    ...baseTokens.semantics.colors.interactive,
                    primary: formData.primaryColor as `#${string}`,
                    primaryHover: formData.primaryHoverColor as `#${string}`,
                    secondary: formData.secondaryColor as `#${string}`,
                    secondaryHover: formData.secondaryHoverColor as `#${string}`,
                    accent: formData.accentColor as `#${string}`,
                },
                border: {
                    ...baseTokens.semantics.colors.border,
                    subtle: formData.borderSubtleColor as `#${string}`,
                    default: formData.borderDefaultColor as `#${string}`,
                    strong: formData.borderStrongColor as `#${string}`,
                },
                status: {
                    ...baseTokens.semantics.colors.status,
                    success: formData.successColor as `#${string}`,
                    warning: formData.warningColor as `#${string}`,
                    danger: formData.errorColor as `#${string}`,
                    info: formData.infoColor as `#${string}`,
                },
                gradient: {
                    ...baseTokens.semantics.colors.gradient,
                    ...(formData.enableAuroraAnimation && formData.auroraGradient.length >= 2 ? {
                        aurora: formData.auroraGradient as `#${string}`[],
                    } : {}),
                    ...(formData.enableButtonGradient ? {
                        primary: [formData.primaryColor, formData.primaryHoverColor] as [`#${string}`, `#${string}`],
                    } : { primary: undefined }),
                },
            },
        },
        motion: {
            ...baseTokens.motion,
            enableParallax: formData.enableAuroraAnimation,
            enableMagneticHover: formData.enableMagneticHover,
            enableScrollReveal: formData.enableScrollReveal,
        },
    };

    return { tokens };
}

const DEFAULT_TENANT_DATA: TenantData = {
    tenantId: '',
    appName: '',
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '',
    primaryHoverColor: '',
    secondaryColor: '',
    secondaryHoverColor: '',
    accentColor: '',
    surfaceColor: '',
    surfaceRaisedColor: '',
    textPrimaryColor: '',
    textSecondaryColor: '',
    textMutedColor: '',
    textAccentColor: '',
    borderSubtleColor: '',
    borderDefaultColor: '',
    borderStrongColor: '',
    successColor: '',
    warningColor: '',
    errorColor: '',
    infoColor: '',
    showLandingPage: true,
    showMarketingContent: true,
    showPricingPage: false,
    domains: [],
    enableAuroraAnimation: false,
    enableGlassmorphism: false,
    enableMagneticHover: false,
    enableScrollReveal: false,
    enableButtonGradient: false,
    fontFamilySans: '',
    fontFamilySerif: '',
    fontFamilyMono: '',
    fontWeightHeadings: 700,
    fontWeightBody: 400,
    fontWeightUI: 500,
    enableFluidTypography: false,
    auroraGradient: [],
    glassColor: '',
    glassBorderColor: '',
    preset: 'aurora',
};

export function TenantEditorModal({ open, onClose, onSave, tenant, mode }: TenantEditorModalProps) {
    const [formData, setFormData] = useState<TenantData>(DEFAULT_TENANT_DATA);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);
    const [newDomain, setNewDomain] = useState('');

    useEffect(() => {
        if (mode === 'edit' && tenant) {
            const tokens = tenant.brandingTokens?.tokens;
            if (tokens) {
                const tokenData = extractFormDataFromTokens(tokens);
                setFormData({
                    ...DEFAULT_TENANT_DATA,
                    ...tokenData,
                    tenantId: tenant.tenant.tenantId,
                    appName: tenant.tenant.branding?.appName ?? '',
                    showLandingPage: tenant.tenant.branding?.marketingFlags?.showLandingPage ?? false,
                    showMarketingContent: tenant.tenant.branding?.marketingFlags?.showMarketingContent ?? false,
                    showPricingPage: tenant.tenant.branding?.marketingFlags?.showPricingPage ?? false,
                    domains: tenant.domains ?? [],
                    preset: 'aurora',
                });
            } else {
                setFormData({
                    ...DEFAULT_TENANT_DATA,
                    tenantId: tenant.tenant.tenantId,
                    appName: tenant.tenant.branding?.appName ?? '',
                    showLandingPage: tenant.tenant.branding?.marketingFlags?.showLandingPage ?? false,
                    showMarketingContent: tenant.tenant.branding?.marketingFlags?.showMarketingContent ?? false,
                    showPricingPage: tenant.tenant.branding?.marketingFlags?.showPricingPage ?? false,
                    domains: tenant.domains ?? [],
                });
            }
        } else if (mode === 'create') {
            const presetData = getPresetFormData('aurora');
            setFormData({ ...DEFAULT_TENANT_DATA, ...presetData });
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

    const handleSave = async () => {
        if (!formData.tenantId.trim()) { setErrorMessage('Tenant ID is required'); return; }
        if (!/^[a-z0-9-]+$/.test(formData.tenantId)) { setErrorMessage('Invalid Tenant ID: must contain only lowercase letters, numbers, and hyphens'); return; }
        if (!formData.appName.trim()) { setErrorMessage('App name is required'); return; }
        if (!formData.primaryColor.trim()) { setErrorMessage('Primary color is required'); return; }
        if (!formData.secondaryColor.trim()) { setErrorMessage('Secondary color is required'); return; }
        if (formData.domains.length === 0) { setErrorMessage('At least one domain is required'); return; }

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

            const brandingTokens = buildBrandingTokensFromForm(formData, tenant?.brandingTokens?.tokens);

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
                setFormData({ ...DEFAULT_TENANT_DATA });
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
        if (!formData.tenantId) { setErrorMessage('Tenant ID is required for publishing'); return; }
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
        setFormData({ ...DEFAULT_TENANT_DATA });
        setErrorMessage('');
        setNewDomain('');
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
        if (!formData.tenantId) { setErrorMessage('Please save the tenant first before uploading images'); return; }
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
        if (!formData.tenantId) { setErrorMessage('Please save the tenant first before uploading images'); return; }
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
                                                <button onClick={() => handleRemoveDomain(index)} class='text-text-muted hover:text-status-danger' data-testid={`remove-domain-${index}`}>
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

                        {/* Preset Selection - Create Mode Only */}
                        {mode === 'create' && (
                            <Section title='Theme Preset' description='Choose a starting theme' defaultOpen={true} testId='section-theme-preset'>
                                <div class='grid grid-cols-3 gap-3'>
                                    {(['aurora', 'brutalist', 'blank'] as PresetKey[]).map((preset) => (
                                        <button
                                            key={preset}
                                            type='button'
                                            onClick={() => {
                                                const presetData = getPresetFormData(preset);
                                                update({ ...presetData, preset });
                                            }}
                                            disabled={isSaving}
                                            class={`p-3 rounded-lg border-2 transition-all text-left ${
                                                formData.preset === preset
                                                    ? 'border-interactive-primary bg-interactive-primary/10'
                                                    : 'border-border-default hover:border-border-strong'
                                            }`}
                                            data-testid={`preset-${preset}`}
                                        >
                                            <div class='font-semibold text-text-primary capitalize'>{preset}</div>
                                            <p class='text-xs text-text-muted mt-1'>
                                                {preset === 'aurora' && 'Dark glassmorphic with animations'}
                                                {preset === 'brutalist' && 'Minimal grayscale'}
                                                {preset === 'blank' && 'Light theme, clean slate'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </Section>
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

                        {/* Primary & Secondary Actions */}
                        <Section title='Actions' description='Button colors and effects' testId='section-actions'>
                            <div class='space-y-4'>
                                <div>
                                    <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide mb-2'>Primary</h4>
                                    <div class='grid grid-cols-2 gap-4'>
                                        <ColorInput id='primary-color' label='Color' value={formData.primaryColor} onChange={(v) => update({ primaryColor: v })} disabled={isSaving} testId='primary-color-input' />
                                        <ColorInput id='primary-hover' label='Hover' value={formData.primaryHoverColor} onChange={(v) => update({ primaryHoverColor: v })} disabled={isSaving} testId='primary-hover-color-input' />
                                    </div>
                                    <div class='mt-2'>
                                        <Toggle label='Gradient buttons' checked={formData.enableButtonGradient} onChange={(v) => update({ enableButtonGradient: v })} disabled={isSaving} testId='enable-button-gradient-checkbox' />
                                    </div>
                                </div>
                                <div>
                                    <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide mb-2'>Secondary</h4>
                                    <div class='grid grid-cols-2 gap-4'>
                                        <ColorInput id='secondary-color' label='Color' value={formData.secondaryColor} onChange={(v) => update({ secondaryColor: v })} disabled={isSaving} testId='secondary-color-input' />
                                        <ColorInput id='secondary-hover' label='Hover' value={formData.secondaryHoverColor} onChange={(v) => update({ secondaryHoverColor: v })} disabled={isSaving} testId='secondary-hover-color-input' />
                                    </div>
                                </div>
                                <div>
                                    <h4 class='text-xs font-semibold text-text-muted uppercase tracking-wide mb-2'>Accent</h4>
                                    <ColorInput id='accent-color' label='Color' value={formData.accentColor} onChange={(v) => update({ accentColor: v })} disabled={isSaving} testId='accent-color-input' />
                                </div>
                            </div>
                        </Section>

                        {/* Surfaces */}
                        <Section title='Surfaces' description='Background and card colors' testId='section-surfaces'>
                            <div class='grid grid-cols-2 gap-4'>
                                <ColorInput id='surface-base' label='Base' value={formData.surfaceColor} onChange={(v) => update({ surfaceColor: v })} disabled={isSaving} testId='surface-color-input' />
                                <ColorInput id='surface-raised' label='Raised' value={formData.surfaceRaisedColor} onChange={(v) => update({ surfaceRaisedColor: v })} disabled={isSaving} testId='surface-raised-color-input' />
                            </div>
                        </Section>

                        {/* Text */}
                        <Section title='Text' description='Text color hierarchy' testId='section-text'>
                            <div class='grid grid-cols-4 gap-4'>
                                <ColorInput id='text-primary' label='Primary' value={formData.textPrimaryColor} onChange={(v) => update({ textPrimaryColor: v })} disabled={isSaving} testId='text-primary-color-input' />
                                <ColorInput id='text-secondary' label='Secondary' value={formData.textSecondaryColor} onChange={(v) => update({ textSecondaryColor: v })} disabled={isSaving} testId='text-secondary-color-input' />
                                <ColorInput id='text-muted' label='Muted' value={formData.textMutedColor} onChange={(v) => update({ textMutedColor: v })} disabled={isSaving} testId='text-muted-color-input' />
                                <ColorInput id='text-accent' label='Accent' value={formData.textAccentColor} onChange={(v) => update({ textAccentColor: v })} disabled={isSaving} testId='text-accent-color-input' />
                            </div>
                        </Section>

                        {/* Borders */}
                        <Section title='Borders' description='Border color levels' testId='section-borders'>
                            <div class='grid grid-cols-3 gap-4'>
                                <ColorInput id='border-subtle' label='Subtle' value={formData.borderSubtleColor} onChange={(v) => update({ borderSubtleColor: v })} disabled={isSaving} testId='border-subtle-color-input' />
                                <ColorInput id='border-default' label='Default' value={formData.borderDefaultColor} onChange={(v) => update({ borderDefaultColor: v })} disabled={isSaving} testId='border-default-color-input' />
                                <ColorInput id='border-strong' label='Strong' value={formData.borderStrongColor} onChange={(v) => update({ borderStrongColor: v })} disabled={isSaving} testId='border-strong-color-input' />
                            </div>
                        </Section>

                        {/* Status */}
                        <Section title='Status Colors' description='Feedback and state colors' testId='section-status-colors'>
                            <div class='grid grid-cols-4 gap-4'>
                                <ColorInput id='success' label='Success' value={formData.successColor} onChange={(v) => update({ successColor: v })} disabled={isSaving} testId='success-color-input' />
                                <ColorInput id='warning' label='Warning' value={formData.warningColor} onChange={(v) => update({ warningColor: v })} disabled={isSaving} testId='warning-color-input' />
                                <ColorInput id='error' label='Error' value={formData.errorColor} onChange={(v) => update({ errorColor: v })} disabled={isSaving} testId='error-color-input' />
                                <ColorInput id='info' label='Info' value={formData.infoColor} onChange={(v) => update({ infoColor: v })} disabled={isSaving} testId='info-color-input' />
                            </div>
                        </Section>

                        {/* Motion & Effects */}
                        <Section title='Motion & Effects' description='Animations and interactions' testId='section-motion-effects'>
                            <div class='space-y-3'>
                                <Toggle label='Aurora Background' description='Animated gradient background with parallax' checked={formData.enableAuroraAnimation} onChange={(v) => update({ enableAuroraAnimation: v })} disabled={isSaving} testId='enable-aurora-animation-checkbox' />
                                <Toggle label='Glassmorphism' description='Frosted glass effect with blur' checked={formData.enableGlassmorphism} onChange={(v) => update({ enableGlassmorphism: v })} disabled={isSaving} testId='enable-glassmorphism-checkbox' />
                                <Toggle label='Magnetic Hover' description='Buttons follow cursor' checked={formData.enableMagneticHover} onChange={(v) => update({ enableMagneticHover: v })} disabled={isSaving} testId='enable-magnetic-hover-checkbox' />
                                <Toggle label='Scroll Reveal' description='Animate elements on scroll' checked={formData.enableScrollReveal} onChange={(v) => update({ enableScrollReveal: v })} disabled={isSaving} testId='enable-scroll-reveal-checkbox' />
                            </div>
                        </Section>

                        {/* Aurora Gradient */}
                        {formData.enableAuroraAnimation && (
                            <Section title='Aurora Gradient' description='4 colors for the aurora animation' testId='section-aurora-gradient' defaultOpen={true}>
                                <div class='grid grid-cols-4 gap-4'>
                                    {[0, 1, 2, 3].map((i) => (
                                        <ColorInput
                                            key={i}
                                            id={`aurora-${i}`}
                                            label={`Color ${i + 1}`}
                                            value={formData.auroraGradient[i] || '#000000'}
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
                        <Section title='Typography' description='Fonts and weights' testId='section-typography'>
                            <div class='space-y-4'>
                                <div class='grid grid-cols-3 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Sans Font</label>
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
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Serif Font</label>
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
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Mono Font</label>
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

                                <div class='grid grid-cols-3 gap-4'>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Heading Weight</label>
                                        <select
                                            value={formData.fontWeightHeadings}
                                            onChange={(e) => update({ fontWeightHeadings: parseInt((e.target as HTMLSelectElement).value, 10) })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                            data-testid='font-weight-headings-input'
                                        >
                                            <option value={400}>Regular (400)</option>
                                            <option value={500}>Medium (500)</option>
                                            <option value={600}>Semibold (600)</option>
                                            <option value={700}>Bold (700)</option>
                                            <option value={800}>Extra Bold (800)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>Body Weight</label>
                                        <select
                                            value={formData.fontWeightBody}
                                            onChange={(e) => update({ fontWeightBody: parseInt((e.target as HTMLSelectElement).value, 10) })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                            data-testid='font-weight-body-input'
                                        >
                                            <option value={300}>Light (300)</option>
                                            <option value={400}>Regular (400)</option>
                                            <option value={500}>Medium (500)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class='block text-xs font-medium text-text-secondary mb-1'>UI Weight</label>
                                        <select
                                            value={formData.fontWeightUI}
                                            onChange={(e) => update({ fontWeightUI: parseInt((e.target as HTMLSelectElement).value, 10) })}
                                            disabled={isSaving}
                                            class='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                                            data-testid='font-weight-ui-input'
                                        >
                                            <option value={400}>Regular (400)</option>
                                            <option value={500}>Medium (500)</option>
                                            <option value={600}>Semibold (600)</option>
                                        </select>
                                    </div>
                                </div>

                                <Toggle label='Fluid Typography' description='Auto-scale text sizes across viewports' checked={formData.enableFluidTypography} onChange={(v) => update({ enableFluidTypography: v })} disabled={isSaving} testId='enable-fluid-typography-checkbox' />
                            </div>
                        </Section>

                        {/* Marketing */}
                        <Section title='Marketing' description='Page visibility flags' testId='section-marketing'>
                            <div class='space-y-3'>
                                <Toggle label='Landing Page' checked={formData.showLandingPage} onChange={(v) => update({ showLandingPage: v })} disabled={isSaving} testId='show-landing-page-checkbox' />
                                <Toggle label='Marketing Content' checked={formData.showMarketingContent} onChange={(v) => update({ showMarketingContent: v })} disabled={isSaving} testId='show-marketing-content-checkbox' />
                                <Toggle label='Pricing Page' checked={formData.showPricingPage} onChange={(v) => update({ showPricingPage: v })} disabled={isSaving} testId='show-pricing-page-checkbox' />
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
