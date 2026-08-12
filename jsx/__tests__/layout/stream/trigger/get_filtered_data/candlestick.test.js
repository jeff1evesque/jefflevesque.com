/**
 * candlestick.test.js: the candlestick response reshaper.
 *
 * This is the seam between the api and the chart. The api returns one record per
 * (window, pattern) pair -- a long format, keyed by 'group_by'/'total_detected' --
 * and the chart needs one record per window with a column per pattern. Everything
 * downstream (toggle_chart_scale/candlestick.js, and the line chart itself) assumes
 * that reshape has happened, so its edges are worth pinning:
 *
 *   - the four-hour correction applied to every timestamp,
 *   - the zero-fill of all fourteen patterns, which is what lets the aggregator add
 *     buckets without producing NaN,
 *   - the keys list, which becomes the pattern selector in the left column.
 *
 * Note: the function is called as getFilteredCandlestickData(v, field), where 'v'
 *       is the Promise.all result -- an ARRAY of responses, of which only v[0] is
 *       read. Tests build that shape rather than a bare row array.
 */

import getFilteredCandlestickData from
    '../../../../../import/layout/stream/trigger/get_filtered_data/candlestick.js';

const FIELD = 'window_start';

//
// a response row as the api returns it: the pattern name lives in 'group_by', the
// count in 'total_detected' as a STRING, and the window parameters ride along
// unused.
//
function row(overrides = {}) {
    return {
        [FIELD]: '2024-06-15T12:00:00Z',
        group_by: 'Hammer',
        total_detected: '3',
        window_every: '1m',
        slide_window_over: '5m',
        slide_window_every: '1m',
        ...overrides,
    };
}

function reshape(rows) {
    return getFilteredCandlestickData([rows], FIELD);
}

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

describe('reshaping a response row', () => {
    it('moves the count into a column named after the pattern', () => {
        const { data_filtered_detected } = reshape([row()]);

        expect(data_filtered_detected).toHaveLength(1);
        expect(data_filtered_detected[0].hammer).toBe(3);
    });

    it('lowercases the pattern name, since the api capitalises it', () => {
        const { data_filtered_detected } = reshape([
            row({ group_by: 'Morning Doji Star'.replace(/\s+/g, '_') }),
        ]);

        expect(data_filtered_detected[0].morning_doji_star).toBe(3);
    });

    it('trims whitespace off the pattern name', () => {
        //
        // this is the whole reason trim-object.js is imported here: a padded
        // 'group_by' would otherwise create a column named ' hammer ', which no
        // chart series and no selector entry would ever match.
        //
        const { data_filtered_detected } = reshape([row({ group_by: '  Hammer  ' })]);

        expect(data_filtered_detected[0].hammer).toBe(3);
        expect(data_filtered_detected[0]['  hammer  ']).toBeUndefined();
    });

    it('drops the long-format fields once they have been folded in', () => {
        const { data_filtered_detected } = reshape([row()]);
        const reshaped = data_filtered_detected[0];

        expect(reshaped.group_by).toBeUndefined();
        expect(reshaped.total_detected).toBeUndefined();
        expect(reshaped.window_every).toBeUndefined();
        expect(reshaped.slide_window_over).toBeUndefined();
        expect(reshaped.slide_window_every).toBeUndefined();
    });

    it('counts a non-string total as zero', () => {
        //
        // checkValidString() gates the parseInt, so a count that arrives as a
        // NUMBER rather than a string reads as zero rather than as itself. The api
        // returns strings today; this is what the reshape does if that ever
        // changes, and it fails quietly -- the chart draws a flat line.
        //
        const { data_filtered_detected } = reshape([row({ total_detected: 3 })]);

        expect(data_filtered_detected[0].hammer).toBe(0);
    });

    it('counts a missing total as zero rather than NaN', () => {
        const { data_filtered_detected } = reshape([row({ total_detected: undefined })]);

        expect(data_filtered_detected[0].hammer).toBe(0);
    });
});

describe('the timestamp correction', () => {
    it('moves every window back four hours', () => {
        //
        // the backend computes its windows in UTC but labels them as if they were
        // eastern, so the value that arrives is four hours ahead of the window it
        // describes. Without this the chart's 'today' bucket starts at 8pm.
        //
        const { data_filtered_detected } = reshape([row({ [FIELD]: '2024-06-15T12:00:00Z' })]);

        expect(data_filtered_detected[0][FIELD].getTime()).toBe(
            Date.parse('2024-06-15T12:00:00Z') - 4 * 60 * 60 * 1000
        );
    });

    it('returns a Date, not the string it was given', () => {
        //
        // the aggregator calls getFullYear()/getMonth() on this field directly, so a
        // string here would throw rather than mis-render.
        //
        const { data_filtered_detected } = reshape([row()]);

        expect(data_filtered_detected[0][FIELD]).toBeInstanceOf(Date);
    });

    it('discards a row whose timestamp will not parse', () => {
        //
        // an unparseable date yields an Invalid Date, which every comparison in the
        // aggregator answers false to -- the point would be silently absent from
        // some buckets and present in others. Dropping it here keeps that out.
        //
        const { data_filtered_detected } = reshape([
            row({ [FIELD]: 'not-a-date', group_by: 'Piercing' }),
            row({ group_by: 'Hammer' }),
        ]);

        expect(data_filtered_detected).toHaveLength(1);
        expect(data_filtered_detected[0].hammer).toBe(3);
    });
});

describe('merging rows onto a window', () => {
    it('folds patterns sharing a timestamp into one record', () => {
        //
        // the api sends one row per pattern per window; the chart needs one row per
        // window. This merge is what turns fourteen rows into one point.
        //
        const { data_filtered_detected } = reshape([
            row({ group_by: 'Hammer', total_detected: '3' }),
            row({ group_by: 'Piercing', total_detected: '5' }),
        ]);

        expect(data_filtered_detected).toHaveLength(1);
        expect(data_filtered_detected[0].hammer).toBe(3);
        expect(data_filtered_detected[0].piercing).toBe(5);
    });

    it('keeps distinct timestamps apart', () => {
        const { data_filtered_detected } = reshape([
            row({ [FIELD]: '2024-06-15T12:00:00Z' }),
            row({ [FIELD]: '2024-06-15T12:05:00Z' }),
        ]);

        expect(data_filtered_detected).toHaveLength(2);
    });

    it('matches windows by value rather than by object identity', () => {
        //
        // the field holds a Date by the time the merge runs, and two Dates for the
        // same instant are never ===. The comparison uses valueOf() for exactly this
        // reason; identity comparison would emit a separate point per pattern.
        //
        const { data_filtered_detected } = reshape([
            row({ group_by: 'Hammer' }),
            row({ group_by: 'Shooting Star'.toLowerCase().replace(/\s+/g, '_') }),
            row({ group_by: 'Piercing' }),
        ]);

        expect(data_filtered_detected).toHaveLength(1);
    });
});

describe('the zero fill', () => {
    it('gives every one of the fourteen patterns a value', () => {
        //
        // this is the contract the aggregator depends on: it sums bucket + row with
        // '+=', so a pattern absent from a window would turn the running total into
        // NaN and blank the series from that point on.
        //
        const { data_filtered_detected } = reshape([row({ group_by: 'Hammer' })]);
        const reshaped = data_filtered_detected[0];

        PATTERNS.forEach((pattern) => {
            expect(typeof reshaped[pattern]).toBe('number');
        });
    });

    it('leaves a detected count alone while filling the rest with zero', () => {
        const { data_filtered_detected } = reshape([row({ group_by: 'Hammer' })]);
        const reshaped = data_filtered_detected[0];

        expect(reshaped.hammer).toBe(3);
        expect(reshaped.shooting_star).toBe(0);
        expect(reshaped.evening_star).toBe(0);
    });

    it('fills a genuine zero rather than leaving the pattern out', () => {
        //
        // '0 || 0' and 'undefined || 0' land on the same value, so a window where a
        // pattern was looked for and not found is indistinguishable here from one
        // where it was never reported. Both mean "draw nothing", which is what the
        // chart wants.
        //
        const { data_filtered_detected } = reshape([
            row({ group_by: 'Hammer', total_detected: '0' }),
        ]);

        expect(data_filtered_detected[0].hammer).toBe(0);
    });
});

describe('the keys list', () => {
    it('names every pattern the chart can draw', () => {
        const { keys } = reshape([row()]);

        PATTERNS.forEach((pattern) => {
            expect(keys).toContain(pattern);
        });
    });

    it('excludes the datetime field, which is the axis rather than a series', () => {
        const { keys } = reshape([row()]);

        expect(keys).not.toContain(FIELD);
    });

    it('is read off the first record only', () => {
        //
        // worth knowing: a column present on a later window but not the first would
        // be absent from the selector even though the data carries it. The zero fill
        // above is what makes that safe for the fourteen known patterns.
        //
        const { keys } = reshape([
            row({ [FIELD]: '2024-06-15T12:00:00Z', group_by: 'Hammer' }),
            row({ [FIELD]: '2024-06-15T12:05:00Z', group_by: 'Unlisted Pattern'.replace(/\s+/g, '_') }),
        ]);

        expect(keys).not.toContain('unlisted_pattern');
    });
});

describe('the edges', () => {
    it('mutates the rows it was handed', () => {
        //
        // the map body writes to and deletes from each row in place, so the response
        // cannot be reshaped twice or reused afterwards -- a second call sees rows
        // with no 'group_by' and throws.
        //
        const rows = [row()];
        reshape(rows);

        expect(rows[0].group_by).toBeUndefined();
        expect(rows[0].hammer).toBe(3);
    });

    it('throws when no row survives the filter', () => {
        //
        // the keys line reads data_filtered_detected[0] unguarded. The caller in
        // trigger.jsx only reaches this with a non-empty response, so this documents
        // a precondition rather than a supported call -- an empty api result must be
        // caught before it gets here.
        //
        expect(() => reshape([row({ [FIELD]: 'not-a-date' })])).toThrow();
    });

    it('throws on an empty response', () => {
        expect(() => reshape([])).toThrow();
    });
});
