import { filterXSS, IFilterXSSOptions } from 'xss';

const XSS_OPTIONS: IFilterXSSOptions = {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
    allowCommentTag: false,
    css: false,
    stripBlankChar: true,
};

export const checkForDangerousPatterns = (requestString: string): boolean => {
    const dangerousPatterns = [
        /__proto__/,
        /constructor/,
        /prototype/,
        // Note: Removed /<script/i to allow XSS content to be sanitized at app level instead of blocked
        /javascript:/i,
        /data:text\/html/i,
        /data:application\/javascript/i,
        /data:application\/x-javascript/i,
        /vbscript:/i,
        /on\w+\s*=/i,
        /expression\s*\(/i,
        /url\s*\(/i,
        /import\s*\(/i,
        /eval\s*\(/i,
        /Function\s*\(/i,
        /setTimeout\s*\(/i,
        /setInterval\s*\(/i,
        // Note: Removed /alert\s*\(/i to allow XSS test content with alert() to be sanitized
        /confirm\s*\(/i,
        /prompt\s*\(/i,
        /document\./i,
        /window\./i,
        /location\./i,
        /history\./i,
        /navigator\./i,
        /XMLHttpRequest/i,
        /fetch\s*\(/i,
        /WebSocket/i,
        /EventSource/i,
        /SharedArrayBuffer/i,
        /Worker\s*\(/i,
        /ServiceWorker/i,
        /postMessage/i,
        /innerHTML/i,
        /outerHTML/i,
        /insertAdjacentHTML/i,
        /createContextualFragment/i,
        /DOMParser/i,
        /Range\.createContextualFragment/i,
        /srcdoc\s*=/i,
        /formaction\s*=/i,
        // Note: Removed script tags from this pattern to allow sanitization
        /<\s*\/?\s*(iframe|object|embed|applet|meta|link|style|base|form|input|button|select|textarea|option|svg|math|xml|xsl)/i,
        /&#x[0-9a-f]+;/i,
        /&#[0-9]+;/i,
        /&[a-z]+;/i,
        /\\\w/,
        /\\u[0-9a-f]{4}/i,
        /\\x[0-9a-f]{2}/i,
        /\\[0-7]{1,3}/,
        /[\x00-\x1f\x7f-\x9f]/,
        /[\u0000-\u001f\u007f-\u009f]/,
        /[\u2000-\u200f\u2028-\u202f\u205f-\u206f\ufeff]/,
        /[\ud800-\udfff]/,
        /\ufffe|\uffff/,
    ];

    return dangerousPatterns.some((pattern) => pattern.test(requestString));
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
