export const COLOR_PATTERNS = ['solid', 'dots', 'stripes', 'diagonal'] as const;

export type ColorPattern = (typeof COLOR_PATTERNS)[number];
