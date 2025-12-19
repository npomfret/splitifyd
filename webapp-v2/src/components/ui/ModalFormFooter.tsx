import type { VNode } from 'preact';
import { Button } from './Button';
import { ModalFooter } from './Modal';

interface ModalFormFooterProps {
    /** Cancel button click handler */
    onCancel: () => void;
    /** Cancel button text */
    cancelText: string;
    /** Submit button text */
    submitText: string;
    /** Whether the form is currently submitting */
    isSubmitting?: boolean;
    /** Whether the submit button should be disabled (independent of isSubmitting) */
    isSubmitDisabled?: boolean;
    /** Submit button variant - defaults to 'primary' */
    submitVariant?: 'primary' | 'danger';
    /** Button type for submit - defaults to 'submit' */
    submitType?: 'submit' | 'button';
    /** Optional submit click handler (required if submitType is 'button') */
    onSubmit?: () => void;
}

/**
 * Standardized modal footer with Cancel and Submit buttons.
 *
 * Handles common patterns:
 * - Cancel button disabled during submission
 * - Submit button shows loading spinner during submission
 * - Submit button disabled when form is invalid or submitting
 *
 * @example
 * // Basic form submit
 * <ModalFormFooter
 *     onCancel={onClose}
 *     cancelText={t('common.cancel')}
 *     submitText={t('common.save')}
 *     isSubmitting={isSubmitting}
 *     isSubmitDisabled={!isFormValid}
 * />
 *
 * @example
 * // Danger action with button handler
 * <ModalFormFooter
 *     onCancel={onClose}
 *     cancelText={t('common.cancel')}
 *     submitText={t('common.delete')}
 *     submitVariant='danger'
 *     submitType='button'
 *     onSubmit={handleDelete}
 *     isSubmitting={isDeleting}
 * />
 */
export function ModalFormFooter({
    onCancel,
    cancelText,
    submitText,
    isSubmitting = false,
    isSubmitDisabled = false,
    submitVariant = 'primary',
    submitType = 'submit',
    onSubmit,
}: ModalFormFooterProps): VNode {
    return (
        <ModalFooter>
            <Button
                type='button'
                variant='secondary'
                onClick={onCancel}
                disabled={isSubmitting}
            >
                {cancelText}
            </Button>
            <Button
                type={submitType}
                variant={submitVariant}
                onClick={submitType === 'button' ? onSubmit : undefined}
                loading={isSubmitting}
                disabled={isSubmitDisabled || isSubmitting}
            >
                {submitText}
            </Button>
        </ModalFooter>
    );
}
