import { apiClient } from '@/app/apiClient';
import { Alert, Button, Card, Input, Modal } from '@/components/ui';
import { logError } from '@/utils/browser-logger';
import type { AdminUpsertTenantRequest } from '@splitifyd/shared';
import { useEffect, useState } from 'preact/hooks';

interface TenantData {
    tenantId: string;
    appName: string;
    logoUrl: string;
    faviconUrl: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    showLandingPage: boolean;
    showMarketingContent: boolean;
    showPricingPage: boolean;
    primaryDomain: string;
    domainAliases: string[];
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
    primaryDomain: string | null;
    domains: string[];
    isDefault: boolean;
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
    showLandingPage: true,
    showMarketingContent: true,
    showPricingPage: false,
    primaryDomain: '',
    domainAliases: [],
};

export function TenantEditorModal({ open, onClose, onSave, tenant, mode }: TenantEditorModalProps) {
    const [formData, setFormData] = useState<TenantData>(DEFAULT_TENANT_DATA);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [newAlias, setNewAlias] = useState('');

    // Update form data when tenant or mode changes
    useEffect(() => {
        if (mode === 'edit' && tenant) {
            setFormData({
                tenantId: tenant.tenant.tenantId || '',
                appName: tenant.tenant.branding?.appName || '',
                logoUrl: tenant.tenant.branding?.logoUrl || '',
                faviconUrl: tenant.tenant.branding?.faviconUrl || tenant.tenant.branding?.logoUrl || '',
                primaryColor: tenant.tenant.branding?.primaryColor || '#1a73e8',
                secondaryColor: tenant.tenant.branding?.secondaryColor || '#34a853',
                accentColor: tenant.tenant.branding?.accentColor || '#fbbc04',
                showLandingPage: tenant.tenant.branding?.marketingFlags?.showLandingPage ?? true,
                showMarketingContent: tenant.tenant.branding?.marketingFlags?.showMarketingContent ?? true,
                showPricingPage: tenant.tenant.branding?.marketingFlags?.showPricingPage ?? false,
                primaryDomain: tenant.primaryDomain || '',
                domainAliases: tenant.domains.filter(d => d !== tenant.primaryDomain) || [],
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
            setErrorMessage('Tenant ID must contain only lowercase letters, numbers, and hyphens');
            return;
        }
        if (!formData.appName.trim()) {
            setErrorMessage('App name is required');
            return;
        }
        if (!formData.logoUrl.trim()) {
            setErrorMessage('Logo URL is required');
            return;
        }
        if (!formData.logoUrl.startsWith('http://') && !formData.logoUrl.startsWith('https://') && !formData.logoUrl.startsWith('/')) {
            setErrorMessage('Logo URL must be a valid URL (http://, https://, or path starting with /)');
            return;
        }
        if (!formData.primaryColor.trim()) {
            setErrorMessage('Primary color is required');
            return;
        }
        if (!formData.secondaryColor.trim()) {
            setErrorMessage('Secondary color is required');
            return;
        }
        if (!formData.primaryDomain.trim()) {
            setErrorMessage('Primary domain is required');
            return;
        }
        // Basic domain validation
        const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
        if (!domainRegex.test(formData.primaryDomain)) {
            setErrorMessage('Primary domain must be a valid domain name (e.g., example.com, app.example.com)');
            return;
        }

        setIsSaving(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            // Compute normalized domains (primary + aliases)
            const allDomains = [formData.primaryDomain, ...formData.domainAliases].map(d => d.trim().toLowerCase().replace(/:\d+$/, ''));

            const requestData: AdminUpsertTenantRequest = {
                tenantId: formData.tenantId,
                branding: {
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
                },
                domains: {
                    primary: formData.primaryDomain.trim().toLowerCase(),
                    aliases: formData.domainAliases.map(d => d.trim().toLowerCase()),
                    normalized: allDomains,
                },
            };

            const result = await apiClient.adminUpsertTenant(requestData);
            const action = result.created ? 'created' : 'updated';
            setSuccessMessage(`Tenant ${action} successfully!`);

            // Close modal after short delay to show success message
            setTimeout(() => {
                onSave();
                onClose();
                setFormData({ ...DEFAULT_TENANT_DATA });
            }, 1500);
        } catch (error: any) {
            const userFriendlyMessage = error.code === 'INVALID_TENANT_PAYLOAD'
                ? 'Invalid tenant data. Please check all fields and try again.'
                : error.code === 'PERMISSION_DENIED'
                ? 'You do not have permission to modify tenant settings.'
                : error.message || 'Failed to save tenant. Please try again.';

            setErrorMessage(userFriendlyMessage);
            logError('Failed to save tenant', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setFormData({ ...DEFAULT_TENANT_DATA });
        setErrorMessage('');
        setNewAlias('');
        onClose();
    };

    const handleAddAlias = () => {
        const alias = newAlias.trim().toLowerCase();
        if (alias && !formData.domainAliases.includes(alias)) {
            setFormData({ ...formData, domainAliases: [...formData.domainAliases, alias] });
            setNewAlias('');
        }
    };

    const handleRemoveAlias = (index: number) => {
        const updated = [...formData.domainAliases];
        updated.splice(index, 1);
        setFormData({ ...formData, domainAliases: updated });
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
                        {successMessage && <Alert type='success' message={successMessage} />}

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

                                <Input
                                    label='Logo URL'
                                    value={formData.logoUrl}
                                    onChange={(value) => setFormData({ ...formData, logoUrl: value })}
                                    placeholder='/logo.svg'
                                    disabled={isSaving}
                                    required
                                    data-testid='logo-url-input'
                                />

                                <Input
                                    label='Favicon URL (optional)'
                                    value={formData.faviconUrl}
                                    onChange={(value) => setFormData({ ...formData, faviconUrl: value })}
                                    placeholder='/favicon.ico'
                                    disabled={isSaving}
                                    data-testid='favicon-url-input'
                                />

                                <div class='grid grid-cols-3 gap-4'>
                                    <div>
                                        <label class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                            Primary Color
                                        </label>
                                        <input
                                            type='color'
                                            value={formData.primaryColor}
                                            onInput={(e) => setFormData({ ...formData, primaryColor: (e.target as HTMLInputElement).value })}
                                            disabled={isSaving}
                                            class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                            data-testid='primary-color-input'
                                        />
                                        <p class='mt-1 text-xs text-text-muted'>{formData.primaryColor}</p>
                                    </div>

                                    <div>
                                        <label class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                            Secondary Color
                                        </label>
                                        <input
                                            type='color'
                                            value={formData.secondaryColor}
                                            onInput={(e) => setFormData({ ...formData, secondaryColor: (e.target as HTMLInputElement).value })}
                                            disabled={isSaving}
                                            class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                            data-testid='secondary-color-input'
                                        />
                                        <p class='mt-1 text-xs text-text-muted'>{formData.secondaryColor}</p>
                                    </div>

                                    <div>
                                        <label class='block text-sm font-medium leading-6 text-text-primary mb-2'>
                                            Accent Color
                                        </label>
                                        <input
                                            type='color'
                                            value={formData.accentColor}
                                            onInput={(e) => setFormData({ ...formData, accentColor: (e.target as HTMLInputElement).value })}
                                            disabled={isSaving}
                                            class='block h-10 w-full rounded-md border border-border-default bg-surface-base cursor-pointer'
                                            data-testid='accent-color-input'
                                        />
                                        <p class='mt-1 text-xs text-text-muted'>{formData.accentColor}</p>
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

                        {/* Domains Section */}
                        <Card padding='md'>
                            <div class='space-y-4'>
                                <h3 class='text-lg font-semibold text-text-primary'>Domains</h3>

                                <Input
                                    label='Primary Domain'
                                    value={formData.primaryDomain}
                                    onChange={(value) => setFormData({ ...formData, primaryDomain: value })}
                                    placeholder='app.example.com'
                                    disabled={isSaving}
                                    required
                                    data-testid='primary-domain-input'
                                />

                                {/* Domain Aliases */}
                                <div class='space-y-2'>
                                    <label class='block text-sm font-medium leading-6 text-text-primary'>
                                        Domain Aliases
                                    </label>

                                    {/* Alias List */}
                                    {formData.domainAliases.length > 0 && (
                                        <div class='space-y-2'>
                                            {formData.domainAliases.map((alias, index) => (
                                                <div key={index} class='flex items-center gap-2 rounded-md border border-border-default bg-surface-muted px-3 py-2'>
                                                    <span class='flex-1 text-sm text-text-primary'>{alias}</span>
                                                    <button
                                                        onClick={() =>
                                                            handleRemoveAlias(index)}
                                                        disabled={isSaving}
                                                        class='text-text-muted hover:text-error-primary'
                                                        data-testid={`remove-alias-${index}`}
                                                    >
                                                        <svg class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                                            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add Alias */}
                                    <div class='flex gap-2'>
                                        <input
                                            type='text'
                                            value={newAlias}
                                            onInput={(e) => setNewAlias((e.target as HTMLInputElement).value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddAlias()}
                                            placeholder='alias.example.com'
                                            disabled={isSaving}
                                            class='flex-1 rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary'
                                            data-testid='new-alias-input'
                                        />
                                        <Button
                                            onClick={handleAddAlias}
                                            disabled={!newAlias.trim() || isSaving}
                                            variant='secondary'
                                            data-testid='add-alias-button'
                                        >
                                            Add Alias
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Footer */}
                <div class='flex items-center justify-end gap-3 border-t border-border-default px-6 py-4'>
                    <Button
                        onClick={handleCancel}
                        variant='secondary'
                        disabled={isSaving}
                        data-testid='cancel-button'
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        loading={isSaving}
                        disabled={isSaving}
                        data-testid='save-tenant-button'
                    >
                        {isSaving ? 'Saving...' : (mode === 'create' ? 'Create Tenant' : 'Save Changes')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
