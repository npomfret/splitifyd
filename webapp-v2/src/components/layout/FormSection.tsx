import { Card, Stack, Tooltip, Typography } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { InfoCircleIcon } from '@/components/ui/icons';
import type { ComponentChildren } from 'preact';

interface FormSectionProps {
    /** Section title */
    title: string;
    /** Optional description shown via tooltip beside the title */
    description?: string;
    /** Accessible label for more info tooltip */
    moreInfoLabel?: string;
    /** Form content */
    children: ComponentChildren;
    /** Accessible label for the section */
    ariaLabel?: string;
}

/**
 * Standardized card wrapper for form sections.
 * Provides consistent styling for settings-style forms with optional info tooltip.
 *
 * @example
 * <FormSection
 *   title="Change Password"
 *   description="Update your account password. Must be at least 12 characters."
 * >
 *   <Input label="Current Password" type="password" />
 *   <Input label="New Password" type="password" />
 *   <Button>Save</Button>
 * </FormSection>
 */
export function FormSection({ title, description, moreInfoLabel = 'More info', children, ariaLabel }: FormSectionProps) {
    return (
        <Card padding='lg' ariaLabel={ariaLabel || title}>
            <Stack spacing='lg'>
                <div className='flex items-center gap-1.5'>
                    <Typography variant='heading'>{title}</Typography>
                    {description && (
                        <Tooltip content={description} placement='top'>
                            <Clickable
                                as='button'
                                type='button'
                                className='text-text-muted hover:text-text-primary transition-colors p-0.5 rounded focus:outline-hidden focus:ring-2 focus:ring-interactive-primary'
                                aria-label={moreInfoLabel}
                            >
                                <InfoCircleIcon size={16} />
                            </Clickable>
                        </Tooltip>
                    )}
                </div>
                {children}
            </Stack>
        </Card>
    );
}
