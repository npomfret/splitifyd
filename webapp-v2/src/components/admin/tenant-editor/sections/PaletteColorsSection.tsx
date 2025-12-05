import { AdminFormSection } from '@/components/admin/forms';
import { ColorInput } from '@/components/ui';
import type { CreationModeSectionProps } from './types';

export function PaletteColorsSection({ formData, update, isSaving, mode, creationMode }: CreationModeSectionProps) {
    return (
        <AdminFormSection
            title='Palette Colors'
            description='Core color palette (11 required)'
            defaultOpen={mode === 'create' && creationMode === 'empty'}
            testId='section-palette'
        >
            <div class='space-y-4'>
                <div class='grid grid-cols-2 gap-4'>
                    <ColorInput id='primary-color' label='Primary *' value={formData.primaryColor} onChange={(v) => update({ primaryColor: v })} disabled={isSaving} testId='primary-color-input' />
                    <ColorInput id='primary-variant' label='Primary Variant *' value={formData.primaryVariantColor} onChange={(v) => update({ primaryVariantColor: v })} disabled={isSaving} testId='primary-variant-color-input' />
                </div>
                <div class='grid grid-cols-2 gap-4'>
                    <ColorInput id='secondary-color' label='Secondary *' value={formData.secondaryColor} onChange={(v) => update({ secondaryColor: v })} disabled={isSaving} testId='secondary-color-input' />
                    <ColorInput id='secondary-variant' label='Secondary Variant *' value={formData.secondaryVariantColor} onChange={(v) => update({ secondaryVariantColor: v })} disabled={isSaving} testId='secondary-variant-color-input' />
                </div>
                <ColorInput id='accent-color' label='Accent *' value={formData.accentColor} onChange={(v) => update({ accentColor: v })} disabled={isSaving} testId='accent-color-input' />
                <div class='grid grid-cols-2 gap-4'>
                    <ColorInput id='neutral-color' label='Neutral *' value={formData.neutralColor} onChange={(v) => update({ neutralColor: v })} disabled={isSaving} testId='neutral-color-input' />
                    <ColorInput id='neutral-variant' label='Neutral Variant *' value={formData.neutralVariantColor} onChange={(v) => update({ neutralVariantColor: v })} disabled={isSaving} testId='neutral-variant-color-input' />
                </div>
                <div class='grid grid-cols-2 gap-4'>
                    <ColorInput id='success-color' label='Success *' value={formData.successColor} onChange={(v) => update({ successColor: v })} disabled={isSaving} testId='success-color-input' />
                    <ColorInput id='warning-color' label='Warning *' value={formData.warningColor} onChange={(v) => update({ warningColor: v })} disabled={isSaving} testId='warning-color-input' />
                    <ColorInput id='danger-color' label='Danger *' value={formData.dangerColor} onChange={(v) => update({ dangerColor: v })} disabled={isSaving} testId='danger-color-input' />
                    <ColorInput id='info-color' label='Info *' value={formData.infoColor} onChange={(v) => update({ infoColor: v })} disabled={isSaving} testId='info-color-input' />
                </div>
            </div>
        </AdminFormSection>
    );
}
