import { Alert, Button, Card, ColorInput, Form, Input, LoadingSpinner } from '@/components/ui';
import { InfoIcon } from '@/components/ui/icons';
import { logError } from '@/utils/browser-logger';
import { SystemUserRoles } from '@billsplit-wl/shared';
import type { TenantSettingsResponse, UpdateTenantBrandingRequest } from '@billsplit-wl/shared';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../app/apiClient';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { BaseLayout } from '../components/layout/BaseLayout';

/**
 * Tenant Branding Editor Page
 *
 * Allows tenant admins to configure their tenant's branding:
 * - App name
 * - Logo URL
 * - Favicon URL
 * - Primary and secondary colors
 * - Marketing flags
 *
 * Access: Requires tenant-admin or system-admin role
 */
export function TenantBrandingPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [tenantSettings, setTenantSettings] = useState<TenantSettingsResponse | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Form state
    const [appName, setAppName] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [faviconUrl, setFaviconUrl] = useState('');
    const [primaryColor, setPrimaryColor] = useState('#1a73e8');
    const [secondaryColor, setSecondaryColor] = useState('#34a853');
    const [showMarketingContent, setShowMarketingContent] = useState(true);
    const [showPricingPage, setShowPricingPage] = useState(false);

    const user = authStore.user;

    // Check if user has tenant-admin or system-admin role
    const hasAdminAccess = user?.role === SystemUserRoles.TENANT_ADMIN || user?.role === SystemUserRoles.SYSTEM_ADMIN;

    // Load tenant settings on mount
    useEffect(() => {
        if (!hasAdminAccess) {
            return;
        }

        const loadSettings = async () => {
            try {
                setIsLoading(true);
                const settings = await apiClient.getTenantSettings();
                setTenantSettings(settings);

                // Populate form with current values from brandingTokens
                const tokens = settings.config.brandingTokens.tokens;
                setAppName(tokens.legal.appName);
                setLogoUrl(tokens.assets.logoUrl ?? '');
                setFaviconUrl(tokens.assets.faviconUrl ?? tokens.assets.logoUrl ?? '');
                setPrimaryColor(settings.config.branding.primaryColor);
                setSecondaryColor(settings.config.branding.secondaryColor);
                setShowMarketingContent(Boolean(settings.config.marketingFlags?.showMarketingContent ?? true));
                setShowPricingPage(Boolean(settings.config.marketingFlags?.showPricingPage ?? false));
            } catch (error: any) {
                setErrorMessage(error.message || 'Failed to load tenant settings');
                logError('Failed to load tenant settings', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadSettings();
    }, [hasAdminAccess]);

    // Clear messages after 5 seconds
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
        if (!tenantSettings || isSaving) return;

        setIsSaving(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const updateData: UpdateTenantBrandingRequest = {
                appName,
                logoUrl,
                faviconUrl,
                primaryColor: primaryColor as any,
                secondaryColor: secondaryColor as any,
                marketingFlags: {
                    showMarketingContent: showMarketingContent as any,
                    showPricingPage: showPricingPage as any,
                },
            };

            await apiClient.updateTenantBranding(updateData);
            setSuccessMessage('Branding settings updated successfully');
        } catch (error: any) {
            if (error.code === 'NOT_IMPLEMENTED') {
                setErrorMessage('Branding update not yet implemented on the backend');
            } else {
                setErrorMessage(error.message || 'Failed to update branding settings');
            }
            logError('Failed to update branding', error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) {
        return null;
    }

    if (!hasAdminAccess) {
        return (
            <BaseLayout title='Access Denied' description='Tenant Branding Settings' headerVariant='dashboard'>
                <div className='mx-auto max-w-(--breakpoint-xl) px-4 py-10 sm:px-6 lg:px-8'>
                    <Alert type='error' message='You do not have permission to access tenant branding settings. This page requires tenant-admin or system-admin role.' />
                </div>
            </BaseLayout>
        );
    }

    if (isLoading) {
        return (
            <BaseLayout title='Tenant Branding' description='Configure your tenant branding' headerVariant='dashboard'>
                <div className='mx-auto max-w-(--breakpoint-xl) px-4 py-10 sm:px-6 lg:px-8'>
                    <Card padding='lg'>
                        <div className='flex items-center justify-center py-12'>
                            <div className='text-center'>
                                <LoadingSpinner size='lg' />
                                <p className='mt-4 help-text'>Loading tenant settings...</p>
                            </div>
                        </div>
                    </Card>
                </div>
            </BaseLayout>
        );
    }

    const hasChanges = tenantSettings && (
        appName !== tenantSettings.config.brandingTokens.tokens.legal.appName
        || logoUrl !== (tenantSettings.config.brandingTokens.tokens.assets.logoUrl ?? '')
        || faviconUrl !== (tenantSettings.config.brandingTokens.tokens.assets.faviconUrl ?? tenantSettings.config.brandingTokens.tokens.assets.logoUrl ?? '')
        || primaryColor !== tenantSettings.config.branding.primaryColor
        || secondaryColor !== tenantSettings.config.branding.secondaryColor
        || showMarketingContent !== (tenantSettings.config.marketingFlags?.showMarketingContent ?? true)
        || showPricingPage !== (tenantSettings.config.marketingFlags?.showPricingPage ?? false)
    );

    return (
        <BaseLayout title='Tenant Branding' description='Configure your tenant branding' headerVariant='dashboard'>
            <div className='mx-auto max-w-(--breakpoint-xl) px-4 py-10 sm:px-6 lg:px-8'>
                <div className='space-y-8'>
                    {/* Header */}
                    <div className='flex flex-col gap-2'>
                        <span className='text-xs font-medium uppercase tracking-wide text-interactive-primary'>
                            Tenant Settings
                        </span>
                        <div className='flex flex-col gap-2'>
                            <h1 className='text-3xl font-semibold text-text-primary'>
                                Branding Configuration
                            </h1>
                            <p className='max-w-2xl help-text sm:text-base'>
                                Customize your tenant's appearance and marketing features
                            </p>
                        </div>
                    </div>

                    {/* Messages */}
                    {(successMessage || errorMessage) && (
                        <div className='space-y-3'>
                            {successMessage && <Alert type='success' message={successMessage} />}
                            {errorMessage && <Alert type='error' message={errorMessage} />}
                        </div>
                    )}

                    {/* Info Card */}
                    {tenantSettings && (
                        <Card padding='sm' className='bg-interactive-primary/10 border border-interactive-primary/30'>
                            <div className='flex items-start gap-3'>
                                <div className='flex h-8 w-8 items-center justify-center rounded-full bg-interactive-primary/15'>
                                    <InfoIcon size={20} className='text-interactive-primary' />
                                </div>
                                <div className='flex-1'>
                                    <p className='text-sm font-medium text-text-primary'>Tenant ID: {tenantSettings.tenantId}</p>
                                    <p className='mt-1 text-xs text-interactive-primary'>
                                        Changes will affect all users accessing this tenant's domain
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Form */}
                    <div className='grid gap-6 lg:grid-cols-2'>
                        {/* Branding Section */}
                        <Card padding='lg'>
                            <div className='space-y-6'>
                                <div className='space-y-2'>
                                    <h2 className='text-xl font-semibold text-text-primary'>Branding Assets</h2>
                                    <p className='help-text'>Configure your brand identity</p>
                                </div>

                                <Form onSubmit={handleSave} className='space-y-5'>
                                    <Input
                                        label='App Name'
                                        value={appName}
                                        onChange={setAppName}
                                        placeholder='My Expense App'
                                        disabled={isSaving}
                                        required
                                        data-testid='app-name-input'
                                    />

                                    <Input
                                        label='Logo URL'
                                        value={logoUrl}
                                        onChange={setLogoUrl}
                                        placeholder='/logo.svg'
                                        disabled={isSaving}
                                        required
                                        data-testid='logo-url-input'
                                    />

                                    <Input
                                        label='Favicon URL'
                                        value={faviconUrl}
                                        onChange={setFaviconUrl}
                                        placeholder='/favicon.ico'
                                        disabled={isSaving}
                                        required
                                        data-testid='favicon-url-input'
                                    />

                                    <div className='grid grid-cols-2 gap-4'>
                                        <ColorInput
                                            id='primary-color'
                                            label='Primary Color'
                                            value={primaryColor}
                                            onChange={setPrimaryColor}
                                            disabled={isSaving}
                                            testId='primary-color-input'
                                        />

                                        <ColorInput
                                            id='secondary-color'
                                            label='Secondary Color'
                                            value={secondaryColor}
                                            onChange={setSecondaryColor}
                                            disabled={isSaving}
                                            testId='secondary-color-input'
                                        />
                                    </div>
                                </Form>
                            </div>
                        </Card>

                        {/* Preview Section */}
                        <Card padding='lg' className='bg-surface-muted'>
                            <div className='space-y-6'>
                                <div className='space-y-2'>
                                    <h2 className='text-xl font-semibold text-text-primary'>Live Preview</h2>
                                    <p className='help-text'>See how your branding will look</p>
                                </div>

                                <div className='space-y-4 rounded-lg border border-border-default bg-interactive-primary/5 p-6'>
                                    <div className='flex items-center gap-3'>
                                        <div
                                            className='h-12 w-12 rounded-lg flex items-center justify-center text-white font-bold text-lg'
                                            style={{ backgroundColor: primaryColor }}
                                        >
                                            {appName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className='font-semibold text-text-primary'>{appName || 'App Name'}</p>
                                            <p className='help-text-xs'>Your tenant branding</p>
                                        </div>
                                    </div>

                                    <div className='space-y-2'>
                                        <button
                                            type='button'
                                            className='w-full rounded-md px-4 py-2 text-sm font-medium text-white transition-colors'
                                            style={{ backgroundColor: primaryColor }}
                                        >
                                            Primary Button
                                        </button>
                                        <button
                                            type='button'
                                            className='w-full rounded-md px-4 py-2 text-sm font-medium text-white transition-colors'
                                            style={{ backgroundColor: secondaryColor }}
                                        >
                                            Secondary Button
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Marketing Flags Section */}
                        <Card padding='lg' className='lg:col-span-2'>
                            <div className='space-y-6'>
                                <div className='space-y-2'>
                                    <h2 className='text-xl font-semibold text-text-primary'>Marketing Features</h2>
                                    <p className='help-text'>Control which marketing pages are visible</p>
                                </div>

                                <div className='grid gap-4 sm:grid-cols-2'>
                                    <label className='flex items-center gap-3 rounded-lg border border-border-default bg-surface-base px-4 py-3 cursor-pointer hover:bg-surface-muted transition-colors'>
                                        <input
                                            type='checkbox'
                                            checked={showMarketingContent}
                                            onChange={(e) => setShowMarketingContent((e.target as HTMLInputElement).checked)}
                                            disabled={isSaving}
                                            className='h-4 w-4 rounded border-border-default text-interactive-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary'
                                            data-testid='show-marketing-content-checkbox'
                                        />
                                        <div className='flex-1'>
                                            <p className='text-sm font-medium text-text-primary'>Marketing Content</p>
                                            <p className='help-text-xs'>Show features/CTA sections</p>
                                        </div>
                                    </label>

                                    <label className='flex items-center gap-3 rounded-lg border border-border-default bg-surface-base px-4 py-3 cursor-pointer hover:bg-surface-muted transition-colors'>
                                        <input
                                            type='checkbox'
                                            checked={showPricingPage}
                                            onChange={(e) => setShowPricingPage((e.target as HTMLInputElement).checked)}
                                            disabled={isSaving}
                                            className='h-4 w-4 rounded border-border-default text-interactive-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary'
                                            data-testid='show-pricing-page-checkbox'
                                        />
                                        <div className='flex-1'>
                                            <p className='text-sm font-medium text-text-primary'>Pricing Page</p>
                                            <p className='help-text-xs'>Show /pricing route</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Save Button */}
                    <div className='flex justify-end'>
                        <Button
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                            loading={isSaving}
                            data-testid='save-branding-button'
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </div>
        </BaseLayout>
    );
}
