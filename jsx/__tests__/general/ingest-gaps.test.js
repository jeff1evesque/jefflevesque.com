/**
 * ingest-gaps.test.js: the intervals the chart draws as zero.
 *
 * The defect this module fixes is invisible by construction: a missing row is
 * missing, so the chart drew a shape that looked correct and simply omitted a
 * day. Every case below is therefore about WHICH intervals get a row, not about
 * the shape of the row -- an over-eager fill (weekends, a stream's pre-history,
 * the day still in progress) is the same defect pointing the other way.
 *
 * Note: 'now' is passed explicitly rather than mocked, and every date is built
 *       with local-time constructors. The suite pins TZ to America/New_York in
 *       jest.config.js, which is the zone the schedules are declared in, so
 *       'expected' hours below read as the schedule reads.
 */

import THROUGHPUT_KEY from '../../import/general/throughput-key.js';
import {
    missingIntervals,
    fillMissingIntervals,
    dropPaddedEmpties
} from '../../import/general/ingest-gaps.js';

const FIELD = 'window_start';
const SOURCE = ['options', 'price'];

//
// Wed 2026-03-18, mid-afternoon: a weekday far from any month boundary, so a
// window reaching back 20 days crosses into february and covers three full
// weekends.
//
const NOW = new Date(2026, 2, 18, 14, 30, 0, 0);

//
// an aggregated chart row, as toggleChartScale emits them: the bucket instant
// plus one key per series and a matching throughput key.
//
function row(date, success = 5, throughput = 5) {
    const item = { [FIELD]: date instanceof Date ? date : new Date(date) };

    SOURCE.forEach((source) => {
        item[source] = success;
        item[`${source}${THROUGHPUT_KEY}`] = throughput;
    });

    return item;
}

//
// a daily bucket, dated the way the aggregator dates one: local midnight.
//
function day(yyyy, mm, dd) {
    return new Date(yyyy, mm - 1, dd);
}

function dates(intervals) {
    return intervals.map(d => [d.getFullYear(), d.getMonth() + 1, d.getDate()]);
}

//
// the 20 day window ending 2026-03-18 opens on 2026-02-27. These are the
// weekdays inside it, which is what 'stockmarket' is expected to run on.
//
const WEEKDAYS = [
    day(2026, 2, 27),
    day(2026, 3, 2), day(2026, 3, 3), day(2026, 3, 4), day(2026, 3, 5), day(2026, 3, 6),
    day(2026, 3, 9), day(2026, 3, 10), day(2026, 3, 11), day(2026, 3, 12), day(2026, 3, 13),
    day(2026, 3, 16), day(2026, 3, 17), day(2026, 3, 18),
];

describe('missingIntervals', () => {
    it('names the one weekday nothing was captured on', () => {
        //
        // the case this module was written for: the S&P 500 scraper failed to run on a
        // monday, so no row exists for it at all and the stacked area joined tuesday
        // straight onto friday. The chart cannot show a dip it has no point for.
        //
        const rows = WEEKDAYS
            .filter(d => d.getTime() !== day(2026, 3, 9).getTime())
            .map(d => row(d));

        expect(dates(missingIntervals(rows, 'stockmarket', 'day', FIELD, NOW)))
            .toEqual([[2026, 3, 9]]);
    });

    it('names nothing when every expected interval reported', () => {
        const rows = WEEKDAYS.map(d => row(d));

        expect(missingIntervals(rows, 'stockmarket', 'day', FIELD, NOW)).toEqual([]);
    });

    it('leaves weekends alone for a weekday-only stream', () => {
        //
        // the reason the report's own 'FillEmptyBuckets' cannot be used here: it zeroes
        // every empty interval, so a stream that is idle by design would draw an outage
        // across every saturday and sunday.
        //
        const rows = [row(day(2026, 3, 6)), row(day(2026, 3, 16))];
        const missing = missingIntervals(rows, 'stockmarket', 'day', FIELD, NOW);
        const weekdays = missing.map(d => d.getDay());

        expect(missing.length).toBeGreaterThan(0);
        expect(weekdays).not.toContain(0);
        expect(weekdays).not.toContain(6);
    });

    it('fills a weekend for a stream that does run on one', () => {
        //
        // the same schedule table, read the other way: 'usnationalweather' never stops,
        // so a silent saturday IS a gap.
        //
        const rows = [day(2026, 3, 13), day(2026, 3, 16), day(2026, 3, 17)].map(d => row(d));

        expect(dates(missingIntervals(rows, 'usnationalweather', 'day', FIELD, NOW)))
            .toEqual([[2026, 3, 14], [2026, 3, 15]]);
    });

    it('does not invent history before the first row it was given', () => {
        //
        // a stream whose artifacts only reach back a few days would otherwise draw the
        // rest of the window as zeros and read as a fortnight-long outage rather than
        // as a stream that has not been running that long.
        //
        const rows = [row(day(2026, 3, 16)), row(day(2026, 3, 17))];

        expect(missingIntervals(rows, 'stockmarket', 'day', FIELD, NOW)).toEqual([]);
    });

    it('does not zero the interval that is still filling', () => {
        //
        // 'now' is mid-wednesday and wednesday has no row yet. Zeroing it would put a
        // dip on the chart every morning before the scraper's first run -- an outage
        // that is really a day which has not happened.
        //
        const rows = WEEKDAYS
            .filter(d => d.getTime() !== day(2026, 3, 18).getTime())
            .map(d => row(d));

        expect(missingIntervals(rows, 'stockmarket', 'day', FIELD, NOW)).toEqual([]);
    });

    it('zeroes an outage that runs up to the current interval', () => {
        //
        // bounded by the CURRENT interval rather than by the last row, so a scraper
        // that stopped days ago still draws its zeros. Stopping at the last row would
        // hide the hardest outage to spot: a chart that simply ends early.
        //
        const rows = WEEKDAYS.filter(d => d <= day(2026, 3, 12)).map(d => row(d));

        expect(dates(missingIntervals(rows, 'stockmarket', 'day', FIELD, NOW)))
            .toEqual([[2026, 3, 13], [2026, 3, 16], [2026, 3, 17]]);
    });

    it('treats a row that reported zero as present, not missing', () => {
        //
        // 'usnationalweather' asks the report to zero its own empty buckets, so those
        // rows already exist. A second row on the same instant would put two points on
        // one x value.
        //
        const rows = [
            row(day(2026, 3, 13)),
            row(day(2026, 3, 14), 0, 0),
            row(day(2026, 3, 15), 0, 0),
            row(day(2026, 3, 16)),
            row(day(2026, 3, 17)),
        ];

        expect(missingIntervals(rows, 'usnationalweather', 'day', FIELD, NOW)).toEqual([]);
    });

    it('names nothing for a stream with no rows at all', () => {
        //
        // a stream that has reported nothing is not an outage the chart can describe --
        // it has no starting point to fill from, and a flat zero line across the whole
        // window would claim more than is known.
        //
        expect(missingIntervals([], 'stockmarket', 'day', FIELD, NOW)).toEqual([]);
        expect(missingIntervals(null, 'stockmarket', 'day', FIELD, NOW)).toEqual([]);
    });

    it('names nothing for a rate that cannot be graded', () => {
        //
        // 'expectedIntervals' returns nothing where the schedule cannot state what was
        // due -- the monthly rate for a day-partitioned stream, the minute rate for a
        // stream with no known spacing -- so the fill inherits that silence rather
        // than guessing.
        //
        expect(missingIntervals([row(day(2026, 3, 2))], 'sec', 'month', FIELD, NOW)).toEqual([]);
        expect(missingIntervals([row(day(2026, 3, 2))], 'bls', 'minute', FIELD, NOW)).toEqual([]);
        expect(missingIntervals([row(day(2026, 3, 2))], 'nosuchstream', 'day', FIELD, NOW)).toEqual([]);
    });

    it('ignores an empty slot in the rows it was handed', () => {
        //
        // the rows arrive from a worker and are merged across several callbacks, so a
        // hole in the array is cheaper to tolerate than to prove impossible -- reading
        // a field off it would throw inside the chart's own update.
        //
        const rows = [null, row(day(2026, 3, 15)), undefined, row(day(2026, 3, 17))];

        expect(dates(missingIntervals(rows, 'usnationalweather', 'day', FIELD, NOW)))
            .toEqual([[2026, 3, 16]]);
    });

    it('ignores a row whose bucket is not a usable date', () => {
        //
        // a row that failed to parse cannot claim an interval, and must not become the
        // window's lower bound either -- NaN compares false against everything, so it
        // would silently suppress the whole fill.
        //
        const rows = [
            { [FIELD]: new Date('nonsense') },
            row(day(2026, 3, 15)),
            row(day(2026, 3, 17)),
        ];

        expect(dates(missingIntervals(rows, 'usnationalweather', 'day', FIELD, NOW)))
            .toEqual([[2026, 3, 16]]);
    });

    it('reads the clock itself when it is given no instant', () => {
        //
        // the page calls this from its chart aggregator without a 'now', so the default
        // is the production path rather than a convenience. A stream whose only row is
        // today's has nothing to fill: every earlier interval is before its first row,
        // and today is the interval still filling.
        //
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        expect(missingIntervals([row(today)], 'usnationalweather', 'day', FIELD)).toEqual([]);
    });

    it('fills an hourly gap only inside the scraper\'s own hours', () => {
        //
        // the hours narrow an hourly chart where they do not narrow a daily one:
        // 'stockmarket' runs 9-15 eastern, so 03:00 is silence by design and 11:00 is
        // a gap.
        //
        const rows = [
            row(new Date(2026, 2, 18, 10)),
            row(new Date(2026, 2, 18, 12)),
        ];
        const missing = missingIntervals(rows, 'stockmarket', 'hour', FIELD, NOW);

        //
        // 09:00 sits before the first row and 14:00 is the hour still filling, so the
        // two gaps between the rows are all that is left.
        //
        expect(missing.map(d => d.getHours())).toEqual([11, 13]);
    });
});

describe('fillMissingIntervals', () => {
    it('inserts a zeroed row in date order', () => {
        const rows = [row(day(2026, 3, 16)), row(day(2026, 3, 18))];
        const filled = fillMissingIntervals(rows, 'stockmarket', 'day', FIELD, SOURCE, NOW);

        expect(dates(filled.map(v => v[FIELD])))
            .toEqual([[2026, 3, 16], [2026, 3, 17], [2026, 3, 18]]);
    });

    it('zeroes every series and its throughput key', () => {
        //
        // the filled row has to be the same shape the aggregator emits, or the listing's
        // totals sum rows of two different kinds -- and an absent series key reads as
        // undefined rather than as zero once recharts stacks it.
        //
        const rows = [row(day(2026, 3, 16)), row(day(2026, 3, 18))];
        const [, gap] = fillMissingIntervals(rows, 'stockmarket', 'day', FIELD, SOURCE, NOW);

        SOURCE.forEach((source) => {
            expect(gap[source]).toBe(0);
            expect(gap[`${source}${THROUGHPUT_KEY}`]).toBe(0);
        });
    });

    it('leaves the rows untouched when nothing is missing', () => {
        //
        // returned by identity rather than copied, so a chart with no gap does not
        // re-render on a value that only looks new.
        //
        const rows = WEEKDAYS.map(d => row(d));

        expect(fillMissingIntervals(rows, 'stockmarket', 'day', FIELD, SOURCE, NOW)).toBe(rows);
    });

    it('adds nothing to the totals the listing reads', () => {
        //
        // zero on both sides of the health ratio, and coverage counts an interval only
        // where throughput is positive. The fill changes what the chart draws and
        // nothing else.
        //
        const rows = [row(day(2026, 3, 16), 4, 8), row(day(2026, 3, 18), 6, 12)];
        const filled = fillMissingIntervals(rows, 'stockmarket', 'day', FIELD, SOURCE, NOW);
        const total = (key) => filled.reduce((sum, v) => sum + v[key], 0);

        expect(total('price')).toBe(10);
        expect(total(`price${THROUGHPUT_KEY}`)).toBe(20);
    });

    it('reads the clock itself when it is given no instant', () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const rows = [row(today)];

        expect(fillMissingIntervals(rows, 'usnationalweather', 'day', FIELD, SOURCE)).toBe(rows);
    });

    it('survives a stream with no source list', () => {
        //
        // the bucket alone still breaks the area, even if no series can be named on it.
        //
        const rows = [row(day(2026, 3, 16)), row(day(2026, 3, 18))];
        const filled = fillMissingIntervals(rows, 'stockmarket', 'day', FIELD, null, NOW);

        expect(filled).toHaveLength(3);
        expect(Object.keys(filled[1])).toEqual([FIELD]);
    });
});

//
// the other half of the same argument. 'fillMissingIntervals' above adds a zero the
// report failed to state; this removes one the report stated for an interval nothing
// was ever due in. Both are about which intervals reach the chart, and the danger in
// each is the same one pointing the other way -- an over-eager drop erases an outage
// exactly as an over-eager fill invents one.
//
const WEATHER = ['weather'];

//
// a single-series row, the shape the aggregator emits for 'usnationalweather'.
// success and throughput are separable because an interval where the scraper ran and
// every request failed reports zero successes and is still an observation.
//
function wx(date, success, throughput = success) {
    return {
        [FIELD]: date,
        weather: success,
        [`weather${THROUGHPUT_KEY}`]: throughput
    };
}

function minute(hh, mi) {
    return new Date(2026, 2, 18, hh, mi);
}

//
// the minute report as the api actually returns it for a stream it treats as
// continuous: a row on every one of the 60 minutes, carrying a run on every fifth
// and a filled-in zero on the other four.
//
function paddedMinuteReport() {
    return Array.from({ length: 60 }, (v, i) => wx(minute(14, i), i % 5 === 0 ? 190 + i : 0));
}

describe('dropPaddedEmpties', () => {
    it('takes the api padding off a minute report', () => {
        //
        // the defect this was written for: 'usnationalweather' is scheduled every five
        // minutes, so the report's own fill states four zeros between each run and the
        // stacked area drops to the axis between every one of them -- twelve separate
        // humps where the stream was behaving perfectly.
        //
        const dropped = dropPaddedEmpties(paddedMinuteReport(), 'minute', FIELD, WEATHER);

        expect(dropped).toHaveLength(12);
        expect(dropped.every(v => v[`weather${THROUGHPUT_KEY}`] > 0)).toBe(true);
        expect(dropped[0][FIELD]).toEqual(minute(14, 0));
        expect(dropped[11][FIELD]).toEqual(minute(14, 55));
    });

    it('leaves the S&P 500 daily gap alone', () => {
        //
        // THE case to hold: the monday nothing was captured on has no row in the daily
        // report at all, so there is no zero here to drop -- and a report that skips a
        // day is not contiguous, so this never runs on it. The gap is drawn by
        // 'fillMissingIntervals' and has to survive untouched.
        //
        const rows = WEEKDAYS
            .filter(d => d.getTime() !== day(2026, 3, 9).getTime())
            .map(d => row(d));

        expect(dropPaddedEmpties(rows, 'day', FIELD, SOURCE)).toBe(rows);
    });

    it('gives back a zero the daily fill is entitled to', () => {
        //
        // the composition is what makes the drop safe rather than the drop alone. A
        // continuous stream's DAILY report is padded and contiguous too, so a genuine
        // outage day comes off here -- and the fill immediately puts it back, because a
        // rate it can grade is a rate whose expected intervals it can name.
        //
        const outage = [13, 14, 15, 16, 17]
            .map(d => wx(day(2026, 3, d), d === 15 ? 0 : 5));
        const dropped = dropPaddedEmpties(outage, 'day', FIELD, WEATHER);

        expect(dropped).toHaveLength(4);

        const filled = fillMissingIntervals(dropped, 'usnationalweather', 'day', FIELD, WEATHER, NOW);

        expect(dates(filled.map(v => v[FIELD])))
            .toEqual([[2026, 3, 13], [2026, 3, 14], [2026, 3, 15], [2026, 3, 16], [2026, 3, 17]]);
        expect(filled[2].weather).toBe(0);
    });

    it('keeps a report that carries only what it observed', () => {
        //
        // 'sec' runs on the same five minute cadence but its report is not padded, so it
        // returns twelve rows five minutes apart. Those are already the shape the chart
        // wants -- and their spacing is what proves nothing was filled in.
        //
        const rows = Array.from({ length: 12 }, (v, i) => wx(minute(14, i * 5), 1600 + i));

        expect(dropPaddedEmpties(rows, 'minute', FIELD, WEATHER)).toBe(rows);
    });

    it('keeps an interval where the scraper ran and everything failed', () => {
        //
        // zero successes is not zero throughput. Dropping it would hide the failure and
        // leave the listing's health describing rows the chart no longer shows.
        //
        const rows = paddedMinuteReport();
        rows[7] = wx(minute(14, 7), 0, 12);

        const dropped = dropPaddedEmpties(rows, 'minute', FIELD, WEATHER);

        expect(dropped).toHaveLength(13);
        expect(dropped.map(v => v[FIELD])).toContainEqual(minute(14, 7));
    });

    it('returns a wholly empty report untouched', () => {
        //
        // every row would otherwise be dropped and the chart would render blank, which
        // claims less than the flat zero line an hour-long outage deserves.
        //
        const rows = Array.from({ length: 60 }, (v, i) => wx(minute(14, i), 0));

        expect(dropPaddedEmpties(rows, 'minute', FIELD, WEATHER)).toBe(rows);
    });

    it('will not call two rows a padded report', () => {
        //
        // two adjacent buckets are one interval apart in any report that has two rows at
        // all, which says nothing about whether the empty ones were filled in.
        //
        const rows = [wx(minute(14, 0), 190), wx(minute(14, 1), 0)];

        expect(dropPaddedEmpties(rows, 'minute', FIELD, WEATHER)).toBe(rows);
    });

    it('leaves a rate it cannot step alone', () => {
        //
        // spacing cannot be judged without a unit to judge it in, so an unknown rate is
        // returned whole rather than measured against an assumed one.
        //
        const rows = paddedMinuteReport();

        expect(dropPaddedEmpties(rows, 'fortnight', FIELD, WEATHER)).toBe(rows);
        expect(dropPaddedEmpties(rows, null, FIELD, WEATHER)).toBe(rows);
    });

    it('drops an unusable row along with the padding', () => {
        //
        // the rows arrive from a worker and are merged across several callbacks, so a
        // hole or an unparsed date is cheaper to tolerate than to prove impossible --
        // neither can claim an interval, and neither belongs on the chart.
        //
        const rows = [null, { [FIELD]: new Date('nonsense') }, ...paddedMinuteReport()];
        const dropped = dropPaddedEmpties(rows, 'minute', FIELD, WEATHER);

        expect(dropped).toHaveLength(12);
        expect(dropped.every(v => v && v[FIELD] instanceof Date)).toBe(true);
    });

    it('keeps everything for a stream with no source list', () => {
        //
        // no series can be named, so no row can be shown to be empty.
        //
        const rows = paddedMinuteReport();

        expect(dropPaddedEmpties(rows, 'minute', FIELD, null)).toBe(rows);
    });

    it('survives being handed no rows at all', () => {
        expect(dropPaddedEmpties([], 'minute', FIELD, WEATHER)).toEqual([]);
        expect(dropPaddedEmpties(null, 'minute', FIELD, WEATHER)).toBeNull();
    });
});
