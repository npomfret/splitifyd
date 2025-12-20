import { useExpenseForm } from '@/app/hooks/useExpenseForm';
import { Clickable } from '@/components/ui/Clickable';
import { XIcon } from '@/components/ui/icons';
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal';
import { ExpenseId, GroupId } from '@billsplit-wl/shared';
import { useTranslation } from 'react-i18next';
import { Button, Card, ErrorState, LoadingState, Stack, Tooltip, Typography } from '../ui';
import { ExpenseBasicFields } from './ExpenseBasicFields';
import { ParticipantSelector } from './ParticipantSelector';
import { PayerSelector } from './PayerSelector';
import { ReceiptUploader } from './ReceiptUploader';
import { SplitAmountInputs } from './SplitAmountInputs';
import { SplitTypeSelector } from './SplitTypeSelector';

type ExpenseFormMode = 'add' | 'edit' | 'copy';

interface ExpenseFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: GroupId;
    mode: ExpenseFormMode;
    expenseId?: ExpenseId | null;
    onSuccess?: () => void;
}

export function ExpenseFormModal({ isOpen, onClose, groupId, mode, expenseId, onSuccess }: ExpenseFormModalProps) {
    const { t } = useTranslation();

    const isEditMode = mode === 'edit';
    const isCopyMode = mode === 'copy';

    const handleSuccess = () => {
        // Activity feed handles refresh automatically via SSE
        onSuccess?.();
        onClose();
    };

    const formState = useExpenseForm({
        isOpen,
        groupId,
        expenseId: isEditMode || isCopyMode ? expenseId : null,
        isEditMode,
        isCopyMode,
        sourceExpenseId: isCopyMode ? expenseId : null,
        onSuccess: handleSuccess,
        onCancel: onClose,
    });

    const getModalTitle = () => {
        switch (mode) {
            case 'edit':
                return t('expenseComponents.expenseFormModal.editExpense');
            case 'copy':
                return t('expenseComponents.expenseFormModal.copyExpense');
            default:
                return t('expenseComponents.expenseFormModal.addExpense');
        }
    };

    const getSubmitButtonText = () => {
        if (formState.saving) {
            return mode === 'edit' ? t('expenseComponents.expenseFormModal.updating') : t('expenseComponents.expenseFormModal.saving');
        }
        switch (mode) {
            case 'edit':
                return t('expenseComponents.expenseFormModal.updateExpense');
            case 'copy':
                return t('expenseComponents.expenseFormModal.createCopy');
            default:
                return t('expenseComponents.expenseFormModal.saveExpense');
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={formState.saving ? undefined : onClose}
            size='lg'
            labelledBy='expense-form-modal-title'
        >
            <ModalHeader>
                <div className='flex justify-between items-center'>
                    <Typography variant='heading' id='expense-form-modal-title'>
                        {getModalTitle()}
                    </Typography>
                    <Tooltip content={t('expenseComponents.expenseFormModal.closeModal')} showOnFocus={false}>
                        <Clickable
                            as='button'
                            type='button'
                            onClick={onClose}
                            disabled={formState.saving}
                            className='text-text-muted hover:text-text-primary disabled:opacity-50'
                            aria-label={t('expenseComponents.expenseFormModal.closeModal')}
                            eventName='modal_close'
                            eventProps={{ modalName: 'expense_form', method: 'x_button' }}
                        >
                            <XIcon size={24} />
                        </Clickable>
                    </Tooltip>
                </div>
            </ModalHeader>

            <ModalContent>
                {/* Loading state */}
                {!formState.isDataReady && !formState.initError && <LoadingState message={t('app.loadingExpenseForm')} />}

                {/* Error state */}
                {formState.initError && (
                    <Stack spacing='md'>
                        <ErrorState error={formState.initError} />
                        <Button variant='secondary' onClick={onClose}>
                            {t('expenseComponents.expenseFormModal.close')}
                        </Button>
                    </Stack>
                )}

                {/* Form content */}
                {formState.isDataReady && formState.group && (
                    <form role='form' onSubmit={formState.handleSubmit} autoComplete='off'>
                        {/* Hidden fields to prevent browser autofill */}
                        <div
                            aria-hidden='true'
                            style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
                        >
                            <input type='text' name='expense-form-username' autoComplete='off' tabIndex={-1} />
                            <input type='password' name='expense-form-password' autoComplete='off' tabIndex={-1} />
                        </div>

                        <Stack spacing='md'>
                            {/* Error message */}
                            {formState.formError && <ErrorState error={formState.formError} className='mb-4' />}

                            {/* Basic expense details */}
                            <ExpenseBasicFields
                                description={formState.description}
                                amount={formState.amount}
                                currency={formState.currency}
                                date={formState.date}
                                time={formState.time}
                                labels={formState.labels}
                                location={formState.location}
                                validationErrors={formState.validationErrors}
                                updateField={formState.updateField}
                                validateOnBlur={formState.validateOnBlur}
                                recentAmounts={formState.recentAmounts}
                                recentlyUsedLabels={formState.recentlyUsedLabels}
                                permittedCurrencies={formState.group.currencySettings?.permitted}
                                recentLocations={formState.recentLocations}
                            />

                            {/* Receipt upload */}
                            <ReceiptUploader
                                receiptUrl={formState.receiptUrl}
                                receiptFile={formState.receiptFile}
                                uploading={formState.receiptUploading}
                                error={formState.receiptError}
                                onFileSelect={formState.setReceiptFile}
                                onClearError={formState.clearReceiptError}
                                disabled={formState.saving}
                            />

                            {/* Payer selection */}
                            <PayerSelector
                                members={formState.members}
                                paidBy={formState.paidBy}
                                validationErrors={formState.validationErrors}
                                updateField={formState.updateField}
                            />

                            {/* Participant selection */}
                            <ParticipantSelector
                                members={formState.members}
                                participants={formState.participants}
                                paidBy={formState.paidBy}
                                validationErrors={formState.validationErrors}
                                handleParticipantToggle={formState.handleParticipantToggle}
                                handleSelectAll={formState.handleSelectAll}
                                handleSelectNone={formState.handleSelectNone}
                            />

                            {/* Split type and amounts */}
                            {formState.participants.length > 0 && (
                                <>
                                    <SplitTypeSelector splitType={formState.splitType} updateField={formState.updateField} />

                                    <Card variant='glass' className='border-border-default'>
                                        <SplitAmountInputs
                                            splitType={formState.splitType}
                                            amount={formState.amount}
                                            currency={formState.currency}
                                            participants={formState.participants}
                                            splits={formState.splits}
                                            members={formState.members}
                                            updateSplitAmount={formState.updateSplitAmount}
                                            updateSplitPercentage={formState.updateSplitPercentage}
                                        />

                                        {formState.validationErrors.splits && (
                                            <p className='text-sm text-semantic-error mt-2' role='alert'>
                                                {formState.validationErrors.splits}
                                            </p>
                                        )}
                                    </Card>
                                </>
                            )}

                            {/* Form actions */}
                            <div className='flex gap-3 pt-2'>
                                <Button
                                    type='button'
                                    variant='secondary'
                                    onClick={onClose}
                                    disabled={formState.saving}
                                    className='flex-1'
                                >
                                    {t('expenseComponents.expenseFormModal.cancel')}
                                </Button>
                                <Button
                                    type='submit'
                                    variant='primary'
                                    disabled={formState.participants.length === 0 || !formState.hasRequiredFields || formState.saving}
                                    loading={formState.saving}
                                    className='flex-1'
                                >
                                    {getSubmitButtonText()}
                                </Button>
                            </div>
                        </Stack>
                    </form>
                )}
            </ModalContent>
        </Modal>
    );
}
