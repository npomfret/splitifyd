import { AdminFormSection, SubsectionHeader } from '@/components/admin/forms';
import { ColorInput } from '@/components/ui';
import type { SectionProps } from './types';

export function InteractiveColorsSection({ formData, update, isSaving }: SectionProps) {
    return (
        <AdminFormSection title='Interactive Colors' description='Button and link states (13 required)' testId='section-interactive'>
            <div class='space-y-4'>
                <SubsectionHeader title='Primary' />
                <div class='grid grid-cols-2 gap-4'>
                    <ColorInput id='interactive-primary' label='Default *' value={formData.interactivePrimaryColor} onChange={(v) => update({ interactivePrimaryColor: v })} disabled={isSaving} testId='interactive-primary-color-input' />
                    <ColorInput id='interactive-primary-hover' label='Hover *' value={formData.interactivePrimaryHoverColor} onChange={(v) => update({ interactivePrimaryHoverColor: v })} disabled={isSaving} testId='interactive-primary-hover-color-input' />
                    <ColorInput id='interactive-primary-active' label='Active *' value={formData.interactivePrimaryActiveColor} onChange={(v) => update({ interactivePrimaryActiveColor: v })} disabled={isSaving} testId='interactive-primary-active-color-input' />
                    <ColorInput id='interactive-primary-fg' label='Foreground *' value={formData.interactivePrimaryForegroundColor} onChange={(v) => update({ interactivePrimaryForegroundColor: v })} disabled={isSaving} testId='interactive-primary-foreground-color-input' />
                </div>
                <SubsectionHeader title='Secondary' />
                <div class='grid grid-cols-2 gap-4'>
                    <ColorInput id='interactive-secondary' label='Default *' value={formData.interactiveSecondaryColor} onChange={(v) => update({ interactiveSecondaryColor: v })} disabled={isSaving} testId='interactive-secondary-color-input' />
                    <ColorInput id='interactive-secondary-hover' label='Hover *' value={formData.interactiveSecondaryHoverColor} onChange={(v) => update({ interactiveSecondaryHoverColor: v })} disabled={isSaving} testId='interactive-secondary-hover-color-input' />
                    <ColorInput id='interactive-secondary-active' label='Active *' value={formData.interactiveSecondaryActiveColor} onChange={(v) => update({ interactiveSecondaryActiveColor: v })} disabled={isSaving} testId='interactive-secondary-active-color-input' />
                    <ColorInput id='interactive-secondary-fg' label='Foreground *' value={formData.interactiveSecondaryForegroundColor} onChange={(v) => update({ interactiveSecondaryForegroundColor: v })} disabled={isSaving} testId='interactive-secondary-foreground-color-input' />
                </div>
                <ColorInput id='interactive-accent' label='Accent *' value={formData.interactiveAccentColor} onChange={(v) => update({ interactiveAccentColor: v })} disabled={isSaving} testId='interactive-accent-color-input' />
                <SubsectionHeader title='Destructive' />
                <div class='grid grid-cols-2 gap-4'>
                    <ColorInput id='interactive-destructive' label='Default *' value={formData.interactiveDestructiveColor} onChange={(v) => update({ interactiveDestructiveColor: v })} disabled={isSaving} testId='interactive-destructive-color-input' />
                    <ColorInput id='interactive-destructive-hover' label='Hover *' value={formData.interactiveDestructiveHoverColor} onChange={(v) => update({ interactiveDestructiveHoverColor: v })} disabled={isSaving} testId='interactive-destructive-hover-color-input' />
                    <ColorInput id='interactive-destructive-active' label='Active *' value={formData.interactiveDestructiveActiveColor} onChange={(v) => update({ interactiveDestructiveActiveColor: v })} disabled={isSaving} testId='interactive-destructive-active-color-input' />
                    <ColorInput id='interactive-destructive-fg' label='Foreground *' value={formData.interactiveDestructiveForegroundColor} onChange={(v) => update({ interactiveDestructiveForegroundColor: v })} disabled={isSaving} testId='interactive-destructive-foreground-color-input' />
                </div>
                <SubsectionHeader title='Effects (optional)' />
                <div class='grid grid-cols-3 gap-4'>
                    <ColorInput id='interactive-ghost' label='Ghost' value={formData.interactiveGhostColor} onChange={(v) => update({ interactiveGhostColor: v })} disabled={isSaving} testId='interactive-ghost-color-input' />
                    <ColorInput id='interactive-magnetic' label='Magnetic' value={formData.interactiveMagneticColor} onChange={(v) => update({ interactiveMagneticColor: v })} disabled={isSaving} testId='interactive-magnetic-color-input' />
                    <ColorInput id='interactive-glow' label='Glow' value={formData.interactiveGlowColor} onChange={(v) => update({ interactiveGlowColor: v })} disabled={isSaving} testId='interactive-glow-color-input' />
                </div>
            </div>
        </AdminFormSection>
    );
}
