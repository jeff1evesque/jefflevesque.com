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


{/*

    a window that has ENDED, rather than one trailing now (#159). The page keeps
    such a window as the start of its last bucket -- the bar furthest right --
    and null for the window ending now. What follows turns that into what the
    rest of the page works with.

*/}


{/*

    an instant as ISO 8601 text with the viewer's own offset, such as
    '2026-09-17T23:00:00-04:00': the form the performance api's 'End' takes, and
    the page's '?end=' in the address. Local rather than utc, so it names the
    same wall-clock time the bar it came from was drawn at.

*/}
export function localInstant(date) {
    const pad = (n) => String(Math.abs(Math.trunc(n))).padStart(2, '0');
    const offset = -date.getTimezoneOffset();

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
        + `${offset < 0 ? '-' : '+'}${pad(offset / 60)}:${pad(offset % 60)}`;
}


{/*

    the last instant of the bucket starting at 'bucket': the 'now' a window
    ending there is measured from, so 'windowStart' and the schedule helpers
    answer for it as they would for the window ending now

*/}
export function lastInstant(rate, bucket) {
    const next = stepInterval(bucket, rate);

    return next ? new Date(next.getTime() - 1) : null;
}


{/*

    'date' moved 'count' intervals of the rate, on the calendar, as
    'stepInterval' moves it by one

*/}
export function shiftInterval(date, rate, count) {
    const r = String(rate || '').toLowerCase();
    const d = new Date(date.getTime());

    if (r === 'minute') {
        d.setMinutes(d.getMinutes() + count);
    } else if (r === 'hour') {
        d.setHours(d.getHours() + count);
    } else if (r === 'day') {
        d.setDate(d.getDate() + count);
    } else if (r === 'month') {
        d.setMonth(d.getMonth() + count);
    } else {
        return null;
    }

    return d;
}


{/*

    the window a page back ('direction' -1) or forward (+1) from the one ending
    at 'end' -- null for now -- as the start of its last bucket. A step is the
    window's own length, so no bucket is skipped or shown twice. Forward stops at
    now: a window that would reach the bucket holding now is the window ending
    now, null again.

*/}
export function pageWindow(rate, end, direction, now = new Date()) {
    const r = String(rate || '').toLowerCase();

    if (!(r in ROLLING_WINDOW)) {
        return null;
    }

    const current = intervalStart(r, now);
    const moved = shiftInterval(end ? intervalStart(r, end) : current, r, direction * ROLLING_WINDOW[r]);

    return moved >= current ? null : moved;
}


{/*

    the window a bar opens: the interval it covers, one rate finer, as
    { rate, end }. A day opens its hours, ending at 23:00; an hour its minutes,
    ending at :59; a month the days ending on its last one -- a Day window is 20
    days long, so a long month's first days are a page back. A minute opens
    nothing, null.

    Note: a bar still running -- today, this hour -- opens the finer window
          ending now, since the one it names has not finished yet

*/}
export function finerWindow(rate, start, now = new Date()) {
    const r = String(rate || '').toLowerCase();
    const [y, m, d, h] = [start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()];
    let opened;

    if (r === 'month') {
        opened = { rate: 'day', end: new Date(y, m + 1, 0) };
    } else if (r === 'day') {
        opened = { rate: 'hour', end: new Date(y, m, d, 23) };
    } else if (r === 'hour') {
        opened = { rate: 'minute', end: new Date(y, m, d, h, 59) };
    } else {
        return null;
    }

    return intervalStart(opened.rate, opened.end) >= intervalStart(opened.rate, now)
        ? { rate: opened.rate, end: null }
        : opened;
}


{/*

    how a window that has ended reads, from its first bucket to its last:

      - 'Sep 17, 2026' for a day by the hour
      - 'Sep 16, 7 PM to Sep 17, 6 PM, 2026' for 24 hours across two days
      - 'Sep 17, 2026, 12:00 PM to 12:59 PM' for an hour by the minute
      - 'Aug 22 to Sep 10, 2026' for days
      - 'Oct 2024 to Sep 2025' for months

    null for the window ending now, which 'windowLabel' names

*/}
export function windowHeading(rate, end) {
    const r = String(rate || '').toLowerCase();

    if (!(r in ROLLING_WINDOW) || !end) {
        return null;
    }

    const first = windowStart(r, lastInstant(r, end));
    const last = intervalStart(r, end);
    const sameDay = first.toDateString() === last.toDateString();
    const sameYear = first.getFullYear() === last.getFullYear();
    const year = last.getFullYear();
    const date = (d, withYear) => d.toLocaleString('en-US', withYear
        ? { month: 'short', day: 'numeric', year: 'numeric' }
        : { month: 'short', day: 'numeric' });
    const time = (d, minutes) => d.toLocaleString('en-US', minutes
        ? { hour: 'numeric', minute: '2-digit' }
        : { hour: 'numeric' });

    if (r === 'month') {
        const month = (d) => d.toLocaleString('en-US', { month: 'short', year: 'numeric' });

        return `${month(first)} to ${month(last)}`;
    }

    if (r === 'day') {
        return `${date(first, !sameYear)} to ${date(last, true)}`;
    }

    if (sameDay && r === 'hour') {
        return date(last, true);
    }

    if (sameDay) {
        return `${date(last, true)}, ${time(first, true)} to ${time(last, true)}`;
    }

    return `${date(first, !sameYear)}, ${time(first, r === 'minute')} to ${date(last, false)}, ${time(last, r === 'minute')}, ${year}`;
}


{/*

    a phone's menu of windows, between the arrows (#222): the window ending now,
    then the whole periods before it, newest first, so the menu's label says
    exactly what the rows cover:

      - day:    the 20 days before, and the 20 before those -- '8/26–9/14'
      - hour:   each whole day before today -- 'Oct 3'
      - minute: each whole hour before this one -- '7 PM'
      - month:  each whole year before this one -- '2025'

    A Day window is 20 days, never a calendar month: the api's windows are
    ROLLING_WINDOW's lengths. WINDOW_CHOICES is how many whole periods the menu
    reaches back -- about a year of days, a month of hours, a day of minutes,
    three years of months. The arrows go on past them, a period at a time.

*/}
export const WINDOW_CHOICES = {
    minute: 24,
    hour: 30,
    day: 18,
    month: 3
};


{/*

    the whole period before the window ending at 'end' -- before the window
    ending now, for null -- as the start of its last bucket.

    Note: the calendar's own arithmetic, as stepInterval's is, so a day 23 or 25
          hours long across a daylight boundary still ends at 23:00

*/}
function previousPeriod(rate, end, now) {
    if (rate === 'day') {
        return pageWindow(rate, end, -1, now);
    }

    const at = end ? intervalStart(rate, end) : intervalStart(rate, now);
    const [y, m, d, h] = [at.getFullYear(), at.getMonth(), at.getDate(), at.getHours()];

    if (rate === 'hour') {
        return new Date(y, m, d - 1, 23);
    }

    if (rate === 'minute') {
        return new Date(y, m, d, h - 1, 59);
    }

    return new Date(y - 1, 11, 1);
}


{/*

    the menu's windows, newest first: null for the window ending now, then the
    whole periods, then -- where 'end' is none of these, as a window a month's
    bar opened is not -- 'end' itself, in its place by date

*/}
function choiceEnds(rate, end, now) {
    const ends = [null];
    let at = previousPeriod(rate, null, now);

    while (ends.length <= WINDOW_CHOICES[rate]) {
        ends.push(at);
        at = previousPeriod(rate, at, now);
    }

    const shown = end ? intervalStart(rate, end) : null;

    if (shown && !ends.some((e) => e && e.valueOf() === shown.valueOf())) {
        const older = ends.findIndex((e) => e && e < shown);

        ends.splice(older < 0 ? ends.length : older, 0, shown);
    }

    return ends;
}


{/*

    how the menu writes a date and an hour: '9/14', '7 PM'. Written out rather
    than by toLocaleString, which puts a narrow no-break space before the AM or
    PM in newer ICU

*/}
const monthDay = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

function clockHour(d) {
    const h = d.getHours();

    return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
}

function clockTime(d) {
    const h = d.getHours();

    return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}


{/*

    a window's name in the menu, kept short so the line of controls fits a
    phone: '9/15–10/4' for 20 days, 'Last 24h' for the hours ending now, 'Oct 3'
    for a whole day, '7 PM' for a whole hour of today and '10/3 7 PM' for one of
    another day, '2025' for a whole year. A window that is no whole period -- one
    an address names -- is written from its first bucket to its last

*/}
export function choiceLabel(rate, end, now = new Date()) {
    const r = String(rate || '').toLowerCase();

    if (!(r in ROLLING_WINDOW)) {
        return null;
    }

    const last = intervalStart(r, end || now);
    const first = windowStart(r, end ? lastInstant(r, end) : now);

    if (r === 'day') {
        return `${monthDay(first)}–${monthDay(last)}`;
    }

    if (!end) {
        return { minute: 'Last hour', hour: 'Last 24h', month: 'Last 12 mo' }[r];
    }

    if (r === 'hour') {
        if (last.getHours() !== 23) {
            return `${monthDay(first)} ${clockHour(first)}–${monthDay(last)} ${clockHour(last)}`;
        }

        return last.getFullYear() === now.getFullYear()
            ? last.toLocaleString('en-US', { month: 'short', day: 'numeric' })
            : `${monthDay(last)}/${String(last.getFullYear()).slice(-2)}`;
    }

    if (r === 'minute') {
        if (last.getMinutes() !== 59) {
            return `${monthDay(first)} ${clockTime(first)}–${clockTime(last)}`;
        }

        return last.toDateString() === now.toDateString()
            ? clockHour(last)
            : `${monthDay(last)} ${clockHour(last)}`;
    }

    if (last.getMonth() !== 11) {
        const month = (d) => `${d.toLocaleString('en-US', { month: 'short' })} '${String(d.getFullYear()).slice(-2)}`;

        return `${month(first)}–${month(last)}`;
    }

    return String(last.getFullYear());
}


/**
 * the menu's choices for `rate`, newest first, as `{ end, label }` -- `end` the
 * start of the window's last bucket, or null for the window ending now. The
 * window on screen, `end`, is always among them.
 */
export function windowChoices(rate, end, now = new Date()) {
    const r = String(rate || '').toLowerCase();

    if (!(r in WINDOW_CHOICES)) {
        return [];
    }

    return choiceEnds(r, end, now).map((at) => ({ end: at, label: choiceLabel(r, at, now) }));
}


/**
 * the window an arrow shows next where the menu is on screen: one choice back
 * (`direction` -1) or forward (+1) from the window ending at `end`. From the
 * window ending now, back is the latest whole period: the 20 days before,
 * yesterday, the last whole hour, last year. Past the oldest choice, back steps
 * a period further. Forward stops at the window ending now, null, as pageWindow
 * does.
 */
export function stepChoice(rate, end, direction, now = new Date()) {
    const r = String(rate || '').toLowerCase();

    if (!(r in WINDOW_CHOICES)) {
        return null;
    }

    const ends = choiceEnds(r, end, now);
    const shown = end ? intervalStart(r, end) : null;
    const at = ends.findIndex((e) => (e && shown ? e.valueOf() === shown.valueOf() : e === shown));
    const to = at - Math.sign(direction);

    if (to < 0) {
        return null;
    }

    return to < ends.length ? ends[to] : previousPeriod(r, ends[ends.length - 1], now);
}
