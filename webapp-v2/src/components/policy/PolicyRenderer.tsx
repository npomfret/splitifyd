import { useMemo } from 'preact/hooks';

interface PolicyRendererProps {
    content: string;
    className?: string;
}

function escapeHtml(value: string): string {
    return (
        value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
    );
}

// Simple markdown parser for policy text
function parseMarkdown(markdown: string): string {
    const safeInput = escapeHtml(markdown);

    return (
        safeInput
            // Headers
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-gray-900 mb-2">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-gray-900 mb-4">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-gray-900 mb-6">$1</h1>')
            // Bold and italic
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            // Lists
            .replace(/^\- (.*$)/gim, '<li class="ml-4">• $1</li>')
            .replace(/(<li.*<\/li>)/gims, '<ul class="list-none space-y-1 mb-3">$1</ul>')
            // Paragraphs (convert double newlines to paragraph breaks)
            .replace(/\n\n/g, '</p><p class="text-gray-700 mb-3">')
            .replace(/^(.*)$/gim, '<p class="text-gray-700 mb-3">$1</p>')
            // Clean up empty paragraphs and fix nesting
            .replace(/<p class="text-gray-700 mb-3"><\/p>/g, '')
            .replace(/<p class="text-gray-700 mb-3">(<h[1-6])/g, '$1')
            .replace(/(<\/h[1-6]>)<\/p>/g, '$1')
            .replace(/<p class="text-gray-700 mb-3">(<ul)/g, '$1')
            .replace(/(<\/ul>)<\/p>/g, '$1')
    );
}

export function PolicyRenderer({ content, className = '' }: PolicyRendererProps) {
    const htmlContent = useMemo(() => parseMarkdown(content), [content]);

    return <div class={`prose prose-gray max-w-none space-y-6 ${className}`} dangerouslySetInnerHTML={{ __html: htmlContent }} />;
}
