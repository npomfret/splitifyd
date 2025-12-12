import { AdminFormInput, AdminFormSection } from '@/components/admin/forms';
import type { SectionProps } from './types';

export function RadiiSection({ formData, update, isSaving }: SectionProps) {
    return (
        <AdminFormSection title='Border Radii' description='Corner rounding values' testId='section-border-radii'>
            <div className='grid grid-cols-6 gap-4'>
                <AdminFormInput label='None' value={formData.radiiNone} onChange={(v) => update({ radiiNone: v })} placeholder='0' disabled={isSaving} monospace required />
                <AdminFormInput label='SM' value={formData.radiiSm} onChange={(v) => update({ radiiSm: v })} placeholder='0.25rem' disabled={isSaving} monospace required />
                <AdminFormInput label='MD' value={formData.radiiMd} onChange={(v) => update({ radiiMd: v })} placeholder='0.5rem' disabled={isSaving} monospace required />
                <AdminFormInput label='LG' value={formData.radiiLg} onChange={(v) => update({ radiiLg: v })} placeholder='1rem' disabled={isSaving} monospace required />
                <AdminFormInput label='Pill' value={formData.radiiPill} onChange={(v) => update({ radiiPill: v })} placeholder='9999px' disabled={isSaving} monospace required />
                <AdminFormInput label='Full' value={formData.radiiFull} onChange={(v) => update({ radiiFull: v })} placeholder='50%' disabled={isSaving} monospace required />
            </div>
        </AdminFormSection>
    );
}
