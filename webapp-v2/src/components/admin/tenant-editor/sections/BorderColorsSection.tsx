import { AdminFormSection } from '@/components/admin/forms';
import { ColorInput } from '@/components/ui';
import type { CreationModeSectionProps } from './types';

export function BorderColorsSection({ formData, update, isSaving, mode, creationMode }: CreationModeSectionProps) {
    return (
        <AdminFormSection
            title='Border Colors'
            description='Border color levels (5 required)'
            defaultOpen={mode === 'create' && creationMode === 'empty'}
            testId='section-borders'
        >
            <div className='grid grid-cols-2 gap-4'>
                <ColorInput
                    id='border-subtle'
                    label='Subtle *'
                    value={formData.borderSubtleColor}
                    onChange={(v) => update({ borderSubtleColor: v })}
                    disabled={isSaving}
                    testId='border-subtle-color-input'
                />
                <ColorInput
                    id='border-default'
                    label='Default *'
                    value={formData.borderDefaultColor}
                    onChange={(v) => update({ borderDefaultColor: v })}
                    disabled={isSaving}
                    testId='border-default-color-input'
                />
                <ColorInput
                    id='border-strong'
                    label='Strong *'
                    value={formData.borderStrongColor}
                    onChange={(v) => update({ borderStrongColor: v })}
                    disabled={isSaving}
                    testId='border-strong-color-input'
                />
                <ColorInput
                    id='border-focus'
                    label='Focus *'
                    value={formData.borderFocusColor}
                    onChange={(v) => update({ borderFocusColor: v })}
                    disabled={isSaving}
                    testId='border-focus-color-input'
                />
                <ColorInput
                    id='border-warning'
                    label='Warning *'
                    value={formData.borderWarningColor}
                    onChange={(v) => update({ borderWarningColor: v })}
                    disabled={isSaving}
                    testId='border-warning-color-input'
                />
            </div>
        </AdminFormSection>
    );
}
