import type { SectionId } from './field-registry';
import type { TenantData } from './types';

interface SectionConfig {
    id: SectionId;
    title: string;
    description: string;
    testId: string;
    advancedOnly?: boolean;
    condition?: (formData: TenantData) => boolean;
    defaultOpen?: boolean;
    gridCols?: number;
}

const SECTION_CONFIG: SectionConfig[] = [
    {
        id: 'palette',
        title: 'Palette Colors',
        description: 'Core color palette (11 required)',
        testId: 'section-palette',
        defaultOpen: false,
    },
    {
        id: 'surfaces',
        title: 'Surface Colors',
        description: 'Background, card, and overlay colors (7 required)',
        testId: 'section-surfaces',
        advancedOnly: true,
    },
    {
        id: 'text',
        title: 'Text Colors',
        description: 'Text color hierarchy (5 required)',
        testId: 'section-text',
        advancedOnly: true,
    },
    {
        id: 'interactive',
        title: 'Interactive Colors',
        description: 'Button and link states (13 required)',
        testId: 'section-interactive',
        advancedOnly: true,
    },
    {
        id: 'border',
        title: 'Border Colors',
        description: 'Border and outline colors (5 required)',
        testId: 'section-border',
        advancedOnly: true,
    },
    {
        id: 'status',
        title: 'Status Colors',
        description: 'Success, warning, error, info states (4 required)',
        testId: 'section-status',
        advancedOnly: true,
    },
    {
        id: 'motion',
        title: 'Motion',
        description: 'Animation settings and feature flags',
        testId: 'section-motion-effects',
        advancedOnly: true,
    },
    {
        id: 'aurora',
        title: 'Aurora Gradient',
        description: '2-4 colors for the aurora animation',
        testId: 'section-aurora-gradient',
        advancedOnly: true,
        condition: (fd) => fd.enableParallax,
        defaultOpen: true,
    },
    {
        id: 'glassmorphism',
        title: 'Glassmorphism',
        description: 'Glass effects and gradient colors',
        testId: 'section-glassmorphism',
        advancedOnly: true,
    },
    {
        id: 'typography',
        title: 'Typography',
        description: 'Font families, sizes, weights, and more',
        testId: 'section-typography',
        advancedOnly: true,
    },
    {
        id: 'spacing',
        title: 'Spacing',
        description: 'Base scale and semantic spacing values',
        testId: 'section-spacing',
        advancedOnly: true,
    },
    {
        id: 'radii',
        title: 'Border Radii',
        description: 'Corner radius scale',
        testId: 'section-radii',
        advancedOnly: true,
    },
    {
        id: 'shadows',
        title: 'Shadows',
        description: 'Box shadow values',
        testId: 'section-shadows',
        advancedOnly: true,
    },
    {
        id: 'legal',
        title: 'Legal',
        description: 'Company and support contact details',
        testId: 'section-legal',
        advancedOnly: false,
        defaultOpen: false,
    },
    {
        id: 'marketing',
        title: 'Marketing Features',
        description: 'Marketing content visibility settings',
        testId: 'section-marketing',
        advancedOnly: false,
        defaultOpen: false,
    },
];

export function getSectionConfig(sectionId: SectionId): SectionConfig | undefined {
    return SECTION_CONFIG.find((s) => s.id === sectionId);
}

