import { useEffect, useRef } from 'preact/hooks';
import { Globe } from './Globe';

export function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const pRef = useRef<HTMLParagraphElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const initAnimations = async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      
      gsap.registerPlugin(ScrollTrigger);

      // Hero animations
      if (h1Ref.current) {
        gsap.from(h1Ref.current, { 
          duration: 1.5, 
          y: -50, 
          opacity: 0, 
          ease: 'elastic.out(1, 0.5)', 
          delay: 0.5 
        });
      }

      if (pRef.current) {
        gsap.from(pRef.current, { 
          duration: 1.5, 
          y: 50, 
          opacity: 0, 
          delay: 1, 
          ease: 'power2.out' 
        });
      }

      // Parallax hero image
      if (imgRef.current) {
        gsap.to(imgRef.current, {
          yPercent: 50,
          ease: 'none',
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });
      }
    };

    initAnimations();
  }, []);

  return (
    <section ref={heroRef} class="hero relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Globe Background */}
      <div class="absolute inset-0 z-0">
        <Globe />
      </div>
      
      {/* Hero Content */}
      <div class="hero-content container mx-auto px-4 relative z-10 text-center">
        <h1 ref={h1Ref} class="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Effortless Bill Splitting,<br />
          Simplified & Smart.
        </h1>
        
        <p ref={pRef} class="text-lg md:text-xl text-gray-700 max-w-3xl mx-auto mb-12">
          Say goodbye to awkward IOUs and complex calculations. Our app makes sharing expenses 
          with friends, family, and roommates easy, fair, and transparent.{' '}
          <strong class="text-gray-900">It's 100% free, with no ads and no limits.</strong>{' '}
          Focus on what matters, not on the math.
        </p>
        
        <img 
          ref={imgRef}
          src="https://placehold.co/800x450/6A0DAD/FFFFFF/png?text=Your+App+Screenshot+Here" 
          alt="Splitifyd App Screenshot" 
          class="hero-image mx-auto rounded-2xl shadow-2xl max-w-full"
          loading="lazy"
        />
      </div>
    </section>
  );
}