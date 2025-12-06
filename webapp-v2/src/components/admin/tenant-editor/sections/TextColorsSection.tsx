import { AdminFormSection } from '@/components/admin/forms';
import { ColorInput } from '@/components/ui';
import type { CreationModeSectionProps } from './types';

export function TextColorsSection({ formData, update, isSaving, mode, creationMode }: CreationModeSectionProps) {
    return (
        <AdminFormSection
            title='Text Colors'
            description='Text color hierarchy (5 required)'
            defaultOpen={mode === 'create' && creationMode === 'empty'}
            testId='section-text'
        >
            <div class='grid grid-cols-2 gap-4'>
                <ColorInput
                    id='text-primary'
                    label='Primary *'
                    value={formData.textPrimaryColor}
                    onChange={(v) => update({ textPrimaryColor: v })}
                    disabled={isSaving}
                    testId='text-primary-color-input'
                />
                <ColorInput
                    id='text-secondary'
                    label='Secondary *'
                    value={formData.textSecondaryColor}
                    onChange={(v) => update({ textSecondaryColor: v })}
                    disabled={isSaving}
                    testId='text-secondary-color-input'
                />
                <ColorInput id='text-muted' label='Muted *' value={formData.textMutedColor} onChange={(v) => update({ textMutedColor: v })} disabled={isSaving} testId='text-muted-color-input' />
                <ColorInput
                    id='text-inverted'
                    label='Inverted *'
                    value={formData.textInvertedColor}
                    onChange={(v) => update({ textInvertedColor: v })}
                    disabled={isSaving}
                    testId='text-inverted-color-input'
                />
                <ColorInput id='text-accent' label='Accent *' value={formData.textAccentColor} onChange={(v) => update({ textAccentColor: v })} disabled={isSaving} testId='text-accent-color-input' />
            </div>
        </AdminFormSection>
    );
}
