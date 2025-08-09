import { useEffect, useRef } from 'preact/hooks';

export function CTASection() {
  const h2Ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const initAnimations = async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      
      gsap.registerPlugin(ScrollTrigger);

      if (h2Ref.current) {
        gsap.from(h2Ref.current, { 
          scale: 0.5,
          opacity: 0,
          duration: 1,
          ease: 'back.out(1.7)',
          scrollTrigger: {
            trigger: h2Ref.current,
            start: 'top bottom-=100',
            toggleActions: 'play none none none'
          }
        });
      }
    };

    // Intentionally not awaited - useEffect cannot be async (React anti-pattern)
    initAnimations();
  }, []);

  return (
    <section class="cta-bottom py-20 bg-purple-600">
      <div class="container mx-auto px-4 text-center">
        <h2 ref={h2Ref} class="text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to Simplify Your Shared Expenses?
        </h2>
        <p class="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
          Join thousands who are already making group payments stress-free and transparent. Get started today!
        </p>
        
        <a 
          href="/register" 
          class="inline-block bg-white text-purple-600 font-semibold px-8 py-4 rounded-lg hover:bg-gray-100 transition-colors transform hover:scale-105 duration-200"
        >
          Sign Up for Free
        </a>
      </div>
    </section>
  );
}