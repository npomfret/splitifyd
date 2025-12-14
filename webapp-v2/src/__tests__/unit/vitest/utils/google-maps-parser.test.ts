import { isMapsUrl, parseMapsUrl } from '@/app/utils/google-maps-parser';
import { describe, expect, it } from 'vitest';

describe('isMapsUrl', () => {
    describe('Google Maps', () => {
        it('returns true for maps.google.com URLs', () => {
            expect(isMapsUrl('https://maps.google.com/maps/place/Starbucks')).toBe(true);
            expect(isMapsUrl('http://maps.google.com/maps/place/Starbucks')).toBe(true);
        });

        it('returns true for google.com/maps URLs', () => {
            expect(isMapsUrl('https://www.google.com/maps/place/Starbucks')).toBe(true);
            expect(isMapsUrl('https://google.com/maps/place/Starbucks')).toBe(true);
        });

        it('returns true for goo.gl/maps URLs', () => {
            expect(isMapsUrl('https://goo.gl/maps/abc123')).toBe(true);
        });

        it('returns true for maps.app.goo.gl URLs', () => {
            expect(isMapsUrl('https://maps.app.goo.gl/abc123')).toBe(true);
        });
    });

    describe('Apple Maps', () => {
        it('returns true for maps.apple.com URLs', () => {
            expect(isMapsUrl('https://maps.apple.com/?q=Starbucks')).toBe(true);
            expect(isMapsUrl('https://maps.apple.com/?address=123+Main+St')).toBe(true);
        });
    });

    describe('Waze', () => {
        it('returns true for waze.com/ul URLs', () => {
            expect(isMapsUrl('https://waze.com/ul?q=Starbucks')).toBe(true);
            expect(isMapsUrl('https://www.waze.com/ul?navigate=yes&to=Coffee+Shop')).toBe(true);
        });

        it('returns true for waze.com/live-map URLs', () => {
            expect(isMapsUrl('https://www.waze.com/live-map/directions?to=place.123')).toBe(true);
        });
    });

    describe('Bing Maps', () => {
        it('returns true for bing.com/maps URLs', () => {
            expect(isMapsUrl('https://www.bing.com/maps?q=Starbucks')).toBe(true);
            expect(isMapsUrl('https://bing.com/maps?where1=Coffee+Shop')).toBe(true);
        });
    });

    describe('OpenStreetMap', () => {
        it('returns true for openstreetmap.org URLs', () => {
            expect(isMapsUrl('https://www.openstreetmap.org/?query=Starbucks')).toBe(true);
            expect(isMapsUrl('https://openstreetmap.org/search?query=Coffee')).toBe(true);
        });

        it('returns true for osm.org URLs', () => {
            expect(isMapsUrl('https://osm.org/?query=Starbucks')).toBe(true);
        });
    });

    describe('HERE Maps', () => {
        it('returns true for here.com URLs', () => {
            expect(isMapsUrl('https://wego.here.com/?q=Starbucks')).toBe(true);
            expect(isMapsUrl('https://share.here.com/p/abc123')).toBe(true);
        });
    });

    describe('Baidu Maps', () => {
        it('returns true for map.baidu.com URLs', () => {
            expect(isMapsUrl('https://map.baidu.com/?query=咖啡店')).toBe(true);
            expect(isMapsUrl('https://map.baidu.com/?wd=Starbucks')).toBe(true);
        });
    });

    describe('Yandex Maps', () => {
        it('returns true for yandex.com/maps URLs', () => {
            expect(isMapsUrl('https://yandex.com/maps/?text=Starbucks')).toBe(true);
        });

        it('returns true for yandex.ru/maps URLs', () => {
            expect(isMapsUrl('https://yandex.ru/maps/?text=Кофейня')).toBe(true);
        });
    });

    describe('Kakao Maps', () => {
        it('returns true for map.kakao.com URLs', () => {
            expect(isMapsUrl('https://map.kakao.com/?q=스타벅스')).toBe(true);
        });
    });

    describe('Naver Maps', () => {
        it('returns true for map.naver.com URLs', () => {
            expect(isMapsUrl('https://map.naver.com/?query=스타벅스')).toBe(true);
        });
    });

    describe('Non-map URLs', () => {
        it('returns false for non-map URLs', () => {
            expect(isMapsUrl('https://example.com')).toBe(false);
            expect(isMapsUrl('https://google.com/search?q=coffee')).toBe(false);
        });

        it('returns false for non-URL strings', () => {
            expect(isMapsUrl('Starbucks')).toBe(false);
            expect(isMapsUrl('')).toBe(false);
            expect(isMapsUrl('just some text')).toBe(false);
        });
    });
});

describe('parseMapsUrl', () => {
    describe('Google Maps', () => {
        it('extracts place name from /maps/place/ URL', () => {
            expect(parseMapsUrl('https://www.google.com/maps/place/Starbucks/@40.7128,-74.0060')).toBe('Starbucks');
        });

        it('decodes URL-encoded place names', () => {
            expect(parseMapsUrl('https://www.google.com/maps/place/The+Coffee+Shop/@40.7128')).toBe('The Coffee Shop');
        });

        it('handles special characters', () => {
            expect(parseMapsUrl('https://www.google.com/maps/place/Caf%C3%A9+de+Flore/@48.8566')).toBe('Café de Flore');
        });

        it('extracts from /maps/search/ URL', () => {
            expect(parseMapsUrl('https://www.google.com/maps/search/coffee+shop/@40.7128')).toBe('coffee shop');
        });

        it('extracts from ?q= parameter', () => {
            expect(parseMapsUrl('https://maps.google.com/?q=Starbucks+NYC')).toBe('Starbucks NYC');
        });

        it('removes trailing coordinates', () => {
            const result = parseMapsUrl('https://www.google.com/maps/place/Restaurant+Name/@40.7128,-74.0060,17z');
            expect(result).toBe('Restaurant Name');
            expect(result).not.toContain('@');
        });
    });

    describe('Apple Maps', () => {
        it('extracts from ?q= parameter', () => {
            expect(parseMapsUrl('https://maps.apple.com/?q=Starbucks')).toBe('Starbucks');
        });

        it('extracts from ?address= parameter', () => {
            expect(parseMapsUrl('https://maps.apple.com/?address=123+Main+Street')).toBe('123 Main Street');
        });

        it('extracts from ?daddr= parameter (destination)', () => {
            expect(parseMapsUrl('https://maps.apple.com/?daddr=Coffee+Shop')).toBe('Coffee Shop');
        });
    });

    describe('Waze', () => {
        it('extracts from ?q= parameter', () => {
            expect(parseMapsUrl('https://waze.com/ul?q=Starbucks')).toBe('Starbucks');
        });

        it('extracts from ?to= parameter', () => {
            expect(parseMapsUrl('https://www.waze.com/ul?navigate=yes&to=Coffee+Shop')).toBe('Coffee Shop');
        });
    });

    describe('Bing Maps', () => {
        it('extracts from ?q= parameter', () => {
            expect(parseMapsUrl('https://www.bing.com/maps?q=Starbucks')).toBe('Starbucks');
        });

        it('extracts from ?where1= parameter', () => {
            expect(parseMapsUrl('https://bing.com/maps?where1=Coffee+Shop')).toBe('Coffee Shop');
        });
    });

    describe('OpenStreetMap', () => {
        it('extracts from ?query= parameter', () => {
            expect(parseMapsUrl('https://www.openstreetmap.org/?query=Starbucks')).toBe('Starbucks');
        });
    });

    describe('HERE Maps', () => {
        it('extracts from ?q= parameter', () => {
            expect(parseMapsUrl('https://wego.here.com/?q=Starbucks')).toBe('Starbucks');
        });

        it('extracts from /search/ path', () => {
            expect(parseMapsUrl('https://wego.here.com/search/Coffee+Shop')).toBe('Coffee Shop');
        });
    });

    describe('Baidu Maps', () => {
        it('extracts from ?query= parameter', () => {
            expect(parseMapsUrl('https://map.baidu.com/?query=Starbucks')).toBe('Starbucks');
        });

        it('extracts from ?wd= parameter', () => {
            expect(parseMapsUrl('https://map.baidu.com/?wd=Coffee+Shop')).toBe('Coffee Shop');
        });
    });

    describe('Yandex Maps', () => {
        it('extracts from ?text= parameter', () => {
            expect(parseMapsUrl('https://yandex.com/maps/?text=Starbucks')).toBe('Starbucks');
        });

        it('extracts from ?text= on Russian domain', () => {
            expect(parseMapsUrl('https://yandex.ru/maps/?text=Coffee+Shop')).toBe('Coffee Shop');
        });
    });

    describe('Kakao Maps', () => {
        it('extracts from ?q= parameter', () => {
            expect(parseMapsUrl('https://map.kakao.com/?q=Starbucks')).toBe('Starbucks');
        });

        it('extracts from /search/ path', () => {
            expect(parseMapsUrl('https://map.kakao.com/search/Coffee+Shop')).toBe('Coffee Shop');
        });
    });

    describe('Naver Maps', () => {
        it('extracts from ?query= parameter', () => {
            expect(parseMapsUrl('https://map.naver.com/?query=Starbucks')).toBe('Starbucks');
        });

        it('extracts from /search/ path', () => {
            expect(parseMapsUrl('https://map.naver.com/search/Coffee+Shop')).toBe('Coffee Shop');
        });
    });

    describe('Edge cases', () => {
        it('returns null for non-map URLs', () => {
            expect(parseMapsUrl('https://example.com')).toBeNull();
        });

        it('returns null for map URLs without extractable place name', () => {
            expect(parseMapsUrl('https://www.google.com/maps/@40.7128,-74.0060,15z')).toBeNull();
        });

        it('returns null for empty string', () => {
            expect(parseMapsUrl('')).toBeNull();
        });

        it('returns null for non-URL strings', () => {
            expect(parseMapsUrl('just a place name')).toBeNull();
        });
    });
});

