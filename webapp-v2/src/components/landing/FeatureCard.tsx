import { useMagneticHover } from '@/app/hooks/useMagneticHover';
import { useScrollReveal } from '@/app/hooks/useScrollReveal';

interface FeatureCardProps {
    icon: string;
    title: string;
    description: string;
    iconColor?: 'default' | 'green';
    delay?: number;
}

export function FeatureCard({ icon, title, description, iconColor = 'default', delay = 0 }: FeatureCardProps) {
    // Use our scroll reveal hook (automatically disabled on Brutalist theme)
    const { ref: scrollRef, isVisible } = useScrollReveal({ threshold: 0.1, delay });

    // Use magnetic hover hook (automatically disabled on Brutalist theme)
    const magneticRef = useMagneticHover<HTMLDivElement>({ strength: 0.2 });

    // Combine refs: we need both scroll reveal tracking and magnetic hover
    const combinedRef = (el: HTMLDivElement | null) => {
        if (scrollRef && 'current' in scrollRef) {
            (scrollRef as any).current = el;
        }
        if (magneticRef && 'current' in magneticRef) {
            (magneticRef as any).current = el;
        }
    };

    return (
        <div
            ref={combinedRef}
            class={`feature-item bg-surface-base border border-border-default rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 fade-up ${
                isVisible ? 'fade-up-visible' : ''
            }`}
            data-icon-color={iconColor}
        >
            <div class={`w-16 h-16 mb-4 rounded-full flex items-center justify-center ${iconColor === 'green' ? 'bg-interactive-accent' : 'bg-interactive-secondary'}`}>
                <img src={icon} alt='' class='w-8 h-8' />
            </div>

            <h3 class='text-xl font-semibold text-text-primary mb-3'>{title}</h3>
            <p class='text-text-muted leading-relaxed'>{description}</p>
        </div>
    );
}
