import { apiClient } from '@/app/apiClient';
import { Alert, Button, Card, ImageUploadField, Input, Modal } from '@/components/ui';
import { logError } from '@/utils/browser-logger';
import { mergeTokensSmartly } from '@/utils/tenant-token-merger';
import type { AdminUpsertTenantRequest, TenantBranding } from '@billsplit-wl/shared';
import { useEffect, useState } from 'preact/hooks';

interface TenantData {
    tenantId: string;
    appName: string;
    logoUrl: string;
    faviconUrl: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    surfaceColor: string;
    textColor: string;
    customCSS: string;
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
    auroraGradient: string[]; // Array of hex colors
    // Glassmorphism Settings
    glassColor: string; // RGBA color for glass effect
    glassBorderColor: string; // RGBA color for glass border
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

const DEFAULT_TENANT_DATA: TenantData = {
    tenantId: '',
    appName: '',
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '#1a73e8',
    secondaryColor: '#34a853',
    accentColor: '#fbbc04',
    surfaceColor: '#ffffff',
    textColor: '#111827',
    customCSS: '',
    showLandingPage: true,
    showMarketingContent: true,
    showPricingPage: false,
    domains: [],
    // Motion & Effects defaults
    enableAuroraAnimation: false,
    enableGlassmorphism: false,
    enableMagneticHover: false,
    enableScrollReveal: false,
    // Typography defaults
    fontFamilySans: 'Space Grotesk, Inter, system-ui, -apple-system, BlinkMacSystemFont',
    fontFamilySerif: 'Fraunces, Georgia, serif',
    fontFamilyMono: 'JetBrains Mono, SFMono-Regular, Menlo, monospace',
    // Aurora Gradient defaults (4 colors)
    auroraGradient: ['#6366f1', '#ec4899', '#22d3ee', '#34d399'],
    // Glassmorphism defaults
    glassColor: 'rgba(25, 30, 50, 0.45)',
    glassBorderColor: 'rgba(255, 255, 255, 0.12)',
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
            // TODO: Restore logging once branding structure is finalized
            // console.log('[TenantEditorModal] Loading - surfaceColor from branding:', tenant.tenant.branding?.surfaceColor);
            // console.log('[TenantEditorModal] Loading - appName from branding:', tenant.tenant.branding?.appName);

            const branding = tenant.tenant.branding as any;
            const tokens = tenant.brandingTokens?.tokens; // Access brandingTokens from top level

            console.log('[TenantEditorModal] Loading - branding object keys:', Object.keys(branding || {}));
            console.log('[TenantEditorModal] Loading - tokens exist?:', !!tokens);

            // CRITICAL: NO DEFAULTS! Show exactly what comes from the API
            setFormData({
                tenantId: tenant.tenant.tenantId,
                appName: tenant.tenant.branding?.appName ?? '',
                logoUrl: tenant.tenant.branding?.logoUrl ?? '',
                faviconUrl: tenant.tenant.branding?.faviconUrl ?? '',
                // Load colors from brandingTokens (source of truth) OR simple branding - NO hardcoded defaults
                primaryColor: tokens?.semantics?.colors?.interactive?.primary ?? tenant.tenant.branding?.primaryColor ?? '',
                secondaryColor: tokens?.palette?.secondary ?? tenant.tenant.branding?.secondaryColor ?? '',
                accentColor: tokens?.semantics?.colors?.interactive?.accent ?? tenant.tenant.branding?.accentColor ?? '',
                surfaceColor: tokens?.semantics?.colors?.surface?.base ?? branding?.surfaceColor ?? '',
                textColor: tokens?.semantics?.colors?.text?.primary ?? branding?.textColor ?? '',
                customCSS: branding?.customCSS ?? '',
                showLandingPage: tenant.tenant.branding?.marketingFlags?.showLandingPage ?? false,
                showMarketingContent: tenant.tenant.branding?.marketingFlags?.showMarketingContent ?? false,
                showPricingPage: tenant.tenant.branding?.marketingFlags?.showPricingPage ?? false,
                domains: tenant.domains ?? [],
                // Load motion settings from brandingTokens - NO defaults
                enableAuroraAnimation: tokens?.motion?.enableParallax ?? false,
                enableGlassmorphism: !!(tokens?.semantics?.colors?.surface?.glass),
                enableMagneticHover: tokens?.motion?.enableMagneticHover ?? false,
                enableScrollReveal: tokens?.motion?.enableScrollReveal ?? false,
                // Load typography from brandingTokens - NO defaults
                fontFamilySans: tokens?.typography?.fontFamily?.sans ?? '',
                fontFamilySerif: tokens?.typography?.fontFamily?.serif ?? '',
                fontFamilyMono: tokens?.typography?.fontFamily?.mono ?? '',
                // Load aurora gradient from brandingTokens - NO defaults
                auroraGradient: Array.isArray(tokens?.semantics?.colors?.gradient?.aurora)
                    ? tokens.semantics.colors.gradient.aurora
                    : [],
                // Load glassmorphism from brandingTokens - NO defaults
                glassColor: tokens?.semantics?.colors?.surface?.glass ?? '',
                glassBorderColor: tokens?.semantics?.colors?.surface?.glassBorder ?? '',
            });
        } else if (mode === 'create') {
            setFormData({ ...DEFAULT_TENANT_DATA });
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

            if (formData.surfaceColor.trim()) {
                branding.surfaceColor = formData.surfaceColor;
            }
            if (formData.textColor.trim()) {
                branding.textColor = formData.textColor;
            }
            if (formData.customCSS.trim()) {
                branding.customCSS = formData.customCSS;
            }

            // Smart merge: preserve existing brandingTokens, only update edited colors, motion flags, and typography
            const brandingTokens = mergeTokensSmartly(
                tenant?.brandingTokens, // Access brandingTokens from top level
                {
                    primaryColor: formData.primaryColor,
                    secondaryColor: formData.secondaryColor,
                    accentColor: formData.accentColor,
                    surfaceColor: formData.surfaceColor,
                    textColor: formData.textColor,
                    enableAuroraAnimation: formData.enableAuroraAnimation,
                    enableGlassmorphism: formData.enableGlassmorphism,
                    enableMagneticHover: formData.enableMagneticHover,
                    enableScrollReveal: formData.enableScrollReveal,
                    fontFamilySans: formData.fontFamilySans,
                    fontFamilySerif: formData.fontFamilySerif,
                    fontFamilyMono: formData.fontFamilyMono,
                    auroraGradient: formData.auroraGradient,
                    glassColor: formData.glassColor,
                    glassBorderColor: formData.glassBorderColor,
                },
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

                                <div class='grid grid-cols-2 gap-4'>
                                    <div>
                                        <label for='surface-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                            Surface Color
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
                                        <p class='mt-1 text-xs text-text-muted'>Used for: cards, containers, borders</p>
                                    </div>

                                    <div>
                                        <label for='text-color-input' class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                            Text Color
                                        </label>
                                        <input
                                            id='text-color-input'
                                            type='color'
                                            value={formData.textColor}
                                            onInput={(e) => setFormData({ ...formData, textColor: (e.target as HTMLInputElement).value })}
                                            disabled={isSaving}
                                            class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                            data-testid='text-color-input'
                                        />
                                        <p class='mt-1 text-xs text-text-muted'>{formData.textColor}</p>
                                        <p class='mt-1 text-xs text-text-muted'>Used for: primary text, headings, overlay backgrounds</p>
                                    </div>
                                </div>

                                <div class='space-y-1'>
                                    <label for='custom-css-input' class='block text-sm font-medium leading-6 text-text-primary'>
                                        Custom CSS
                                    </label>
                                    <textarea
                                        id='custom-css-input'
                                        value={formData.customCSS}
                                        onInput={(event) => setFormData({ ...formData, customCSS: (event.target as HTMLTextAreaElement).value })}
                                        placeholder='/* Optional tenant-specific CSS */'
                                        disabled={isSaving}
                                        rows={4}
                                        class='w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary'
                                        data-testid='custom-css-input'
                                    />
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
