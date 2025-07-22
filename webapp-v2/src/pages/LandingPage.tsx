import { useEffect, useRef } from 'preact/hooks';
import { SEOHead } from '../components/SEOHead';
import { HeroSection } from '../components/landing/HeroSection';
import { FeaturesGrid } from '../components/landing/FeaturesGrid';
import { CTASection } from '../components/landing/CTASection';
import '../styles/landing.css';

export function LandingPage() {
  const navbarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Dynamically import GSAP for code splitting
    const initAnimations = async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      
      gsap.registerPlugin(ScrollTrigger);

      // Navbar animation
      if (navbarRef.current) {
        gsap.from(navbarRef.current, { 
          duration: 1, 
          y: -100, 
          opacity: 0, 
          ease: 'power2.out' 
        });
      }
    };

    initAnimations();
  }, []);
  return (
    <div class="min-h-screen bg-white">
      <SEOHead 
        title="Effortless Bill Splitting - Splitifyd"
        description="Say goodbye to awkward IOUs and complex calculations. Our app makes sharing expenses with friends, family, and roommates easy, fair, and transparent. It's 100% free, with no ads and no limits."
      />
      
      {/* Header */}
      <header ref={navbarRef} class="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div class="container mx-auto px-4">
          <nav class="navbar flex items-center justify-between h-16">
            <a href="/" class="logo flex items-center">
              <img src="/images/logo.svg" alt="Splitifyd" class="h-8" />
            </a>
            <div class="nav-links flex items-center gap-6">
              <a href="/login" class="text-gray-700 hover:text-purple-600 transition-colors">
                Login
              </a>
              <a href="/register" class="nav-cta bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                Sign Up
              </a>
            </div>
          </nav>
        </div>
      </header>

      <main class="pt-16">
        <HeroSection />
        <FeaturesGrid />
        <CTASection />
        
        {/* Transparency Notice */}
        <section class="transparency-notice py-8 bg-gray-50">
          <div class="container mx-auto px-4">
            <div class="transparency-content text-center text-gray-600">
              <p>
                <strong class="text-gray-800">This is a tool for tracking expenses, not for making payments.</strong>{' '}
                To save and manage your expenses, you'll need a free account. We will never ask for sensitive financial details.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer class="bg-gray-900 text-gray-400 py-8">
        <div class="container mx-auto px-4 text-center">
          <p>&copy; 2025 Pomo Corp ltd. All rights reserved.</p>
          <p class="mt-2">
            <a href="/privacy-policy" class="hover:text-white transition-colors">Privacy Policy</a>
            {' | '}
            <a href="/terms-of-service" class="hover:text-white transition-colors">Terms of Service</a>
            {' | '}
            <a href="/cookies-policy" class="hover:text-white transition-colors">Cookie Policy</a>
            {' | '}
            <a href="/pricing" class="hover:text-white transition-colors">Pricing</a>
          </p>
        </div>
      </footer>
    </div>
  );
}