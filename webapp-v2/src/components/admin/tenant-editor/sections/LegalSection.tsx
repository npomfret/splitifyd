import { AdminFormInput, AdminFormSection } from '@/components/admin/forms';
import type { SectionProps } from './types';

export function LegalSection({ formData, update, isSaving }: SectionProps) {
    return (
        <AdminFormSection title='Legal' description='Company and legal information' testId='section-legal'>
            <div class='grid grid-cols-2 gap-4'>
                <AdminFormInput label='Company Name' value={formData.legalCompanyName} onChange={(v) => update({ legalCompanyName: v })} placeholder='Acme Corp' disabled={isSaving} required />
                <AdminFormInput
                    label='Support Email'
                    type='email'
                    value={formData.legalSupportEmail}
                    onChange={(v) => update({ legalSupportEmail: v })}
                    placeholder='support@example.com'
                    disabled={isSaving}
                    required
                />
                <AdminFormInput
                    label='Privacy Policy URL'
                    type='url'
                    value={formData.legalPrivacyPolicyUrl}
                    onChange={(v) => update({ legalPrivacyPolicyUrl: v })}
                    placeholder='https://...'
                    disabled={isSaving}
                />
                <AdminFormInput
                    label='Terms of Service URL'
                    type='url'
                    value={formData.legalTermsOfServiceUrl}
                    onChange={(v) => update({ legalTermsOfServiceUrl: v })}
                    placeholder='https://...'
                    disabled={isSaving}
                />
            </div>
        </AdminFormSection>
    );
}
