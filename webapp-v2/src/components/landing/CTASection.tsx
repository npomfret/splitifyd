import { useNavigation } from '@/hooks/useNavigation';
import { useEffect, useRef } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function CTASection() {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const h2Ref = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        const initAnimations = async () => {
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
                        toggleActions: 'play none none none',
                    },
                });
            }
        };

        // Intentionally not awaited - useEffect cannot be async (React anti-pattern)
        initAnimations();
    }, []);

    return (
        <section class='cta-bottom py-20 bg-interactive-primary'>
            <div class='container mx-auto px-4 text-center'>
                <h2 ref={h2Ref} class='text-3xl md:text-4xl font-bold text-interactive-primary-foreground mb-4'>
                    {t('landing.cta.title')}
                </h2>
                <p class='text-xl text-interactive-primary-foreground opacity-90 mb-8 max-w-2xl mx-auto'>{t('landing.cta.subtitle')}</p>

                <button
                    onClick={() => navigation.goToRegister()}
                    class='inline-block bg-surface-base text-interactive-primary font-semibold px-8 py-4 rounded-lg hover:opacity-90 transition-opacity transform hover:scale-105 duration-200'
                >
                    {t('landing.cta.signUpButton')}
                </button>
            </div>
        </section>
    );
}
