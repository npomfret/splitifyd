import { ComponentChildren } from 'preact';
import { SEOHead } from '../SEOHead';

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ComponentChildren;
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div class="min-h-screen bg-gray-50 flex flex-col">
      <SEOHead 
        title={title}
        description={description || `${title} - Splitifyd`}
      />
      
      {/* Header */}
      <header class="bg-white shadow-sm border-b">
        <div class="max-w-md mx-auto px-4 py-4">
          <nav class="flex justify-center">
            <a href="/" class="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors">
              Splitifyd
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main class="flex-1 flex items-center justify-center px-4 py-12">
        <div class="w-full max-w-md">
          <div class="bg-white rounded-lg shadow-md border p-8">
            <h1 class="text-2xl font-bold text-gray-900 text-center mb-8">{title}</h1>
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer class="bg-white border-t py-6">
        <div class="max-w-md mx-auto px-4 text-center">
          <div class="flex justify-center space-x-6 text-sm text-gray-500">
            <a href="/v2/terms" class="hover:text-gray-700 transition-colors">
              Terms
            </a>
            <a href="/v2/privacy" class="hover:text-gray-700 transition-colors">
              Privacy
            </a>
            <a href="/" class="hover:text-gray-700 transition-colors">
              Back to Home
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}