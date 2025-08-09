import { StaticPageLayout } from '../../components/StaticPageLayout';

export function PricingPage() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const canonical = `${baseUrl}/pricing`;
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Pricing (It's Free, Seriously) - Splitifyd",
    "description": "Simple, transparent pricing for Splitifyd. Split bills with friends for free.",
    "url": canonical,
    "mainEntity": {
      "@type": "Product",
      "name": "Splitifyd",
      "description": "Split bills easily with friends and family. Track expenses and settle debts effortlessly.",
      "offers": [
        {
          "@type": "Offer",
          "name": "Free Plan",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Perfect for personal use with unlimited friends and expense tracking"
        }
      ]
    }
  };

  return (
    <StaticPageLayout 
      title="Pricing (It's Free, Seriously)" 
      description="Simple, transparent pricing for Splitifyd. Split bills with friends for free."
      canonical={canonical}
      structuredData={structuredData}
    >
      <div class="space-y-8">
        {/* Pricing Hero */}
        <div class="text-center">
          <h2 class="text-2xl font-bold text-gray-900 mb-4">Choose Your Adventure</h2>
        </div>

        {/* Pricing Cards */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Just Getting Started Plan */}
          <div class="border border-gray-200 rounded-lg p-6">
            <div class="text-center">
              <h3 class="text-xl font-bold text-gray-900 mb-2">The "Just Getting Started" Plan</h3>
              <div class="mb-4">
                <sup class="text-xl">$</sup>
                <span class="text-4xl font-bold">0</span>
                <span class="text-gray-500">/month</span>
              </div>
            </div>
            
            <ul class="space-y-3 mb-8">
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Unlimited expense tracking</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Unlimited groups</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Unlimited friends (if you have that many)</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Basic debt simplification</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Access to our highly sarcastic FAQ section</span>
              </li>
            </ul>
            
            <a href="/register" class="block w-full bg-blue-600 text-white text-center py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
              Sign Up (It's Still Free)
            </a>
          </div>

          {/* I'm Basically a Pro Plan */}
          <div class="border-2 border-blue-500 rounded-lg p-6 relative">
            <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded text-sm">
              MOST POPULAR
            </div>
            <div class="text-center">
              <h3 class="text-xl font-bold text-gray-900 mb-2">The "I'm Basically a Pro" Plan</h3>
              <div class="mb-4">
                <sup class="text-xl">$</sup>
                <span class="text-4xl font-bold">0</span>
                <span class="text-gray-500">/month</span>
              </div>
            </div>
            
            <ul class="space-y-3 mb-8">
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Everything in "Just Getting Started"</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Advanced debt simplification (it's the same, but sounds cooler)</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Priority access to our "we'll get to it when we get to it" support</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>The warm fuzzy feeling of not paying for anything</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Bragging rights to your friends about your free app</span>
              </li>
            </ul>
            
            <a href="/register" class="block w-full bg-blue-600 text-white text-center py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
              Join Now (Seriously, No Catch)
            </a>
          </div>

          {/* I'm a Philanthropist Plan */}
          <div class="border border-gray-200 rounded-lg p-6">
            <div class="text-center">
              <h3 class="text-xl font-bold text-gray-900 mb-2">The "I'm a Philanthropist" Plan</h3>
              <div class="mb-4">
                <sup class="text-xl">$</sup>
                <span class="text-4xl font-bold">0</span>
                <span class="text-gray-500">/month</span>
              </div>
            </div>
            
            <ul class="space-y-3 mb-8">
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Everything in "I'm Basically a Pro"</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>The ability to tell people you're on the "Philanthropist" plan</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>A deep sense of satisfaction from using a free app</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>We'll send you good vibes (results may vary)</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Your name will be whispered in the halls of free software fame</span>
              </li>
            </ul>
            
            <a href="/register" class="block w-full bg-blue-600 text-white text-center py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
              Get Started (It's a Gift!)
            </a>
          </div>
        </div>

        {/* Transparency Notice */}
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p class="text-gray-700">
            <strong>Disclaimer:</strong> All plans are, and always will be, absolutely free. We just like making fancy tables. No hidden fees, no premium features, no secret handshake required. Just pure, unadulterated free expense splitting. You're welcome.
          </p>
        </div>
      </div>
    </StaticPageLayout>
  );
}