import { useEffect, useState } from 'preact/hooks';

export interface ThemeMotionConfig {
    enableParallax: boolean;
    enableMagneticHover: boolean;
    enableScrollReveal: boolean;
}

export interface ThemeConfig {
    motion: ThemeMotionConfig;
}

/**
 * Hook that reads theme configuration from CSS variables injected by the theme system.
 * The theme CSS is loaded from /api/theme.css and contains flattened branding tokens.
 *
 * Motion flags are read from CSS variables like:
 * - --motion-enable-parallax: true | false
 * - --motion-enable-magnetic-hover: true | false
 * - --motion-enable-scroll-reveal: true | false
 *
 * These flags control whether motion enhancements are enabled:
 * - Aurora theme: all motion enabled
 * - Brutalist theme: all motion disabled
 */
export function useThemeConfig(): ThemeConfig {
    const [config, setConfig] = useState<ThemeConfig>(() => {
        return {
            motion: readMotionConfig(),
        };
    });

    useEffect(() => {
        // Re-read config when theme CSS changes
        const observer = new MutationObserver(() => {
            setConfig({
                motion: readMotionConfig(),
            });
        });

        // Watch for theme stylesheet changes
        const themeLink = document.getElementById('tenant-theme-stylesheet');
        if (themeLink) {
            observer.observe(themeLink, {
                attributes: true,
                attributeFilter: ['href'],
            });
        }

        return () => observer.disconnect();
    }, []);

    return config;
}

function readMotionConfig(): ThemeMotionConfig {
    if (typeof window === 'undefined' || !document.documentElement) {
        return {
            enableParallax: false,
            enableMagneticHover: false,
            enableScrollReveal: false,
        };
    }

    const styles = getComputedStyle(document.documentElement);

    // Read CSS variables and convert string "true"/"false" to boolean
    const enableParallax = readBooleanVar(styles, '--motion-enable-parallax');
    const enableMagneticHover = readBooleanVar(styles, '--motion-enable-magnetic-hover');
    const enableScrollReveal = readBooleanVar(styles, '--motion-enable-scroll-reveal');

    return {
        enableParallax,
        enableMagneticHover,
        enableScrollReveal,
    };
}

function readBooleanVar(styles: CSSStyleDeclaration, varName: string): boolean {
    const value = styles.getPropertyValue(varName).trim();
    return value === 'true';
}
