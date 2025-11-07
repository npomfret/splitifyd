import { useEffect, useRef, useState } from 'preact/hooks';

interface FeatureCardProps {
    icon: string;
    title: string;
    description: string;
    iconColor?: 'default' | 'green';
    delay?: number;
}

export function FeatureCard({ icon, title, description, iconColor = 'default', delay = 0 }: FeatureCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setTimeout(() => setIsVisible(true), delay);
                }
            },
            { threshold: 0.1 },
        );

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }

        return () => observer.disconnect();
    }, [delay]);

    return (
        <div
            ref={cardRef}
            class={`feature-item bg-white border-primary-100 rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            data-icon-color={iconColor}
        >
            <div class={`w-16 h-16 mb-4 rounded-full flex items-center justify-center ${iconColor === 'green' ? 'bg-green-100' : 'bg-orange-100'}`}>
                <img src={icon} alt='' class='w-8 h-8' />
            </div>

            <h3 class='text-xl font-semibold text-gray-900 mb-3'>{title}</h3>
            <p class='text-gray-600 leading-relaxed'>{description}</p>
        </div>
    );
}
