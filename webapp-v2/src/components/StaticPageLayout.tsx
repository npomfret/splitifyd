import { ComponentChildren } from 'preact';

interface StaticPageLayoutProps {
  title: string;
  description?: string;
  children: ComponentChildren;
}

export function StaticPageLayout({ title, description, children }: StaticPageLayoutProps) {
  // Update document title for SEO
  if (typeof document !== 'undefined') {
    document.title = `${title} | Splitifyd`;
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription && description) {
      metaDescription.setAttribute('content', description);
    }
  }

  return (
    <div class="min-h-screen bg-gray-50">
      {/* Header */}
      <header class="bg-white shadow-sm border-b">
        <div class="max-w-4xl mx-auto px-4 py-6">
          <nav class="flex items-center justify-between">
            <a href="/" class="text-xl font-bold text-gray-900">
              Splitifyd
            </a>
            <div class="flex space-x-6">
              <a href="/" class="text-gray-600 hover:text-gray-900 transition-colors">
                Home
              </a>
              <a href="/v2/pricing" class="text-gray-600 hover:text-gray-900 transition-colors">
                Pricing
              </a>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main class="max-w-4xl mx-auto px-4 py-12">
        <div class="bg-white rounded-lg shadow-sm p-8">
          <h1 class="text-3xl font-bold text-gray-900 mb-6">{title}</h1>
          <div class="prose prose-gray max-w-none">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer class="bg-gray-800 text-white mt-16">
        <div class="max-w-4xl mx-auto px-4 py-8">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 class="text-lg font-semibold mb-4">Splitifyd</h3>
              <p class="text-gray-300">
                Split bills easily with friends and family. Track expenses and settle debts effortlessly.
              </p>
            </div>
            <div>
              <h3 class="text-lg font-semibold mb-4">Product</h3>
              <ul class="space-y-2">
                <li>
                  <a href="/v2/pricing" class="text-gray-300 hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 class="text-lg font-semibold mb-4">Legal</h3>
              <ul class="space-y-2">
                <li>
                  <a href="/v2/terms" class="text-gray-300 hover:text-white transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="/v2/privacy" class="text-gray-300 hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/v2/cookies" class="text-gray-300 hover:text-white transition-colors">
                    Cookie Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div class="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Splitifyd. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}