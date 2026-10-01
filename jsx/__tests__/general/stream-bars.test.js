/**
 * stream-bars.test.js: one stream's window as a row of bars.
 *
 * Each bar is asked two questions: did the interval carry rows, and was a run due
 * in it. The answers are pinned against a fixed 'now' -- Wednesday 2026-09-30,
 * noon -- so the window is the same twenty days, or sixty minutes, on every run.
 *
 * Note: the rows are bucketed on LOCAL getters and the schedules are read in
 *       eastern, so every date here depends on the TZ pin in jest.config.js. They
 *       are written as local times for that reason.
 */

import THROUGHPUT_KEY from '../../import/general/throughput-key.js';
import {
    HEALTH_BANDS,
    healthBand,
    streamBars,
    barWhen,
    barSummary,
    scheduleLabel,
} from '../../import/general/stream-bars.js';

const FIELD = 'window_start';
const NOW = new Date(2026, 8, 30, 12, 0, 0);

//
// an aggregated row, as toggleChartScale leaves it: one series and its throughput
//
function row(source, date, records, throughput = records) {
    return {
        [FIELD]: date,
        [source]: records,
        [`${source}${THROUGHPUT_KEY}`]: throughput,
    };
}

//
// the bar that starts at `date`
//
function barAt(bars, date) {
    return bars.find((bar) => bar.start.valueOf() === date.valueOf());
}

const day = (d) => new Date(2026, 8, d);

describe('a health band', () => {
    it.each([
        [1, 0],
        [0.999, 1],
        [0.95, 1],
        [0.9, 2],
        [0.8, 2],
        [0.5, 3],
        [0.49, 4],
        [0, 4],
    ])('puts %s in band %s', (health, band) => {
        expect(healthBand(health)).toBe(band);
    });

    it('falls to the last band for a health below every floor', () => {
        expect(healthBand(-1)).toBe(HEALTH_BANDS.length - 1);
    });
});

describe('the bars of a weekday stream, by the day', () => {
    //
    // sec runs on weekdays. Its report carries the 14th, 15th and 17th and the
    // 29th: the 16th is a weekday it missed, the weekends are none of its business,
    // the 11th is older than its first row, and the 30th is still filling.
    //
    const rows = [
        row('sec', day(14), 120),
        row('sec', day(15), 90, 100),
        row('sec', day(17), 40),
        row('sec', day(29), 60),
    ];
    const bars = streamBars(rows, 'sec', 'day', FIELD, ['sec'], NOW);

    it('draws one bar per day of the twenty-day window, oldest first', () => {
        expect(bars).toHaveLength(20);
        expect(bars[0].start).toEqual(day(11));
        expect(bars[19].start).toEqual(day(30));
    });

    it('draws a day that reported as its records, what failed, and its health', () => {
        expect(barAt(bars, day(15))).toEqual({
            start: day(15),
            kind: 'reported',
            records: 90,
            failed: 10,
            health: 0.9,
        });
        expect(barAt(bars, day(14)).failed).toBe(0);
        expect(barAt(bars, day(14)).health).toBe(1);
    });

    it('draws a weekday that reported nothing as missed', () => {
        expect(barAt(bars, day(16)).kind).toBe('missed');
    });

    it('draws a weekend as not scheduled', () => {
        expect(barAt(bars, day(19)).kind).toBe('off');
        expect(barAt(bars, day(20)).kind).toBe('off');
    });

    it('does not call a day older than the first row missed', () => {
        //
        // a stream whose report only reaches back so far would otherwise draw every
        // day before it as an outage -- see missingIntervals
        //
        expect(barAt(bars, day(11)).kind).toBe('pending');
    });

    it('does not call the day still filling missed', () => {
        expect(barAt(bars, day(30)).kind).toBe('pending');
    });
});

describe('a row that carried nothing', () => {
    it('is not read as a report, so a zeroed day is still missed', () => {
        //
        // the page zeroes every missing interval before the bars see it -- see
        // fillMissingIntervals -- and a zeroed row must not answer that it arrived
        //
        const rows = [
            row('sec', day(14), 120),
            row('sec', day(15), 0, 0),
            row('sec', day(16), 50),
        ];

        expect(barAt(streamBars(rows, 'sec', 'day', FIELD, ['sec'], NOW), day(15)).kind).toBe('missed');
    });

    it('skips a row whose date never parsed', () => {
        const rows = [
            row('sec', day(14), 120),
            { [FIELD]: new Date('not a date'), sec: 5, [`sec${THROUGHPUT_KEY}`]: 5 },
            { [FIELD]: 'a string', sec: 5, [`sec${THROUGHPUT_KEY}`]: 5 },
            null,
        ];
        const bars = streamBars(rows, 'sec', 'day', FIELD, ['sec'], NOW);

        expect(bars.filter((bar) => bar.kind === 'reported')).toHaveLength(1);
    });

    it('counts a series that is not a number as nothing', () => {
        const rows = [{ [FIELD]: day(14), sec: 'lots', [`sec${THROUGHPUT_KEY}`]: 10 }];

        expect(barAt(streamBars(rows, 'sec', 'day', FIELD, ['sec'], NOW), day(14)).records).toBe(0);
    });
});

describe('a stream with more than one series', () => {
    it('sums them into one bar', () => {
        const rows = [{
            [FIELD]: day(29),
            options: 30,
            price: 12,
            [`options${THROUGHPUT_KEY}`]: 30,
            [`price${THROUGHPUT_KEY}`]: 14,
        }];
        const bar = barAt(streamBars(rows, 'stock-market', 'day', FIELD, ['options', 'price'], NOW), day(29));

        expect(bar.records).toBe(42);
        expect(bar.failed).toBe(2);
    });
});

describe('the bars by the minute', () => {
    //
    // us-national-weather runs 'rate(5 minutes)', so its run lands anywhere in its
    // five minutes: here at :02 past, in the window's 11:02 and 11:07. The minute
    // its window opens on carries nothing and is not a miss.
    //
    const rows = [
        row('weather', new Date(2026, 8, 30, 11, 2), 8),
        row('weather', new Date(2026, 8, 30, 11, 7), 9),
    ];
    const bars = streamBars(rows, 'us-national-weather', 'minute', FIELD, ['weather'], NOW);
    const at = (minute) => barAt(bars, new Date(2026, 8, 30, 11, minute));

    it('draws one bar per minute of the sixty-minute window', () => {
        expect(bars).toHaveLength(60);
    });

    it('draws the minute a run landed in', () => {
        expect(at(2).kind).toBe('reported');
        expect(at(7).records).toBe(9);
    });

    it('draws the minute its window opens on as between runs, not missed', () => {
        expect(at(5).kind).toBe('between');
    });

    it('draws a minute no run was due in as not scheduled', () => {
        expect(at(3).kind).toBe('off');
    });

    it('draws a window whose run never landed as missed', () => {
        expect(at(10).kind).toBe('missed');
    });
});

describe('a window that has ended (#159)', () => {
    //
    // 'now' is where the window ends and 'clock' the present. Asked for after
    // the window has ended, its last day is no longer filling: a weekday with
    // nothing is a miss, where in the window ending now it waits
    //
    const END = new Date(2026, 8, 29, 23, 59, 59, 999);
    const CLOCK = new Date(2026, 9, 5, 9, 0);
    const rows = [row('sec', day(14), 120), row('sec', day(15), 90, 100)];

    it('draws the last day as missed once the clock has left it', () => {
        const bars = streamBars(rows, 'sec', 'day', FIELD, ['sec'], END, CLOCK);

        expect(bars[bars.length - 1].start).toEqual(day(29));
        expect(bars[bars.length - 1].kind).toBe('missed');
    });

    it('leaves it pending while the clock is still in it', () => {
        const bars = streamBars(rows, 'sec', 'day', FIELD, ['sec'], END);

        expect(bars[bars.length - 1].kind).toBe('pending');
    });
});

describe('a rate it has no window for', () => {
    it('draws nothing', () => {
        expect(streamBars([], 'sec', 'second', FIELD, ['sec'], NOW)).toEqual([]);
        expect(streamBars([], 'sec', undefined, FIELD, ['sec'], NOW)).toEqual([]);
    });
});

describe('a stream with no schedule', () => {
    it('draws its rows and calls nothing else due', () => {
        const bars = streamBars([row('x', day(29), 3)], 'no-such-stream', 'day', FIELD, ['x'], NOW);

        expect(barAt(bars, day(29)).kind).toBe('reported');
        expect(bars.filter((bar) => bar.kind !== 'reported').every((bar) => bar.kind === 'off')).toBe(true);
    });

    it('draws every interval of the window when there are no rows at all', () => {
        expect(streamBars(null, 'sec', 'hour', FIELD, ['sec'], NOW)).toHaveLength(24);
    });
});

describe('when a bar was', () => {
    const start = new Date(2026, 8, 30, 15, 5);

    it.each([
        ['month', 'September 2026'],
        ['day', 'Wed, Sep 30'],
        ['hour', 'Wed, Sep 30, 3 PM'],
        ['minute', 'Wed, Sep 30, 3:05 PM'],
    ])('is said to the %s', (rate, said) => {
        //
        // newer ICU puts a narrow no-break space before the AM or PM
        //
        expect(barWhen(start, rate).replace(/\u202f/g, ' ')).toBe(said);
    });

    it('is said in full for a rate it does not know', () => {
        expect(barWhen(start, 'second')).toBe(start.toLocaleString('en-US', {}));
    });
});

describe('what a bar says of itself', () => {
    it('counts the records of a bar that reported', () => {
        expect(barSummary({ kind: 'reported', records: 1234, failed: 0, health: 1 })).toBe('1,234 records');
        expect(barSummary({ kind: 'reported', records: 1, failed: 0, health: 1 })).toBe('1 record');
    });

    it('says what failed, and the health that leaves', () => {
        expect(barSummary({ kind: 'reported', records: 90, failed: 10, health: 0.9 }))
            .toBe('90 records, 10 failed (health 90%)');
    });

    it.each([
        ['missed', 'Missed: a run was due, and nothing reported'],
        ['between', 'Between runs: the run due here landed in another minute'],
        ['off', 'Not scheduled'],
        ['pending', 'Nothing reported yet'],
        ['something else', ''],
    ])('says what a bar of kind %s is', (kind, said) => {
        expect(barSummary({ kind })).toBe(said);
    });
});

describe('how often a stream runs', () => {
    it.each([
        ['stock-market', 'weekdays, every 20 min'],
        ['stock-split', 'weekdays, once a day'],
        ['bls', 'once a day'],
        ['sec', 'weekdays, every 5 min'],
        ['us-national-weather', 'daily, every 5 min'],
        ['no-such-stream', ''],
    ])('%s: %s', (stream, said) => {
        expect(scheduleLabel(stream)).toBe(said);
    });
});
