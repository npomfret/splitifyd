import { apiClient } from '@/app/apiClient';
import { Alert, Button, Card, ImageUploadField, Input, Modal } from '@/components/ui';
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
    // Core Colors
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    surfaceColor: string;
    surfaceRaisedColor: string;
    textPrimaryColor: string;
    textSecondaryColor: string;
    textMutedColor: string;
    // Border Colors
    borderSubtleColor: string;
    borderDefaultColor: string;
    borderStrongColor: string;
    // Status Colors
    successColor: string;
    warningColor: string;
    errorColor: string;
    infoColor: string;
    // Marketing flags
    showLandingPage: boolean;
    showMarketingContent: boolean;
    showPricingPage: boolean;
    domains: string[];
    // Motion & Effects
    enableAuroraAnimation: boolean;
    enableGlassmorphism: boolean;
    enableMagneticHover: boolean;
    enableScrollReveal: boolean;
    // Typography
    fontFamilySans: string;
    fontFamilySerif: string;
    fontFamilyMono: string;
    // Aurora Gradient (2-4 colors)
    auroraGradient: string[];
    // Glassmorphism Settings
    glassColor: string;
    glassBorderColor: string;
    // Preset selection (for create mode)
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
    brandingTokens?: TenantBranding; // Moved to top level to match TenantRegistryRecord
}

interface TenantEditorModalProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    tenant?: FullTenant; // Full tenant object from the list
    mode: 'create' | 'edit';
}

// Helper function to extract form data from branding tokens
function extractFormDataFromTokens(tokens: BrandingTokens): Partial<TenantData> {
    return {
        primaryColor: tokens.semantics?.colors?.interactive?.primary || tokens.palette?.primary || '',
        secondaryColor: tokens.palette?.secondary || '',
        accentColor: tokens.semantics?.colors?.interactive?.accent || tokens.palette?.accent || '',
        surfaceColor: tokens.semantics?.colors?.surface?.base || '',
        surfaceRaisedColor: tokens.semantics?.colors?.surface?.raised || '',
        textPrimaryColor: tokens.semantics?.colors?.text?.primary || '',
        textSecondaryColor: tokens.semantics?.colors?.text?.secondary || '',
        textMutedColor: tokens.semantics?.colors?.text?.muted || '',
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
        fontFamilySans: tokens.typography?.fontFamily?.sans || '',
        fontFamilySerif: tokens.typography?.fontFamily?.serif || '',
        fontFamilyMono: tokens.typography?.fontFamily?.mono || '',
        auroraGradient: Array.isArray(tokens.semantics?.colors?.gradient?.aurora)
            ? tokens.semantics.colors.gradient.aurora
            : [],
        glassColor: tokens.semantics?.colors?.surface?.glass || '',
        glassBorderColor: tokens.semantics?.colors?.surface?.glassBorder || '',
        logoUrl: tokens.assets?.logoUrl || '',
        faviconUrl: tokens.assets?.faviconUrl || '',
    };
}

// Get form data based on preset selection
function getPresetFormData(preset: PresetKey): Partial<TenantData> {
    if (preset === 'blank') {
        // Minimal defaults for blank preset
        return {
            primaryColor: '#2563eb',
            secondaryColor: '#7c3aed',
            accentColor: '#f97316',
            surfaceColor: '#ffffff',
            surfaceRaisedColor: '#f9fafb',
            textPrimaryColor: '#111827',
            textSecondaryColor: '#4b5563',
            textMutedColor: '#9ca3af',
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
            fontFamilySans: 'Inter, system-ui, sans-serif',
            fontFamilySerif: 'Georgia, serif',
            fontFamilyMono: 'Monaco, monospace',
            auroraGradient: [],
            glassColor: '',
            glassBorderColor: '',
        };
    }

    // Use fixture tokens for aurora/brutalist
    const fixtureKey = preset === 'aurora' ? 'localhost' : 'loopback';
    const tokens = brandingTokenFixtures[fixtureKey];
    return extractFormDataFromTokens(tokens);
}

// Build complete BrandingTokens from form data
function buildBrandingTokensFromForm(formData: TenantData, existingTokens?: BrandingTokens): TenantBranding {
    // Start with existing tokens as a base (preserves unedited values)
    // or get base from preset
    const baseTokens: BrandingTokens = existingTokens
        ? { ...existingTokens }
        : brandingTokenFixtures[formData.preset === 'brutalist' ? 'loopback' : 'localhost'];

    // Build the complete tokens object with form values
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
                    // Conditionally include glass properties - use defaults if enabled without custom colors
                    ...(formData.enableGlassmorphism ? {
                        glass: (formData.glassColor || 'rgba(25, 30, 50, 0.45)') as `rgba(${string})`,
                        glassBorder: (formData.glassBorderColor || 'rgba(255, 255, 255, 0.12)') as `rgba(${string})`,
                    } : {
                        // Explicitly remove glass properties when disabled
                        glass: undefined,
                        glassBorder: undefined,
                    }),
                },
                text: {
                    ...baseTokens.semantics.colors.text,
                    primary: formData.textPrimaryColor as `#${string}`,
                    secondary: formData.textSecondaryColor as `#${string}`,
                    muted: formData.textMutedColor as `#${string}`,
                },
                interactive: {
                    ...baseTokens.semantics.colors.interactive,
                    primary: formData.primaryColor as `#${string}`,
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
                    // Include aurora gradient if aurora animation is enabled and colors exist
                    ...(formData.enableAuroraAnimation && formData.auroraGradient.length >= 2 ? {
                        aurora: formData.auroraGradient as `#${string}`[],
                    } : {}),
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
    // Colors will be filled by preset selection
    primaryColor: '',
    secondaryColor: '',
    accentColor: '',
    surfaceColor: '',
    surfaceRaisedColor: '',
    textPrimaryColor: '',
    textSecondaryColor: '',
    textMutedColor: '',
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
    fontFamilySans: '',
    fontFamilySerif: '',
    fontFamilyMono: '',
    auroraGradient: [],
    glassColor: '',
    glassBorderColor: '',
    preset: 'aurora', // Default to aurora preset for new tenants
};

export function TenantEditorModal({ open, onClose, onSave, tenant, mode }: TenantEditorModalProps) {
    const [formData, setFormData] = useState<TenantData>(DEFAULT_TENANT_DATA);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);
    const [newDomain, setNewDomain] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [faviconFile, setFaviconFile] = useState<File | null>(null);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);

    // Update form data when tenant or mode changes
    useEffect(() => {
        if (mode === 'edit' && tenant) {
            const tokens = tenant.brandingTokens?.tokens;

            if (tokens) {
                // Extract ALL form values directly from tokens (single source of truth)
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
                    preset: 'aurora', // Not relevant for edit mode
                });
            } else {
                // Fallback for tenants without tokens (shouldn't happen, but handle gracefully)
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
            // For create mode, apply the default preset (aurora)
            const presetData = getPresetFormData('aurora');
            setFormData({ ...DEFAULT_TENANT_DATA, ...presetData });
        }
        // Clear messages when modal opens/closes or mode changes
        setErrorMessage('');
        setSuccessMessage('');
    }, [tenant, mode]);

    // Auto-dismiss success/error messages after 5 seconds
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
        // Validation
        if (!formData.tenantId.trim()) {
            setErrorMessage('Tenant ID is required');
            return;
        }
        if (!/^[a-z0-9-]+$/.test(formData.tenantId)) {
            setErrorMessage('Invalid Tenant ID: must contain only lowercase letters, numbers, and hyphens');
            return;
        }
        if (!formData.appName.trim()) {
            setErrorMessage('App name is required');
            return;
        }
        // Logo is optional - can be added after tenant is created
        if (!formData.primaryColor.trim()) {
            setErrorMessage('Primary color is required');
            return;
        }
        if (!formData.secondaryColor.trim()) {
            setErrorMessage('Secondary color is required');
            return;
        }
        if (formData.domains.length === 0) {
            setErrorMessage('At least one domain is required');
            return;
        }
        // Basic domain validation for all domains
        const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
        for (const domain of formData.domains) {
            if (!domainRegex.test(domain)) {
                setErrorMessage(`Invalid domain: ${domain}. Domains must be valid domain names (e.g., example.com, app.example.com)`);
                return;
            }
        }

        setIsSaving(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            // Normalize and deduplicate domains (trim, lowercase, remove port)
            const normalizedDomains = Array.from(
                new Set(
                    formData.domains.map(d => d.trim().toLowerCase().replace(/:\d+$/, '')),
                ),
            );

            // Build simple branding object (for backward compat + appName/logos)
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

            // Build complete brandingTokens directly from form data
            const brandingTokens = buildBrandingTokensFromForm(
                formData,
                tenant?.brandingTokens?.tokens, // Pass existing tokens to preserve unedited values
            );

            const requestData = {
                tenantId: formData.tenantId,
                branding,
                brandingTokens,
                domains: normalizedDomains,
            } as AdminUpsertTenantRequest;

            const result = await apiClient.adminUpsertTenant(requestData);
            const action = result.created ? 'created' : 'updated';

            // Automatically publish theme after save to regenerate CSS
            try {
                await apiClient.publishTenantTheme({ tenantId: formData.tenantId });
                setSuccessMessage(`Tenant ${action} and theme published successfully!`);
            } catch (publishError: any) {
                // Save succeeded but publish failed - show warning
                setSuccessMessage(`Tenant ${action} successfully, but theme publish failed. Click "Publish Theme" manually.`);
                logError('Auto-publish after save failed', publishError);
            }

            // Notify parent to refresh data
            onSave();

            // Close modal after short delay to show success message
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
        if (!formData.tenantId) {
            setErrorMessage('Please save the tenant first before uploading images');
            return;
        }

        setLogoFile(file);
        setIsUploadingLogo(true);
        setErrorMessage('');

        try {
            const result = await apiClient.uploadTenantImage(formData.tenantId, 'logo', file);
            setFormData({ ...formData, logoUrl: result.url });
            setSuccessMessage('Logo uploaded successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error: any) {
            setErrorMessage(error.message || 'Failed to upload logo');
            logError('Failed to upload logo', error);
        } finally {
            setIsUploadingLogo(false);
        }
    };

    const handleFaviconUpload = async (file: File) => {
        if (!formData.tenantId) {
            setErrorMessage('Please save the tenant first before uploading images');
            return;
        }

        setFaviconFile(file);
        setIsUploadingFavicon(true);
        setErrorMessage('');

        try {
            const result = await apiClient.uploadTenantImage(formData.tenantId, 'favicon', file);
            setFormData({ ...formData, faviconUrl: result.url });
            setSuccessMessage('Favicon uploaded successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error: any) {
            setErrorMessage(error.message || 'Failed to upload favicon');
            logError('Failed to upload favicon', error);
        } finally {
            setIsUploadingFavicon(false);
        }
    };

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
                            {mode === 'create'
                                ? 'Configure a new tenant with branding, features, and domains'
                                : 'Update tenant configuration'}
                        </p>
                    </div>
                    <button
                        onClick={handleCancel}
                        class='text-text-muted hover:text-text-primary'
                        data-testid='close-modal-button'
                    >
                        <svg class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
                        </svg>
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div class='flex-1 overflow-y-auto px-6 py-6'>
                    <div class='space-y-6'>
                        {/* Success Message */}
                        {successMessage && <Alert type='success' message={successMessage} data-testid='tenant-editor-success-message' />}

                        {/* Error Message */}
                        {errorMessage && <Alert type='error' message={errorMessage} />}

                        {/* Tenant ID */}
                        <Card padding='md'>
                            <div class='space-y-4'>
                                <h3 class='text-lg font-semibold text-text-primary'>Tenant Identification</h3>
                                <Input
                                    label='Tenant ID'
                                    value={formData.tenantId}
                                    onChange={(value) => setFormData({ ...formData, tenantId: value })}
                                    placeholder='my-tenant-id'
                                    disabled={mode === 'edit' || isSaving}
                                    required
                                    data-testid='tenant-id-input'
                                />
                                {mode === 'edit' && <p class='text-xs text-text-muted'>Tenant ID cannot be changed after creation</p>}
                            </div>
                        </Card>

                        {/* Preset Selection - Only in create mode */}
                        {mode === 'create' && (
                            <Card padding='md'>
                                <div class='space-y-4'>
                                    <div>
                                        <h3 class='text-lg font-semibold text-text-primary'>Theme Preset</h3>
                                        <p class='mt-1 text-sm text-text-muted'>
                                            Choose a starting theme. You can customize all settings after selection.
                                        </p>
                                    </div>
                                    <div class='grid grid-cols-3 gap-4'>
                                        <button
                                            type='button'
                                            onClick={() => {
                                                const presetData = getPresetFormData('aurora');
                                                setFormData({ ...formData, ...presetData, preset: 'aurora' });
                                            }}
                                            disabled={isSaving}
                                            class={`p-4 rounded-lg border-2 transition-all ${
                                                formData.preset === 'aurora'
                                                    ? 'border-interactive-primary bg-interactive-primary/10'
                                                    : 'border-border-default hover:border-border-strong'
                                            }`}
                                            data-testid='preset-aurora'
                                        >
                                            <div class='text-left'>
                                                <div class='font-semibold text-text-primary'>Aurora</div>
                                                <p class='text-xs text-text-muted mt-1'>Dark glassmorphic with animations</p>
                                                <div class='flex gap-1 mt-2'>
                                                    <span class='w-4 h-4 rounded-full bg-[#4f46e5]' />
                                                    <span class='w-4 h-4 rounded-full bg-[#ec4899]' />
                                                    <span class='w-4 h-4 rounded-full bg-[#22d3ee]' />
                                                    <span class='w-4 h-4 rounded-full bg-[#34d399]' />
                                                </div>
                                            </div>
                                        </button>
                                        <button
                                            type='button'
                                            onClick={() => {
                                                const presetData = getPresetFormData('brutalist');
                                                setFormData({ ...formData, ...presetData, preset: 'brutalist' });
                                            }}
                                            disabled={isSaving}
                                            class={`p-4 rounded-lg border-2 transition-all ${
                                                formData.preset === 'brutalist'
                                                    ? 'border-interactive-primary bg-interactive-primary/10'
                                                    : 'border-border-default hover:border-border-strong'
                                            }`}
                                            data-testid='preset-brutalist'
                                        >
                                            <div class='text-left'>
                                                <div class='font-semibold text-text-primary'>Brutalist</div>
                                                <p class='text-xs text-text-muted mt-1'>Minimal grayscale, no effects</p>
                                                <div class='flex gap-1 mt-2'>
                                                    <span class='w-4 h-4 rounded-full bg-[#a1a1aa]' />
                                                    <span class='w-4 h-4 rounded-full bg-[#d4d4d8]' />
                                                    <span class='w-4 h-4 rounded-full bg-[#71717a]' />
                                                    <span class='w-4 h-4 rounded-full bg-[#e5e5e5]' />
                                                </div>
                                            </div>
                                        </button>
                                        <button
                                            type='button'
                                            onClick={() => {
                                                const presetData = getPresetFormData('blank');
                                                setFormData({ ...formData, ...presetData, preset: 'blank' });
                                            }}
                                            disabled={isSaving}
                                            class={`p-4 rounded-lg border-2 transition-all ${
                                                formData.preset === 'blank'
                                                    ? 'border-interactive-primary bg-interactive-primary/10'
                                                    : 'border-border-default hover:border-border-strong'
                                            }`}
                                            data-testid='preset-blank'
                                        >
                                            <div class='text-left'>
                                                <div class='font-semibold text-text-primary'>Blank</div>
                                                <p class='text-xs text-text-muted mt-1'>Light theme, start from scratch</p>
                                                <div class='flex gap-1 mt-2'>
                                                    <span class='w-4 h-4 rounded-full bg-[#2563eb]' />
                                                    <span class='w-4 h-4 rounded-full bg-[#7c3aed]' />
                                                    <span class='w-4 h-4 rounded-full bg-[#f97316]' />
                                                    <span class='w-4 h-4 rounded-full bg-[#ffffff] border border-gray-300' />
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Branding Section */}
                        <Card padding='md'>
                            <div class='space-y-4'>
                                <h3 class='text-lg font-semibold text-text-primary'>Branding</h3>

                                <Input
                                    label='App Name'
                                    value={formData.appName}
                                    onChange={(value) => setFormData({ ...formData, appName: value })}
                                    placeholder='My Expense App'
                                    disabled={isSaving}
                                    required
                                    data-testid='app-name-input'
                                />

                                <ImageUploadField
                                    label='Logo (optional)'
                                    accept='image/*'
                                    maxSizeMB={2}
                                    currentImageUrl={formData.logoUrl}
                                    onFileSelect={handleLogoUpload}
                                    onClear={() => setFormData({ ...formData, logoUrl: '' })}
                                    disabled={isSaving || isUploadingLogo || !formData.tenantId}
                                    helperText={!formData.tenantId ? 'Save tenant first to enable upload' : 'Max 2MB. Formats: PNG, JPG, SVG, WebP'}
                                    allowUrlInput={true}
                                    data-testid='logo-upload-field'
                                />

                                <ImageUploadField
                                    label='Favicon (optional)'
                                    accept='image/x-icon,image/png,image/svg+xml'
                                    maxSizeMB={0.5}
                                    currentImageUrl={formData.faviconUrl}
                                    onFileSelect={handleFaviconUpload}
                                    onClear={() => setFormData({ ...formData, faviconUrl: '' })}
                                    disabled={isSaving || isUploadingFavicon || !formData.tenantId}
                                    helperText={!formData.tenantId ? 'Save tenant first to enable upload' : 'Max 512KB. Formats: ICO, PNG, SVG'}
                                    allowUrlInput={true}
                                    data-testid='favicon-upload-field'
                                />

                                <div class='grid grid-cols-3 gap-4'>
                                    <div>
                                        <label for='primary-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                            Primary Color
                                        </label>
                                        <input
                                            id='primary-color-input'
                                            type='color'
                                            value={formData.primaryColor}
                                            onInput={(e) => setFormData({ ...formData, primaryColor: (e.target as HTMLInputElement).value })}
                                            disabled={isSaving}
                                            class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                            data-testid='primary-color-input'
                                        />
                                        <p class='mt-1 text-xs text-text-muted'>{formData.primaryColor}</p>
                                        <p class='mt-1 text-xs text-text-muted'>Used for: buttons, links, focused inputs</p>
                                    </div>

                                    <div>
                                        <label for='secondary-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                            Secondary Color
                                        </label>
                                        <input
                                            id='secondary-color-input'
                                            type='color'
                                            value={formData.secondaryColor}
                                            onInput={(e) => setFormData({ ...formData, secondaryColor: (e.target as HTMLInputElement).value })}
                                            disabled={isSaving}
                                            class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                            data-testid='secondary-color-input'
                                        />
                                        <p class='mt-1 text-xs text-text-muted'>{formData.secondaryColor}</p>
                                        <p class='mt-1 text-xs text-text-muted'>Used for: success states, confirmations</p>
                                    </div>

                                    <div>
                                        <label for='accent-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                            Accent Color
                                        </label>
                                        <input
                                            id='accent-color-input'
                                            type='color'
                                            value={formData.accentColor}
                                            onInput={(e) => setFormData({ ...formData, accentColor: (e.target as HTMLInputElement).value })}
                                            disabled={isSaving}
                                            class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                            data-testid='accent-color-input'
                                        />
                                        <p class='mt-1 text-xs text-text-muted'>{formData.accentColor}</p>
                                        <p class='mt-1 text-xs text-text-muted'>Used for: highlights, warnings, badges</p>
                                    </div>
                                </div>

                                {/* Surfaces Category */}
                                <div class='space-y-2'>
                                    <h4 class='text-sm font-semibold text-text-secondary'>Surfaces</h4>
                                    <div class='grid grid-cols-2 gap-4'>
                                        <div>
                                            <label for='surface-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                                Base Surface
                                            </label>
                                            <input
                                                id='surface-color-input'
                                                type='color'
                                                value={formData.surfaceColor}
                                                onInput={(e) => setFormData({ ...formData, surfaceColor: (e.target as HTMLInputElement).value })}
                                                disabled={isSaving}
                                                class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                                data-testid='surface-color-input'
                                            />
                                            <p class='mt-1 text-xs text-text-muted'>{formData.surfaceColor}</p>
                                        </div>
                                        <div>
                                            <label for='surface-raised-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                                Raised Surface
                                            </label>
                                            <input
                                                id='surface-raised-color-input'
                                                type='color'
                                                value={formData.surfaceRaisedColor}
                                                onInput={(e) => setFormData({ ...formData, surfaceRaisedColor: (e.target as HTMLInputElement).value })}
                                                disabled={isSaving}
                                                class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                                data-testid='surface-raised-color-input'
                                            />
                                            <p class='mt-1 text-xs text-text-muted'>{formData.surfaceRaisedColor}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Text Category */}
                                <div class='space-y-2'>
                                    <h4 class='text-sm font-semibold text-text-secondary'>Text</h4>
                                    <div class='grid grid-cols-3 gap-4'>
                                        <div>
                                            <label for='text-primary-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                                Primary
                                            </label>
                                            <input
                                                id='text-primary-color-input'
                                                type='color'
                                                value={formData.textPrimaryColor}
                                                onInput={(e) => setFormData({ ...formData, textPrimaryColor: (e.target as HTMLInputElement).value })}
                                                disabled={isSaving}
                                                class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                                data-testid='text-primary-color-input'
                                            />
                                            <p class='mt-1 text-xs text-text-muted'>{formData.textPrimaryColor}</p>
                                        </div>
                                        <div>
                                            <label for='text-secondary-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                                Secondary
                                            </label>
                                            <input
                                                id='text-secondary-color-input'
                                                type='color'
                                                value={formData.textSecondaryColor}
                                                onInput={(e) => setFormData({ ...formData, textSecondaryColor: (e.target as HTMLInputElement).value })}
                                                disabled={isSaving}
                                                class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                                data-testid='text-secondary-color-input'
                                            />
                                            <p class='mt-1 text-xs text-text-muted'>{formData.textSecondaryColor}</p>
                                        </div>
                                        <div>
                                            <label for='text-muted-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                                Muted
                                            </label>
                                            <input
                                                id='text-muted-color-input'
                                                type='color'
                                                value={formData.textMutedColor}
                                                onInput={(e) => setFormData({ ...formData, textMutedColor: (e.target as HTMLInputElement).value })}
                                                disabled={isSaving}
                                                class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                                data-testid='text-muted-color-input'
                                            />
                                            <p class='mt-1 text-xs text-text-muted'>{formData.textMutedColor}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Borders Category */}
                                <div class='space-y-2'>
                                    <h4 class='text-sm font-semibold text-text-secondary'>Borders</h4>
                                    <div class='grid grid-cols-3 gap-4'>
                                        <div>
                                            <label for='border-subtle-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                                Subtle
                                            </label>
                                            <input
                                                id='border-subtle-color-input'
                                                type='color'
                                                value={formData.borderSubtleColor}
                                                onInput={(e) => setFormData({ ...formData, borderSubtleColor: (e.target as HTMLInputElement).value })}
                                                disabled={isSaving}
                                                class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                                data-testid='border-subtle-color-input'
                                            />
                                            <p class='mt-1 text-xs text-text-muted'>{formData.borderSubtleColor}</p>
                                        </div>
                                        <div>
                                            <label for='border-default-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                                Default
                                            </label>
                                            <input
                                                id='border-default-color-input'
                                                type='color'
                                                value={formData.borderDefaultColor}
                                                onInput={(e) => setFormData({ ...formData, borderDefaultColor: (e.target as HTMLInputElement).value })}
                                                disabled={isSaving}
                                                class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                                data-testid='border-default-color-input'
                                            />
                                            <p class='mt-1 text-xs text-text-muted'>{formData.borderDefaultColor}</p>
                                        </div>
                                        <div>
                                            <label for='border-strong-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                                Strong
                                            </label>
                                            <input
                                                id='border-strong-color-input'
                                                type='color'
                                                value={formData.borderStrongColor}
                                                onInput={(e) => setFormData({ ...formData, borderStrongColor: (e.target as HTMLInputElement).value })}
                                                disabled={isSaving}
                                                class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                                data-testid='border-strong-color-input'
                                            />
                                            <p class='mt-1 text-xs text-text-muted'>{formData.borderStrongColor}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Colors Category */}
                                <div class='space-y-2'>
                                    <h4 class='text-sm font-semibold text-text-secondary'>Status Colors</h4>
                                    <div class='grid grid-cols-4 gap-4'>
                                        <div>
                                            <label for='success-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                                Success
                                            </label>
                                            <input
                                                id='success-color-input'
                                                type='color'
                                                value={formData.successColor}
                                                onInput={(e) => setFormData({ ...formData, successColor: (e.target as HTMLInputElement).value })}
                                                disabled={isSaving}
                                                class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                                data-testid='success-color-input'
                                            />
                                            <p class='mt-1 text-xs text-text-muted'>{formData.successColor}</p>
                                        </div>
                                        <div>
                                            <label for='warning-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                                Warning
                                            </label>
                                            <input
                                                id='warning-color-input'
                                                type='color'
                                                value={formData.warningColor}
                                                onInput={(e) => setFormData({ ...formData, warningColor: (e.target as HTMLInputElement).value })}
                                                disabled={isSaving}
                                                class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                                data-testid='warning-color-input'
                                            />
                                            <p class='mt-1 text-xs text-text-muted'>{formData.warningColor}</p>
                                        </div>
                                        <div>
                                            <label for='error-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                                Error
                                            </label>
                                            <input
                                                id='error-color-input'
                                                type='color'
                                                value={formData.errorColor}
                                                onInput={(e) => setFormData({ ...formData, errorColor: (e.target as HTMLInputElement).value })}
                                                disabled={isSaving}
                                                class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                                data-testid='error-color-input'
                                            />
                                            <p class='mt-1 text-xs text-text-muted'>{formData.errorColor}</p>
                                        </div>
                                        <div>
                                            <label for='info-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                                Info
                                            </label>
                                            <input
                                                id='info-color-input'
                                                type='color'
                                                value={formData.infoColor}
                                                onInput={(e) => setFormData({ ...formData, infoColor: (e.target as HTMLInputElement).value })}
                                                disabled={isSaving}
                                                class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                                data-testid='info-color-input'
                                            />
                                            <p class='mt-1 text-xs text-text-muted'>{formData.infoColor}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Marketing Flags */}
                                <div class='space-y-2'>
                                    <label class='block text-sm font-medium leading-6 text-text-primary'>
                                        Marketing Features
                                    </label>
                                    <div class='grid grid-cols-2 gap-2'>
                                        <label class='flex items-center gap-2 text-sm'>
                                            <input
                                                type='checkbox'
                                                checked={formData.showLandingPage}
                                                onChange={(e) => setFormData({ ...formData, showLandingPage: (e.target as HTMLInputElement).checked })}
                                                disabled={isSaving}
                                                class='h-4 w-4 rounded'
                                                data-testid='show-landing-page-checkbox'
                                            />
                                            <span class='text-text-primary'>Landing Page</span>
                                        </label>

                                        <label class='flex items-center gap-2 text-sm'>
                                            <input
                                                type='checkbox'
                                                checked={formData.showMarketingContent}
                                                onChange={(e) => setFormData({ ...formData, showMarketingContent: (e.target as HTMLInputElement).checked })}
                                                disabled={isSaving}
                                                class='h-4 w-4 rounded'
                                                data-testid='show-marketing-content-checkbox'
                                            />
                                            <span class='text-text-primary'>Marketing Content</span>
                                        </label>

                                        <label class='flex items-center gap-2 text-sm'>
                                            <input
                                                type='checkbox'
                                                checked={formData.showPricingPage}
                                                onChange={(e) => setFormData({ ...formData, showPricingPage: (e.target as HTMLInputElement).checked })}
                                                disabled={isSaving}
                                                class='h-4 w-4 rounded'
                                                data-testid='show-pricing-page-checkbox'
                                            />
                                            <span class='text-text-primary'>Pricing Page</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Motion & Effects Section */}
                        <Card padding='md'>
                            <div class='space-y-4'>
                                <div>
                                    <h3 class='text-lg font-semibold text-text-primary'>Motion & Effects</h3>
                                    <p class='mt-1 text-sm text-text-muted'>
                                        Control animations and interactive behaviors for your theme
                                    </p>
                                </div>

                                <div class='space-y-3'>
                                    <label class='flex items-center gap-3 text-sm'>
                                        <input
                                            type='checkbox'
                                            checked={formData.enableAuroraAnimation}
                                            onChange={(e) => setFormData({ ...formData, enableAuroraAnimation: (e.target as HTMLInputElement).checked })}
                                            disabled={isSaving}
                                            class='h-4 w-4 rounded'
                                            data-testid='enable-aurora-animation-checkbox'
                                        />
                                        <div>
                                            <span class='font-medium text-text-primary'>Aurora Background Animation</span>
                                            <p class='text-xs text-text-muted'>Animated gradient background with parallax effect</p>
                                        </div>
                                    </label>

                                    <label class='flex items-center gap-3 text-sm'>
                                        <input
                                            type='checkbox'
                                            checked={formData.enableGlassmorphism}
                                            onChange={(e) => setFormData({ ...formData, enableGlassmorphism: (e.target as HTMLInputElement).checked })}
                                            disabled={isSaving}
                                            class='h-4 w-4 rounded'
                                            data-testid='enable-glassmorphism-checkbox'
                                        />
                                        <div>
                                            <span class='font-medium text-text-primary'>Glassmorphism</span>
                                            <p class='text-xs text-text-muted'>Frosted glass effect with blur and transparency</p>
                                        </div>
                                    </label>

                                    <label class='flex items-center gap-3 text-sm'>
                                        <input
                                            type='checkbox'
                                            checked={formData.enableMagneticHover}
                                            onChange={(e) => setFormData({ ...formData, enableMagneticHover: (e.target as HTMLInputElement).checked })}
                                            disabled={isSaving}
                                            class='h-4 w-4 rounded'
                                            data-testid='enable-magnetic-hover-checkbox'
                                        />
                                        <div>
                                            <span class='font-medium text-text-primary'>Magnetic Hover</span>
                                            <p class='text-xs text-text-muted'>Buttons follow cursor with magnetic attraction</p>
                                        </div>
                                    </label>

                                    <label class='flex items-center gap-3 text-sm'>
                                        <input
                                            type='checkbox'
                                            checked={formData.enableScrollReveal}
                                            onChange={(e) => setFormData({ ...formData, enableScrollReveal: (e.target as HTMLInputElement).checked })}
                                            disabled={isSaving}
                                            class='h-4 w-4 rounded'
                                            data-testid='enable-scroll-reveal-checkbox'
                                        />
                                        <div>
                                            <span class='font-medium text-text-primary'>Scroll Reveal</span>
                                            <p class='text-xs text-text-muted'>Animate elements as they enter viewport</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </Card>

                        {/* Typography Section */}
                        <Card padding='md'>
                            <div class='space-y-4'>
                                <div>
                                    <h3 class='text-lg font-semibold text-text-primary'>Typography</h3>
                                    <p class='mt-1 text-sm text-text-muted'>
                                        Configure font families for your theme
                                    </p>
                                </div>

                                <div class='space-y-1'>
                                    <label for='font-family-sans-input' class='block text-sm font-medium leading-6 text-text-primary'>
                                        Sans-Serif Font Family
                                    </label>
                                    <input
                                        id='font-family-sans-input'
                                        type='text'
                                        value={formData.fontFamilySans}
                                        onInput={(e) => setFormData({ ...formData, fontFamilySans: (e.target as HTMLInputElement).value })}
                                        placeholder='Space Grotesk, Inter, system-ui, -apple-system, BlinkMacSystemFont'
                                        disabled={isSaving}
                                        class='w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary'
                                        data-testid='font-family-sans-input'
                                    />
                                    <p class='text-xs text-text-muted'>Font stack for body text and UI elements</p>
                                </div>

                                <div class='space-y-1'>
                                    <label for='font-family-serif-input' class='block text-sm font-medium leading-6 text-text-primary'>
                                        Serif Font Family
                                    </label>
                                    <input
                                        id='font-family-serif-input'
                                        type='text'
                                        value={formData.fontFamilySerif}
                                        onInput={(e) => setFormData({ ...formData, fontFamilySerif: (e.target as HTMLInputElement).value })}
                                        placeholder='Fraunces, Georgia, serif'
                                        disabled={isSaving}
                                        class='w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary'
                                        data-testid='font-family-serif-input'
                                    />
                                    <p class='text-xs text-text-muted'>Font stack for headings and display text</p>
                                </div>

                                <div class='space-y-1'>
                                    <label for='font-family-mono-input' class='block text-sm font-medium leading-6 text-text-primary'>
                                        Monospace Font Family
                                    </label>
                                    <input
                                        id='font-family-mono-input'
                                        type='text'
                                        value={formData.fontFamilyMono}
                                        onInput={(e) => setFormData({ ...formData, fontFamilyMono: (e.target as HTMLInputElement).value })}
                                        placeholder='JetBrains Mono, SFMono-Regular, Menlo, monospace'
                                        disabled={isSaving}
                                        class='w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary'
                                        data-testid='font-family-mono-input'
                                    />
                                    <p class='text-xs text-text-muted'>Font stack for code and technical content</p>
                                </div>
                            </div>
                        </Card>

                        {/* Aurora Gradient Editor Section */}
                        <Card padding='md'>
                            <div class='space-y-4'>
                                <div>
                                    <h3 class='text-lg font-semibold text-text-primary'>Aurora Gradient</h3>
                                    <p class='mt-1 text-sm text-text-muted'>
                                        Configure up to 4 colors for the aurora background animation. Appears as an animated gradient behind the page content when "Aurora Background Animation" is enabled.
                                    </p>
                                </div>

                                <div class='grid grid-cols-2 md:grid-cols-4 gap-4'>
                                    {[0, 1, 2, 3].map((index) => (
                                        <div key={index}>
                                            <label for={`aurora-gradient-color-${index + 1}-input`} class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                                Color {index + 1}
                                            </label>
                                            <input
                                                id={`aurora-gradient-color-${index + 1}-input`}
                                                type='color'
                                                value={formData.auroraGradient[index] || '#000000'}
                                                onInput={(e) => {
                                                    const newGradient = [...formData.auroraGradient];
                                                    newGradient[index] = (e.target as HTMLInputElement).value;
                                                    setFormData({ ...formData, auroraGradient: newGradient });
                                                }}
                                                disabled={isSaving}
                                                class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                                data-testid={`aurora-gradient-color-${index + 1}-input`}
                                            />
                                            <p class='mt-1 text-xs text-text-muted'>{formData.auroraGradient[index] || '#000000'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>

                        {/* Glassmorphism Settings Section */}
                        <Card padding='md'>
                            <div class='space-y-4'>
                                <div>
                                    <h3 class='text-lg font-semibold text-text-primary'>Glassmorphism Settings</h3>
                                    <p class='mt-1 text-sm text-text-muted'>
                                        Configure glass colors for frosted glass effects (RGBA format). Applied to cards, modals, and panels when "Glassmorphism" is enabled.
                                    </p>
                                </div>

                                <div class='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    <div class='space-y-1'>
                                        <label for='glass-color-input' class='block text-sm font-medium leading-6 text-text-primary'>
                                            Glass Color
                                        </label>
                                        <input
                                            id='glass-color-input'
                                            type='text'
                                            value={formData.glassColor}
                                            onInput={(e) => setFormData({ ...formData, glassColor: (e.target as HTMLInputElement).value })}
                                            placeholder='rgba(25, 30, 50, 0.45)'
                                            disabled={isSaving}
                                            class='w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary font-mono'
                                            data-testid='glass-color-input'
                                        />
                                        <p class='text-xs text-text-muted'>Used for: card and modal backgrounds with blur effect</p>
                                    </div>

                                    <div class='space-y-1'>
                                        <label for='glass-border-color-input' class='block text-sm font-medium leading-6 text-text-primary'>
                                            Glass Border Color
                                        </label>
                                        <input
                                            id='glass-border-color-input'
                                            type='text'
                                            value={formData.glassBorderColor}
                                            onInput={(e) => setFormData({ ...formData, glassBorderColor: (e.target as HTMLInputElement).value })}
                                            placeholder='rgba(255, 255, 255, 0.12)'
                                            disabled={isSaving}
                                            class='w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary font-mono'
                                            data-testid='glass-border-color-input'
                                        />
                                        <p class='text-xs text-text-muted'>Used for: subtle borders around glass surfaces</p>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Domains Section */}
                        <Card padding='md'>
                            <div class='space-y-4'>
                                <div>
                                    <h3 class='text-lg font-semibold text-text-primary'>Domains</h3>
                                    <p class='mt-1 text-sm text-text-muted'>
                                        Add all domains where this tenant should be accessible. At least one domain is required.
                                    </p>
                                </div>

                                {/* Domain List */}
                                {formData.domains.length > 0 && (
                                    <div class='space-y-2'>
                                        {formData.domains.map((domain, index) => (
                                            <div key={index} class='flex items-center gap-2 rounded-md border border-border-default bg-surface-muted px-3 py-2'>
                                                <span class='flex-1 text-sm text-text-primary font-mono'>{domain}</span>
                                                <button
                                                    onClick={() => handleRemoveDomain(index)}
                                                    disabled={isSaving}
                                                    class='text-text-muted hover:text-error-primary'
                                                    data-testid={`remove-domain-${index}`}
                                                >
                                                    <svg class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                                        <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add Domain */}
                                <div class='space-y-2'>
                                    <label class='block text-sm font-medium leading-6 text-text-primary'>
                                        Add Domain
                                    </label>
                                    <div class='flex gap-2'>
                                        <input
                                            type='text'
                                            value={newDomain}
                                            onInput={(e) => setNewDomain((e.target as HTMLInputElement).value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddDomain()}
                                            placeholder='app.example.com'
                                            disabled={isSaving}
                                            class='flex-1 rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary'
                                            data-testid='new-domain-input'
                                        />
                                        <Button
                                            onClick={handleAddDomain}
                                            disabled={!newDomain.trim() || isSaving}
                                            variant='secondary'
                                            data-testid='add-domain-button'
                                        >
                                            Add
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Footer */}
                <div class='flex items-center justify-end gap-3 border-t border-border-default bg-surface-base px-6 py-4'>
                    <Button
                        onClick={handleCancel}
                        variant='secondary'
                        disabled={isSaving || isPublishing}
                        data-testid='cancel-button'
                    >
                        Cancel
                    </Button>
                    {mode === 'edit' && (
                        <Button
                            onClick={handlePublish}
                            variant='primary'
                            disabled={isSaving || isPublishing}
                            loading={isPublishing}
                            data-testid='publish-theme-button'
                            className='!bg-gradient-to-r !from-amber-500 !to-orange-600 !text-white !shadow-lg hover:!shadow-amber-500/30'
                        >
                            {isPublishing ? 'Publishing...' : 'Publish Theme'}
                        </Button>
                    )}
                    <Button
                        onClick={handleSave}
                        variant='primary'
                        loading={isSaving}
                        disabled={isSaving}
                        data-testid='save-tenant-button'
                        className='!bg-gradient-to-r !from-indigo-600 !to-purple-600 !text-white !shadow-lg hover:!shadow-indigo-500/30'
                    >
                        {isSaving ? 'Saving...' : (mode === 'create' ? 'Create Tenant' : 'Save Changes')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
