/**
 * stream-name.test.js: stream id to the label a visitor sees.
 *
 * The id is load-bearing well beyond the label: it is the 'Data' param sent to
 * api-datalake, the suffix of every per-stream state key, the '?item=' deep link,
 * and the css class on the active listing row. So only the rendered label is
 * swapped, and an unknown id must pass through untouched rather than becoming
 * empty -- a blank title is worse than a raw id.
 */

import streamName, { streamCoverage } from '../../import/general/stream-name.js';

describe('streamName', () => {
    it('labels every stream it knows', () => {
        expect(streamName('stockmarket')).toBe('S&P 500');
        expect(streamName('stockmarketstocksplit')).toBe('Stock Splits');
        expect(streamName('usnationalweather')).toBe('US Weather Alerts');
        expect(streamName('bls')).toBe('Bureau of Labor Statistics');
        expect(streamName('sec')).toBe('SEC Filings');
    });

    it('matches either casing the id arrives in', () => {
        //
        // the listing rows carry 'StockMarket' while the chart title is handed the
        // lower-cased 'selected_stream', so both reach this function.
        //
        expect(streamName('StockMarket')).toBe('S&P 500');
        expect(streamName('STOCKMARKET')).toBe('S&P 500');
    });

    it('matches the whole id, so the two stock streams stay distinct', () => {
        //
        // 'stockmarketstocksplit' is not a 'stockmarket' that picked up a suffix.
        // A prefix match would label the split feed 'S&P 500', which is exactly
        // the wrong scope.
        //
        expect(streamName('stockmarketstocksplit')).not.toBe('S&P 500');
        expect(streamName('stockmarketstocksplit')).toBe('Stock Splits');
    });

    it('passes an unknown id through unchanged', () => {
        expect(streamName('somethingelse')).toBe('somethingelse');
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
        expect(streamCoverage('stockmarket')).toBe('S&P 500');
        expect(streamCoverage('stockmarketstocksplit')).toBe('Market-wide');
    });

    it('is case insensitive, like the label lookup', () => {
        expect(streamCoverage('StockMarket')).toBe('S&P 500');
    });

    it('returns null for a stream with no coverage note', () => {
        //
        // null rather than '' so the caller renders no 'Coverage' row at all
        // rather than an empty one.
        //
        expect(streamCoverage('bls')).toBeNull();
        expect(streamCoverage('sec')).toBeNull();
        expect(streamCoverage('usnationalweather')).toBeNull();
        expect(streamCoverage('unknown')).toBeNull();
    });

    it('returns null for a non-string', () => {
        expect(streamCoverage(null)).toBeNull();
        expect(streamCoverage(undefined)).toBeNull();
        expect(streamCoverage(42)).toBeNull();
    });
});
