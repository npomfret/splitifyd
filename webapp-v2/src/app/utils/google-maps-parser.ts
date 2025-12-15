/**
 * Utility for parsing map service URLs to extract place names.
 * Supports Google Maps, Apple Maps, Waze, Bing Maps, OpenStreetMap,
 * HERE Maps, Baidu, Yandex, Kakao, and Naver Maps.
 */

/**
 * Supported map services and their URL patterns
 */
const MAP_SERVICES = {
    // Google Maps - most common
    google: [
        'maps.google.',
        'google.com/maps',
        'google.co.', // needs /maps check
        'goo.gl/maps',
        'maps.app.goo.gl',
    ],
    // Apple Maps
    apple: [
        'maps.apple.com',
    ],
    // Waze
    waze: [
        'waze.com/ul',
        'waze.com/live-map',
        'waze.com/location',
    ],
    // Bing Maps
    bing: [
        'bing.com/maps',
    ],
    // OpenStreetMap
    osm: [
        'openstreetmap.org',
        'osm.org',
    ],
    // HERE Maps
    here: [
        'here.com',
        'wego.here.com',
        'share.here.com',
    ],
    // Baidu Maps (China)
    baidu: [
        'map.baidu.com',
    ],
    // Yandex Maps (Russia)
    yandex: [
        'yandex.com/maps',
        'yandex.ru/maps',
    ],
    // Kakao Maps (South Korea)
    kakao: [
        'map.kakao.com',
    ],
    // Naver Maps (South Korea)
    naver: [
        'map.naver.com',
    ],
} as const;

type MapService = keyof typeof MAP_SERVICES;

/**
 * Detects which map service a URL belongs to.
 * Returns null if not a recognized map URL.
 */
function detectMapService(input: string): MapService | null {
    const trimmed = input.trim().toLowerCase();

    // Google needs special handling for country domains
    if (
        trimmed.includes('maps.google.')
        || trimmed.includes('google.com/maps')
        || (trimmed.includes('google.co.') && trimmed.includes('/maps'))
        || trimmed.includes('goo.gl/maps')
        || trimmed.includes('maps.app.goo.gl')
    ) {
        return 'google';
    }

    // Check other services
    for (const [service, patterns] of Object.entries(MAP_SERVICES)) {
        if (service === 'google') continue; // Already handled
        for (const pattern of patterns) {
            if (trimmed.includes(pattern)) {
                return service as MapService;
            }
        }
    }

    return null;
}

/**
 * Checks if the input string is a recognized map service URL.
 * Supports Google Maps, Apple Maps, Waze, Bing, OpenStreetMap, HERE, Baidu, Yandex, Kakao, and Naver Maps.
 */
export function isMapsUrl(input: string): boolean {
    if (!input || typeof input !== 'string') {
        return false;
    }
    return detectMapService(input) !== null;
}

/**
 * Parses a map service URL and extracts the place name.
 * Returns null if the input is not a valid map URL or if no place name can be extracted.
 */
export function parseMapsUrl(input: string): string | null {
    if (!input || typeof input !== 'string') {
        return null;
    }

    const trimmed = input.trim();
    const service = detectMapService(trimmed);

    if (!service) {
        return null;
    }

    switch (service) {
        case 'google':
            return parseGoogleUrl(trimmed);
        case 'apple':
            return parseAppleUrl(trimmed);
        case 'waze':
            return parseWazeUrl(trimmed);
        case 'bing':
            return parseBingUrl(trimmed);
        case 'osm':
            return parseOsmUrl(trimmed);
        case 'here':
            return parseHereUrl(trimmed);
        case 'baidu':
            return parseBaiduUrl(trimmed);
        case 'yandex':
            return parseYandexUrl(trimmed);
        case 'kakao':
            return parseKakaoUrl(trimmed);
        case 'naver':
            return parseNaverUrl(trimmed);
        default:
            return null;
    }
}

/**
 * Parse Google Maps URLs
 * Formats: /maps/place/NAME/@..., /maps/search/NAME, ?q=NAME
 */
function parseGoogleUrl(url: string): string | null {
    // Try /maps/place/NAME/ pattern
    const placeMatch = url.match(/\/maps\/place\/([^/@]+)/i);
    if (placeMatch?.[1]) {
        return decodeAndCleanPlaceName(placeMatch[1]);
    }

    // Try /maps/search/NAME pattern
    const searchMatch = url.match(/\/maps\/search\/([^/@?]+)/i);
    if (searchMatch?.[1]) {
        return decodeAndCleanPlaceName(searchMatch[1]);
    }

    // Try ?q=NAME query parameter
    return extractQueryParam(url, 'q');
}

/**
 * Parse Apple Maps URLs
 * Formats: ?q=NAME, ?address=NAME, ?daddr=NAME (destination), ?saddr=NAME (source)
 */
function parseAppleUrl(url: string): string | null {
    // Try various query parameters Apple Maps uses
    return extractQueryParam(url, 'q')
        || extractQueryParam(url, 'address')
        || extractQueryParam(url, 'daddr')
        || extractQueryParam(url, 'saddr');
}

/**
 * Parse Waze URLs
 * Formats: ?q=NAME, ?to=NAME, /ul?q=NAME, /ul?navigate=yes&to=NAME
 */
function parseWazeUrl(url: string): string | null {
    return extractQueryParam(url, 'q')
        || extractQueryParam(url, 'to')
        || extractQueryParam(url, 'place');
}

/**
 * Parse Bing Maps URLs
 * Formats: ?q=NAME, ?where1=NAME, /search?q=NAME
 */
function parseBingUrl(url: string): string | null {
    return extractQueryParam(url, 'q')
        || extractQueryParam(url, 'where1');
}

/**
 * Parse OpenStreetMap URLs
 * Formats: ?query=NAME, /search?query=NAME, /way/NAME, /node/NAME
 * Note: OSM URLs often contain coordinates rather than place names
 */
function parseOsmUrl(url: string): string | null {
    // Try query parameter
    const query = extractQueryParam(url, 'query');
    if (query) return query;

    // Try to extract from search path
    const searchMatch = url.match(/\/search[/?].*?query=([^&]+)/i);
    if (searchMatch?.[1]) {
        return decodeAndCleanPlaceName(searchMatch[1]);
    }

    return null;
}

/**
 * Parse HERE Maps URLs
 * Formats: ?q=NAME, /search/NAME, share.here.com contains encoded data
 */
function parseHereUrl(url: string): string | null {
    // Try query parameter
    const query = extractQueryParam(url, 'q');
    if (query) return query;

    // Try /search/NAME pattern
    const searchMatch = url.match(/\/search\/([^/?]+)/i);
    if (searchMatch?.[1]) {
        return decodeAndCleanPlaceName(searchMatch[1]);
    }

    // HERE share URLs have encoded place names in path sometimes
    // e.g., share.here.com/p/s-Yz1jb2ZmZWU...
    // These are base64-ish encoded, hard to decode reliably
    return null;
}

/**
 * Parse Baidu Maps URLs
 * Formats: ?query=NAME, ?word=NAME, ?wd=NAME
 */
function parseBaiduUrl(url: string): string | null {
    return extractQueryParam(url, 'query')
        || extractQueryParam(url, 'word')
        || extractQueryParam(url, 'wd');
}

/**
 * Parse Yandex Maps URLs
 * Formats: ?text=NAME, /search/NAME
 */
function parseYandexUrl(url: string): string | null {
    // Try text parameter
    const text = extractQueryParam(url, 'text');
    if (text) return text;

    // Try /search/NAME pattern
    const searchMatch = url.match(/\/maps\/[^/]*\/search\/([^/?]+)/i);
    if (searchMatch?.[1]) {
        return decodeAndCleanPlaceName(searchMatch[1]);
    }

    return null;
}

/**
 * Parse Kakao Maps URLs
 * Formats: ?q=NAME, /search/NAME
 */
function parseKakaoUrl(url: string): string | null {
    // Try query parameter
    const query = extractQueryParam(url, 'q');
    if (query) return query;

    // Try search path
    const searchMatch = url.match(/\/search\/([^/?]+)/i);
    if (searchMatch?.[1]) {
        return decodeAndCleanPlaceName(searchMatch[1]);
    }

    return null;
}

/**
 * Parse Naver Maps URLs
 * Formats: ?query=NAME, /search/NAME
 */
function parseNaverUrl(url: string): string | null {
    // Try query parameter
    const query = extractQueryParam(url, 'query');
    if (query) return query;

    // Try search path
    const searchMatch = url.match(/\/search\/([^/?]+)/i);
    if (searchMatch?.[1]) {
        return decodeAndCleanPlaceName(searchMatch[1]);
    }

    return null;
}

/**
 * Extract a query parameter value from a URL.
 */
function extractQueryParam(url: string, param: string): string | null {
    try {
        const urlObj = new URL(url);
        const value = urlObj.searchParams.get(param);
        if (value) {
            return decodeAndCleanPlaceName(value);
        }
    } catch {
        // URL parsing failed, try regex fallback
        const regex = new RegExp(`[?&]${param}=([^&]+)`, 'i');
        const match = url.match(regex);
        if (match?.[1]) {
            return decodeAndCleanPlaceName(match[1]);
        }
    }
    return null;
}

/**
 * Decodes URL-encoded place names and cleans up formatting.
 * Handles plus signs, percent encoding, and removes coordinates if present.
 */
function decodeAndCleanPlaceName(encoded: string): string | null {
    try {
        // Replace plus signs with spaces first
        let decoded = encoded.replace(/\+/g, ' ');

        // Decode percent-encoded characters
        decoded = decodeURIComponent(decoded);

        // Remove any trailing coordinates (e.g., "@40.123,-73.456")
        decoded = decoded.replace(/@[\d.,-]+.*$/, '');

        // Clean up extra whitespace
        decoded = decoded.trim().replace(/\s+/g, ' ');

        return decoded || null;
    } catch {
        // If decoding fails, return the original with basic cleanup
        return encoded.replace(/\+/g, ' ').trim() || null;
    }
}
