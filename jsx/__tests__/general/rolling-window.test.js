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
    windowStart,
    localInstant,
    lastInstant,
    shiftInterval,
    pageWindow,
    finerWindow,
    windowHeading,
    WINDOW_CHOICES,
    choiceLabel,
    windowChoices,
    stepChoice
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
    // recognize the interval that is still filling, which must not be drawn as a zero.
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


//
// a window that has ended (#159): kept as the start of its last bucket, and
// measured from that bucket's last instant
//
const SEP = (day, hour = 0, minute = 0) => new Date(2026, 8, day, hour, minute);
const LATER = new Date(2026, 8, 30, 18, 15);

//
// newer ICU puts a narrow no-break space before the AM or PM
//
const plain = (text) => text.replace(/\u202f/g, ' ');

describe('localInstant', () => {
    it('writes an instant with the viewer\'s own offset', () => {
        //
        // jest.config.js pins New York, so September is -04:00 and January -05:00
        //
        expect(localInstant(SEP(17, 23))).toBe('2026-09-17T23:00:00-04:00');
        expect(localInstant(new Date(2026, 0, 5, 7, 8, 9))).toBe('2026-01-05T07:08:09-05:00');
    });

    it('names the instant it was given', () => {
        const when = SEP(17, 23, 30);

        expect(new Date(localInstant(when)).valueOf()).toBe(when.valueOf());
    });
});

describe('lastInstant', () => {
    it('is the millisecond before the next bucket', () => {
        expect(lastInstant('day', SEP(10))).toEqual(new Date(2026, 8, 10, 23, 59, 59, 999));
        expect(lastInstant('hour', SEP(17, 23))).toEqual(new Date(2026, 8, 17, 23, 59, 59, 999));
        expect(lastInstant('month', new Date(2025, 8, 1))).toEqual(new Date(2025, 8, 30, 23, 59, 59, 999));
    });

    it('measures the window that ends there as the window ending now would be', () => {
        expect(windowStart('day', lastInstant('day', SEP(10)))).toEqual(new Date(2026, 7, 22));
    });

    it('is null for a rate it does not know', () => {
        expect(lastInstant('week', SEP(10))).toBeNull();
    });
});

describe('shiftInterval', () => {
    it('moves a date whole intervals, on the calendar', () => {
        expect(shiftInterval(SEP(10), 'day', -20)).toEqual(new Date(2026, 7, 21));
        expect(shiftInterval(SEP(17, 5), 'hour', 24)).toEqual(SEP(18, 5));
        expect(shiftInterval(SEP(17, 12, 59), 'minute', -60)).toEqual(SEP(17, 11, 59));
        expect(shiftInterval(new Date(2025, 8, 1), 'month', 12)).toEqual(new Date(2026, 8, 1));
    });

    it('is null for a rate it does not know', () => {
        expect(shiftInterval(SEP(10), 'week', 1)).toBeNull();
    });
});

describe('pageWindow', () => {
    it('steps back a whole window from the window ending now', () => {
        //
        // the window ending now runs Sep 11 to Sep 30, so the page before ends on
        // Sep 10, and runs from Aug 22
        //
        expect(pageWindow('day', null, -1, LATER)).toEqual(SEP(10));
    });

    it('steps back again from a window that has ended', () => {
        expect(pageWindow('day', SEP(10), -1, LATER)).toEqual(new Date(2026, 7, 21));
        expect(pageWindow('hour', SEP(17, 23), -1, LATER)).toEqual(SEP(16, 23));
        expect(pageWindow('minute', SEP(17, 12, 59), -1, LATER)).toEqual(SEP(17, 11, 59));
        expect(pageWindow('month', new Date(2025, 8, 1), -1, LATER)).toEqual(new Date(2024, 8, 1));
    });

    it('steps forward, and stops at the window ending now', () => {
        expect(pageWindow('day', new Date(2026, 7, 21), 1, LATER)).toEqual(SEP(10));
        expect(pageWindow('day', SEP(10), 1, LATER)).toBeNull();
    });

    it('takes an end anywhere in its last bucket', () => {
        expect(pageWindow('day', SEP(10, 15, 30), -1, LATER)).toEqual(new Date(2026, 7, 21));
    });

    it('is null for a rate it does not know', () => {
        expect(pageWindow('week', null, -1, LATER)).toBeNull();
    });
});

describe('finerWindow', () => {
    it('opens a day into its 24 hours', () => {
        expect(finerWindow('day', SEP(17), LATER)).toEqual({ rate: 'hour', end: SEP(17, 23) });
    });

    it('opens an hour into its 60 minutes', () => {
        expect(finerWindow('hour', SEP(17, 12), LATER)).toEqual({ rate: 'minute', end: SEP(17, 12, 59) });
    });

    it('opens a month into the days ending on its last', () => {
        expect(finerWindow('month', new Date(2026, 1, 1), LATER)).toEqual({ rate: 'day', end: new Date(2026, 1, 28) });
    });

    it('opens a bar still running into the window ending now', () => {
        expect(finerWindow('day', SEP(30), LATER)).toEqual({ rate: 'hour', end: null });
        expect(finerWindow('hour', SEP(30, 18), LATER)).toEqual({ rate: 'minute', end: null });
    });

    it('opens nothing from a minute', () => {
        expect(finerWindow('minute', SEP(17, 12, 5), LATER)).toBeNull();
    });
});

describe('windowHeading', () => {
    it.each([
        ['a day by the hour', 'hour', SEP(17, 23), 'Sep 17, 2026'],
        ['an hour by the minute', 'minute', SEP(17, 12, 59), 'Sep 17, 2026, 12:00 PM to 12:59 PM'],
        ['20 days', 'day', SEP(10), 'Aug 22 to Sep 10, 2026'],
        ['12 months', 'month', new Date(2025, 8, 1), 'Oct 2024 to Sep 2025'],
        ['24 hours across two days', 'hour', SEP(17, 18), 'Sep 16, 7 PM to Sep 17, 6 PM, 2026'],
        ['20 days across a new year', 'day', new Date(2026, 0, 5), 'Dec 17, 2025 to Jan 5, 2026'],
    ])('names %s', (_, rate, end, heading) => {
        expect(plain(windowHeading(rate, end))).toBe(heading);
    });

    it('names an hour by the minute across midnight in full', () => {
        expect(plain(windowHeading('minute', SEP(18, 0, 30)))).toBe('Sep 17, 11:31 PM to Sep 18, 12:30 AM, 2026');
    });

    it('is null for the window ending now, which windowLabel names', () => {
        expect(windowHeading('day', null)).toBeNull();
        expect(windowHeading('week', SEP(10))).toBeNull();
    });
});

//
// a phone's window menu (#222), seen on a Sunday evening in October
//
const OCT = (day, hour = 0, minute = 0) => new Date(2026, 9, day, hour, minute);
const EVENING = OCT(4, 20, 15);

const labels = (rate, end = null, now = EVENING) => windowChoices(rate, end, now).map((choice) => choice.label);

describe('WINDOW_CHOICES', () => {
    it('reaches back about a year of days, a month of hours, a day of minutes and three years', () => {
        expect(WINDOW_CHOICES).toEqual({ minute: 24, hour: 30, day: 18, month: 3 });
    });
});

describe('windowChoices', () => {
    it('lists the 20 days ending now, then each 20 days before them, by date', () => {
        const choices = windowChoices('day', null, EVENING);

        expect(choices).toHaveLength(WINDOW_CHOICES.day + 1);
        expect(choices.slice(0, 3)).toEqual([
            { end: null, label: '9/15–10/4' },
            { end: SEP(14), label: '8/26–9/14' },
            { end: new Date(2026, 7, 25), label: '8/6–8/25' },
        ]);
    });

    it('lists the 24 hours ending now, then each whole day before today', () => {
        const choices = windowChoices('hour', null, EVENING);

        expect(choices).toHaveLength(WINDOW_CHOICES.hour + 1);
        expect(choices.slice(0, 3)).toEqual([
            { end: null, label: 'Last 24h' },
            { end: OCT(3, 23), label: 'Oct 3' },
            { end: OCT(2, 23), label: 'Oct 2' },
        ]);
    });

    it('lists the hour ending now, then each whole hour, an earlier day\'s with its date', () => {
        const all = labels('minute');

        expect(all).toHaveLength(WINDOW_CHOICES.minute + 1);
        expect(all.slice(0, 3)).toEqual(['Last hour', '7 PM', '6 PM']);
        expect(all.slice(-2)).toEqual(['10/3 9 PM', '10/3 8 PM']);
        expect(windowChoices('minute', null, EVENING)[1].end).toEqual(OCT(4, 19, 59));
    });

    it('lists the 12 months ending now, then each whole year before this one', () => {
        expect(windowChoices('month', null, EVENING)).toEqual([
            { end: null, label: 'Last 12 mo' },
            { end: new Date(2025, 11, 1), label: '2025' },
            { end: new Date(2024, 11, 1), label: '2024' },
            { end: new Date(2023, 11, 1), label: '2023' },
        ]);
    });

    it('adds the window on screen in its place, when it is none of the choices', () => {
        //
        // September's bar opens the 20 days ending on its 30th
        //
        const choices = windowChoices('day', SEP(30), EVENING);

        expect(choices).toHaveLength(WINDOW_CHOICES.day + 2);
        expect(choices.slice(0, 3).map((choice) => choice.label)).toEqual(['9/15–10/4', '9/11–9/30', '8/26–9/14']);
        expect(choices[1].end).toEqual(SEP(30));
    });

    it('adds a window older than every choice at the end', () => {
        const choices = windowChoices('hour', new Date(2026, 6, 1, 23), EVENING);

        expect(choices[choices.length - 1]).toEqual({ end: new Date(2026, 6, 1, 23), label: 'Jul 1' });
    });

    it('adds nothing for a window already among them', () => {
        expect(windowChoices('hour', OCT(2, 23), EVENING)).toHaveLength(WINDOW_CHOICES.hour + 1);
    });

    it('writes a day of another year by its numbers, and a range across New Year', () => {
        const jan = new Date(2027, 0, 2, 10);

        expect(labels('hour', null, jan).slice(0, 4)).toEqual(['Last 24h', 'Jan 1', '12/31/26', '12/30/26']);
        expect(labels('day', null, new Date(2027, 0, 5, 10))[0]).toBe('12/17–1/5');
    });

    it('ends every whole day at 23:00, across a daylight boundary too', () => {
        const ends = windowChoices('hour', null, new Date(2026, 10, 3, 12)).slice(1).map((choice) => choice.end);

        ends.forEach((end) => expect(end.getHours()).toBe(23));
        expect(ends[1]).toEqual(new Date(2026, 10, 1, 23));
    });

    it('is empty for a rate it does not know', () => {
        expect(windowChoices('week', null, EVENING)).toEqual([]);
    });
});

describe('choiceLabel', () => {
    it('writes a window that is no whole period from its first bucket to its last', () => {
        expect(choiceLabel('hour', OCT(3, 15), EVENING)).toBe('10/2 4 PM–10/3 3 PM');
        expect(choiceLabel('minute', OCT(4, 19, 30), EVENING)).toBe('10/4 6:31 PM–7:30 PM');
        expect(choiceLabel('month', new Date(2025, 8, 1), EVENING)).toBe('Oct \'24–Sep \'25');
    });

    it('writes noon and midnight as a clock does', () => {
        expect(choiceLabel('minute', OCT(4, 12, 59), EVENING)).toBe('12 PM');
        expect(choiceLabel('minute', OCT(4, 0, 59), EVENING)).toBe('12 AM');
        expect(choiceLabel('minute', OCT(4, 9, 30), EVENING)).toBe('10/4 8:31 AM–9:30 AM');
        expect(choiceLabel('minute', OCT(4, 12, 30), EVENING)).toBe('10/4 11:31 AM–12:30 PM');
    });

    it('is null for a rate it does not know, or none', () => {
        expect(choiceLabel('week', null, EVENING)).toBeNull();
        expect(choiceLabel(undefined, null)).toBeNull();
    });

    it('measures from the present when it is given no other', () => {
        expect(choiceLabel('hour', null)).toBe('Last 24h');
        expect(windowChoices('month', null)).toHaveLength(WINDOW_CHOICES.month + 1);
        expect(windowChoices(null, null)).toEqual([]);
        expect(stepChoice('hour', null, 1)).toBeNull();
        expect(stepChoice(undefined, null, -1)).toBeNull();
    });
});

describe('stepChoice', () => {
    it('steps back from the window ending now to the latest whole period', () => {
        expect(stepChoice('day', null, -1, EVENING)).toEqual(SEP(14));
        expect(stepChoice('hour', null, -1, EVENING)).toEqual(OCT(3, 23));
        expect(stepChoice('minute', null, -1, EVENING)).toEqual(OCT(4, 19, 59));
        expect(stepChoice('month', null, -1, EVENING)).toEqual(new Date(2025, 11, 1));
    });

    it('steps one choice back and forward, and stops at the window ending now', () => {
        expect(stepChoice('hour', OCT(3, 23), -1, EVENING)).toEqual(OCT(2, 23));
        expect(stepChoice('hour', OCT(2, 23), 1, EVENING)).toEqual(OCT(3, 23));
        expect(stepChoice('hour', OCT(3, 23), 1, EVENING)).toBeNull();
        expect(stepChoice('hour', null, 1, EVENING)).toBeNull();
    });

    it('steps from a window that is none of the choices to its neighbors', () => {
        expect(stepChoice('day', SEP(30), -1, EVENING)).toEqual(SEP(14));
        expect(stepChoice('day', SEP(30), 1, EVENING)).toBeNull();
    });

    it('keeps stepping a period at a time past the oldest choice', () => {
        const oldest = windowChoices('hour', null, EVENING).slice(-1)[0].end;
        const older = stepChoice('hour', oldest, -1, EVENING);

        expect(oldest).toEqual(SEP(4, 23));
        expect(older).toEqual(SEP(3, 23));
        expect(stepChoice('hour', older, -1, EVENING)).toEqual(SEP(2, 23));
    });

    it('is null for a rate it does not know', () => {
        expect(stepChoice('week', null, -1, EVENING)).toBeNull();
    });
});
