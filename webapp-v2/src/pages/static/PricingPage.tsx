import { StaticPageLayout } from '../../components/StaticPageLayout';

export function PricingPage() {
  return (
    <StaticPageLayout 
      title="Pricing" 
      description="Simple, transparent pricing for Splitifyd. Split bills with friends for free."
    >
      <div class="space-y-8">
        {/* Pricing Hero */}
        <div class="text-center">
          <h2 class="text-2xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
          <p class="text-lg text-gray-600 mb-8">
            Split bills with friends and family without breaking the bank
          </p>
        </div>

        {/* Pricing Cards */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Free Plan */}
          <div class="border border-gray-200 rounded-lg p-6">
            <div class="text-center">
              <h3 class="text-xl font-bold text-gray-900 mb-2">Free</h3>
              <div class="mb-4">
                <span class="text-4xl font-bold">$0</span>
                <span class="text-gray-500">/month</span>
              </div>
              <p class="text-gray-600 mb-6">Perfect for personal use</p>
            </div>
            
            <ul class="space-y-3 mb-8">
              <li class="flex items-center">
                <svg class="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Split bills with unlimited friends</span>
              </li>
              <li class="flex items-center">
                <svg class="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Track expenses and balances</span>
              </li>
              <li class="flex items-center">
                <svg class="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Email notifications</span>
              </li>
              <li class="flex items-center">
                <svg class="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Mobile-friendly interface</span>
              </li>
            </ul>
            
            <button class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
              Get Started Free
            </button>
          </div>

          {/* Premium Plan (Future) */}
          <div class="border border-gray-200 rounded-lg p-6 opacity-60">
            <div class="text-center">
              <h3 class="text-xl font-bold text-gray-900 mb-2">Premium</h3>
              <div class="mb-4">
                <span class="text-4xl font-bold">$5</span>
                <span class="text-gray-500">/month</span>
              </div>
              <p class="text-gray-600 mb-6">Coming Soon</p>
            </div>
            
            <ul class="space-y-3 mb-8">
              <li class="flex items-center">
                <svg class="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Everything in Free</span>
              </li>
              <li class="flex items-center">
                <svg class="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Advanced reporting</span>
              </li>
              <li class="flex items-center">
                <svg class="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Receipt scanning</span>
              </li>
              <li class="flex items-center">
                <svg class="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>Priority support</span>
              </li>
            </ul>
            
            <button class="w-full bg-gray-400 text-white py-2 px-4 rounded-lg cursor-not-allowed">
              Coming Soon
            </button>
          </div>
        </div>

        {/* FAQ Section */}
        <div class="bg-gray-50 rounded-lg p-6">
          <h3 class="text-xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h3>
          
          <div class="space-y-4">
            <div>
              <h4 class="font-semibold text-gray-900 mb-2">Is Splitifyd really free?</h4>
              <p class="text-gray-600">
                Yes! All core features for splitting bills and tracking expenses are completely free. 
                We believe everyone should have access to fair bill splitting.
              </p>
            </div>
            
            <div>
              <h4 class="font-semibold text-gray-900 mb-2">How do you make money?</h4>
              <p class="text-gray-600">
                We're planning premium features for power users in the future, but our core mission 
                is to provide free, fair bill splitting for everyone.
              </p>
            </div>
            
            <div>
              <h4 class="font-semibold text-gray-900 mb-2">Can I use Splitifyd for large groups?</h4>
              <p class="text-gray-600">
                Absolutely! There's no limit on group size or the number of expenses you can track.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div class="text-center bg-blue-50 rounded-lg p-8">
          <h3 class="text-2xl font-bold text-gray-900 mb-4">Ready to Split Bills Fairly?</h3>
          <p class="text-gray-600 mb-6">
            Join thousands of users who trust Splitifyd to manage their shared expenses.
          </p>
          <a 
            href="/" 
            class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start Splitting Bills
          </a>
        </div>
      </div>
    </StaticPageLayout>
  );
}