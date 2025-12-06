import { AdminFormSection } from '@/components/admin/forms';
import { ColorInput, RgbaColorInput } from '@/components/ui';
import type { CreationModeSectionProps } from './types';

export function SurfaceColorsSection({ formData, update, isSaving, mode, creationMode }: CreationModeSectionProps) {
    return (
        <AdminFormSection
            title='Surface Colors'
            description='Background, card, and overlay colors (6 required)'
            defaultOpen={mode === 'create' && creationMode === 'empty'}
            testId='section-surfaces'
        >
            <div class='grid grid-cols-2 gap-4'>
                <ColorInput
                    id='surface-base'
                    label='Base *'
                    value={formData.surfaceBaseColor}
                    onChange={(v) => update({ surfaceBaseColor: v })}
                    disabled={isSaving}
                    testId='surface-base-color-input'
                />
                <ColorInput
                    id='surface-raised'
                    label='Raised *'
                    value={formData.surfaceRaisedColor}
                    onChange={(v) => update({ surfaceRaisedColor: v })}
                    disabled={isSaving}
                    testId='surface-raised-color-input'
                />
                <ColorInput
                    id='surface-sunken'
                    label='Sunken *'
                    value={formData.surfaceSunkenColor}
                    onChange={(v) => update({ surfaceSunkenColor: v })}
                    disabled={isSaving}
                    testId='surface-sunken-color-input'
                />
            </div>
            <div class='grid grid-cols-2 gap-4 mt-4'>
                <RgbaColorInput
                    id='surface-overlay'
                    label='Overlay * (rgba)'
                    value={formData.surfaceOverlayColor}
                    onChange={(v) => update({ surfaceOverlayColor: v })}
                    disabled={isSaving}
                    testId='surface-overlay-color-input'
                />
                <ColorInput
                    id='surface-warning'
                    label='Warning *'
                    value={formData.surfaceWarningColor}
                    onChange={(v) => update({ surfaceWarningColor: v })}
                    disabled={isSaving}
                    testId='surface-warning-color-input'
                />
                <ColorInput
                    id='surface-muted'
                    label='Muted *'
                    value={formData.surfaceMutedColor}
                    onChange={(v) => update({ surfaceMutedColor: v })}
                    disabled={isSaving}
                    testId='surface-muted-color-input'
                />
            </div>
        </AdminFormSection>
    );
}
