import { ComponentChildren } from 'preact';
import { Header } from './Header';
import { Footer } from './Footer';
import { SEOHead } from '../SEOHead';

interface BaseLayoutProps {
  children: ComponentChildren;
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  structuredData?: any;
  headerVariant?: 'default' | 'minimal' | 'dashboard';
  showHeader?: boolean;
  showFooter?: boolean;
}

export function BaseLayout({
  children,
  title,
  description,
  canonical,
  ogImage,
  structuredData,
  headerVariant = 'default',
  showHeader = true,
  showFooter = true,
}: BaseLayoutProps) {
  return (
    <div class="min-h-screen bg-gray-50 flex flex-col">
      {title && (
        <SEOHead 
          title={title}
          description={description || title}
          canonical={canonical}
          ogImage={ogImage}
          structuredData={structuredData}
        />
      )}
      
      {showHeader && <Header variant={headerVariant} />}
      
      <main class="flex-1">
        {children}
      </main>
      
      {showFooter && <Footer />}
    </div>
  );
}