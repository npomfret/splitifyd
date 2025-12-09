import { AdminFormSection, AdminFormToggle } from '@/components/admin/forms';
import { useTranslation } from 'react-i18next';
import type { SectionProps } from './types';

export function MarketingSection({ formData, update, isSaving }: SectionProps) {
    const { t } = useTranslation();
    return (
        <AdminFormSection title={t('admin.tenantEditor.sections.marketing.title')} description={t('admin.tenantEditor.sections.marketing.description')} testId='section-marketing'>
            <div class='space-y-3'>
                <AdminFormToggle
                    label='Marketing Content'
                    description='Display marketing sections'
                    checked={formData.showMarketingContent}
                    onChange={(v) => update({ showMarketingContent: v })}
                    disabled={isSaving}
                    testId='show-marketing-content-checkbox'
                />
                <AdminFormToggle
                    label='Pricing Page'
                    description='Show the pricing page'
                    checked={formData.showPricingPage}
                    onChange={(v) => update({ showPricingPage: v })}
                    disabled={isSaving}
                    testId='show-pricing-page-checkbox'
                />
            </div>
        </AdminFormSection>
    );
}
