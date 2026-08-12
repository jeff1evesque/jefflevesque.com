/**
 * stream-scale.test.jsx: the stream layout's chart aggregation.
 *
 * stream.test.jsx covers the listing before data arrives. The aggregation below it
 * is the part with actual arithmetic in it, and none of it is reachable through the
 * rendered page, because no report ever loads under jsdom:
 *
 *   - initializeChartScale, which maps a rate name onto the d3 format strings
 *   - toggleChartScale, which buckets rows by that rate and sums each series
 *   - updateMetrics, which totals the same rows into the listing's health figure
 *
 * All three are driven through a ref. They are ordinary methods called from the
 * component's own handlers, and this is the only boundary they present.
 *
 * Note: the buckets are built from LOCAL date getters, so every assertion here
 *       depends on the TZ pin in jest.config.js. The dates below are written as
 *       local times for that reason.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import THROUGHPUT_KEY from '../../../import/general/throughput-key.js';
import StreamLayout from '../../../import/layout/stream/stream.jsx';

const FIELD = 'window_start';
const STREAM = 'bls';
const SOURCE = 'bls';
const THROUGHPUT = `${SOURCE}${THROUGHPUT_KEY}`;

function setup() {
    const held = React.createRef();

    render(
        <MemoryRouter>
            <StreamLayout ref={held} />
        </MemoryRouter>
    );

    return held.current;
}

//
// a single report row, as performance.js posts them: a true instant plus one key
// per series and a matching throughput key.
//
function row(date, success = 1, throughput = 2) {
    return {
        [FIELD]: new Date(date),
        [SOURCE]: success,
        [THROUGHPUT]: throughput,
    };
}

//
// Every row has to satisfy two constraints at once, and getting either wrong makes a
// test that passes locally and fails elsewhere:
//
//   1. it must sit INSIDE the trailing window, or toggleChartScale filters it out --
//      the window reaches back 60 minutes / 24 hours / 20 days / 12 months from now,
//      truncated to the unit. Only the lower bound is applied, so a timestamp later
//      than now is kept.
//
//   2. rows a test expects to aggregate must fall in the SAME bucket, and rows it
//      expects to stay apart must not.
//
// A naive 'now minus n minutes' satisfies (1) but not (2): 'now - 1min' and
// 'now - 2min' are usually the same hour and occasionally straddle the boundary, so
// the hour test failed in CI purely because the run started within two minutes of
// the top of an hour. Fixed calendar dates fail the other way -- they satisfy (2)
// forever but drop out of the rolling window once enough time passes, so a suite
// written against 2026/08 would start failing in 2027 for no visible reason.
//
// These helpers pin the bucket relative to now instead: same unit, chosen offset.
//
function thisHour(minute) {
    const d = new Date();
    d.setMinutes(minute, 0, 0);
    return d;
}

function thisDay(hour) {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    return d;
}

//
// Note: the date is set to the 1st BEFORE shifting the month, so shifting out of a
//       31 day month does not spill into the next one -- the same care windowStart
//       itself takes.
//
function monthsAgo(count, day = 15) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - count);
    d.setDate(day);
    d.setHours(12, 0, 0, 0);
    return d;
}

const thisMonth = (day) => monthsAgo(0, day);

function scale(page, rate, rows) {
    let result;

    act(() => {
        result = page.toggleChartScale(STREAM, rate, rows);
    });

    return result;
}

describe('initializeChartScale', () => {
    it.each([
        ['monthly', 'scale_chart_monthly', '%m/%Y', 'Month'],
        ['month', 'scale_chart_monthly', '%m/%Y', 'Month'],
        ['daily', 'scale_chart_daily', '%m/%d', 'Day'],
        ['day', 'scale_chart_daily', '%m/%d', 'Day'],
        ['hourly', 'scale_chart_hourly', '%I%p', 'Hour'],
        ['hour', 'scale_chart_hourly', '%I%p', 'Hour'],
        ['minutes', 'scale_chart_minutes', '%I:%M%p', 'Minute'],
        ['minute', 'scale_chart_minutes', '%I:%M%p', 'Minute'],
    ])('%s sets its flag, tick format and rate label', (rate, flag, format, label) => {
        //
        // every rate is accepted under two spellings, because the control tray passes
        // the adjective and the stored rate is the noun. Both have to land on the same
        // branch or the chart formats its axis for a different scale than it aggregated.
        //
        const page = setup();

        act(() => {
            page.initializeChartScale(rate);
        });

        expect(page.state[flag]).toBe(true);
        expect(page.state.x_ticker_format).toBe(format);
        expect(page.state[`stream_rate_${page.state.selected_stream}`]).toBe(label);
    });

    it('sets exactly one scale flag at a time', () => {
        //
        // the four flags drive which control reads as active, so two true at once would
        // light up two.
        //
        const page = setup();

        act(() => {
            page.initializeChartScale('hourly');
        });

        const flags = ['scale_chart_monthly', 'scale_chart_daily',
            'scale_chart_hourly', 'scale_chart_minutes'];
        expect(flags.filter(f => page.state[f] === true)).toEqual(['scale_chart_hourly']);
    });

    it('clears a previously set flag when the rate changes', () => {
        const page = setup();

        act(() => {
            page.initializeChartScale('monthly');
        });
        act(() => {
            page.initializeChartScale('daily');
        });

        expect(page.state.scale_chart_monthly).toBe(false);
        expect(page.state.scale_chart_daily).toBe(true);
    });

    it('accepts an upper-case rate', () => {
        const page = setup();

        act(() => {
            page.initializeChartScale('MONTHLY');
        });

        expect(page.state.scale_chart_monthly).toBe(true);
    });

    it('does nothing at all for an empty rate', () => {
        const page = setup();
        const before = page.state.x_ticker_format;

        act(() => {
            page.initializeChartScale('');
        });

        expect(page.state.x_ticker_format).toBe(before);
    });

    it('leaves the formats alone for an unrecognised rate', () => {
        //
        // the flags are all set to false but no format branch matches, so the axis
        // keeps whatever it had. A silent no-op rather than a reset.
        //
        const page = setup();
        const before = page.state.x_ticker_format;

        act(() => {
            page.initializeChartScale('fortnightly');
        });

        expect(page.state.scale_chart_monthly).toBe(false);
        expect(page.state.x_ticker_format).toBe(before);
    });
});

describe('toggleChartScale bucketing', () => {
    it('folds rows in the same month into one point', () => {
        const page = setup();

        const result = scale(page, 'month', [
            row(thisMonth(1), 3, 6),
            row(thisMonth(20), 4, 8),
        ]);

        expect(result).toHaveLength(1);
        expect(result[0][SOURCE]).toBe(7);
        expect(result[0][THROUGHPUT]).toBe(14);
    });

    it('dates a monthly bucket to the first of its own month', () => {
        //
        // the bucket is built as 'YYYY/MM/01', which parses as LOCAL time. The earlier
        // 'YYYY-MM' form parsed as UTC and landed in the previous month once shifted to
        // New York.
        //
        const page = setup();

        const anchor = thisMonth(20);
        const [point] = scale(page, 'month', [row(anchor)]);

        expect(point[FIELD].getMonth()).toBe(anchor.getMonth());
        expect(point[FIELD].getDate()).toBe(1);
        expect(point[FIELD].getFullYear()).toBe(anchor.getFullYear());
    });

    it('keeps separate months apart', () => {
        const page = setup();

        const result = scale(page, 'month', [
            row(monthsAgo(1, 15)),
            row(thisMonth(15)),
        ]);

        expect(result).toHaveLength(2);
    });

    it('folds rows in the same day into one point', () => {
        const page = setup();

        const result = scale(page, 'day', [
            row(thisDay(3), 2, 4),
            row(thisDay(9), 3, 6),
        ]);

        expect(result).toHaveLength(1);
        expect(result[0][SOURCE]).toBe(5);
    });

    it('folds rows in the same hour into one point', () => {
        const page = setup();

        const result = scale(page, 'hour', [
            row(thisHour(10), 1, 2),
            row(thisHour(20), 1, 2),
        ]);

        expect(result).toHaveLength(1);
        expect(result[0][SOURCE]).toBe(2);
    });

    it('keeps distinct minutes apart', () => {
        const page = setup();

        const result = scale(page, 'minute', [
            row(thisHour(10)),
            row(thisHour(20)),
        ]);

        expect(result).toHaveLength(2);
    });

    it('falls back to a full timestamp for an unrecognised rate', () => {
        //
        // the else branch keys on the ISO instant, so nothing aggregates: every row
        // becomes its own point.
        //
        const page = setup();

        const result = scale(page, 'fortnightly', [
            row(thisHour(10)),
            row(thisHour(20)),
        ]);

        expect(result).toHaveLength(2);
    });

    it('counts a missing series value as zero rather than NaN', () => {
        //
        // one NaN would poison the whole sum and the chart would draw nothing, with no
        // error to explain it.
        //
        const page = setup();

        const result = scale(page, 'month', [
            { [FIELD]: thisMonth(1) },
            row(thisMonth(2), 5, 10),
        ]);

        expect(result[0][SOURCE]).toBe(5);
        expect(Number.isNaN(result[0][SOURCE])).toBe(false);
    });

    it('carries the throughput key alongside every series', () => {
        //
        // the two aggregate together so the listing's health stays a ratio of the same
        // rows the chart is drawing.
        //
        const page = setup();

        const [point] = scale(page, 'month', [row(thisMonth(1), 1, 9)]);

        expect(point).toHaveProperty(SOURCE);
        expect(point).toHaveProperty(THROUGHPUT, 9);
    });

    it('stores the result against the stream it aggregated', () => {
        const page = setup();

        scale(page, 'month', [row(thisMonth(1))]);

        expect(page.state[`chart_data_${STREAM}`]).toHaveLength(1);
    });

    it('falls back to the stream\'s stored rate when none is given', () => {
        //
        // the chart re-aggregates on a data refresh without being told the rate again,
        // so it has to recover it from state.
        //
        const page = setup();

        act(() => {
            page.setState({ [`stream_rate_${STREAM}`]: 'Month' });
        });

        const result = scale(page, null, [
            row(thisMonth(1)),
            row(thisMonth(20)),
        ]);

        expect(result).toHaveLength(1);
    });
});

describe('toggleChartScale windowing', () => {
    it('drops rows older than the trailing window', () => {
        //
        // every rate ends at now and reaches back a fixed distance, so a stale row is
        // filtered rather than stretching the axis to meet it.
        //
        const page = setup();

        const result = scale(page, 'day', [
            row('2001/01/01 10:00'),
            row(thisDay(3)),
        ]);

        expect(result).toHaveLength(1);
    });

    it('keeps a row inside the window', () => {
        const page = setup();

        const result = scale(page, 'hour', [row(thisHour(10))]);

        expect(result).toHaveLength(1);
    });
});

describe('toggleChartScale gap filling', () => {
    //
    // an interval whose scraper never ran carries no row, so the stacked area joined
    // straight across it and the outage read as a slightly wider day -- the S&P 500
    // daily chart drew an unbroken ramp over a monday nothing was captured on. The
    // aggregator now inserts a zero for it (see ingest-gaps.js), which is asserted
    // there in detail; what these two cover is that the aggregator actually calls it,
    // and calls it with this stream's own source list.
    //
    function daysAgo(count) {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() - count);
        return d;
    }

    function bucket(d) {
        const b = new Date(d.getTime());
        b.setHours(0, 0, 0, 0);
        return b.valueOf();
    }

    it('draws a zero for a day the scraper never ran', () => {
        //
        // 'bls' is expected every day, so a skipped day is unambiguous -- no weekday
        // gate to reason about. Three days back rather than one, so the missing day is
        // never the interval still filling.
        //
        const page = setup();

        const result = scale(page, 'day', [row(daysAgo(4), 7, 9), row(daysAgo(2), 8, 10)]);
        const gap = result.filter(v => v[FIELD].valueOf() === bucket(daysAgo(3)));

        expect(gap).toHaveLength(1);
        expect(gap[0][SOURCE]).toBe(0);
        expect(gap[0][THROUGHPUT]).toBe(0);
    });

    it('leaves the listing totals untouched', () => {
        //
        // zero on both sides of the health ratio, so the fill changes the chart and
        // nothing the listing reports.
        //
        const page = setup();

        const result = scale(page, 'day', [row(daysAgo(4), 7, 9), row(daysAgo(2), 8, 10)]);

        expect(result.reduce((sum, v) => sum + v[SOURCE], 0)).toBe(15);
        expect(result.reduce((sum, v) => sum + v[THROUGHPUT], 0)).toBe(19);
    });

    it('does not zero a weekend for a weekday-only stream', () => {
        //
        // the reason the report's own 'FillEmptyBuckets' is not used for this: it
        // zeroes every empty interval, so a weekday-only stream would draw an outage
        // across every weekend. 'stockmarketstocksplit' is weekday-only, and a ten day
        // span always contains one.
        //
        const page = setup();
        let result;

        act(() => {
            result = page.toggleChartScale(
                'stockmarketstocksplit',
                'day',
                [row(daysAgo(12)), row(daysAgo(2))]
            );
        });

        //
        // asserted alongside the weekend, so the case cannot pass by filling nothing
        // at all.
        //
        expect(result.length).toBeGreaterThan(2);
        expect(result.filter(v => [0, 6].includes(v[FIELD].getDay()))).toEqual([]);
    });
});

describe('toggleChartScale padding removal', () => {
    //
    // the mirror of the gap filling above, and the defect it was written for is the
    // opposite one: 'usnationalweather' is the one stream the api treats as continuous,
    // so its report is padded to a row per interval. At the MINUTE rate that states a
    // zero for the four minutes in five the scraper is idle by design, and the stacked
    // area dropped to the axis between every run -- twelve separate humps for a stream
    // behaving perfectly. ingest-gaps.js asserts the rule in detail; these cover that
    // the aggregator calls it, calls it before the fill, and calls it with this
    // stream's own source list.
    //
    function minutesAgo(count) {
        const d = new Date();
        d.setSeconds(0, 0);
        d.setMinutes(d.getMinutes() - count);
        return d;
    }

    function wxRow(date, success, throughput = success) {
        return {
            [FIELD]: date,
            weather: success,
            [`weather${THROUGHPUT_KEY}`]: throughput,
        };
    }

    //
    // the whole trailing minute window as the api returns it: a row on every one of the
    // 60 minutes, carrying a run on every fifth and a filled-in zero on the rest.
    //
    function paddedMinuteReport() {
        return Array.from(
            { length: 60 },
            (v, i) => wxRow(minutesAgo(59 - i), i % 5 === 0 ? 190 + i : 0)
        );
    }

    function scaleFor(page, stream, rate, rows) {
        let result;

        act(() => {
            result = page.toggleChartScale(stream, rate, rows);
        });

        return result;
    }

    it('takes the api padding off a minute chart', () => {
        const page = setup();
        const result = scaleFor(page, 'usnationalweather', 'minute', paddedMinuteReport());

        expect(result).toHaveLength(12);
        expect(result.every(v => v[`weather${THROUGHPUT_KEY}`] > 0)).toBe(true);
    });

    it('leaves the run intervals themselves alone', () => {
        //
        // asserted alongside the count, so the case cannot pass by dropping the wrong
        // rows: what survives has to be the five minute cadence the scraper actually
        // runs on, oldest first.
        //
        const page = setup();
        const result = scaleFor(page, 'usnationalweather', 'minute', paddedMinuteReport());
        const spacing = result.slice(1).map((v, i) => v[FIELD] - result[i][FIELD]);

        expect(result[0][FIELD].valueOf()).toBe(minutesAgo(59).valueOf());
        expect(spacing.every(ms => ms === 5 * 60 * 1000)).toBe(true);
    });

    it('keeps a zero a report did not pad', () => {
        //
        // 'sec' runs on the same five minute cadence but its report carries only what it
        // observed, so its rows are already five minutes apart. A zero among them was
        // measured rather than filled in, and has to survive.
        //
        const page = setup();
        const rows = Array.from(
            { length: 12 },
            (v, i) => ({
                [FIELD]: minutesAgo(55 - i * 5),
                sec: i === 4 ? 0 : 1600 + i,
                [`sec${THROUGHPUT_KEY}`]: i === 4 ? 0 : 1600 + i,
            })
        );

        const result = scaleFor(page, 'sec', 'minute', rows);

        expect(result).toHaveLength(12);
        expect(result.filter(v => v[`sec${THROUGHPUT_KEY}`] === 0)).toHaveLength(1);
    });

    it('does not strip a daily chart the scraper genuinely missed a day of', () => {
        //
        // THE case the drop must not reach. 'bls' is expected every day, so a skipped day
        // is a real outage -- the fill zeroes it, and a report that skips a day is not
        // contiguous, so nothing is stripped from it either before or after.
        //
        const page = setup();

        function daysAgo(count) {
            const d = new Date();
            d.setHours(12, 0, 0, 0);
            d.setDate(d.getDate() - count);
            return d;
        }

        function bucket(d) {
            const b = new Date(d.getTime());
            b.setHours(0, 0, 0, 0);
            return b.valueOf();
        }

        const result = scaleFor(page, STREAM, 'day', [row(daysAgo(4), 7, 9), row(daysAgo(2), 8, 10)]);
        const at = d => result.find(v => v[FIELD].valueOf() === bucket(d));

        //
        // both observed days survive, and so does the zero the fill put between them.
        // Every other day in the window is a gap of the same kind -- there is no row for
        // yesterday either -- so the count is not the assertion; these three buckets are.
        //
        expect(at(daysAgo(4))[THROUGHPUT]).toBe(9);
        expect(at(daysAgo(2))[THROUGHPUT]).toBe(10);
        expect(at(daysAgo(3))[THROUGHPUT]).toBe(0);
    });
});

describe('toggleChartScale with nothing to aggregate', () => {
    it('stores an empty series for a stream with no rows', () => {
        const page = setup();

        const result = scale(page, 'month', []);

        expect(result).toEqual([]);
        expect(page.state[`chart_data_${STREAM}`]).toEqual([]);
    });

    it('stores an empty series when the data is null', () => {
        const page = setup();

        const result = scale(page, 'month', null);

        expect(result).toEqual([]);
    });

    it('complains when there is no stream to file the result under', () => {
        const page = setup();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        act(() => {
            page.toggleChartScale('', 'month', null);
        });

        expect(quiet.mock.calls.flat().join(' ')).toContain('no selected_stream');

        quiet.mockRestore();
    });
});

describe('updateMetrics', () => {
    function metrics(page, rows) {
        act(() => {
            page.updateMetrics(rows, STREAM);
        });

        return {
            total: page.state[`stream_${STREAM}_total`],
            health: page.state[`stream_${STREAM}_health`],
        };
    }

    it('totals the successes across every row', () => {
        const page = setup();

        expect(metrics(page, [row(thisHour(10), 3, 10), row(thisHour(20), 4, 10)]).total).toBe(7);
    });

    it('reports health as a percentage of throughput', () => {
        //
        // 5 of 10 across two rows.
        //
        const page = setup();

        expect(metrics(page, [row(thisHour(10), 2, 4), row(thisHour(20), 3, 6)]).health).toBe('50.00');
    });

    it('caps health at 100 rather than reporting more than everything', () => {
        //
        // success above throughput is not meaningful, and an uncapped figure like
        // '150.00' in the listing reads as a bug in the data rather than in the sum.
        //
        const page = setup();

        expect(metrics(page, [row(thisHour(10), 15, 10)]).health).toBe(100);
    });

    it('reports n/a rather than zero when nothing succeeded', () => {
        //
        // zero successes and 'not measured' are different, and the listing shows n/a
        // for the latter. A literal 0 here would read as a stream that is failing
        // rather than one that has not reported.
        //
        const page = setup();

        expect(metrics(page, [row(thisHour(10), 0, 10)]).total).toBe('n/a');
    });

    it('reports n/a for health when there is no throughput to divide by', () => {
        //
        // 0/0 is NaN, which must not reach the listing.
        //
        const page = setup();

        expect(metrics(page, [row(thisHour(10), 0, 0)]).health).toBe('n/a');
    });

    it('ignores a row missing the series entirely', () => {
        const page = setup();

        const result = metrics(page, [
            { [FIELD]: thisHour(10) },
            row(thisHour(20), 5, 10),
        ]);

        expect(result.total).toBe(5);
    });

    it('leaves the metrics untouched for a stream it was not given', () => {
        //
        // the write is guarded by a match against the stream list, so one stream's
        // report cannot overwrite another's figures.
        //
        const page = setup();

        act(() => {
            page.updateMetrics([row(thisHour(10), 5, 10)], STREAM);
        });

        expect(page.state.stream_sec_total).not.toBe(5);
    });
});
