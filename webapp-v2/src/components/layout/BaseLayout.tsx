import { ComponentChildren } from 'preact';
import { Header } from './Header';
import { Footer } from './Footer';
import { V2Indicator } from '../ui/V2Indicator';
import { SEOHead } from '../SEOHead';

interface BaseLayoutProps {
  children: ComponentChildren;
  title?: string;
  description?: string;
  headerVariant?: 'default' | 'minimal' | 'dashboard';
  showHeader?: boolean;
  showFooter?: boolean;
  showV2Indicator?: boolean;
}

export function BaseLayout({
  children,
  title,
  description,
  headerVariant = 'default',
  showHeader = true,
  showFooter = true,
  showV2Indicator = true
}: BaseLayoutProps) {
  return (
    <div class="min-h-screen bg-gray-50 flex flex-col">
      {showV2Indicator && <V2Indicator />}
      
      {title && (
        <SEOHead 
          title={title}
          description={description || title}
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