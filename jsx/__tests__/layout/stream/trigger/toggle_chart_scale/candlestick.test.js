/**
 * candlestick.test.js: the candlestick scale aggregator.
 *
 * This is what the rate selector in the left column actually does. Given the
 * per-window records produced by get_filtered_data/candlestick.js, it rolls them up
 * into minute, hour, day or month buckets and then trims the result to the span
 * that scale is meant to show -- the current hour for 'minutes', today for
 * 'hourly', the last twenty days for 'daily', everything for 'monthly'.
 *
 * Both halves matter and neither is visible from the chart: an aggregation fault
 * shows up as a plausible-looking wrong number, and a windowing fault as a chart
 * that is simply emptier than it should be.
 *
 * Note: the clock is pinned with fake timers, because three of the four scales trim
 *       against 'now' -- 'is this row today' cannot be asserted against a moving
 *       today. The ZONE is pinned too, in jest.config.js rather than here: the
 *       module buckets by local wall clock before converting through
 *       'America/New_York', so a run in Asia/Tokyo splits one eastern trading day
 *       across two daily buckets. That pin cannot be done from a test file -- jest
 *       hands each file a copy of 'process', so the assignment never reaches v8.
 *
 * Note: the fourteen zero-filled patterns in the fixtures are not padding. The
 *       aggregator merges buckets with '+=', so a row missing a pattern poisons the
 *       running total with NaN -- see 'the zero fill' below.
 */

import getCandlestickArrResult from
    '../../../../../import/layout/stream/trigger/toggle_chart_scale/candlestick.js';

const FIELD = 'window_start';

//
// a Saturday well clear of both daylight-savings transitions, so the four
// arithmetic paths through the module cannot land on a 23- or 25-hour day.
//
const NOW = '2024-06-15T14:30:00-04:00';

const PATTERNS = [
    'inverted_hammer',
    'shooting_star',
    'hammer',
    'hanging_man',
    'piercing',
    'dark_cloud_cover',
    'morning_doji_star',
    'evening_doji_star',
    'bearish_engulfing',
    'bullish_engulfing',
    'dragonfly_doji',
    'gravestone_doji',
    'morning_star',
    'evening_star',
];

beforeEach(() => {
    jest.useFakeTimers({ now: new Date(NOW) });
});

afterEach(() => {
    jest.useRealTimers();
});

//
// one reshaped window, as get_filtered_data/candlestick.js emits it: a Date in the
// datetime field and a number for every pattern.
//
function point(datetime, counts = {}) {
    const zeroed = {};
    PATTERNS.forEach((pattern) => { zeroed[pattern] = 0; });

    return { [FIELD]: new Date(datetime), ...zeroed, ...counts };
}

function aggregate(rows, scale, patterns) {
    return getCandlestickArrResult(rows, FIELD, scale, patterns);
}

describe('the minute scale', () => {
    it('adds up the windows landing in the same minute', () => {
        const result = aggregate([
            point('2024-06-15T14:30:00-04:00', { hammer: 2 }),
            point('2024-06-15T14:30:40-04:00', { hammer: 3 }),
        ], 'minutes');

        expect(result).toHaveLength(1);
        expect(result[0].hammer).toBe(5);
    });

    it('keeps separate minutes as separate points', () => {
        const result = aggregate([
            point('2024-06-15T14:30:00-04:00', { hammer: 2 }),
            point('2024-06-15T14:31:00-04:00', { hammer: 3 }),
        ], 'minutes');

        expect(result).toHaveLength(2);
        expect(result.map((v) => v.hammer)).toEqual([2, 3]);
    });

    it('shows the current hour only', () => {
        //
        // the minute view is the live one -- it is read while the market is open, so
        // an earlier hour on the same axis would compress the part being watched.
        //
        const result = aggregate([
            point('2024-06-15T13:30:00-04:00', { hammer: 9 }),
            point('2024-06-15T14:30:00-04:00', { hammer: 2 }),
        ], 'minutes');

        expect(result).toHaveLength(1);
        expect(result[0].hammer).toBe(2);
    });

    it('buckets a single-digit minute correctly', () => {
        //
        // the bucket key is built without zero-padding the minute, so 14:05 keys as
        // '2024/06/15 14:5'. That still parses to 14:05, which is the only reason
        // the first ten minutes of every hour are not silently dropped.
        //
        const result = aggregate([
            point('2024-06-15T14:05:00-04:00', { hammer: 1 }),
        ], 'minutes');

        expect(result).toHaveLength(1);
        expect(result[0][FIELD].getMinutes()).toBe(5);
    });
});

describe('the hourly scale', () => {
    it('adds up the windows landing in the same hour', () => {
        const result = aggregate([
            point('2024-06-15T14:05:00-04:00', { hammer: 2 }),
            point('2024-06-15T14:55:00-04:00', { hammer: 3 }),
        ], 'hourly');

        expect(result).toHaveLength(1);
        expect(result[0].hammer).toBe(5);
    });

    it('keeps separate hours as separate points', () => {
        const result = aggregate([
            point('2024-06-15T13:05:00-04:00', { hammer: 2 }),
            point('2024-06-15T14:55:00-04:00', { hammer: 3 }),
        ], 'hourly');

        expect(result).toHaveLength(2);
    });

    it('shows today only', () => {
        const result = aggregate([
            point('2024-06-14T14:05:00-04:00', { hammer: 9 }),
            point('2024-06-15T14:05:00-04:00', { hammer: 2 }),
        ], 'hourly');

        expect(result).toHaveLength(1);
        expect(result[0].hammer).toBe(2);
    });

    it('places each point on the hour rather than at the first window in it', () => {
        //
        // the bucket carries the hour's own timestamp, so the axis is evenly spaced
        // whether or not a window happens to open on the hour.
        //
        const result = aggregate([
            point('2024-06-15T14:37:00-04:00', { hammer: 1 }),
        ], 'hourly');

        expect(result[0][FIELD].getHours()).toBe(14);
        expect(result[0][FIELD].getMinutes()).toBe(0);
    });
});

describe('the daily scale', () => {
    it('adds up the windows landing on the same day', () => {
        const result = aggregate([
            point('2024-06-13T09:35:00-04:00', { hammer: 2 }),
            point('2024-06-13T15:55:00-04:00', { hammer: 3 }),
        ], 'daily');

        expect(result).toHaveLength(1);
        expect(result[0].hammer).toBe(5);
    });

    it('keeps roughly the last twenty days', () => {
        const result = aggregate([
            point('2024-06-01T10:00:00-04:00', { hammer: 1 }),
            point('2024-06-10T10:00:00-04:00', { hammer: 2 }),
            point('2024-06-15T10:00:00-04:00', { hammer: 3 }),
        ], 'daily');

        expect(result).toHaveLength(3);
    });

    it('drops anything older than that window', () => {
        //
        // the axis is a trailing view, not an archive -- the whole history would
        // squash the recent days the page is about.
        //
        const result = aggregate([
            point('2020-01-02T10:00:00-05:00', { hammer: 9 }),
            point('2024-06-15T10:00:00-04:00', { hammer: 3 }),
        ], 'daily');

        expect(result).toHaveLength(1);
        expect(result[0].hammer).toBe(3);
    });

    it('places each point at midnight of its day', () => {
        const result = aggregate([
            point('2024-06-14T15:55:00-04:00', { hammer: 1 }),
        ], 'daily');

        expect(result[0][FIELD].getDate()).toBe(14);
        expect(result[0][FIELD].getHours()).toBe(0);
    });
});

describe('the monthly scale', () => {
    it('adds up the windows landing in the same month', () => {
        const result = aggregate([
            point('2024-06-03T10:00:00-04:00', { hammer: 2 }),
            point('2024-06-28T10:00:00-04:00', { hammer: 3 }),
        ], 'monthly');

        expect(result).toHaveLength(1);
        expect(result[0].hammer).toBe(5);
    });

    it('keeps separate months apart', () => {
        const result = aggregate([
            point('2024-05-03T10:00:00-04:00', { hammer: 2 }),
            point('2024-06-03T10:00:00-04:00', { hammer: 3 }),
        ], 'monthly');

        expect(result).toHaveLength(2);
    });

    it('applies no trailing window, unlike every other scale', () => {
        //
        // monthly is the only scale that returns the aggregate untrimmed, so history
        // as far back as the response goes is drawn.
        //
        const result = aggregate([
            point('2020-01-02T10:00:00-05:00', { hammer: 9 }),
            point('2024-06-15T10:00:00-04:00', { hammer: 3 }),
        ], 'monthly');

        expect(result).toHaveLength(2);
    });

    it('stamps the bucket with the first of the month it holds', () => {
        //
        // FIXED. The monthly branch built '`${year}-${month}`' with getMonth() + 2,
        // where every other branch uses + 1. Two faults that cancelled: the
        // hyphenated form is an ISO date and parses as UTC, which in eastern time
        // lands an hour before midnight in the PREVIOUS month, and the + 2 pushed the
        // label a month forward to compensate. The axis looked right by accident.
        //
        const result = aggregate([
            point('2024-06-15T10:00:00-04:00', { hammer: 1 }),
        ], 'monthly');

        const when = result[0][FIELD];
        expect(when.getFullYear()).toBe(2024);
        expect(when.getMonth()).toBe(5);
        expect(when.getDate()).toBe(1);
    });

    it('handles december, which the old key could not express', () => {
        //
        // getMonth() + 2 on december is 13, and new Date('2024-13') is an Invalid
        // Date -- so a december bucket carried NaN onto the axis. The slash form
        // cannot produce that.
        //
        const result = aggregate([
            point('2024-12-15T10:00:00-05:00', { hammer: 3 }),
        ], 'monthly');

        const when = result[0][FIELD];
        expect(isNaN(when)).toBe(false);
        expect(when.getFullYear()).toBe(2024);
        expect(when.getMonth()).toBe(11);
        expect(result[0].hammer).toBe(3);
    });

    it('keeps december and the following january apart', () => {
        //
        // the year rolls over between them, so a key built from the month alone
        // would have merged them.
        //
        const result = aggregate([
            point('2024-12-15T10:00:00-05:00', { hammer: 3 }),
            point('2025-01-15T10:00:00-05:00', { hammer: 4 }),
        ], 'monthly');

        expect(result).toHaveLength(2);
        expect(result.map(v => v[FIELD].getMonth())).toEqual([11, 0]);
    });
});

describe('an unrecognised scale', () => {
    it('buckets by exact instant, aggregating nothing', () => {
        //
        // the fall-through keys on the full iso timestamp, so two windows a minute
        // apart stay two points. trigger.jsx only ever passes the four known rates;
        // this is what a fifth would do.
        //
        const result = aggregate([
            point('2024-06-15T14:30:00-04:00', { hammer: 2 }),
            point('2024-06-15T14:30:40-04:00', { hammer: 3 }),
        ], 'weekly');

        expect(result).toHaveLength(2);
    });

    it('returns every row, however old', () => {
        const result = aggregate([
            point('2020-01-02T10:00:00-05:00', { hammer: 9 }),
            point('2024-06-15T14:30:00-04:00', { hammer: 3 }),
        ], 'weekly');

        expect(result).toHaveLength(2);
    });
});

describe('the selected patterns', () => {
    it('carries all fourteen when none are selected', () => {
        //
        // this is the initial chart: nothing chosen in the Pattern selector means
        // every series is drawn.
        //
        const result = aggregate([
            point('2024-06-15T14:30:00-04:00', { hammer: 1 }),
        ], 'minutes');

        PATTERNS.forEach((pattern) => {
            expect(result[0]).toHaveProperty(pattern);
        });
    });

    it('carries only the selected ones when some are', () => {
        //
        // narrowing happens here rather than in the chart, so an unselected pattern
        // never reaches the series list and cannot be drawn by accident.
        //
        const result = aggregate([
            point('2024-06-15T14:30:00-04:00', { hammer: 1, piercing: 4 }),
        ], 'minutes', ['hammer']);

        expect(Object.keys(result[0]).sort()).toEqual([FIELD, 'hammer'].sort());
    });

    it('aggregates the selected ones across a bucket', () => {
        const result = aggregate([
            point('2024-06-15T14:30:00-04:00', { hammer: 2, piercing: 1 }),
            point('2024-06-15T14:30:40-04:00', { hammer: 3, piercing: 6 }),
        ], 'minutes', ['hammer', 'piercing']);

        expect(result).toHaveLength(1);
        expect(result[0].hammer).toBe(5);
        expect(result[0].piercing).toBe(7);
    });

    it('ignores an empty selection rather than emptying the chart', () => {
        //
        // clearing the Pattern selector sends [] through, and checkValidArray()
        // rejects it -- so the chart falls back to all fourteen instead of going
        // blank.
        //
        const result = aggregate([
            point('2024-06-15T14:30:00-04:00', { hammer: 1 }),
        ], 'minutes', []);

        expect(result[0]).toHaveProperty('shooting_star');
    });
});

describe('the zero fill it depends on', () => {
    it('turns a bucket into NaN when a merged row omits a pattern', () => {
        //
        // this is the coupling to get_filtered_data/candlestick.js, which fills all
        // fourteen patterns with 0 before this ever runs. Without that fill the '+='
        // here produces NaN, and recharts renders a NaN series as nothing at all --
        // a blank chart with no error anywhere.
        //
        const complete = point('2024-06-15T14:30:00-04:00', { hammer: 2 });
        const partial = { [FIELD]: new Date('2024-06-15T14:30:40-04:00'), hammer: 3 };

        const result = aggregate([complete, partial], 'minutes');

        expect(result[0].hammer).toBe(5);
        expect(Number.isNaN(result[0].shooting_star)).toBe(true);
    });

    it('is unnecessary when the patterns are named explicitly', () => {
        //
        // a selection restricts the sum to the named keys, so a row carrying only
        // those aggregates cleanly.
        //
        const result = aggregate([
            { [FIELD]: new Date('2024-06-15T14:30:00-04:00'), hammer: 2 },
            { [FIELD]: new Date('2024-06-15T14:30:40-04:00'), hammer: 3 },
        ], 'minutes', ['hammer']);

        expect(result[0].hammer).toBe(5);
    });
});
