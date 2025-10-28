import { COLOR_PATTERNS, USER_COLORS, UserThemeColor } from '@splitifyd/shared';
import { convertToISOString } from '@splitifyd/test-support';

export async function assignThemeColor(): Promise<UserThemeColor> {
    // Pick a random color
    const colorIndex = Math.floor(Math.random() * USER_COLORS.length);
    const color = USER_COLORS[colorIndex];

    // Pick a random pattern
    const patternIndex = Math.floor(Math.random() * COLOR_PATTERNS.length);
    const pattern = COLOR_PATTERNS[patternIndex];

    return {
        light: color.light,
        dark: color.dark,
        name: color.name,
        pattern,
        assignedAt: convertToISOString(new Date()),
        colorIndex,
    };
}
