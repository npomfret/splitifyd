import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@/test-utils';
import { StaticPageLayout } from '../StaticPageLayout';

// Unit tests for SEO functionality in StaticPageLayout
describe('StaticPageLayout - SEO', () => {
    beforeEach(() => {
        // Reset document head before each test
        document.head.innerHTML = '';
        document.title = '';
    });

    it('sets page title through StaticPageLayout', () => {
        render(
            <StaticPageLayout title="Test Page" description="Test description">
                <p>Content</p>
            </StaticPageLayout>,
        );

        expect(document.title).toBe('Test Page | Splitifyd');
    });

    it('combines SEO meta tags with page layout', () => {
        render(
            <StaticPageLayout title="Legal Page" description="Important legal information" canonical="https://splitifyd.com/legal">
                <p>Legal content</p>
            </StaticPageLayout>,
        );

        // Check combined SEO functionality
        expect(document.title).toBe('Legal Page | Splitifyd');

        const metaDescription = document.querySelector('meta[name="description"]');
        expect(metaDescription?.getAttribute('content')).toBe('Important legal information');

        const canonical = document.querySelector('link[rel="canonical"]');
        expect(canonical?.getAttribute('href')).toBe('https://splitifyd.com/legal');

        const ogTitle = document.querySelector('meta[property="og:title"]');
        expect(ogTitle?.getAttribute('content')).toBe('Legal Page | Splitifyd');
    });

    it('handles structured data integration', () => {
        const structuredData = {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Integration Test Page',
        };

        render(
            <StaticPageLayout title="Test Page" description="Test description" structuredData={structuredData}>
                <p>Content</p>
            </StaticPageLayout>,
        );

        const scriptTag = document.querySelector('script[type="application/ld+json"]');
        expect(scriptTag?.textContent).toBe(JSON.stringify(structuredData));
    });

    it('sets all required social media meta tags', () => {
        render(
            <StaticPageLayout title="Social Test" description="Social media description" ogImage="https://splitifyd.com/social-image.jpg">
                <p>Content</p>
            </StaticPageLayout>,
        );

        // Open Graph tags
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDescription = document.querySelector('meta[property="og:description"]');
        const ogImage = document.querySelector('meta[property="og:image"]');
        const ogType = document.querySelector('meta[property="og:type"]');

        expect(ogTitle?.getAttribute('content')).toBe('Social Test | Splitifyd');
        expect(ogDescription?.getAttribute('content')).toBe('Social media description');
        expect(ogImage?.getAttribute('content')).toBe('https://splitifyd.com/social-image.jpg');
        expect(ogType?.getAttribute('content')).toBe('website');

        // Twitter tags
        const twitterCard = document.querySelector('meta[name="twitter:card"]');
        const twitterTitle = document.querySelector('meta[name="twitter:title"]');
        const twitterDescription = document.querySelector('meta[name="twitter:description"]');
        const twitterImage = document.querySelector('meta[name="twitter:image"]');

        expect(twitterCard?.getAttribute('content')).toBe('summary_large_image');
        expect(twitterTitle?.getAttribute('content')).toBe('Social Test | Splitifyd');
        expect(twitterDescription?.getAttribute('content')).toBe('Social media description');
        expect(twitterImage?.getAttribute('content')).toBe('https://splitifyd.com/social-image.jpg');
    });

    it('maintains SEO consistency across page renders', () => {
        const { rerender } = render(
            <StaticPageLayout title="Page 1" description="Description 1">
                <p>Content 1</p>
            </StaticPageLayout>,
        );

        expect(document.title).toBe('Page 1 | Splitifyd');

        // Re-render with different content
        rerender(
            <StaticPageLayout title="Page 2" description="Description 2">
                <p>Content 2</p>
            </StaticPageLayout>,
        );

        expect(document.title).toBe('Page 2 | Splitifyd');

        const metaDescription = document.querySelector('meta[name="description"]');
        expect(metaDescription?.getAttribute('content')).toBe('Description 2');
    });
});
