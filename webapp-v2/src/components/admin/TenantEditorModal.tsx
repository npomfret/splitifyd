import { apiClient } from '@/app/apiClient';
import { AdminFormSection, AdminFormToggle, ModeToggle } from '@/components/admin/forms';
import { ImagePicker } from '@/components/admin/ImagePicker';
import {
    buildBrandingTokensFromForm,
    CreationMode,
    EMPTY_TENANT_DATA,
    extractFormDataFromTokens,
    FullTenant,
    TenantData,
    TenantEditorModalProps,
    validateTenantData,
} from '@/components/admin/tenant-editor';
import {
    AuroraGradientSection,
    BorderColorsSection,
    GlassmorphismSection,
    InteractiveColorsSection,
    LegalSection,
    MarketingSection,
    MotionEffectsSection,
    PaletteColorsSection,
    RadiiSection,
    ShadowsSection,
    SpacingSection,
    StatusColorsSection,
    SurfaceColorsSection,
    TextColorsSection,
    TypographySection,
} from '@/components/admin/tenant-editor/sections';
import { Alert, Button, ImageUploadField, Input, Modal } from '@/components/ui';
import { XIcon } from '@/components/ui/icons';
import { logError } from '@/utils/browser-logger';
import type { AdminUpsertTenantRequest } from '@billsplit-wl/shared';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

const Section = AdminFormSection;
const Toggle = AdminFormToggle;

type EditorMode = 'basic' | 'advanced';

export type { CreationMode, FullTenant, TenantData, TenantEditorModalProps };

export function TenantEditorModal({ open, onClose, onSave, tenant, mode }: TenantEditorModalProps) {
    const { t } = useTranslation();
    const previousOpenRef = useRef(open);
    const previousTenantIdRef = useRef(tenant?.tenant.tenantId);
    const [formData, setFormData] = useState<TenantData>(EMPTY_TENANT_DATA);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);
    const [newDomain, setNewDomain] = useState('');
    const [imagePickerOpen, setImagePickerOpen] = useState<'logo' | 'favicon' | null>(null);
    const [creationMode, setCreationMode] = useState<CreationMode>('empty');
    const [existingTenants, setExistingTenants] = useState<FullTenant[]>([]);
    const [selectedSourceTenantId, setSelectedSourceTenantId] = useState<string>('');
    const [isLoadingTenants, setIsLoadingTenants] = useState(false);
    const [editorMode, setEditorMode] = useState<EditorMode>('basic');

    // Reset editor mode when modal closes
    useEffect(() => {
        if (!open) {
            setEditorMode('basic');
        }
    }, [open]);

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

    useEffect(() => {
        if (creationMode === 'copy' && selectedSourceTenantId) {
            const sourceTenant = existingTenants.find(t => t.tenant.tenantId === selectedSourceTenantId);
            if (sourceTenant?.tenant.brandingTokens?.tokens) {
                const tokenData = extractFormDataFromTokens(sourceTenant.tenant.brandingTokens.tokens);
                setFormData({
                    ...EMPTY_TENANT_DATA,
                    ...tokenData,
                    tenantId: '',
                    appName: '',
                    domains: [],
                    showMarketingContent: sourceTenant.tenant.marketingFlags?.showMarketingContent ?? true,
                    showPricingPage: sourceTenant.tenant.marketingFlags?.showPricingPage ?? false,
                });
            }
        }
    }, [creationMode, selectedSourceTenantId, existingTenants]);

    // Reset form when modal opens or tenant changes
    useEffect(() => {
        const wasOpen = previousOpenRef.current;
        const isNowOpen = open;
        const prevTenantId = previousTenantIdRef.current;
        const currentTenantId = tenant?.tenant.tenantId;
        previousOpenRef.current = open;
        previousTenantIdRef.current = currentTenantId;

        // Reset form on:
        // 1. Open transition (closed → open)
        // 2. Tenant change while modal is open
        // 3. Mode change
        const isOpenTransition = !wasOpen && isNowOpen;
        const isTenantChange = prevTenantId !== currentTenantId;

        if (!isOpenTransition && !isTenantChange) {
            return;
        }

        if (mode === 'edit' && tenant) {
            const tokens = tenant.tenant.brandingTokens?.tokens;
            const branding = tenant.tenant.branding;
            if (tokens) {
                const tokenData = extractFormDataFromTokens(tokens);
                setFormData({
                    ...EMPTY_TENANT_DATA,
                    ...tokenData,
                    tenantId: tenant.tenant.tenantId,
                    showMarketingContent: tenant.tenant.marketingFlags?.showMarketingContent ?? false,
                    showPricingPage: tenant.tenant.marketingFlags?.showPricingPage ?? false,
                    showAppNameInHeader: branding?.showAppNameInHeader ?? true,
                    domains: tenant.domains ?? [],
                });
            } else {
                setFormData({
                    ...EMPTY_TENANT_DATA,
                    tenantId: tenant.tenant.tenantId,
                    showMarketingContent: tenant.tenant.marketingFlags?.showMarketingContent ?? false,
                    showPricingPage: tenant.tenant.marketingFlags?.showPricingPage ?? false,
                    showAppNameInHeader: branding?.showAppNameInHeader ?? true,
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
    }, [open, tenant, mode]);

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
        const validationError = validateTenantData(formData, t);
        if (validationError) {
            setErrorMessage(validationError);
            return;
        }

        const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
        for (const domain of formData.domains) {
            if (!domainRegex.test(domain)) {
                setErrorMessage(t('admin.tenantEditor.validation.invalidDomain', { domain }));
                return;
            }
        }

        setIsSaving(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const normalizedDomains = Array.from(new Set(formData.domains.map(d => d.trim().toLowerCase().replace(/:\d+$/, ''))));

            const branding: Record<string, unknown> = {
                primaryColor: formData.primaryColor,
                secondaryColor: formData.secondaryColor,
                accentColor: formData.accentColor,
                showAppNameInHeader: formData.showAppNameInHeader,
            };

            const brandingTokens = buildBrandingTokensFromForm(formData);

            const requestData = {
                tenantId: formData.tenantId,
                branding,
                marketingFlags: {
                    showMarketingContent: formData.showMarketingContent,
                    showPricingPage: formData.showPricingPage,
                },
                brandingTokens,
                domains: normalizedDomains,
            } as AdminUpsertTenantRequest;

            const result = await apiClient.adminUpsertTenant(requestData);
            const isCreated = result.created;

            try {
                await apiClient.publishTenantTheme({ tenantId: formData.tenantId });
                setSuccessMessage(isCreated ? t('admin.tenantEditor.success.createdAndPublished') : t('admin.tenantEditor.success.updatedAndPublished'));
            } catch (publishError: any) {
                setSuccessMessage(isCreated ? t('admin.tenantEditor.success.createdPublishFailed') : t('admin.tenantEditor.success.updatedPublishFailed'));
                logError('Auto-publish after save failed', publishError);
            }

            onSave();
            setTimeout(() => {
                onClose();
                setFormData({ ...EMPTY_TENANT_DATA });
            }, 1500);
        } catch (error: any) {
            const userFriendlyMessage = error.code === 'INVALID_TENANT_PAYLOAD'
                ? t('admin.tenantEditor.errors.invalidPayload')
                : error.code === 'PERMISSION_DENIED'
                ? t('admin.tenantEditor.errors.permissionDenied')
                : error.code === 'DUPLICATE_DOMAIN'
                ? error.message || t('admin.tenantEditor.errors.duplicateDomain')
                : error.message || t('admin.tenantEditor.errors.saveFailed');
            setErrorMessage(userFriendlyMessage);
            logError('Failed to save tenant', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!formData.tenantId) {
            setErrorMessage(t('admin.tenantEditor.validation.tenantIdRequiredForPublish'));
            return;
        }
        setIsPublishing(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await apiClient.publishTenantTheme({ tenantId: formData.tenantId });
            setSuccessMessage(t('admin.tenantEditor.success.themePublished'));
        } catch (error: any) {
            const userFriendlyMessage = error.code === 'TENANT_NOT_FOUND'
                ? t('admin.tenantEditor.errors.tenantNotFound')
                : error.code === 'TENANT_TOKENS_MISSING'
                ? t('admin.tenantEditor.errors.tokensMissing')
                : error.message || t('admin.tenantEditor.errors.publishFailed');
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
            setErrorMessage(t('admin.tenantEditor.validation.saveTenantFirst'));
            return;
        }
        try {
            const result = await apiClient.uploadTenantImage(formData.tenantId, 'logo', file);
            setFormData({ ...formData, logoUrl: result.url });
            setSuccessMessage(t('admin.tenantEditor.success.logoUploaded'));
        } catch (error: any) {
            setErrorMessage(error.message || t('admin.tenantEditor.errors.uploadFailed', { type: 'logo' }));
            logError('Failed to upload logo', error);
        }
    };

    const handleFaviconUpload = async (file: File) => {
        if (!formData.tenantId) {
            setErrorMessage(t('admin.tenantEditor.validation.saveTenantFirst'));
            return;
        }
        try {
            const result = await apiClient.uploadTenantImage(formData.tenantId, 'favicon', file);
            setFormData({ ...formData, faviconUrl: result.url });
            setSuccessMessage(t('admin.tenantEditor.success.faviconUploaded'));
        } catch (error: any) {
            setErrorMessage(error.message || t('admin.tenantEditor.errors.uploadFailed', { type: 'favicon' }));
            logError('Failed to upload favicon', error);
        }
    };

    const update = (partial: Partial<TenantData>) => setFormData((prev) => ({ ...prev, ...partial }));

    const handleLogoFromLibrary = useCallback((url: string) => {
        setFormData((prev) => ({ ...prev, logoUrl: url }));
        setSuccessMessage(t('admin.tenantEditor.success.logoSelected'));
    }, [t]);

    const handleFaviconFromLibrary = useCallback((url: string) => {
        setFormData((prev) => ({ ...prev, faviconUrl: url }));
        setSuccessMessage(t('admin.tenantEditor.success.faviconSelected'));
    }, [t]);

    return (
        <>
            <Modal open={open} onClose={handleCancel} size='lg' className='max-h-[90vh] flex flex-col' data-testid='tenant-editor-modal'>
                <div class='flex flex-col min-h-0 h-full'>
                    {/* Header */}
                    <div class='shrink-0 flex items-center justify-between border-b border-border-default px-6 py-4'>
                        <div>
                            <h2 class='text-xl font-semibold text-text-primary'>
                                {mode === 'create' ? t('admin.tenantEditor.titleCreate') : t('admin.tenantEditor.titleEdit')}
                            </h2>
                            <p class='mt-1 text-sm text-text-muted'>
                                {mode === 'create' ? t('admin.tenantEditor.descriptionCreate') : t('admin.tenantEditor.descriptionEdit')}
                            </p>
                        </div>
                        <button onClick={handleCancel} class='text-text-muted hover:text-text-primary' aria-label='Close'>
                            <XIcon size={24} />
                        </button>
                    </div>

                    {/* Mode Toggle Bar */}
                    <div class='shrink-0 flex items-center justify-between border-b border-border-subtle px-6 py-3 bg-surface-raised'>
                        <ModeToggle
                            mode={editorMode}
                            onChange={setEditorMode}
                            disabled={isSaving}
                            testId='editor-mode-toggle'
                        />
                        <span class='text-xs text-text-muted'>
                            {editorMode === 'basic'
                                ? t('admin.tenantEditor.modeHint.basic')
                                : t('admin.tenantEditor.modeHint.advanced')}
                        </span>
                    </div>

                    {/* Content */}
                    <div class='flex-1 min-h-0 overflow-y-auto px-6 py-4'>
                        <div class='space-y-4'>
                            {successMessage && <Alert type='success' message={successMessage} data-testid='tenant-editor-success-message' />}
                            {errorMessage && <Alert type='error' message={errorMessage} />}

                            {/* Creation Mode Selection - Create Mode Only */}
                            {mode === 'create' && (
                                <Section
                                    title={t('admin.tenantEditor.sections.gettingStarted.title')}
                                    description={t('admin.tenantEditor.sections.gettingStarted.description')}
                                    defaultOpen={true}
                                    testId='section-creation-mode'
                                >
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
                                                <span class='text-sm font-medium text-text-primary'>{t('admin.tenantEditor.creationMode.empty')}</span>
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
                                                <span class='text-sm font-medium text-text-primary'>{t('admin.tenantEditor.creationMode.copy')}</span>
                                            </label>
                                        </div>

                                        {creationMode === 'empty' && (
                                            <div class='bg-surface-raised border border-border-subtle rounded-lg p-4'>
                                                <p class='text-sm text-text-secondary'>
                                                    {t('admin.tenantEditor.creationMode.emptyDescription')}
                                                </p>
                                            </div>
                                        )}

                                        {creationMode === 'copy' && (
                                            <div class='space-y-3'>
                                                {isLoadingTenants
                                                    ? <p class='text-sm text-text-muted'>{t('admin.tenantEditor.loading.tenants')}</p>
                                                    : existingTenants.length === 0
                                                    ? <p class='text-sm text-text-muted'>{t('admin.tenantEditor.empty.noTenants')}</p>
                                                    : (
                                                        <select
                                                            value={selectedSourceTenantId}
                                                            onChange={(e) => setSelectedSourceTenantId((e.target as HTMLSelectElement).value)}
                                                            class='w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm'
                                                            data-testid='source-tenant-select'
                                                        >
                                                            <option value=''>{t('admin.tenantEditor.placeholders.selectTenant')}</option>
                                                            {existingTenants.map((tenant) => (
                                                                <option key={tenant.tenant.tenantId} value={tenant.tenant.tenantId}>
                                                                    {tenant.tenant.tenantId} - {tenant.tenant.brandingTokens?.tokens?.legal?.appName || t('common.unknown')}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                {selectedSourceTenantId && (
                                                    <div class='bg-surface-raised border border-border-subtle rounded-lg p-4'>
                                                        <p class='text-sm text-text-secondary'>
                                                            {t('admin.tenantEditor.creationMode.copyDescription', { tenant: selectedSourceTenantId })}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </Section>
                            )}

                            {/* Basic Info - Always Open */}
                            <Section
                                title={t('admin.tenantEditor.sections.basicInfo.title')}
                                description={t('admin.tenantEditor.sections.basicInfo.description')}
                                defaultOpen={true}
                                testId='section-basic-info'
                            >
                                <Input
                                    label={t('admin.tenantEditor.fields.tenantId')}
                                    value={formData.tenantId}
                                    onChange={(value) => update({ tenantId: value })}
                                    placeholder={t('admin.tenantEditor.placeholders.tenantId')}
                                    disabled={mode === 'edit' || isSaving}
                                    required
                                    data-testid='tenant-id-input'
                                />
                                {mode === 'edit' && <p class='text-xs text-text-muted -mt-2'>{t('admin.tenantEditor.hints.tenantIdReadonly')}</p>}

                                <Input
                                    label={t('admin.tenantEditor.fields.appName')}
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
                                                        <XIcon size={16} />
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
                                            class='flex-1 min-w-0 rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm'
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
                                        allowLibrary={!!formData.tenantId}
                                        onOpenLibrary={() => setImagePickerOpen('logo')}
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
                                        allowLibrary={!!formData.tenantId}
                                        onOpenLibrary={() => setImagePickerOpen('favicon')}
                                        data-testid='favicon-upload-field'
                                    />
                                </div>
                            </Section>

                            {/* Header Display */}
                            <Section title='Header Display' description='Logo and app name visibility' testId='section-header-display'>
                                <div class='space-y-3'>
                                    <Toggle
                                        label='Show App Name in Header'
                                        description='Display app name text next to logo (disable if logo contains the name)'
                                        checked={formData.showAppNameInHeader}
                                        onChange={(v) => update({ showAppNameInHeader: v })}
                                        disabled={isSaving}
                                        testId='show-app-name-in-header-checkbox'
                                    />
                                </div>
                            </Section>

                            {/* Basic Mode: Show simplified palette */}
                            <PaletteColorsSection formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} simplified={editorMode === 'basic'} />

                            {/* Advanced Mode Only Sections */}
                            {editorMode === 'advanced' && (
                                <>
                                    <SurfaceColorsSection formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />

                                    <TextColorsSection formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />

                                    <InteractiveColorsSection formData={formData} update={update} isSaving={isSaving} />

                                    <BorderColorsSection formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />

                                    <StatusColorsSection formData={formData} update={update} isSaving={isSaving} />

                                    <MotionEffectsSection formData={formData} update={update} isSaving={isSaving} />
                                    <AuroraGradientSection formData={formData} update={update} isSaving={isSaving} />
                                    <GlassmorphismSection formData={formData} update={update} isSaving={isSaving} />

                                    <TypographySection formData={formData} update={update} isSaving={isSaving} />
                                    <SpacingSection formData={formData} update={update} isSaving={isSaving} />
                                    <RadiiSection formData={formData} update={update} isSaving={isSaving} />
                                    <ShadowsSection formData={formData} update={update} isSaving={isSaving} />
                                </>
                            )}

                            {/* Basic Mode Sections: Legal and Marketing */}
                            <LegalSection formData={formData} update={update} isSaving={isSaving} />
                            <MarketingSection formData={formData} update={update} isSaving={isSaving} />
                        </div>
                    </div>

                    {/* Footer */}
                    <div class='shrink-0 flex items-center justify-end gap-3 border-t border-border-default px-6 py-4'>
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

            {/* Image Picker Modal */}
            {formData.tenantId && (
                <ImagePicker
                    isOpen={imagePickerOpen !== null}
                    onClose={() => setImagePickerOpen(null)}
                    onSelect={imagePickerOpen === 'logo' ? handleLogoFromLibrary : handleFaviconFromLibrary}
                    tenantId={formData.tenantId}
                    currentImageUrl={imagePickerOpen === 'logo' ? formData.logoUrl : formData.faviconUrl}
                    title={imagePickerOpen === 'logo' ? 'Select Logo from Library' : 'Select Favicon from Library'}
                />
            )}
        </>
    );
}
