import type { BrandingMarketingFlags } from '@billsplit-wl/shared';
import { toShowLandingPageFlag, toShowMarketingContentFlag, toShowPricingPageFlag } from '@billsplit-wl/shared';

/**
 * Builder for BrandingMarketingFlags objects used in tenant config tests.
 */
export class MarketingFlagsBuilder {
    private flags: Partial<BrandingMarketingFlags> = {};

    withShowLandingPage(show: boolean): this {
        this.flags.showLandingPage = toShowLandingPageFlag(show);
        return this;
    }

    withShowMarketingContent(show: boolean): this {
        this.flags.showMarketingContent = toShowMarketingContentFlag(show);
        return this;
    }

    withShowPricingPage(show: boolean): this {
        this.flags.showPricingPage = toShowPricingPageFlag(show);
        return this;
    }

    /** Enable all marketing features */
    allEnabled(): this {
        this.flags.showLandingPage = toShowLandingPageFlag(true);
        this.flags.showMarketingContent = toShowMarketingContentFlag(true);
        this.flags.showPricingPage = toShowPricingPageFlag(true);
        return this;
    }

    /** Disable all marketing features */
    allDisabled(): this {
        this.flags.showLandingPage = toShowLandingPageFlag(false);
        this.flags.showMarketingContent = toShowMarketingContentFlag(false);
        this.flags.showPricingPage = toShowPricingPageFlag(false);
        return this;
    }

    build(): Partial<BrandingMarketingFlags> {
        return { ...this.flags };
    }
}
