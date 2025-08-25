import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@/test-utils';
import { SEOHead } from '../../components/SEOHead';

// Test the SEO component behavior - focus on what it actually does
describe('SEOHead', () => {
    beforeEach(() => {
        // Reset document head before each test
        document.head.innerHTML = '';
        document.title = '';
    });

    it('sets the document title correctly', () => {
        render(<SEOHead title="Test Page" description="Test description" />);

        expect(document.title).toBe('Test Page | Splitifyd');
    });

    it('adds meta description when provided', () => {
        render(<SEOHead title="Test" description="This is a test page" />);

        const metaDescription = document.querySelector('meta[name="description"]');
        expect(metaDescription?.getAttribute('content')).toBe('This is a test page');
    });

    it('adds Open Graph meta tags', () => {
        render(<SEOHead title="Test Page" description="Test description" />);

        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDescription = document.querySelector('meta[property="og:description"]');
        const ogType = document.querySelector('meta[property="og:type"]');

        expect(ogTitle?.getAttribute('content')).toBe('Test Page | Splitifyd');
        expect(ogDescription?.getAttribute('content')).toBe('Test description');
        expect(ogType?.getAttribute('content')).toBe('website');
    });

    it('adds Twitter Card meta tags', () => {
        render(<SEOHead title="Test Page" description="Test description" />);

        const twitterCard = document.querySelector('meta[name="twitter:card"]');
        const twitterTitle = document.querySelector('meta[name="twitter:title"]');

        expect(twitterCard?.getAttribute('content')).toBe('summary_large_image');
        expect(twitterTitle?.getAttribute('content')).toBe('Test Page | Splitifyd');
    });

    it('adds canonical URL when provided', () => {
        const canonicalUrl = 'https://splitifyd.com/test';
        render(<SEOHead title="Test" description="Test" canonical={canonicalUrl} />);

        const canonical = document.querySelector('link[rel="canonical"]');
        expect(canonical?.getAttribute('href')).toBe(canonicalUrl);
    });

    it('adds structured data when provided', () => {
        const structuredData = {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Test Page',
        };

        render(<SEOHead title="Test" description="Test" structuredData={structuredData} />);

        const scriptTag = document.querySelector('script[type="application/ld+json"]');
        expect(scriptTag?.textContent).toBe(JSON.stringify(structuredData));
    });

    it('handles custom OG type', () => {
        render(<SEOHead title="Test" description="Test" ogType="article" />);

        const ogType = document.querySelector('meta[property="og:type"]');
        expect(ogType?.getAttribute('content')).toBe('article');
    });

    it('adds OG image when provided', () => {
        const imageUrl = 'https://splitifyd.com/image.jpg';
        render(<SEOHead title="Test" description="Test" ogImage={imageUrl} />);

        const ogImage = document.querySelector('meta[property="og:image"]');
        const twitterImage = document.querySelector('meta[name="twitter:image"]');

        expect(ogImage?.getAttribute('content')).toBe(imageUrl);
        expect(twitterImage?.getAttribute('content')).toBe(imageUrl);
    });
});
