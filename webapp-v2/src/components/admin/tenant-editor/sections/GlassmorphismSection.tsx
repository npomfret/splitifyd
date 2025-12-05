import { AdminFormSection } from '@/components/admin/forms';
import { RgbaColorInput } from '@/components/ui';
import type { SectionProps } from './types';

export function GlassmorphismSection({ formData, update, isSaving }: SectionProps) {
    if (!formData.enableGlassmorphism) {
        return null;
    }

    return (
        <AdminFormSection title='Glassmorphism Settings' description='Glass effect colors (RGBA)' testId='section-glassmorphism-settings' defaultOpen={true}>
            <div class='grid grid-cols-2 gap-4'>
                <RgbaColorInput id='glass-color' label='Glass Color' value={formData.glassColor} onChange={(v) => update({ glassColor: v })} placeholder='rgba(25, 30, 50, 0.45)' disabled={isSaving} testId='glass-color-input' />
                <RgbaColorInput id='glass-border' label='Glass Border' value={formData.glassBorderColor} onChange={(v) => update({ glassBorderColor: v })} placeholder='rgba(255, 255, 255, 0.12)' disabled={isSaving} testId='glass-border-color-input' />
            </div>
        </AdminFormSection>
    );
}
