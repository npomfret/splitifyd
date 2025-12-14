import { filterXSS, IFilterXSSOptions } from 'xss';

const XSS_OPTIONS: IFilterXSSOptions = {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
    allowCommentTag: false,
    css: false,
    stripBlankChar: true,
};

export const checkForDangerousPatterns = (requestString: string): { isDangerous: boolean; matchedPattern?: string; } => {
    const dangerousPatterns = [
        { pattern: /__proto__/, name: '__proto__ prototype pollution' },
        { pattern: /constructor/, name: 'constructor property access' },
        { pattern: /prototype/, name: 'prototype property access' },
        { pattern: /<script[\s>]/i, name: 'script tag' },
        { pattern: /javascript:/i, name: 'javascript: protocol' },
        { pattern: /data:text\/html/i, name: 'data:text/html protocol' },
        { pattern: /data:application\/javascript/i, name: 'data:application/javascript protocol' },
        { pattern: /data:application\/x-javascript/i, name: 'data:application/x-javascript protocol' },
        { pattern: /vbscript:/i, name: 'vbscript: protocol' },
        { pattern: /on\w+\s*=/i, name: 'event handler attribute' },
        { pattern: /expression\s*\(/i, name: 'CSS expression' },
        { pattern: /url\s*\(/i, name: 'CSS url function' },
        { pattern: /import\s*\(/i, name: 'dynamic import' },
        { pattern: /eval\s*\(/i, name: 'eval function' },
        { pattern: /Function\s*\(/i, name: 'Function constructor' },
        { pattern: /setTimeout\s*\(/i, name: 'setTimeout function' },
        { pattern: /setInterval\s*\(/i, name: 'setInterval function' },
        { pattern: /alert\s*\(/i, name: 'alert function' },
        { pattern: /confirm\s*\(/i, name: 'confirm function' },
        { pattern: /prompt\s*\(/i, name: 'prompt function' },
        { pattern: /document\./i, name: 'document object access' },
        { pattern: /window\./i, name: 'window object access' },
        { pattern: /location\./i, name: 'location object access' },
        { pattern: /history\./i, name: 'history object access' },
        { pattern: /navigator\./i, name: 'navigator object access' },
        { pattern: /new\s+XMLHttpRequest\s*\(/i, name: 'XMLHttpRequest constructor' },
        { pattern: /\bfetch\s*\(/i, name: 'fetch function call' },
        { pattern: /new\s+WebSocket\s*\(/i, name: 'WebSocket constructor' },
        { pattern: /new\s+EventSource\s*\(/i, name: 'EventSource constructor' },
        { pattern: /new\s+SharedArrayBuffer\s*\(/i, name: 'SharedArrayBuffer constructor' },
        { pattern: /new\s+Worker\s*\(/i, name: 'Worker constructor' },
        { pattern: /navigator\.serviceWorker/i, name: 'ServiceWorker access' },
        { pattern: /\.postMessage\s*\(/i, name: 'postMessage call' },
        { pattern: /innerHTML/i, name: 'innerHTML property' },
        { pattern: /outerHTML/i, name: 'outerHTML property' },
        { pattern: /insertAdjacentHTML/i, name: 'insertAdjacentHTML method' },
        { pattern: /createContextualFragment/i, name: 'createContextualFragment method' },
        { pattern: /new\s+DOMParser\s*\(/i, name: 'DOMParser constructor' },
        { pattern: /Range\.createContextualFragment/i, name: 'Range.createContextualFragment' },
        { pattern: /srcdoc\s*=/i, name: 'srcdoc attribute' },
        { pattern: /formaction\s*=/i, name: 'formaction attribute' },
        // Note: Removed script tags from this pattern to allow sanitization
        { pattern: /<\s*\/?\s*(iframe|object|embed|applet|meta|link|style|base|form|input|button|select|textarea|option|svg|math|xml|xsl)/i, name: 'dangerous HTML tag' },
        { pattern: /&#x[0-9a-f]+;/i, name: 'hexadecimal HTML entity' },
        { pattern: /&#[0-9]+;/i, name: 'decimal HTML entity' },
        { pattern: /&[a-z]+;/i, name: 'named HTML entity' },
        { pattern: /\\u[0-9a-f]{4}/i, name: 'unicode escape sequence' },
        { pattern: /\\x[0-9a-f]{2}/i, name: 'hex escape sequence' },
        { pattern: /\\[0-7]{1,3}/, name: 'octal escape sequence' },
        { pattern: /[\x00-\x1f\x7f-\x9f]/, name: 'control character' },
        { pattern: /[\u0000-\u001f\u007f-\u009f]/, name: 'unicode control character' },
        { pattern: /[\u2000-\u200f\u2028-\u202f\u205f-\u206f\ufeff]/, name: 'unicode whitespace character' },
        // Only block orphaned surrogates (unpaired), not valid emoji surrogate pairs
        { pattern: /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/, name: 'orphaned unicode surrogate' },
        { pattern: /\ufffe|\uffff/, name: 'unicode noncharacter' },
    ];

    for (const { pattern, name } of dangerousPatterns) {
        if (pattern.test(requestString)) {
            return { isDangerous: true, matchedPattern: name };
        }
    }

    return { isDangerous: false };
};

export const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') {
        return String(str);
    }

    return filterXSS(str, XSS_OPTIONS);
};

export const isDangerousProperty = (key: string): boolean => {
    return key.startsWith('_') || key.startsWith('$') || key.includes('__proto__') || key.includes('constructor') || key.includes('prototype');
};
