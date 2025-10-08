import type { ColorPattern, UserThemeColor } from '@splitifyd/shared';

/**
 * Builder for UserThemeColor objects used in test data
 * Creates theme color objects for testing group member themes and user color assignments
 */
export class ThemeBuilder {
    private theme: UserThemeColor = {
        light: '#3B82F6',
        dark: '#1E40AF',
        name: 'blue',
        pattern: 'solid',
        assignedAt: new Date().toISOString(),
        colorIndex: 0,
    };

    constructor() {}

    /**
     * Set the light color value
     */
    withLight(light: string): this {
        this.theme.light = light;
        return this;
    }

    /**
     * Set the dark color value
     */
    withDark(dark: string): this {
        this.theme.dark = dark;
        return this;
    }

    /**
     * Set the color name
     */
    withName(name: string): this {
        this.theme.name = name;
        return this;
    }

    /**
     * Set the color pattern
     */
    withPattern(pattern: ColorPattern): this {
        this.theme.pattern = pattern;
        return this;
    }

    /**
     * Set the assignment timestamp
     */
    withAssignedAt(assignedAt: string): this {
        this.theme.assignedAt = assignedAt;
        return this;
    }

    /**
     * Set the color index
     */
    withColorIndex(colorIndex: number): this {
        this.theme.colorIndex = colorIndex;
        return this;
    }

    /**
     * Create a red theme with predefined colors
     */
    static red(): ThemeBuilder {
        return new ThemeBuilder().withLight('#FF6B6B').withDark('#FF6B6B').withName('red').withColorIndex(0);
    }

    /**
     * Create a blue theme with predefined colors
     */
    static blue(): ThemeBuilder {
        return new ThemeBuilder().withLight('#0000FF').withDark('#0000FF').withName('blue').withColorIndex(2);
    }

    /**
     * Build the final UserThemeColor object
     */
    build(): UserThemeColor {
        return { ...this.theme };
    }
}
