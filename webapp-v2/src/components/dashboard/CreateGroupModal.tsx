import { ApiError } from '@/app/apiClient';
import { useAuthRequired } from '@/app/hooks/useAuthRequired';
import { useModalOpen } from '@/app/hooks/useModalOpen';
import { CurrencyService } from '@/app/services/currencyService';
import { enhancedGroupsStore } from '@/app/stores/groups-store-enhanced.ts';
import { Clickable } from '@/components/ui/Clickable';
import { CurrencyIcon, XCircleIcon, XIcon } from '@/components/ui/icons';
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal';
import { ModalFormFooter } from '@/components/ui/ModalFormFooter';
import { cx } from '@/utils/cx';
import { CreateGroupRequest, CurrencyISOCode, GroupId, toCurrencyISOCode, toDisplayName, toGroupName } from '@billsplit-wl/shared';
import { signal, useComputed } from '@preact/signals';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Form, FormFieldLabel, Input, Select, Stack, Switch, Textarea, Tooltip, Typography } from '../ui';

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (groupId: GroupId) => void;
}

const DISPLAY_NAME_PATTERN = /^[a-zA-Z0-9\s\-_.]+$/;

export function CreateGroupModal({ isOpen, onClose, onSuccess }: CreateGroupModalProps) {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const currentUser = useComputed(() => authStore.user);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [displayNameValidationError, setDisplayNameValidationError] = useState<string | null>(null);

    // Create fresh signals for each modal instance to avoid stale state
    const [groupNameSignal] = useState(() => signal(''));
    const [groupDescriptionSignal] = useState(() => signal(''));
    const [groupDisplayNameSignal] = useState(() => signal(currentUser.value?.displayName?.trim() ?? ''));

    // Currency settings state
    const currencyService = CurrencyService.getInstance();
    const [currencyRestrictionsEnabled, setCurrencyRestrictionsEnabled] = useState(false);
    const [permittedCurrencies, setPermittedCurrencies] = useState<string[]>([]);
    const [defaultCurrency, setDefaultCurrency] = useState<string>('');
    const [currencySearchTerm, setCurrencySearchTerm] = useState('');
    const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
    const currencyDropdownRef = useRef<HTMLDivElement>(null);
    const currencySearchInputRef = useRef<HTMLInputElement>(null);

    // Reset form when modal opens
    useModalOpen(isOpen, {
        onOpen: useCallback(() => {
            groupNameSignal.value = '';
            groupDescriptionSignal.value = '';
            groupDisplayNameSignal.value = currentUser.value?.displayName?.trim() ?? '';
            setValidationError(null);
            setDisplayNameValidationError(null);
            // Reset currency settings
            setCurrencyRestrictionsEnabled(false);
            setPermittedCurrencies([]);
            setDefaultCurrency('');
            setCurrencySearchTerm('');
            setIsCurrencyDropdownOpen(false);
            // Clear any validation errors from previous attempts
            enhancedGroupsStore.clearValidationError();
        }, [currentUser.value?.displayName]),
    });

    const validateForm = (): string | null => {
        const name = groupNameSignal.value.trim();

        if (!name) {
            return t('createGroupModal.validation.nameRequired');
        }

        if (name.length < 2) {
            return t('createGroupModal.validation.nameTooShort');
        }

        if (name.length > 50) {
            return t('createGroupModal.validation.nameTooLong');
        }

        return null;
    };

    const validateDisplayName = (): string | null => {
        const displayName = groupDisplayNameSignal.value.trim();

        if (!displayName) {
            return t('createGroupModal.validation.displayNameRequired');
        }

        if (displayName.length < 2) {
            return t('createGroupModal.validation.displayNameTooShort');
        }

        if (displayName.length > 50) {
            return t('createGroupModal.validation.displayNameTooLong');
        }

        if (!DISPLAY_NAME_PATTERN.test(displayName)) {
            return t('createGroupModal.validation.displayNameInvalid');
        }

        return null;
    };

    // Currency settings helpers
    const allCurrencies = currencyService.getCurrencies();

    const availableCurrencies = useMemo(() => {
        const filtered = allCurrencies.filter((c) => !permittedCurrencies.includes(c.acronym));
        if (currencySearchTerm) {
            const searchLower = currencySearchTerm.toLowerCase();
            return filtered.filter(
                (c) =>
                    c.acronym.toLowerCase().includes(searchLower)
                    || c.name.toLowerCase().includes(searchLower)
                    || c.symbol.toLowerCase().includes(searchLower),
            );
        }
        return filtered;
    }, [allCurrencies, permittedCurrencies, currencySearchTerm]);

    const defaultCurrencyOptions = useMemo(
        () =>
            permittedCurrencies.map((code) => {
                const currency = currencyService.getCurrencyByCode(code);
                return {
                    value: code,
                    label: currency ? `${currency.acronym} - ${currency.name}` : code,
                };
            }),
        [permittedCurrencies, currencyService],
    );

    const handleAddCurrency = useCallback((code: string) => {
        setPermittedCurrencies((prev) => {
            const updated = [...prev, code];
            // Auto-set default to first currency if not set
            if (!defaultCurrency) {
                setDefaultCurrency(code);
            }
            return updated;
        });
        setIsCurrencyDropdownOpen(false);
        setCurrencySearchTerm('');
    }, [defaultCurrency]);

    const handleRemoveCurrency = useCallback((code: string) => {
        setPermittedCurrencies((prev) => {
            const updated = prev.filter((c) => c !== code);
            // If removing the default currency, set to another if available
            if (defaultCurrency === code) {
                setDefaultCurrency(updated.length > 0 ? updated[0] : '');
            }
            return updated;
        });
    }, [defaultCurrency]);

    const handleOpenCurrencyDropdown = useCallback(() => {
        setIsCurrencyDropdownOpen(true);
        setTimeout(() => currencySearchInputRef.current?.focus(), 0);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target as Node)) {
                setIsCurrencyDropdownOpen(false);
                setCurrencySearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        const validationError = validateForm();
        if (validationError) {
            setValidationError(validationError);
            return;
        }

        const displayNameError = validateDisplayName();
        if (displayNameError) {
            setDisplayNameValidationError(displayNameError);
            return;
        }

        setIsSubmitting(true);
        setValidationError(null);
        setDisplayNameValidationError(null);

        try {
            const trimmedGroupName = groupNameSignal.value.trim();
            const trimmedDisplayName = groupDisplayNameSignal.value.trim();
            const groupData: CreateGroupRequest = {
                name: toGroupName(trimmedGroupName),
                groupDisplayName: toDisplayName(trimmedDisplayName),
                description: groupDescriptionSignal.value.trim() || undefined,
                currencySettings: currencyRestrictionsEnabled && permittedCurrencies.length > 0
                    ? {
                        permitted: permittedCurrencies as CurrencyISOCode[],
                        default: toCurrencyISOCode(defaultCurrency || permittedCurrencies[0]),
                    }
                    : undefined,
            };

            const newGroup = await enhancedGroupsStore.createGroup(groupData);

            // Success! Close modal and optionally callback
            if (onSuccess) {
                onSuccess(newGroup.id);
            }
            setDisplayNameValidationError(null);
            onClose();
        } catch (error) {
            if (error instanceof ApiError && error.code === 'DISPLAY_NAME_TAKEN') {
                enhancedGroupsStore.clearValidationError();
                setDisplayNameValidationError(t('createGroupModal.validation.displayNameTaken'));
                return;
            }
            // Error is already handled by the store (sets enhancedGroupsStore.errorSignal)
            // Just prevent unhandled promise rejection - don't close modal on error
        } finally {
            setIsSubmitting(false);
        }
    };

    const trimmedGroupName = groupNameSignal.value.trim();
    const trimmedDisplayName = groupDisplayNameSignal.value.trim();
    const isFormValid = trimmedGroupName.length >= 2
        && trimmedDisplayName.length >= 2
        && trimmedDisplayName.length <= 50
        && DISPLAY_NAME_PATTERN.test(trimmedDisplayName);

    return (
        <Modal
            open={isOpen}
            onClose={isSubmitting ? undefined : onClose}
            size='sm'
            labelledBy='create-group-modal-title'
        >
            <ModalHeader>
                <div className='flex items-center justify-between'>
                    <Typography variant='subheading' id='create-group-modal-title'>
                        {t('createGroupModal.title')}
                    </Typography>
                    <Tooltip content={t('createGroupModal.closeButtonAriaLabel')} showOnFocus={false}>
                        <Clickable
                            as='button'
                            type='button'
                            onClick={onClose}
                            className='text-text-muted hover:text-text-primary transition-colors rounded-full p-1 hover:bg-surface-muted'
                            disabled={isSubmitting}
                            aria-label={t('createGroupModal.closeButtonAriaLabel')}
                            eventName='modal_close'
                            eventProps={{ modalName: 'create_group', method: 'x_button' }}
                        >
                            <XIcon size={20} />
                        </Clickable>
                    </Tooltip>
                </div>
            </ModalHeader>

            <Form onSubmit={handleSubmit}>
                <ModalContent>
                    <Stack spacing='lg'>
                        {/* Group Name */}
                        <div>
                            <FormFieldLabel
                                label={t('createGroupModal.groupNameLabel')}
                                htmlFor='group-name'
                                required
                                helpText={t('createGroupModal.groupNameHelpText')}
                            />
                            <Input
                                id='group-name'
                                type='text'
                                name='name'
                                placeholder={t('createGroupModal.groupNamePlaceholder')}
                                value={groupNameSignal.value}
                                onChange={(value) => {
                                    groupNameSignal.value = value;
                                    setValidationError(null); // Clear error when user types
                                    // Also clear store validation errors when user starts fixing the issue
                                    enhancedGroupsStore.clearValidationError();
                                }}
                                required
                                disabled={isSubmitting}
                                error={validationError || undefined}
                            />
                        </div>

                        {/* Group Display Name */}
                        <div>
                            <FormFieldLabel
                                label={t('createGroupModal.groupDisplayNameLabel')}
                                htmlFor='group-display-name'
                                required
                                helpText={t('createGroupModal.groupDisplayNameHelpText')}
                            />
                            <Input
                                id='group-display-name'
                                type='text'
                                name='groupDisplayName'
                                placeholder={t('createGroupModal.groupDisplayNamePlaceholder')}
                                value={groupDisplayNameSignal.value}
                                onChange={(value) => {
                                    groupDisplayNameSignal.value = value;
                                    setDisplayNameValidationError(null);
                                    enhancedGroupsStore.clearValidationError();
                                }}
                                required
                                disabled={isSubmitting}
                                error={displayNameValidationError || undefined}
                            />
                        </div>

                        {/* Group Description (Optional) */}
                        <div>
                            <FormFieldLabel
                                label={t('createGroupModal.groupDescriptionLabel')}
                                htmlFor='group-description'
                                helpText={t('createGroupModal.groupDescriptionHelpText')}
                            />
                            <Textarea
                                id='group-description'
                                name='description'
                                rows={3}
                                placeholder={t('createGroupModal.groupDescriptionPlaceholder')}
                                value={groupDescriptionSignal.value}
                                onChange={(value) => {
                                    groupDescriptionSignal.value = value;
                                }}
                                disabled={isSubmitting}
                                maxLength={200}
                            />
                        </div>

                        {/* Currency Restrictions (Optional) */}
                        <div className='border-t border-border-default pt-4'>
                            <Switch
                                label={t('createGroupModal.restrictCurrencies')}
                                description={currencyRestrictionsEnabled ? t('createGroupModal.restrictCurrenciesHelp') : undefined}
                                checked={currencyRestrictionsEnabled}
                                onChange={setCurrencyRestrictionsEnabled}
                                disabled={isSubmitting}
                            />

                            {currencyRestrictionsEnabled && (
                                <div className='mt-4 space-y-4 pl-4 border-l-2 border-interactive-primary/30'>
                                    {/* Permitted currencies */}
                                    <div>
                                        <label className='block text-sm font-medium text-text-primary mb-2'>
                                            {t('groupSettings.currencySettings.permittedLabel')}
                                        </label>

                                        {/* Selected currencies as chips */}
                                        <div className='flex flex-wrap gap-2 mb-2'>
                                            {permittedCurrencies.map((code) => {
                                                const currency = currencyService.getCurrencyByCode(code);
                                                return (
                                                    <span
                                                        key={code}
                                                        className={cx(
                                                            'inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm',
                                                            'bg-surface-muted text-text-primary border border-border-default',
                                                        )}
                                                    >
                                                        {currency && <CurrencyIcon symbol={currency.symbol} size={16} className='text-text-muted' />}
                                                        <span className='font-medium'>{code}</span>
                                                        <button
                                                            type='button'
                                                            onClick={() => handleRemoveCurrency(code)}
                                                            disabled={isSubmitting || permittedCurrencies.length <= 1}
                                                            className={cx(
                                                                'ml-1 p-0.5 rounded hover:bg-surface-raised transition-colors',
                                                                permittedCurrencies.length <= 1
                                                                    ? 'opacity-30 cursor-not-allowed'
                                                                    : 'hover:text-semantic-error',
                                                            )}
                                                            aria-label={`Remove ${code}`}
                                                        >
                                                            <XIcon size={14} />
                                                        </button>
                                                    </span>
                                                );
                                            })}

                                            {/* Add currency button/dropdown */}
                                            <div className='relative' ref={currencyDropdownRef}>
                                                <button
                                                    type='button'
                                                    onClick={handleOpenCurrencyDropdown}
                                                    disabled={isSubmitting}
                                                    className={cx(
                                                        'inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm',
                                                        'border border-dashed border-border-default text-text-muted',
                                                        'hover:border-interactive-primary hover:text-interactive-primary transition-colors',
                                                        isSubmitting && 'opacity-50 cursor-not-allowed',
                                                    )}
                                                >
                                                    + {t('groupSettings.currencySettings.addCurrency')}
                                                </button>

                                                {isCurrencyDropdownOpen && (
                                                    <div
                                                        className={cx(
                                                            'absolute z-50 top-full start-0 mt-1 w-64',
                                                            'bg-surface-raised border border-border-default rounded-md shadow-lg',
                                                            'max-h-60 overflow-hidden',
                                                        )}
                                                    >
                                                        <div className='p-2 border-b border-border-default'>
                                                            <input
                                                                ref={currencySearchInputRef}
                                                                type='text'
                                                                value={currencySearchTerm}
                                                                onInput={(e) => setCurrencySearchTerm((e.target as HTMLInputElement).value)}
                                                                placeholder={t('groupSettings.currencySettings.searchPlaceholder')}
                                                                className={cx(
                                                                    'w-full px-2 py-1 text-sm rounded border border-border-default',
                                                                    'bg-surface-base text-text-primary placeholder:text-text-muted',
                                                                    'focus:outline-hidden focus:ring-1 focus:ring-interactive-primary',
                                                                )}
                                                            />
                                                        </div>
                                                        <div className='max-h-48 overflow-y-auto'>
                                                            {availableCurrencies.length === 0
                                                                ? (
                                                                    <div className='p-2 help-text text-center'>
                                                                        {currencySearchTerm
                                                                            ? t('currencySelector.noResults')
                                                                            : t('groupSettings.currencySettings.allCurrenciesSelected')}
                                                                    </div>
                                                                )
                                                                : (
                                                                    availableCurrencies.slice(0, 50).map((currency) => (
                                                                        <button
                                                                            key={currency.acronym}
                                                                            type='button'
                                                                            onClick={() => handleAddCurrency(currency.acronym)}
                                                                            className={cx(
                                                                                'w-full px-3 py-2 text-start text-sm',
                                                                                'hover:bg-surface-muted transition-colors',
                                                                                'flex items-center gap-2',
                                                                            )}
                                                                        >
                                                                            <CurrencyIcon symbol={currency.symbol} size={20} className='text-text-muted shrink-0' />
                                                                            <span className='font-medium'>{currency.acronym}</span>
                                                                            <span className='text-text-muted truncate'>{currency.name}</span>
                                                                        </button>
                                                                    ))
                                                                )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Default currency dropdown */}
                                    {permittedCurrencies.length > 0 && (
                                        <Select
                                            label={t('groupSettings.currencySettings.defaultLabel')}
                                            value={defaultCurrency}
                                            onChange={setDefaultCurrency}
                                            options={defaultCurrencyOptions}
                                            disabled={isSubmitting || permittedCurrencies.length === 0}
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Error Display */}
                        {enhancedGroupsStore.errorSignal.value && (
                            <div className='bg-surface-warning border border-border-warning rounded-md p-3'>
                                <div className='flex'>
                                    <div className='shrink-0'>
                                        <XCircleIcon size={20} className='text-semantic-error' />
                                    </div>
                                    <div className='ml-3'>
                                        <p className='text-sm text-semantic-error' role='alert'>
                                            {enhancedGroupsStore.errorSignal.value}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Stack>
                </ModalContent>

                <ModalFormFooter
                    onCancel={onClose}
                    cancelText={t('createGroupModal.cancelButton')}
                    submitText={t('createGroupModal.submitButton')}
                    isSubmitting={isSubmitting}
                    isSubmitDisabled={!isFormValid}
                />
            </Form>
        </Modal>
    );
}
