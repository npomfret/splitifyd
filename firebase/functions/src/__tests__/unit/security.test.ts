import { checkForDangerousPatterns, isDangerousProperty, sanitizeString } from '../../utils/security';

describe('Security Utils', () => {
    describe('sanitizeString', () => {
        it('should sanitize basic XSS attempts', () => {
            expect(sanitizeString('<script>alert("xss")</script>')).toBe('');
            expect(sanitizeString('javascript:alert("xss")')).toBe('javascript:alert("xss")');
            expect(sanitizeString('<img src="x" onerror="alert(1)">')).toBe('');
        });

        it('should handle HTML entities', () => {
            expect(sanitizeString('&lt;script&gt;')).toBe('&lt;script&gt;');
            expect(sanitizeString('&#x3c;script&#x3e;')).toBe('&#x3c;script&#x3e;');
        });

        it('should handle unicode and encoding attacks', () => {
            expect(sanitizeString('\u003cscript\u003e')).toBe('[removed]');
            expect(sanitizeString('\x3cscript\x3e')).toBe('[removed]');
        });

        it('should preserve safe content', () => {
            expect(sanitizeString('Hello world')).toBe('Hello world');
            expect(sanitizeString('user@example.com')).toBe('user@example.com');
            expect(sanitizeString('Price: $29.99')).toBe('Price: $29.99');
        });

        it('should handle non-string inputs', () => {
            expect(sanitizeString(123 as any)).toBe('123');
            expect(sanitizeString(null as any)).toBe('null');
            expect(sanitizeString(undefined as any)).toBe('undefined');
        });
    });

    describe('checkForDangerousPatterns', () => {
        it('should detect basic XSS patterns', () => {
            expect(checkForDangerousPatterns('<script>alert(1)</script>').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('javascript:alert(1)').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('<img onerror="alert(1)">').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('vbscript:msgbox(1)').isDangerous).toBe(true);
        });

        it('should detect prototype pollution attempts', () => {
            expect(checkForDangerousPatterns('__proto__').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('constructor').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('prototype').isDangerous).toBe(true);
        });

        it('should detect DOM manipulation attempts', () => {
            expect(checkForDangerousPatterns('document.cookie').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('window.location').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('innerHTML').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('outerHTML').isDangerous).toBe(true);
        });

        it('should detect function execution attempts', () => {
            expect(checkForDangerousPatterns('eval("code")').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('Function("code")').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('setTimeout("code", 1000)').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('setInterval("code", 1000)').isDangerous).toBe(true);
        });

        it('should detect dangerous HTML elements', () => {
            expect(checkForDangerousPatterns('<iframe src="evil.com">').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('<object data="evil.swf">').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('<embed src="evil.swf">').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('<svg onload="alert(1)">').isDangerous).toBe(true);
        });

        it('should detect encoding attempts', () => {
            expect(checkForDangerousPatterns('&#x3c;script&#x3e;').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('&#60;script&#62;').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('&lt;script&gt;').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('\\u003cscript\\u003e').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('\\x3cscript\\x3e').isDangerous).toBe(true);
        });

        it('should detect control characters', () => {
            expect(checkForDangerousPatterns('\u0000').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('\u001f').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('\u007f').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('\u2028').isDangerous).toBe(true);
            expect(checkForDangerousPatterns('\ufeff').isDangerous).toBe(true);
        });

        it('should allow safe content', () => {
            expect(checkForDangerousPatterns('Hello world').isDangerous).toBe(false);
            expect(checkForDangerousPatterns('user@example.com').isDangerous).toBe(false);
            expect(checkForDangerousPatterns('Price: $29.99').isDangerous).toBe(false);
            expect(checkForDangerousPatterns('{"name": "John", "age": 30}').isDangerous).toBe(false);
        });

        it('should allow emoji characters', () => {
            // Emojis use surrogate pairs in UTF-16 but are legitimate content
            expect(checkForDangerousPatterns('👍').isDangerous).toBe(false);
            expect(checkForDangerousPatterns('❤️').isDangerous).toBe(false);
            expect(checkForDangerousPatterns('😂').isDangerous).toBe(false);
            expect(checkForDangerousPatterns('🎉').isDangerous).toBe(false);
            expect(checkForDangerousPatterns('{"emoji":"👍"}').isDangerous).toBe(false);
        });
    });

    describe('isDangerousProperty', () => {
        it('should detect dangerous property names', () => {
            expect(isDangerousProperty('__proto__')).toBe(true);
            expect(isDangerousProperty('constructor')).toBe(true);
            expect(isDangerousProperty('prototype')).toBe(true);
            expect(isDangerousProperty('_secret')).toBe(true);
            expect(isDangerousProperty('$private')).toBe(true);
        });

        it('should allow safe property names', () => {
            expect(isDangerousProperty('name')).toBe(false);
            expect(isDangerousProperty('email')).toBe(false);
            expect(isDangerousProperty('uid')).toBe(false);
            expect(isDangerousProperty('createdAt')).toBe(false);
        });
    });

    describe('Integration scenarios', () => {
        it('should handle complex nested attack vectors', () => {
            const complexPayload = JSON.stringify({
                name: '<script>alert("xss")</script>',
                email: 'user@example.com',
                bio: 'javascript:void(0)',
                __proto__: { polluted: true },
            });

            expect(checkForDangerousPatterns(complexPayload).isDangerous).toBe(true);
        });

        it('should sanitize document-like structures', () => {
            const userInput = {
                title: '<script>alert("title")</script>',
                content: 'Safe content',
                metadata: {
                    author: '<img onerror="alert(1)" src="x">',
                    tags: ['safe', 'javascript:alert(1)'],
                },
            };

            const sanitizedTitle = sanitizeString(userInput.title);
            const sanitizedAuthor = sanitizeString(userInput.metadata.author);
            const sanitizedTag = sanitizeString(userInput.metadata.tags[1]);

            expect(sanitizedTitle).not.toContain('<script>');
            expect(sanitizedAuthor).not.toContain('onerror=');
            expect(sanitizedTag).toBe('javascript:alert(1)');
        });
    });
});
