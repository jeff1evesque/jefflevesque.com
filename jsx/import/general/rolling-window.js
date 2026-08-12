/**
 * rolling-window.js: the trailing range each ingest rate reports.
 *
 * every rate reports a window that ends now and extends a fixed distance back,
 * rather than one clipped to the calendar period it sits in. a calendar range
 * empties out at each boundary -- the daily chart holds two points on the 2nd
 * of the month, the hourly chart one point at 00:30 -- while a trailing range
 * carries the previous month or the previous day forward and stays populated.
 *
 * Note: this now describes only what the CHART draws. Enumerating the artifacts
 *       a request has to cover moved to api-stream-performance, which derives
 *       the same window from the interval it is handed -- 'ROLLING_WINDOW' here
 *       and in its 'create/report.py' are the two halves that have to agree, and
 *       a window wider than the artifacts fetched is still the failure that
 *       matters: it reads as an outage (a chart thinning out early in the month)
 *       rather than as a short fetch.
 *
 */

{/*

    'now' is the viewer's own clock. it was 'dstDate()', which returned eastern
    wall-clock wearing the local zone's offset -- fine while the chart rows were
    shifted the same way, wrong now that they are true instants: the bounds and
    the rows would be measured on two different clocks

*/}


{/*

    how far back each rate reaches, in its own unit. the daily figure is the
    one this page has always drawn; the rest previously clipped to the calendar
    period -- 'hour' to today, 'minute' to the current hour

*/}
export const ROLLING_WINDOW = {
    minute: 60,
    hour: 24,
    day: 20,
    month: 12
};


{/*

    the start of the bucket an instant falls in, truncated to the rate's own
    unit. the same truncation the chart's aggregator performs when it keys a row
    by '${year}/${month}/${day}', stated once so a caller can name a bucket
    without rebuilding that string.

    Note: 'month' sets the date to the 1st, which is where the aggregator dates
          a monthly bucket too

*/}
export function intervalStart(rate, now = new Date()) {
    const r = String(rate || '').toLowerCase();
    const d = new Date(now.getTime());

    if (r === 'minute') {
        d.setSeconds(0, 0);
    } else if (r === 'hour') {
        d.setMinutes(0, 0, 0);
    } else if (r === 'day') {
        d.setHours(0, 0, 0, 0);
    } else if (r === 'month') {
        d.setHours(0, 0, 0, 0);
        d.setDate(1);
    } else {
        return null;
    }

    return d;
}


{/*

    the bucket one interval after the one given, in the rate's own unit.

    stated here beside 'intervalStart' because two callers now have to agree on
    what 'the next interval' means: 'expectedIntervals' walks the window
    enumerating what a scraper owed, and 'ingest-gaps.js' walks a report asking
    whether its rows sit one interval apart. a stepper written twice is a
    stepper that eventually disagrees with itself.

    Note: the date's own setters do the arithmetic rather than adding a fixed
          number of milliseconds, so a day that is 23 or 25 hours long across a
          daylight boundary still steps to the next midnight, and a month steps
          by its own length rather than by 30 days

    Note: null for a rate this module does not know, matching 'intervalStart' --
          a caller that cannot name the unit gets no answer rather than a
          silently assumed one

*/}
export function stepInterval(date, rate) {
    const r = String(rate || '').toLowerCase();
    const d = new Date(date.getTime());

    if (r === 'minute') {
        d.setMinutes(d.getMinutes() + 1);
    } else if (r === 'hour') {
        d.setHours(d.getHours() + 1);
    } else if (r === 'day') {
        d.setDate(d.getDate() + 1);
    } else if (r === 'month') {
        d.setMonth(d.getMonth() + 1);
    } else {
        return null;
    }

    return d;
}


{/*

    the inclusive start of the window: the oldest bucket the chart keeps.

    each rate truncates to its own unit first, so the boundary lands on a
    bucket edge rather than mid-bucket -- a 24 hour window ending at 14:20
    starts at 15:00 yesterday, not 14:20, so the oldest column is whole.

    Note: 'month' sets the date to the 1st before shifting the month, since
          shifting first would spill the 31st of a long month into the 1st or
          2nd of a short one -- which is why the truncation above runs first
          rather than the shift

*/}
export function windowStart(rate, now = new Date()) {
    const r = String(rate || '').toLowerCase();
    const d = intervalStart(r, now);

    if (!d) {
        return null;
    }

    if (r === 'minute') {
        d.setMinutes(d.getMinutes() - (ROLLING_WINDOW.minute - 1));
    } else if (r === 'hour') {
        d.setHours(d.getHours() - (ROLLING_WINDOW.hour - 1));
    } else if (r === 'day') {
        d.setDate(d.getDate() - (ROLLING_WINDOW.day - 1));
    } else {
        d.setMonth(d.getMonth() - (ROLLING_WINDOW.month - 1));
    }

    return d;
}


{/*

    how the range reads to a user. stated once here so the label cannot drift
    from the window it describes -- it previously named the calendar period
    ('July') for a chart that was already drawing a trailing 20 days

*/}
export function windowLabel(rate) {
    const r = String(rate || '').toLowerCase();
    const unit = { minute: 'Minutes', hour: 'Hours', day: 'Days', month: 'Months' };

    return r in ROLLING_WINDOW
        ? `Last ${ROLLING_WINDOW[r]} ${unit[r]}`
        : null;
}
