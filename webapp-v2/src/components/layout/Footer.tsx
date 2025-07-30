export function Footer() {
  return (
    <footer class="bg-gray-100 border-t border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div>
            <h3 class="font-semibold text-gray-900 mb-3">Splitifyd</h3>
            <p class="text-sm text-gray-600">
              Split bills easily with friends and family.
            </p>
          </div>
          
          {/* Product Links */}
          <div>
            <h3 class="font-semibold text-gray-900 mb-3">Product</h3>
            <ul class="space-y-2">
              <li>
                <a href="/v2/pricing" class="text-sm text-gray-600 hover:text-purple-600 transition-colors">
                  Pricing
                </a>
              </li>
            </ul>
          </div>
          
          {/* Legal Links */}
          <div>
            <h3 class="font-semibold text-gray-900 mb-3">Legal</h3>
            <ul class="space-y-2">
              <li>
                <a href="/v2/terms" class="text-sm text-gray-600 hover:text-purple-600 transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/v2/privacy" class="text-sm text-gray-600 hover:text-purple-600 transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/v2/cookies" class="text-sm text-gray-600 hover:text-purple-600 transition-colors">
                  Cookie Policy
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div class="mt-8 pt-8 border-t border-gray-200">
          <p class="text-center text-sm text-gray-500">
            &copy; 2025 Pomo Corp ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}