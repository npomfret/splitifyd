import { ComponentChildren } from 'preact';
import { Header } from './Header';
import { Footer } from './Footer';
import { SEOHead } from '../SEOHead';

interface BaseLayoutProps {
  children: ComponentChildren;
  title?: string;
  description?: string;
  headerVariant?: 'default' | 'minimal' | 'dashboard';
  showHeader?: boolean;
  showFooter?: boolean;
}

export function BaseLayout({
  children,
  title,
  description,
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