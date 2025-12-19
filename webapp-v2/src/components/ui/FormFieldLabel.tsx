import type { VNode } from 'preact';
import { useTranslation } from 'react-i18next';
import { Clickable } from './Clickable';
import { InfoCircleIcon } from './icons';
import { Tooltip } from './Tooltip';

interface FormFieldLabelProps {
    /** The text content of the label */
    label: string;
    /** The htmlFor attribute to connect to an input */
    htmlFor: string;
    /** Whether the field is required - shows a red asterisk */
    required?: boolean;
    /** Optional tooltip help text */
    helpText?: string;
    /** Optional custom className */
    className?: string;
}

/**
 * Standardized form field label with optional required indicator and help tooltip.
 *
 * Consistent styling:
 * - Label text: text-sm font-medium text-text-primary
 * - Required indicator: red asterisk from common.required
 * - Help tooltip: InfoCircleIcon with interactive styling
 *
 * @example
 * // Required field with help text
 * <FormFieldLabel
 *     label="Email"
 *     htmlFor='email-input'
 *     required
 *     helpText="Enter your email address"
 * />
 * <Input id='email-input' ... />
 *
 * @example
 * // Optional field with no help text
 * <FormFieldLabel
 *     label="Notes"
 *     htmlFor='notes-input'
 * />
 */
export function FormFieldLabel({
    label,
    htmlFor,
    required = false,
    helpText,
    className = '',
}: FormFieldLabelProps): VNode {
    const { t } = useTranslation();

    return (
        <label
            htmlFor={htmlFor}
            className={`flex items-center gap-1.5 text-sm font-medium text-text-primary mb-2 ${className}`}
        >
            {label}
            {required && (
                <span className='text-semantic-error'>{t('common.required')}</span>
            )}
            {helpText && (
                <Tooltip content={helpText} placement='top'>
                    <Clickable
                        as='button'
                        type='button'
                        className='text-text-muted hover:text-text-primary transition-colors p-0.5 rounded focus:outline-hidden focus:ring-2 focus:ring-interactive-primary'
                        aria-label={t('common.moreInfo')}
                    >
                        <InfoCircleIcon size={16} />
                    </Clickable>
                </Tooltip>
            )}
        </label>
    );
}
