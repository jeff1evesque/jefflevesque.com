/**
 * ingest-schedule.test.js: when each stream's scraper is supposed to run.
 *
 * This module decides whether a missing interval is a gap or a Saturday. Get it
 * wrong and the coverage figure reports an outage that never happened, or hides
 * one that did -- neither shows up as an error, only as a wrong number.
 *
 * Everything is read on EASTERN wall-clock, not the viewer's, because the
 * scrapers are scheduled there. So the fixtures below are UTC instants chosen for
 * the eastern time they land on, and each is annotated with it. They straddle the
 * daylight saving change on purpose: 14:00Z is 10:00 in March (EDT) and 09:00 in
 * January (EST), which is exactly the shift that would make an hour-gated stream
 * look unscheduled for half the year if the zone were ignored.
 */

import {
    INGEST_SCHEDULE,
    coverageSupported,
    expectedIntervals,
    intervalExpected,
    runsContinuously
} from '../../import/general/ingest-schedule.js';

//
// verified against Intl before being written down.
//
const MON_1000_EDT = new Date('2026-03-16T14:00:00Z');   // Mon 10:00
const MON_1010_EDT = new Date('2026-03-16T14:10:00Z');   // Mon 10:10
const MON_1005_EDT = new Date('2026-03-16T14:05:00Z');   // Mon 10:05
const SAT_1000_EDT = new Date('2026-03-21T14:00:00Z');   // Sat 10:00
const MON_0900_EST = new Date('2026-01-19T14:00:00Z');   // Mon 09:00, winter
const SUN_2200_EST = new Date('2026-03-16T02:00:00Z');   // Sun 22:00
const MON_1700_EDT = new Date('2026-03-16T21:00:00Z');   // Mon 17:00
const MON_0800_EDT = new Date('2026-03-16T12:00:00Z');   // Mon 08:00
const MON_1500_EDT = new Date('2026-03-16T19:00:00Z');   // Mon 15:00
const MON_1500_EST = new Date('2026-01-19T20:00:00Z');   // Mon 15:00, winter

describe('INGEST_SCHEDULE', () => {
    it('describes all five streams', () => {
        expect(Object.keys(INGEST_SCHEDULE).sort()).toEqual([
            'bls', 'sec', 'stockmarket', 'stockmarketstocksplit', 'usnationalweather',
        ]);
    });

    it('gives every stream all four fields', () => {
        Object.values(INGEST_SCHEDULE).forEach(s => {
            expect(s).toHaveProperty('hours');
            expect(s).toHaveProperty('weekdays');
            expect(s).toHaveProperty('every');
            expect(s).toHaveProperty('partition');
        });
    });

    it('partitions by day or year and nothing else', () => {
        Object.values(INGEST_SCHEDULE).forEach(s => {
            expect(['day', 'year']).toContain(s.partition);
        });
    });

    it('names a minute spacing for the three streams that have one', () => {
        //
        // stockmarket schedules its minutes outright ('0,10,20,30,40,50'), so its
        // spacing comes off the cron. weather and sec are both 'rate(5 minutes)',
        // whose offset the expression does not fix -- theirs is read off the live
        // report instead, where every bucket of a trailing hour sits on a multiple
        // of five. bls and stock-split run a handful of times a day at fixed
        // minutes and are the two that stay ungraded.
        //
        const withSpacing = Object.entries(INGEST_SCHEDULE)
            .filter(([, s]) => s.every)
            .map(([name]) => name)
            .sort();

        expect(withSpacing).toEqual(['sec', 'stockmarket', 'usnationalweather']);
        expect(INGEST_SCHEDULE.stockmarket.every).toBe(10);
        expect(INGEST_SCHEDULE.usnationalweather.every).toBe(5);
        expect(INGEST_SCHEDULE.sec.every).toBe(5);
    });
});

describe('intervalExpected', () => {
    it('rejects a stream it does not know', () => {
        expect(intervalExpected('nosuchstream', 'day', MON_1000_EDT)).toBe(false);
        expect(intervalExpected(null, 'day', MON_1000_EDT)).toBe(false);
    });

    describe('the monthly rate', () => {
        it('is always expected, even on a weekend', () => {
            //
            // a month contains weekdays whatever else it contains, so the weekday
            // gate is not applied -- and this returns before that check.
            //
            expect(intervalExpected('sec', 'month', SAT_1000_EDT)).toBe(true);
            expect(intervalExpected('stockmarket', 'month', SAT_1000_EDT)).toBe(true);
        });
    });

    describe('the weekday gate', () => {
        it('excludes saturday for a weekday-only stream', () => {
            expect(intervalExpected('sec', 'day', SAT_1000_EDT)).toBe(false);
            expect(intervalExpected('stockmarket', 'day', SAT_1000_EDT)).toBe(false);
        });

        it('does not exclude a weekend for a stream that runs every day', () => {
            //
            // weather and bls both report at weekends -- bls because eight of
            // its ten feeds report daily, the other two only on tuesdays.
            //
            expect(intervalExpected('usnationalweather', 'day', SAT_1000_EDT)).toBe(true);
            expect(intervalExpected('bls', 'day', SAT_1000_EDT)).toBe(true);
        });

        it('reads the weekday on eastern time, not the viewer\'s', () => {
            //
            // 2026-03-16T02:00:00Z is already Monday in UTC but still Sunday
            // 22:00 in New York. A weekday-only stream must read the eastern day.
            //
            expect(intervalExpected('sec', 'day', SUN_2200_EST)).toBe(false);
        });
    });

    describe('the daily rate', () => {
        it('is expected on any weekday, whatever the hour', () => {
            //
            // the hours narrow an hourly or finer chart only: a daily interval is
            // expected if the scraper runs at any point that day.
            //
            expect(intervalExpected('stockmarket', 'day', MON_0800_EDT)).toBe(true);
            expect(intervalExpected('stockmarket', 'day', MON_1700_EDT)).toBe(true);
        });
    });

    describe('the hourly rate, against an hour RANGE', () => {
        it('accepts an hour inside the range', () => {
            // sec: hours [6, 22] is a range, 6 through 22 inclusive
            expect(intervalExpected('sec', 'hour', MON_1000_EDT)).toBe(true);
        });

        it('rejects an hour outside the range', () => {
            // stockmarket: hours [9, 15], so 17:00 is past the close
            expect(intervalExpected('stockmarket', 'hour', MON_1700_EDT)).toBe(false);
        });

        it('accepts the first hour of the range', () => {
            expect(intervalExpected('stockmarket', 'hour', MON_0900_EST)).toBe(true);
        });
    });

    describe('the hourly rate, against a LIST of hours', () => {
        it('accepts an hour named in the list', () => {
            // bls: hours [15] is a list, not a range
            expect(intervalExpected('bls', 'hour', MON_1500_EDT)).toBe(true);
        });

        it('rejects every hour the list does not name', () => {
            //
            // the hours the stream used to report in. since 2026-08-15 all ten
            // feeds are collected together at 15 eastern, so an interval at
            // 08:00 is no longer owed anything and grading one would report an
            // outage that cannot happen.
            //
            [MON_0800_EDT, MON_1000_EDT, MON_1700_EDT].forEach(d => {
                expect(intervalExpected('bls', 'hour', d)).toBe(false);
            });
        });

        it('reads the hour on eastern time, not UTC', () => {
            //
            // 20:00Z is 15:00 eastern in january and 16:00 in march. read as
            // utc the run would look scheduled at 20:00 year round, and the one
            // hour bls actually reports in would count as a gap every day.
            //
            expect(intervalExpected('bls', 'hour', MON_1500_EST)).toBe(true);
            expect(intervalExpected('bls', 'hour', new Date('2026-03-16T20:00:00Z'))).toBe(false);
        });
    });

    describe('an unrestricted stream', () => {
        it('expects every hour', () => {
            // usnationalweather: hours null
            [MON_0800_EDT, MON_1000_EDT, MON_1700_EDT, SUN_2200_EST].forEach(d => {
                expect(intervalExpected('usnationalweather', 'hour', d)).toBe(true);
            });
        });
    });

    describe('the minute rate', () => {
        it('accepts a minute on the spacing', () => {
            expect(intervalExpected('stockmarket', 'minute', MON_1000_EDT)).toBe(true);
            expect(intervalExpected('stockmarket', 'minute', MON_1010_EDT)).toBe(true);
        });

        it('rejects a minute off the spacing', () => {
            expect(intervalExpected('stockmarket', 'minute', MON_1005_EDT)).toBe(false);
        });

        it('accepts a five minute spacing on the five', () => {
            //
            // 10:05 is off stockmarket's ten minute spacing and on the five minute
            // one the other two run, so the same instant answers differently per
            // stream -- which is the whole point of reading 'every' rather than
            // assuming one cadence.
            //
            expect(intervalExpected('usnationalweather', 'minute', MON_1005_EDT)).toBe(true);
            expect(intervalExpected('sec', 'minute', MON_1005_EDT)).toBe(true);
            expect(intervalExpected('usnationalweather', 'minute', MON_1010_EDT)).toBe(true);
        });

        it('rejects a minute off the five', () => {
            // 10:07 is on no spacing this table names
            const MON_1007_EDT = new Date('2026-03-16T14:07:00Z');

            expect(intervalExpected('usnationalweather', 'minute', MON_1007_EDT)).toBe(false);
            expect(intervalExpected('sec', 'minute', MON_1007_EDT)).toBe(false);
        });

        it('still applies the hour gate to a five minute stream', () => {
            //
            // sec is graded by minute now, but only inside the hours it runs: 23:05
            // is past its 6-22 window, so a minute on the five there is owed
            // nothing. weather has no hours at all and takes the same minute.
            //
            const MON_1705_EDT = new Date('2026-03-16T21:05:00Z');
            const MON_2305_EDT = new Date('2026-03-17T03:05:00Z');

            expect(intervalExpected('sec', 'minute', MON_1705_EDT)).toBe(true);
            expect(intervalExpected('sec', 'minute', MON_2305_EDT)).toBe(false);
            expect(intervalExpected('usnationalweather', 'minute', MON_2305_EDT)).toBe(true);
        });

        it('rejects every minute for a stream with no spacing', () => {
            //
            // reached through arithmetic rather than a guard: 'every' is null, so
            // 'minute % null' is NaN and 'NaN === 0' is false. The outcome is the
            // intended one -- bls and stock-split go ungraded at the minute rate --
            // and coverageSupported is what stops the question being asked at all.
            //
            expect(intervalExpected('bls', 'minute', MON_0800_EDT)).toBe(false);
            expect(intervalExpected('bls', 'minute', MON_1500_EDT)).toBe(false);
            expect(intervalExpected('stockmarketstocksplit', 'minute', MON_1000_EDT)).toBe(false);
        });
    });

    it('is case insensitive about both stream and rate', () => {
        expect(intervalExpected('StockMarket', 'DAY', MON_1000_EDT)).toBe(true);
        expect(intervalExpected('SEC', 'Hour', MON_1000_EDT)).toBe(true);
    });
});

describe('coverageSupported', () => {
    it('rejects an unknown stream', () => {
        expect(coverageSupported('nosuchstream', 'day')).toBe(false);
    });

    it('rejects a rate the chart does not offer', () => {
        //
        // gated on ROLLING_WINDOW, so 'second' -- which the frontend deliberately
        // does not carry -- is refused here too rather than being graded against
        // a window that does not exist.
        //
        expect(coverageSupported('stockmarket', 'second')).toBe(false);
        expect(coverageSupported('stockmarket', 'week')).toBe(false);
    });

    it('supports the monthly rate for every stream, however it is partitioned', () => {
        //
        // FIXED: a day-partitioned stream used to be refused here. Twelve months is
        // ~365 day partitions -- past both the url length a gateway carries and the
        // api's own 31 item cap -- so that rate asked only for the current month, and
        // the eleven months never requested would have been graded as gaps.
        //
        // The page now sends a stream name rather than paths, and the api resolves the
        // the whole window arrives for a day-partitioned stream too and there is
        // nothing left for the gate to protect against.
        //
        expect(coverageSupported('bls', 'month')).toBe(true);                    // year
        expect(coverageSupported('stockmarketstocksplit', 'month')).toBe(true);  // year
        expect(coverageSupported('sec', 'month')).toBe(true);                    // day
        expect(coverageSupported('stockmarket', 'month')).toBe(true);            // day
        expect(coverageSupported('usnationalweather', 'month')).toBe(true);      // day
    });

    it('supports the minute rate only where a spacing is known', () => {
        expect(coverageSupported('stockmarket', 'minute')).toBe(true);
        expect(coverageSupported('usnationalweather', 'minute')).toBe(true);
        expect(coverageSupported('sec', 'minute')).toBe(true);
        expect(coverageSupported('bls', 'minute')).toBe(false);
        expect(coverageSupported('stockmarketstocksplit', 'minute')).toBe(false);
    });

    it('supports the hourly and daily rates for every stream', () => {
        Object.keys(INGEST_SCHEDULE).forEach(stream => {
            expect(coverageSupported(stream, 'hour')).toBe(true);
            expect(coverageSupported(stream, 'day')).toBe(true);
        });
    });
});

describe('runsContinuously', () => {
    it('is true only for a stream with no hour and no weekday restriction', () => {
        //
        // this decides whether the REPORT is asked to fill empty intervals, which
        // is a different question from whether coverage can be stated. The fill
        // treats every empty interval as a gap, so on a weekday-only stream it
        // would draw a zero across every weekend and show an outage that never
        // happened.
        //
        expect(runsContinuously('usnationalweather')).toBe(true);
    });

    it('is false for an hour-restricted stream', () => {
        expect(runsContinuously('sec')).toBe(false);
        expect(runsContinuously('stockmarket')).toBe(false);
        expect(runsContinuously('bls')).toBe(false);
        expect(runsContinuously('stockmarketstocksplit')).toBe(false);
    });

    it('is false for an unknown stream', () => {
        expect(runsContinuously('nosuchstream')).toBe(false);
        expect(runsContinuously(null)).toBe(false);
    });
});

describe('expectedIntervals', () => {
    const NOW = new Date('2026-03-16T14:00:00Z');   // Mon 10:00 eastern

    it('returns nothing when coverage is unsupported', () => {
        //
        // 'sec' at the monthly rate used to belong here, back when a day-partitioned
        // stream could not fetch that window. It is graded now -- see the
        // coverageSupported case above.
        //
        expect(expectedIntervals('stockmarketstocksplit', 'minute', NOW)).toEqual([]);
        expect(expectedIntervals('bls', 'minute', NOW)).toEqual([]);
        expect(expectedIntervals('nosuchstream', 'day', NOW)).toEqual([]);
    });

    it('enumerates a five minute window on the five', () => {
        //
        // twelve stops in a trailing hour for a stream on 'rate(5 minutes)', every
        // one of them a multiple of five. weather is unrestricted, so this reaches
        // the spacing alone with no hour or weekday gate in front of it.
        //
        const intervals = expectedIntervals('usnationalweather', 'minute', NOW);

        expect(intervals).toHaveLength(12);
        intervals.forEach(v => expect(v.getMinutes() % 5).toBe(0));
    });

    it('grades a monthly window for a day-partitioned stream', () => {
        //
        // the point of the batching change: the twelve month window now arrives for
        // these streams, so it can be counted against.
        //
        expect(expectedIntervals('sec', 'month', NOW).length).toBeGreaterThan(1);
        expect(expectedIntervals('stockmarket', 'month', NOW).length).toBeGreaterThan(1);
        expect(expectedIntervals('usnationalweather', 'month', NOW).length).toBeGreaterThan(1);
    });

    it('returns nothing for a rate with no window', () => {
        expect(expectedIntervals('stockmarket', 'second', NOW)).toEqual([]);
    });

    it('generates intervals rather than reading them off a report', () => {
        //
        // the whole point: the report only carries an interval something landed
        // in, and the missing ones are exactly what is being counted.
        //
        const intervals = expectedIntervals('usnationalweather', 'day', NOW);

        expect(intervals.length).toBeGreaterThan(0);
        intervals.forEach(d => expect(d).toBeInstanceOf(Date));
    });

    it('runs oldest first', () => {
        const intervals = expectedIntervals('usnationalweather', 'day', NOW);

        for (let i = 1; i < intervals.length; i++) {
            expect(intervals[i].getTime()).toBeGreaterThan(intervals[i - 1].getTime());
        }
    });

    it('omits weekends for a weekday-only stream', () => {
        //
        // the reason coverage does not need FillEmptyBuckets: it counts only the
        // intervals it expects, so a weekend is never a gap.
        //
        const intervals = expectedIntervals('sec', 'day', NOW);
        const weekdays = intervals.map(d => new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York', weekday: 'short',
        }).format(d));

        expect(weekdays).not.toContain('Sat');
        expect(weekdays).not.toContain('Sun');
    });

    it('includes weekends for a stream that runs every day', () => {
        const intervals = expectedIntervals('usnationalweather', 'day', NOW);
        const weekdays = new Set(intervals.map(d => new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York', weekday: 'short',
        }).format(d)));

        expect(weekdays.has('Sat') || weekdays.has('Sun')).toBe(true);
    });

    it('steps a month window by months, not by days', () => {
        //
        // stepping a twelve month window by days would enumerate ~365 stops and
        // count each as an interval, reporting coverage against 365 expected
        // months.
        //
        const intervals = expectedIntervals('bls', 'month', NOW);

        expect(intervals.length).toBeLessThanOrEqual(12);
    });

    it('keeps every minute interval on the spacing', () => {
        const intervals = expectedIntervals('stockmarket', 'minute', NOW);

        intervals.forEach(d => {
            const minute = Number(new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York', minute: 'numeric',
            }).format(d));

            expect(minute % 10).toBe(0);
        });
    });

    it('keeps every hourly interval inside the stream\'s hours', () => {
        const intervals = expectedIntervals('stockmarket', 'hour', NOW);

        intervals.forEach(d => {
            const hour = Number(new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York', hour: 'numeric', hour12: false,
            }).format(d)) % 24;

            expect(hour).toBeGreaterThanOrEqual(9);
            expect(hour).toBeLessThanOrEqual(15);
        });
    });

    it('never returns an interval later than now', () => {
        const intervals = expectedIntervals('usnationalweather', 'hour', NOW);

        intervals.forEach(d => expect(d.getTime()).toBeLessThanOrEqual(NOW.getTime()));
    });

    it('does not mutate the date it was given', () => {
        const now = new Date('2026-03-16T14:00:00Z');
        const before = now.getTime();

        expectedIntervals('usnationalweather', 'day', now);

        expect(now.getTime()).toBe(before);
    });
});
