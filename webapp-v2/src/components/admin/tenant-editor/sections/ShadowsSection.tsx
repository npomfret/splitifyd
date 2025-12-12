import { AdminFormInput, AdminFormSection } from '@/components/admin/forms';
import type { SectionProps } from './types';

export function ShadowsSection({ formData, update, isSaving }: SectionProps) {
    return (
        <AdminFormSection title='Shadows' description='Box shadow definitions' testId='section-shadows'>
            <div className='grid grid-cols-3 gap-4'>
                <AdminFormInput label='SM' value={formData.shadowSm} onChange={(v) => update({ shadowSm: v })} placeholder='0 1px 2px ...' disabled={isSaving} monospace required />
                <AdminFormInput label='MD' value={formData.shadowMd} onChange={(v) => update({ shadowMd: v })} placeholder='0 4px 6px ...' disabled={isSaving} monospace required />
                <AdminFormInput label='LG' value={formData.shadowLg} onChange={(v) => update({ shadowLg: v })} placeholder='0 10px 15px ...' disabled={isSaving} monospace required />
            </div>
        </AdminFormSection>
    );
}
