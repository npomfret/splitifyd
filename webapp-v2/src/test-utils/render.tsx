import { render as testingLibraryRender, RenderOptions, RenderResult } from '@testing-library/preact';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
    // Add any custom render options here
    // For example: initialState, theme, etc.
}

// Custom render function that can be extended with providers
export function render(ui: Parameters<typeof testingLibraryRender>[0], options: CustomRenderOptions = {}): RenderResult {
    const { ...renderOptions } = options;

    // For now, just use the default render
    // Later we can wrap with providers like Router, State, etc.
    return testingLibraryRender(ui, renderOptions);
}

// Re-export everything from testing-library/preact
export * from '@testing-library/preact';
