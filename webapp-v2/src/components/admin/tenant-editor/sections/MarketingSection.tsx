import { AdminFormSection, AdminFormToggle } from '@/components/admin/forms';
import type { SectionProps } from './types';

export function MarketingSection({ formData, update, isSaving }: SectionProps) {
    return (
        <AdminFormSection title='Marketing Features' description='Toggle marketing pages and content' testId='section-marketing'>
            <div class='space-y-3'>
                <AdminFormToggle label='Landing Page' description='Show the public landing page' checked={formData.showLandingPage} onChange={(v) => update({ showLandingPage: v })} disabled={isSaving} testId='show-landing-page-checkbox' />
                <AdminFormToggle label='Marketing Content' description='Display marketing sections' checked={formData.showMarketingContent} onChange={(v) => update({ showMarketingContent: v })} disabled={isSaving} testId='show-marketing-content-checkbox' />
                <AdminFormToggle label='Pricing Page' description='Show the pricing page' checked={formData.showPricingPage} onChange={(v) => update({ showPricingPage: v })} disabled={isSaving} testId='show-pricing-page-checkbox' />
            </div>
        </AdminFormSection>
    );
}
