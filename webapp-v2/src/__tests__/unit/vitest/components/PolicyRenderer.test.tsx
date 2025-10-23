import { PolicyRenderer } from '@/components/policy/PolicyRenderer';
import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';

describe('PolicyRenderer', () => {
    it('escapes HTML before applying markdown transformations', () => {
        const maliciousContent = '# Heading\n<script>alert("xss")</script>\nNormal text';

        const { container } = render(<PolicyRenderer content={maliciousContent} />);

        // Heading should render as an H1
        const heading = screen.getByRole('heading', { level: 1, name: 'Heading' });
        expect(heading).toBeInTheDocument();

        // Script tags should be escaped, not executed or present in DOM
        expect(container.innerHTML).not.toContain('<script>');
        expect(container.innerHTML).toContain('&lt;script&gt;alert("xss")&lt;/script&gt;');

        // Plain paragraphs remain readable
        expect(screen.getByText('Normal text')).toBeInTheDocument();
    });

    it('renders basic markdown elements with sanitized HTML', () => {
        const content = [
            '## Welcome',
            '',
            '- item one',
            '- item two',
            '',
            'Please review the **terms** and *conditions*.',
        ]
            .join('\n');

        const { container } = render(<PolicyRenderer content={content} />);

        // Verify heading conversion
        const heading = screen.getByRole('heading', { level: 2, name: 'Welcome' });
        expect(heading).toBeInTheDocument();

        // Verify list rendering
        const listItems = container.querySelectorAll('li');
        expect(listItems).toHaveLength(2);
        expect(listItems[0].textContent).toContain('item one');

        // Bold/italic transformations occur within sanitized content
        expect(container.querySelector('strong')?.textContent).toBe('terms');
        expect(container.querySelector('em')?.textContent).toBe('conditions');
    });
});
