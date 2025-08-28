export interface UserColorPalette {
    light: string;
    dark: string;
    name: string;
    contrastRatio: number;
}

export const USER_COLORS: UserColorPalette[] = [
    { light: '#1f5582', dark: '#4a9eff', name: 'Ocean Blue', contrastRatio: 4.6 },
    { light: '#0f5132', dark: '#25d366', name: 'Forest Green', contrastRatio: 4.8 },
    { light: '#842029', dark: '#f87171', name: 'Crimson Red', contrastRatio: 4.5 },
    { light: '#59359a', dark: '#a855f7', name: 'Royal Purple', contrastRatio: 4.7 },
    { light: '#b45309', dark: '#fbbf24', name: 'Amber Yellow', contrastRatio: 4.6 },
    { light: '#0f766e', dark: '#2dd4bf', name: 'Teal', contrastRatio: 4.9 },
    { light: '#c2410c', dark: '#fb923c', name: 'Tangerine', contrastRatio: 4.5 },
    { light: '#7c2d12', dark: '#fca5a5', name: 'Rose', contrastRatio: 4.8 },
    { light: '#365314', dark: '#84cc16', name: 'Lime', contrastRatio: 4.6 },
    { light: '#075985', dark: '#0ea5e9', name: 'Sky Blue', contrastRatio: 4.7 },
    { light: '#701a75', dark: '#d946ef', name: 'Fuchsia', contrastRatio: 4.5 },
    { light: '#92400e', dark: '#f59e0b', name: 'Gold', contrastRatio: 4.8 },
    { light: '#164e63', dark: '#06b6d4', name: 'Cyan', contrastRatio: 4.6 },
    { light: '#7c3aed', dark: '#8b5cf6', name: 'Violet', contrastRatio: 4.5 },
    { light: '#0c4a6e', dark: '#0284c7', name: 'Blue', contrastRatio: 4.9 },
    { light: '#991b1b', dark: '#ef4444', name: 'Red', contrastRatio: 4.7 },
];

export const COLOR_PATTERNS = ['solid', 'dots', 'stripes', 'diagonal'] as const;

export type ColorPattern = (typeof COLOR_PATTERNS)[number];

export interface UserColor {
    light: string;
    dark: string;
    name: string;
    contrastRatio: number;
}
