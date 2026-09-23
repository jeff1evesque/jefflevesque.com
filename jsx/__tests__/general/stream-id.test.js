/**
 * stream-id.test.js: the one id each stream goes by, and every name that leads
 * to it.
 *
 * A stream used to go by several names -- 'StockMarket' in the site's urls,
 * 'stockmarket' in its requests, 'stock-market' in one page's own state -- and
 * each page converted between them itself, two of them wrongly. What is held
 * here is the list the site uses now, and that every name a stream has gone by
 * still finds it: those names are in bookmarks and in links other people have
 * shared.
 */

import {
    STOCK_MARKET,
    STOCK_SPLIT,
    BLS,
    SEC,
    US_NATIONAL_WEATHER,
    STREAMS,
    canonicalStream,
} from '../../import/general/stream-id.js';

describe('the ids', () => {
    it('are the five the performance api answers to', () => {
        expect([STOCK_MARKET, STOCK_SPLIT, BLS, SEC, US_NATIONAL_WEATHER])
            .toEqual(['stock-market', 'stock-split', 'bls', 'sec', 'us-national-weather']);
    });

    it('are listed in the order the /stream and /data listings draw them', () => {
        expect(STREAMS).toEqual(['stock-market', 'stock-split', 'bls', 'sec', 'us-national-weather']);
    });

    it('are lower-case words joined by hyphens, which is what the urls and the api take', () => {
        //
        // the documented archive id is 'stream/yyyy', matched by '^[a-z-]+/...',
        // and a url segment needs no encoding when it is only these characters.
        //
        STREAMS.forEach((id) => {
            expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
        });
    });
});

describe('canonicalStream', () => {
    it.each(STREAMS)('takes the id %s as it is', (id) => {
        expect(canonicalStream(id)).toBe(id);
    });

    it.each([
        ['StockMarket', 'stock-market'],
        ['stockmarket', 'stock-market'],
        ['STOCKMARKET', 'stock-market'],
        ['Stock-Market', 'stock-market'],
        ['StockMarketStockSplit', 'stock-split'],
        ['stockmarketstocksplit', 'stock-split'],
        ['StockSplit', 'stock-split'],
        ['stocksplit', 'stock-split'],
        ['USNationalWeather', 'us-national-weather'],
        ['usnationalweather', 'us-national-weather'],
        ['BLS', 'bls'],
        ['SEC', 'sec'],
    ])('finds %s, a name the stream went by, as %s', (name, id) => {
        //
        // 'StockSplit' and 'stocksplit' too: the trigger page matched on
        // 'stocksplit', and its test routed to '/stream/StockSplit/trigger'.
        //
        expect(canonicalStream(name)).toBe(id);
    });

    it('keeps the two stock streams apart', () => {
        //
        // the whole name is matched, not a prefix: 'stockmarketstocksplit' is not
        // a 'stockmarket' that picked up a suffix.
        //
        expect(canonicalStream('stockmarketstocksplit')).not.toBe(STOCK_MARKET);
        expect(canonicalStream('stock')).toBeNull();
        expect(canonicalStream('stockmarketstock')).toBeNull();
    });

    it.each(['no-such-stream', '', 'us-weather-alert', 'weather', 'market'])(
        'finds no stream for %p',
        (name) => {
            //
            // 'us-weather-alert' is the weather stream's DATASET, which is the
            // datalake's name for its data and not a name the stream went by.
            //
            expect(canonicalStream(name)).toBeNull();
        }
    );

    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
        'finds no stream for %p, which an object lookup would have',
        (name) => {
            expect(canonicalStream(name)).toBeNull();
        }
    );

    it.each([null, undefined, 42, {}, []])('finds no stream for %p, which is not a name', (name) => {
        expect(canonicalStream(name)).toBeNull();
    });
});
