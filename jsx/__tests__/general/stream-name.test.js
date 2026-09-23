/**
 * stream-name.test.js: stream id to the label a visitor sees.
 *
 * The id is load-bearing well beyond the label: it is the path of the alarm and
 * trigger pages, the '?item=' deep link, the 'Stream' sent to the performance
 * api, and the suffix of every per-stream state key. So only the rendered label
 * is swapped, and an unknown id must pass through untouched rather than becoming
 * empty -- a blank title is worse than a raw id.
 */

import streamName, { streamCoverage } from '../../import/general/stream-name.js';

describe('streamName', () => {
    it('labels every stream it knows, by its id', () => {
        expect(streamName('stock-market')).toBe('S&P 500');
        expect(streamName('stock-split')).toBe('Stock Splits');
        expect(streamName('us-national-weather')).toBe('US Weather Alerts');
        expect(streamName('bls')).toBe('Bureau of Labor Statistics');
        expect(streamName('sec')).toBe('SEC Filings');
    });

    it('finds the label under any name the stream has gone by', () => {
        //
        // the alarm page used to rename 'StockMarket' to 'stock-market' for
        // itself and look that up here, which knew the stream only as
        // 'stockmarket' -- so the page offered to 'Download raw stock-market
        // ingest performance metrics'. Every name leads to the id now, and the
        // id to the label.
        //
        expect(streamName('StockMarket')).toBe('S&P 500');
        expect(streamName('stockmarket')).toBe('S&P 500');
        expect(streamName('STOCKMARKET')).toBe('S&P 500');
        expect(streamName('StockMarketStockSplit')).toBe('Stock Splits');
        expect(streamName('USNationalWeather')).toBe('US Weather Alerts');
    });

    it('matches the whole name, so the two stock streams stay distinct', () => {
        //
        // 'stockmarketstocksplit' is not a 'stockmarket' that picked up a suffix.
        // A prefix match would label the split feed 'S&P 500', which is exactly
        // the wrong scope.
        //
        expect(streamName('stock-split')).not.toBe('S&P 500');
        expect(streamName('stockmarketstocksplit')).toBe('Stock Splits');
    });

    it('passes an unknown id through unchanged', () => {
        expect(streamName('somethingelse')).toBe('somethingelse');
        expect(streamName('constructor')).toBe('constructor');
        expect(streamName('')).toBe('');
    });

    it('passes a non-string through untouched', () => {
        //
        // returned as-is rather than coerced: the caller may hand this a null
        // before a stream is selected, and 'null' as a title is worse than
        // rendering nothing.
        //
        expect(streamName(null)).toBeNull();
        expect(streamName(undefined)).toBeUndefined();
        expect(streamName(42)).toBe(42);
    });
});

describe('streamCoverage', () => {
    it('states the universe for the two streams that need it', () => {
        //
        // only the stock streams qualify: they sit adjacent in the listing and
        // differ precisely in scope, which the titles alone leave ambiguous.
        //
        expect(streamCoverage('stock-market')).toBe('S&P 500');
        expect(streamCoverage('stock-split')).toBe('Market-wide');
    });

    it('finds it under any name the stream has gone by, like the label', () => {
        expect(streamCoverage('StockMarket')).toBe('S&P 500');
        expect(streamCoverage('stockmarketstocksplit')).toBe('Market-wide');
    });

    it('returns null for a stream with no coverage note', () => {
        //
        // null rather than '' so the caller renders no 'Coverage' row at all
        // rather than an empty one.
        //
        expect(streamCoverage('bls')).toBeNull();
        expect(streamCoverage('sec')).toBeNull();
        expect(streamCoverage('us-national-weather')).toBeNull();
        expect(streamCoverage('unknown')).toBeNull();
    });

    it('returns null for a non-string', () => {
        expect(streamCoverage(null)).toBeNull();
        expect(streamCoverage(undefined)).toBeNull();
        expect(streamCoverage(42)).toBeNull();
    });
});
