import { AdminFormInput, AdminFormSection, SubsectionHeader } from '@/components/admin/forms';
import type { SectionProps } from './types';

export function SpacingSection({ formData, update, isSaving }: SectionProps) {
    return (
        <AdminFormSection title='Spacing' description='Scale and semantic spacing values' testId='section-spacing'>
            <div class='space-y-4'>
                <SubsectionHeader title='Scale' />
                <div class='grid grid-cols-7 gap-4'>
                    <AdminFormInput label='2XS' value={formData.spacing2xs} onChange={(v) => update({ spacing2xs: v })} placeholder='0.25rem' disabled={isSaving} monospace required />
                    <AdminFormInput label='XS' value={formData.spacingXs} onChange={(v) => update({ spacingXs: v })} placeholder='0.5rem' disabled={isSaving} monospace required />
                    <AdminFormInput label='SM' value={formData.spacingSm} onChange={(v) => update({ spacingSm: v })} placeholder='0.75rem' disabled={isSaving} monospace required />
                    <AdminFormInput label='MD' value={formData.spacingMd} onChange={(v) => update({ spacingMd: v })} placeholder='1rem' disabled={isSaving} monospace required />
                    <AdminFormInput label='LG' value={formData.spacingLg} onChange={(v) => update({ spacingLg: v })} placeholder='1.5rem' disabled={isSaving} monospace required />
                    <AdminFormInput label='XL' value={formData.spacingXl} onChange={(v) => update({ spacingXl: v })} placeholder='2rem' disabled={isSaving} monospace required />
                    <AdminFormInput label='2XL' value={formData.spacing2xl} onChange={(v) => update({ spacing2xl: v })} placeholder='3rem' disabled={isSaving} monospace required />
                </div>
                <SubsectionHeader title='Semantic' />
                <div class='grid grid-cols-4 gap-4'>
                    <AdminFormInput
                        label='Page Padding'
                        value={formData.spacingPagePadding}
                        onChange={(v) => update({ spacingPagePadding: v })}
                        placeholder='1.5rem'
                        disabled={isSaving}
                        monospace
                        required
                    />
                    <AdminFormInput
                        label='Section Gap'
                        value={formData.spacingSectionGap}
                        onChange={(v) => update({ spacingSectionGap: v })}
                        placeholder='2rem'
                        disabled={isSaving}
                        monospace
                        required
                    />
                    <AdminFormInput
                        label='Card Padding'
                        value={formData.spacingCardPadding}
                        onChange={(v) => update({ spacingCardPadding: v })}
                        placeholder='1.5rem'
                        disabled={isSaving}
                        monospace
                        required
                    />
                    <AdminFormInput
                        label='Component Gap'
                        value={formData.spacingComponentGap}
                        onChange={(v) => update({ spacingComponentGap: v })}
                        placeholder='1rem'
                        disabled={isSaving}
                        monospace
                        required
                    />
                </div>
            </div>
        </AdminFormSection>
    );
}
