import { apiClient } from '@/app/apiClient';
import { useAsyncAction } from '@/app/hooks';
import { useModalOpenOrChange } from '@/app/hooks/useModalOpen';
import { AdminFormSection, AdminFormToggle, ModeToggle } from '@/components/admin/forms';
import { ImagePicker } from '@/components/admin/ImagePicker';
import {
    AutoSection,
    buildBrandingTokensFromForm,
    CreationMode,
    EMPTY_TENANT_DATA,
    extractFormDataFromTokens,
    FullTenant,
    TenantData,
    TenantEditorModalProps,
    validateTenantData,
} from '@/components/admin/tenant-editor';
import { PaletteColorsSection } from '@/components/admin/tenant-editor/sections';
import { Alert, Button, ImageUploadField, Input, Modal } from '@/components/ui';
import { XIcon } from '@/components/ui/icons';
import { logError } from '@/utils/browser-logger';
import type { AdminUpsertTenantRequest } from '@billsplit-wl/shared';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

const Section = AdminFormSection;
const Toggle = AdminFormToggle;

type EditorMode = 'basic' | 'advanced';

export function TenantEditorModal({ open, onClose, onSave, tenant, mode }: TenantEditorModalProps) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<TenantData>(EMPTY_TENANT_DATA);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
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
    useModalOpenOrChange(
        open,
        tenant?.tenant.tenantId,
        useCallback(() => {
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
        }, [mode, tenant]),
    );

    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage('');
                setErrorMessage('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    // Helper to get error message from API error
    const getErrorMessage = (error: any, defaultKey: string): string => {
        if (error.code === 'INVALID_TENANT_PAYLOAD') return t('admin.tenantEditor.errors.invalidPayload');
        if (error.code === 'PERMISSION_DENIED') return t('admin.tenantEditor.errors.permissionDenied');
        if (error.code === 'DUPLICATE_DOMAIN') return error.message || t('admin.tenantEditor.errors.duplicateDomain');
        if (error.code === 'TENANT_NOT_FOUND') return t('admin.tenantEditor.errors.tenantNotFound');
        if (error.code === 'TENANT_TOKENS_MISSING') return t('admin.tenantEditor.errors.tokensMissing');
        return error.message || t(defaultKey);
    };

    // Async action for saving tenant (includes auto-publish attempt)
    const saveAction = useAsyncAction(
        async (requestData: AdminUpsertTenantRequest) => {
            const result = await apiClient.adminUpsertTenant(requestData);
            const isCreated = result.created;

            let publishSuccess = true;
            try {
                await apiClient.publishTenantTheme({ tenantId: requestData.tenantId });
            } catch (publishError) {
                logError('Auto-publish after save failed', publishError);
                publishSuccess = false;
            }

            return { isCreated, publishSuccess };
        },
        {
            onSuccess: ({ isCreated, publishSuccess }) => {
                if (publishSuccess) {
                    setSuccessMessage(isCreated ? t('admin.tenantEditor.success.createdAndPublished') : t('admin.tenantEditor.success.updatedAndPublished'));
                } else {
                    setSuccessMessage(isCreated ? t('admin.tenantEditor.success.createdPublishFailed') : t('admin.tenantEditor.success.updatedPublishFailed'));
                }
                onSave();
                setTimeout(() => {
                    onClose();
                    setFormData({ ...EMPTY_TENANT_DATA });
                }, 1500);
            },
            onError: (error) => {
                logError('Failed to save tenant', error);
                return getErrorMessage(error, 'admin.tenantEditor.errors.saveFailed');
            },
        },
    );

    // Async action for publishing theme
    const publishAction = useAsyncAction(
        async (tenantId: string) => {
            await apiClient.publishTenantTheme({ tenantId });
        },
        {
            onSuccess: () => {
                setSuccessMessage(t('admin.tenantEditor.success.themePublished'));
            },
            onError: (error) => {
                logError('Failed to publish tenant theme', error);
                return getErrorMessage(error, 'admin.tenantEditor.errors.publishFailed');
            },
        },
    );

    // Async action for uploading logo
    const uploadLogoAction = useAsyncAction(
        async (file: File) => {
            const result = await apiClient.uploadTenantImage(formData.tenantId, 'logo', file);
            return result.url;
        },
        {
            onSuccess: (url) => {
                setFormData((prev) => ({ ...prev, logoUrl: url }));
                setSuccessMessage(t('admin.tenantEditor.success.logoUploaded'));
            },
            onError: (error) => {
                logError('Failed to upload logo', error);
                return (error as any).message || t('admin.tenantEditor.errors.uploadFailed', { type: 'logo' });
            },
        },
    );

    // Async action for uploading favicon
    const uploadFaviconAction = useAsyncAction(
        async (file: File) => {
            const result = await apiClient.uploadTenantImage(formData.tenantId, 'favicon', file);
            return result.url;
        },
        {
            onSuccess: (url) => {
                setFormData((prev) => ({ ...prev, faviconUrl: url }));
                setSuccessMessage(t('admin.tenantEditor.success.faviconUploaded'));
            },
            onError: (error) => {
                logError('Failed to upload favicon', error);
                return (error as any).message || t('admin.tenantEditor.errors.uploadFailed', { type: 'favicon' });
            },
        },
    );

    // Derived loading states
    const isSaving = saveAction.isLoading;
    const isPublishing = publishAction.isLoading;

    // Combined error from actions
    const displayError = errorMessage || saveAction.error || publishAction.error || uploadLogoAction.error || uploadFaviconAction.error;

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

        setErrorMessage('');
        setSuccessMessage('');

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

        await saveAction.execute(requestData);
    };

    const handlePublish = async () => {
        if (!formData.tenantId) {
            setErrorMessage(t('admin.tenantEditor.validation.tenantIdRequiredForPublish'));
            return;
        }
        setErrorMessage('');
        setSuccessMessage('');
        await publishAction.execute(formData.tenantId);
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
        await uploadLogoAction.execute(file);
    };

    const handleFaviconUpload = async (file: File) => {
        if (!formData.tenantId) {
            setErrorMessage(t('admin.tenantEditor.validation.saveTenantFirst'));
            return;
        }
        await uploadFaviconAction.execute(file);
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
            <Modal open={open} onClose={handleCancel} size='lg' className='max-h-[90vh] flex flex-col' labelledBy='tenant-editor-modal-title'>
                <div className='flex flex-col min-h-0 h-full'>
                    {/* Header */}
                    <div className='shrink-0 flex items-center justify-between border-b border-border-default px-6 py-4'>
                        <div>
                            <h2 id='tenant-editor-modal-title' className='text-xl font-semibold text-text-primary'>
                                {mode === 'create' ? t('admin.tenantEditor.titleCreate') : t('admin.tenantEditor.titleEdit')}
                            </h2>
                            <p className='mt-1 help-text'>
                                {mode === 'create' ? t('admin.tenantEditor.descriptionCreate') : t('admin.tenantEditor.descriptionEdit')}
                            </p>
                        </div>
                        <button onClick={handleCancel} className='text-text-muted hover:text-text-primary' aria-label='Close'>
                            <XIcon size={24} />
                        </button>
                    </div>

                    {/* Mode Toggle Bar */}
                    <div className='shrink-0 flex items-center justify-between border-b border-border-subtle px-6 py-3 bg-surface-raised'>
                        <ModeToggle
                            mode={editorMode}
                            onChange={setEditorMode}
                            disabled={isSaving}
                        />
                        <span className='help-text-xs'>
                            {editorMode === 'basic'
                                ? t('admin.tenantEditor.modeHint.basic')
                                : t('admin.tenantEditor.modeHint.advanced')}
                        </span>
                    </div>

                    {/* Content */}
                    <div className='flex-1 min-h-0 overflow-y-auto px-6 py-4'>
                        <div className='space-y-4'>
                            {successMessage && <Alert type='success' message={successMessage} />}
                            {displayError && <Alert type='error' message={displayError} />}

                            {/* Creation Mode Selection - Create Mode Only */}
                            {mode === 'create' && (
                                <Section
                                    title={t('admin.tenantEditor.sections.gettingStarted.title')}
                                    description={t('admin.tenantEditor.sections.gettingStarted.description')}
                                    defaultOpen={true}
                                    testId='section-creation-mode'
                                >
                                    <div className='space-y-4'>
                                        <div className='flex gap-4'>
                                            <label className='flex items-center gap-2 cursor-pointer'>
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
                                                    className='h-4 w-4'
                                                />
                                                <span className='text-sm font-medium text-text-primary'>{t('admin.tenantEditor.creationMode.empty')}</span>
                                            </label>
                                            <label className='flex items-center gap-2 cursor-pointer'>
                                                <input
                                                    type='radio'
                                                    name='creationMode'
                                                    value='copy'
                                                    checked={creationMode === 'copy'}
                                                    onChange={() => setCreationMode('copy')}
                                                    disabled={existingTenants.length === 0}
                                                    className='h-4 w-4'
                                                />
                                                <span className='text-sm font-medium text-text-primary'>{t('admin.tenantEditor.creationMode.copy')}</span>
                                            </label>
                                        </div>

                                        {creationMode === 'empty' && (
                                            <div className='bg-surface-raised border border-border-subtle rounded-lg p-4'>
                                                <p className='text-sm text-text-secondary'>
                                                    {t('admin.tenantEditor.creationMode.emptyDescription')}
                                                </p>
                                            </div>
                                        )}

                                        {creationMode === 'copy' && (
                                            <div className='space-y-3'>
                                                {isLoadingTenants
                                                    ? <p className='help-text'>{t('admin.tenantEditor.loading.tenants')}</p>
                                                    : existingTenants.length === 0
                                                    ? <p className='help-text'>{t('admin.tenantEditor.empty.noTenants')}</p>
                                                    : (
                                                        <select
                                                            value={selectedSourceTenantId}
                                                            onChange={(e) => setSelectedSourceTenantId((e.target as HTMLSelectElement).value)}
                                                            className='w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm'
                                                            aria-label={t('admin.tenantEditor.placeholders.selectTenant')}
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
                                                    <div className='bg-surface-raised border border-border-subtle rounded-lg p-4'>
                                                        <p className='text-sm text-text-secondary'>
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
                                />
                                {mode === 'edit' && <p className='help-text-xs -mt-2'>{t('admin.tenantEditor.hints.tenantIdReadonly')}</p>}

                                <Input
                                    label={t('admin.tenantEditor.fields.appName')}
                                    value={formData.appName}
                                    onChange={(value) => update({ appName: value })}
                                    placeholder='My Expense App'
                                    disabled={isSaving}
                                    required
                                />

                                {/* Domains */}
                                <div className='space-y-2'>
                                    <label className='block text-sm font-medium text-text-primary'>Domains</label>
                                    {formData.domains.length > 0 && (
                                        <div className='flex flex-wrap gap-2'>
                                            {formData.domains.map((domain, index) => (
                                                <span key={index} className='inline-flex items-center gap-1 px-2 py-1 bg-surface-raised border border-border-default rounded text-sm font-mono'>
                                                    {domain}
                                                    <button
                                                        onClick={() =>
                                                            handleRemoveDomain(index)}
                                                        className='text-text-muted hover:text-status-danger'
                                                        aria-label={`Remove ${domain}`}
                                                    >
                                                        <XIcon size={16} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className='flex gap-2'>
                                        <input
                                            type='text'
                                            value={newDomain}
                                            onInput={(e) => setNewDomain((e.target as HTMLInputElement).value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddDomain()}
                                            placeholder='app.example.com'
                                            disabled={isSaving}
                                            className='flex-1 min-w-0 rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm'
                                        />
                                        <Button onClick={handleAddDomain} disabled={!newDomain.trim() || isSaving} variant='secondary'>Add</Button>
                                    </div>
                                </div>
                            </Section>

                            {/* Required Fields Notice for Empty Slate */}
                            {mode === 'create' && creationMode === 'empty' && (
                                <div className='bg-semantic-warning-subtle border border-semantic-warning rounded-lg p-4'>
                                    <p className='text-sm text-semantic-warning-emphasis'>
                                        <strong>Required:</strong> You must fill in ALL fields below before saving. There are no defaults.
                                    </p>
                                </div>
                            )}

                            {/* Logo & Branding */}
                            <Section title='Logo & Assets' description='Logo and favicon images' testId='section-logo-assets'>
                                <div className='grid grid-cols-2 gap-4'>
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
                                        dataTestId='logo-upload-field'
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
                                        dataTestId='favicon-upload-field'
                                    />
                                </div>
                            </Section>

                            {/* Header Display */}
                            <Section title='Header Display' description='Logo and app name visibility' testId='section-header-display'>
                                <div className='space-y-3'>
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
                                    <AutoSection sectionId='surfaces' formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />
                                    <AutoSection sectionId='text' formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />
                                    <AutoSection sectionId='interactive' formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />
                                    <AutoSection sectionId='border' formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />
                                    <AutoSection sectionId='status' formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />
                                    <AutoSection sectionId='motion' formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />
                                    <AutoSection sectionId='aurora' formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />
                                    <AutoSection sectionId='glassmorphism' formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />
                                    <AutoSection sectionId='typography' formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />
                                    <AutoSection sectionId='spacing' formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />
                                    <AutoSection sectionId='radii' formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />
                                    <AutoSection sectionId='shadows' formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />
                                </>
                            )}

                            {/* Legal and Marketing - always visible */}
                            <AutoSection sectionId='legal' formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />
                            <AutoSection sectionId='marketing' formData={formData} update={update} isSaving={isSaving} mode={mode} creationMode={creationMode} />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className='shrink-0 flex items-center justify-end gap-3 border-t border-border-default px-6 py-4'>
                        <Button onClick={handleCancel} variant='secondary' disabled={isSaving || isPublishing}>Cancel</Button>
                        {mode === 'edit' && (
                            <Button onClick={handlePublish} variant='primary' disabled={isSaving || isPublishing} loading={isPublishing}>
                                {isPublishing ? 'Publishing...' : 'Publish Theme'}
                            </Button>
                        )}
                        <Button onClick={handleSave} variant='primary' loading={isSaving} disabled={isSaving}>
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
