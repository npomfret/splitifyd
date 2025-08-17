import { useEffect } from 'preact/hooks';

interface SEOHeadProps {
    title: string;
    description?: string;
    canonical?: string;
    ogType?: 'website' | 'article';
    ogImage?: string;
    structuredData?: any;
}

export function SEOHead({ title, description, canonical, ogType = 'website', ogImage, structuredData }: SEOHeadProps) {
    useEffect(() => {
        if (typeof document === 'undefined') return;

        document.title = `${title} | Splitifyd`;

        // Helper function to set or update meta tag
        const setMeta = (name: string, content: string, property?: boolean) => {
            const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
            let meta = document.querySelector(selector);

            if (!meta) {
                meta = document.createElement('meta');
                if (property) {
                    meta.setAttribute('property', name);
                } else {
                    meta.setAttribute('name', name);
                }
                document.head.appendChild(meta);
            }

            meta.setAttribute('content', content);
        };

        // Set basic meta tags
        if (description) {
            setMeta('description', description);
        }

        // Set Open Graph tags
        setMeta('og:title', `${title} | Splitifyd`, true);
        if (description) {
            setMeta('og:description', description, true);
        }
        setMeta('og:type', ogType, true);
        setMeta('og:site_name', 'Splitifyd', true);

        if (canonical) {
            setMeta('og:url', canonical, true);
        }

        if (ogImage) {
            setMeta('og:image', ogImage, true);
        }

        // Set Twitter Card tags
        setMeta('twitter:card', 'summary_large_image');
        setMeta('twitter:title', `${title} | Splitifyd`);
        if (description) {
            setMeta('twitter:description', description);
        }
        if (ogImage) {
            setMeta('twitter:image', ogImage);
        }

        // Set canonical URL
        if (canonical) {
            let canonicalLink = document.querySelector('link[rel="canonical"]');
            if (!canonicalLink) {
                canonicalLink = document.createElement('link');
                canonicalLink.setAttribute('rel', 'canonical');
                document.head.appendChild(canonicalLink);
            }
            canonicalLink.setAttribute('href', canonical);
        }

        // Set structured data
        if (structuredData) {
            let structuredDataScript = document.querySelector('script[type="application/ld+json"]');
            if (!structuredDataScript) {
                structuredDataScript = document.createElement('script');
                structuredDataScript.setAttribute('type', 'application/ld+json');
                document.head.appendChild(structuredDataScript);
            }
            structuredDataScript.textContent = JSON.stringify(structuredData);
        }
    }, [title, description, canonical, ogType, ogImage, structuredData]);

    return null; // This component doesn't render anything
}
