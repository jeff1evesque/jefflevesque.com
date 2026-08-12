/**
 * rolling-window.test.js: the trailing range each ingest rate reports.
 *
 * This module decides two things at once: what the chart draws, and which
 * artifacts the request has to name. When they disagree the result is not an
 * error -- it is a chart that thins out and reads as an outage. So the
 * assertions here are about exact boundaries rather than about shape.
 *
 * Every function takes 'now' as an argument, so these drive fixed instants
 * rather than mocking the clock. All arithmetic in the module is local-time
 * (setHours, setDate, setMonth), so the dates below are built local-time too and
 * the assertions hold in any zone.
 *
 * Note: the window is INCLUSIVE of the current bucket, so a 20 day window
 *       reaches back 19 days, not 20. That off-by-one is the easiest thing to
 *       get wrong here and is asserted directly.
 */

import {
    ROLLING_WINDOW,
    intervalStart,
    stepInterval,
    windowLabel,
    windowStart
} from '../../import/general/rolling-window.js';

//
// a mid-month, mid-afternoon instant: far enough from every boundary that a
// case crossing one is doing so because the window reaches, not because 'now'
// was chosen to sit on an edge.
//
const NOW = new Date(2026, 2, 15, 14, 20, 35, 500);   // 2026-03-15 14:20:35.500

function ymd(d) {
    return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
}

function hms(d) {
    return [d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()];
}

describe('ROLLING_WINDOW', () => {
    it('names a window for every rate the chart offers', () => {
        expect(ROLLING_WINDOW).toEqual({
            minute: 60,
            hour: 24,
            day: 20,
            month: 12,
        });
    });

    it('deliberately offers no per-second rate', () => {
        //
        // api-stream-performance's ROLLING_WINDOW does carry 'second': 60, so the
        // two maps differ. That asymmetry is intentional and safe in this
        // direction -- the backend can serve a window the chart never asks for.
        // The dangerous direction is the reverse, a chart asking for a window the
        // report cannot produce, which is what report.py's comment warns about.
        //
        // Ingest is not frequent enough for a per-second chart to carry signal,
        // so the rate is not offered here. Pinned so adding one is a decision
        // rather than an accident.
        //
        expect(ROLLING_WINDOW).not.toHaveProperty('second');
    });
});

describe('stepInterval', () => {
    //
    // two callers depend on this agreeing with itself: 'expectedIntervals' walks the
    // window enumerating what a scraper owed, and 'ingest-gaps.js' walks a report
    // asking whether its rows sit one interval apart. A stepper that disagreed
    // between them would have the chart drop rows the schedule still expected.
    //
    it('steps each rate by its own unit', () => {
        expect(stepInterval(NOW, 'minute')).toEqual(new Date(2026, 2, 15, 14, 21, 35, 500));
        expect(stepInterval(NOW, 'hour')).toEqual(new Date(2026, 2, 15, 15, 20, 35, 500));
        expect(ymd(stepInterval(NOW, 'day'))).toEqual([2026, 3, 16]);
        expect(ymd(stepInterval(NOW, 'month'))).toEqual([2026, 4, 15]);
    });

    it('leaves the date it was handed alone', () => {
        //
        // 'expectedIntervals' reassigns its cursor rather than mutating it, so a
        // stepper that wrote through would corrupt the interval it had just pushed.
        //
        const before = NOW.valueOf();

        stepInterval(NOW, 'day');

        expect(NOW.valueOf()).toBe(before);
    });

    it('steps a day across a daylight boundary to the next midnight', () => {
        //
        // the date's own setters do the arithmetic rather than adding 24 hours: 2026-03-08
        // is 23 hours long in New York, and a fixed millisecond step would land at 01:00
        // on the 9th and put every later bucket an hour off its label.
        //
        const dst = new Date(2026, 2, 8);

        expect(stepInterval(dst, 'day')).toEqual(new Date(2026, 2, 9));
    });

    it('steps a month by its own length', () => {
        //
        // monthly buckets are dated to the 1st, which is the only date this can be asked
        // to step from without a short month truncating it.
        //
        expect(ymd(stepInterval(new Date(2026, 0, 1), 'month'))).toEqual([2026, 2, 1]);
        expect(ymd(stepInterval(new Date(2026, 11, 1), 'month'))).toEqual([2027, 1, 1]);
    });

    it('answers nothing for a rate it does not know', () => {
        //
        // matching 'intervalStart': a caller that cannot name the unit gets no answer
        // rather than a silently assumed one. 'ingest-gaps.js' reads this as 'the
        // spacing cannot be judged' and leaves the rows whole.
        //
        expect(stepInterval(NOW, 'fortnight')).toBeNull();
        expect(stepInterval(NOW, '')).toBeNull();
        expect(stepInterval(NOW, null)).toBeNull();
    });
});

describe('intervalStart', () => {
    //
    // the truncation windowStart performs before it shifts, exported on its own so a
    // caller can name the bucket an instant falls in. 'ingest-gaps.js' uses it to
    // recognise the interval that is still filling, which must not be drawn as a zero.
    //
    it.each([
        ['minute', [2026, 3, 15], [14, 20, 0, 0]],
        ['hour', [2026, 3, 15], [14, 0, 0, 0]],
        ['day', [2026, 3, 15], [0, 0, 0, 0]],
        ['month', [2026, 3, 1], [0, 0, 0, 0]],
    ])('%s truncates to its own unit and shifts nothing', (rate, date, time) => {
        const start = intervalStart(rate, NOW);

        expect(ymd(start)).toEqual(date);
        expect(hms(start)).toEqual(time);
    });

    it('dates a monthly bucket where the chart aggregator dates one', () => {
        //
        // the aggregator keys a monthly bucket as 'YYYY/MM/01'. A bucket named here
        // that landed anywhere else would never match a row, and every month would
        // read as a gap.
        //
        expect(intervalStart('month', new Date(2026, 2, 31, 23, 59, 59)).getDate()).toBe(1);
    });

    it('does not mutate the date it was given', () => {
        const now = new Date(2026, 2, 15, 14, 20, 35, 500);
        const before = now.getTime();

        intervalStart('day', now);

        expect(now.getTime()).toBe(before);
    });

    it('is case insensitive', () => {
        expect(intervalStart('Day', NOW)).toEqual(intervalStart('day', NOW));
    });

    it('returns null for a rate it does not offer', () => {
        //
        // the null is what makes windowStart's own null branch reachable, and what
        // stops the gap fill guessing a bucket for a rate it cannot name.
        //
        expect(intervalStart('week', NOW)).toBeNull();
        expect(intervalStart('', NOW)).toBeNull();
        expect(intervalStart(null, NOW)).toBeNull();
    });

    it('defaults to the current instant', () => {
        expect(intervalStart('day').getTime()).toBe(intervalStart('day', new Date()).getTime());
    });
});

describe('windowStart', () => {
    it('minute truncates to the minute and reaches back 59', () => {
        //
        // inclusive of the current minute: 14:20 back 59 minutes is 13:21, not
        // 13:20.
        //
        const start = windowStart('minute', NOW);

        expect(ymd(start)).toEqual([2026, 3, 15]);
        expect(hms(start)).toEqual([13, 21, 0, 0]);
    });

    it('hour truncates to the hour and crosses into the previous day', () => {
        //
        // 24 hours ending inside 14:00 starts at 15:00 yesterday, so the oldest
        // column is a whole hour rather than a partial one.
        //
        const start = windowStart('hour', NOW);

        expect(ymd(start)).toEqual([2026, 3, 14]);
        expect(hms(start)).toEqual([15, 0, 0, 0]);
    });

    it('day truncates to midnight and crosses into the previous month', () => {
        //
        // 20 days ending 15 March starts 24 February -- February 2026 has 28
        // days, so this also covers the short-month case.
        //
        const start = windowStart('day', NOW);

        expect(ymd(start)).toEqual([2026, 2, 24]);
        expect(hms(start)).toEqual([0, 0, 0, 0]);
    });

    it('month starts on the first of the month, twelve months back', () => {
        const start = windowStart('month', NOW);

        expect(ymd(start)).toEqual([2025, 4, 1]);
        expect(hms(start)).toEqual([0, 0, 0, 0]);
    });

    it('month does not spill a long month into a short one', () => {
        //
        // the guard this module documents: the date is set to the 1st BEFORE the
        // month is shifted. From 31 March, shifting first would ask for 31 April,
        // which javascript normalizes to 1 May -- a month later than intended,
        // silently dropping a month from the chart.
        //
        const start = windowStart('month', new Date(2026, 2, 31, 23, 59, 59));

        expect(ymd(start)).toEqual([2025, 4, 1]);
    });

    it('does not mutate the date it was given', () => {
        //
        // 'now' is the viewer's clock and is passed to several of these in turn;
        // a mutating implementation would make each call shift the next.
        //
        const now = new Date(2026, 2, 15, 14, 20, 35, 500);
        const before = now.getTime();

        windowStart('day', now);

        expect(now.getTime()).toBe(before);
    });

    it('is case insensitive', () => {
        expect(windowStart('MINUTE', NOW)).toEqual(windowStart('minute', NOW));
        expect(windowStart('Day', NOW)).toEqual(windowStart('day', NOW));
    });

    it('returns null for a rate it does not offer', () => {
        expect(windowStart('second', NOW)).toBeNull();
        expect(windowStart('week', NOW)).toBeNull();
        expect(windowStart('', NOW)).toBeNull();
        expect(windowStart(null, NOW)).toBeNull();
        expect(windowStart(undefined, NOW)).toBeNull();
    });
});

describe('windowLabel', () => {
    it('states the window it describes, for every rate', () => {
        expect(windowLabel('minute')).toBe('Last 60 Minutes');
        expect(windowLabel('hour')).toBe('Last 24 Hours');
        expect(windowLabel('day')).toBe('Last 20 Days');
        expect(windowLabel('month')).toBe('Last 12 Months');
    });

    it('takes its number from ROLLING_WINDOW rather than repeating it', () => {
        //
        // the label previously named the calendar period ('July') for a chart
        // already drawing a trailing 20 days. Deriving it here is what keeps the
        // two from drifting again.
        //
        Object.keys(ROLLING_WINDOW).forEach(rate => {
            expect(windowLabel(rate)).toContain(String(ROLLING_WINDOW[rate]));
        });
    });

    it('is case insensitive', () => {
        expect(windowLabel('DAY')).toBe('Last 20 Days');
        expect(windowLabel('Month')).toBe('Last 12 Months');
    });

    it('returns null for a rate it does not offer', () => {
        expect(windowLabel('second')).toBeNull();
        expect(windowLabel('week')).toBeNull();
        expect(windowLabel(null)).toBeNull();
    });
});
