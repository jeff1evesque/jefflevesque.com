/**
 * ingest-gaps.js: the intervals the chart has to draw as zero.
 *
 * a scraper that never ran reports nothing at all -- not a zero. the row for
 * that interval is simply absent, and the stacked area then joins the intervals
 * on either side of it into one continuous shape: the gap reads as a slightly
 * wider day rather than a missing one. the S&P 500 daily chart drew an unbroken
 * ramp across a monday whose scraper never started, which is the failure this
 * module exists to remove -- an outage has to look like an outage.
 *
 * Note: this is deliberately NOT the report's own 'FillEmptyBuckets'. that fill
 *       zeroes EVERY empty interval, and most streams are legitimately idle in
 *       most of them -- asking for it on a weekday-only stream draws a zero
 *       across every weekend, an outage the stream never had. only
 *       'usnationalweather' can use it (see 'runsContinuously'). the intervals
 *       below come from the scraper's own schedule instead, so an interval is
 *       filled only when a run was actually due in it
 *
 * Note: the same 'expectedIntervals' the listing's coverage figure counts
 *       against, so the chart and that percentage describe one set of intervals
 *       rather than two. a coverage of 95% over 20 days now has a visible day
 *       to point at
 *
 */

import THROUGHPUT_KEY from './throughput-key.js';
import { coverageBucket, expectedIntervals } from './ingest-schedule.js';
import { intervalStart, stepInterval } from './rolling-window.js';


{/*

    how many rows a report has to carry before its spacing means anything. two
    adjacent buckets are one interval apart in every report that has two rows at
    all, which says nothing about whether the empty ones were filled in

*/}
const PADDED_MINIMUM = 3;


{/*

    the bucket instants the aggregated rows already occupy, whatever they carry.

    presence is the test rather than a non-zero total: a row that reported zero
    is already drawn at zero, and adding a second row on the same instant would
    put two points on one x value

    Note: filed through 'coverageBucket', the same way the listing's coverage
          figure files them. The two answer one question between them -- which
          intervals arrived -- and the whole point of counting against
          'expectedIntervals' here is that the chart's gaps and that percentage
          describe the same set. A row matched by one and not the other would
          draw a zero over an interval coverage had just counted as covered

*/}
function presentIntervals(chart_data, stream, rate, field_datetime) {
    const present = new Set();

    (chart_data || []).forEach((item) => {
        const when = item ? item[field_datetime] : null;

        if (when instanceof Date && !isNaN(when)) {
            present.add(coverageBucket(stream, rate, when).valueOf());
        }
    });

    return present;
}


{/*

    every interval a run was due in that carries no row at all, oldest first.

    two ends of the window are excluded, for opposite reasons:

      - anything older than the first row the report returned. a stream whose
        artifacts only reach back five days would otherwise draw fifteen days of
        zeros and read as a fortnight-long outage rather than as a young stream

      - the interval holding 'now', which is still filling. the daily chart
        would otherwise dip to zero every morning between midnight and the
        scraper's first run of the day, reporting an outage that is really just
        a day that has not happened yet. a run that is genuinely late shows up
        the following interval, which is the earliest point the two can be told
        apart

    Note: the trailing edge is bounded by the CURRENT interval rather than by
          the last row, so a scraper that stopped days ago still draws its zeros
          up to today. bounding it by the last row would hide exactly the outage
          that is hardest to spot -- a chart that simply stops early

*/}
export function missingIntervals(chart_data, stream, rate, field_datetime, now = new Date()) {
    const expected = expectedIntervals(stream, rate, now);

    if (!expected.length) {
        return [];
    }

    const present = presentIntervals(chart_data, stream, rate, field_datetime);

    if (!present.size) {
        return [];
    }

    const first = Math.min(...present);
    const current = intervalStart(rate, now);

    return expected.filter((v) => {
        const t = v.valueOf();

        return t >= first
            && !present.has(t)
            && (!current || t < current.valueOf());
    });
}


{/*

    'chart_data' with a zeroed row inserted for every interval above, in date
    order.

    the zeroed row carries a key per series AND its throughput key, the same
    shape the aggregator emits, so the listing's totals keep summing rows of one
    kind. zero adds nothing to either side of the health ratio, and coverage
    counts an interval only where throughput is positive, so neither figure
    moves -- the fill changes what the chart draws and nothing else

*/}
export function fillMissingIntervals(
    chart_data,
    stream,
    rate,
    field_datetime,
    stream_source,
    now = new Date()
) {
    const missing = missingIntervals(chart_data, stream, rate, field_datetime, now);

    if (!missing.length) {
        return chart_data;
    }

    const zeroed = missing.map((when) => {
        const row = { [field_datetime]: when };

        (stream_source || []).forEach((source) => {
            row[source] = 0;
            row[`${source}${THROUGHPUT_KEY}`] = 0;
        });

        return row;
    });

    return [...chart_data, ...zeroed].sort(
        (a, b) => a[field_datetime] - b[field_datetime]
    );
}


{/*

    whether the report was padded to one row per interval, rather than carrying
    only the intervals something landed in.

    the api asks its report to fill empty buckets for a stream that never stops
    (see 'runsContinuously'), and at a coarse rate that is right -- every hour
    of a continuous stream really did carry runs. at the MINUTE rate it stops
    being right: 'usnationalweather' is scheduled 'rate(5 minutes)', so four
    minutes in five are legitimately idle, and the fill states each of them as a
    zero. those zeros are true and useless -- the stacked area drops to the axis
    between every run and reads as twelve separate humps rather than one curve.

    contiguity is the test because it is the signature of the fill and of
    nothing else. a report carrying only what it observed skips the quiet
    intervals, so its rows sit further apart than one step: the same stream's
    minute report from the api that does NOT pad returns twelve rows five
    minutes apart, and a daily report skips the weekend outright

*/}
function reportIsPadded(rows, rate, field_datetime) {
    if (rows.length < PADDED_MINIMUM || !stepInterval(rows[0][field_datetime], rate)) {
        return false;
    }

    const ordered = [...rows].sort((a, b) => a[field_datetime] - b[field_datetime]);
    let cursor = ordered[0][field_datetime];

    return ordered.slice(1).every((item) => {
        cursor = stepInterval(cursor, rate);
        return cursor.valueOf() === item[field_datetime].valueOf();
    });
}


{/*

    'chart_data' with the report's own padding removed, so the area joins one
    observation to the next instead of collapsing to the axis between them.

    this is the mirror of 'fillMissingIntervals' above: that fill ADDS a zero
    where the schedule says a run was due, this drops a zero the report invented
    where nothing was due at all.

    the two used to be mutually exclusive -- the fill needs a graded rate, and
    the api padded exactly the streams whose cadence the schedule could not
    state. that no longer holds: 'usnationalweather' is padded AND graded at the
    minute rate, so both run on one chart. the order they run in is what keeps
    them from fighting, and it is the order the caller uses: the padding comes
    off first, so the fill is asked its question about the runs the stream
    actually made. the other way round, every interval would already carry a row
    and the fill would find no gap to draw at all.

    Note: the S&P 500's missing monday survives this untouched, and by
          construction rather than by luck. its daily report has no row for that
          monday at all -- there is no zero to drop, and a report that skips a
          day is not contiguous, so nothing here runs on it

    Note: a row is kept on its THROUGHPUT rather than its successes. an interval
          where the scraper ran and every request failed reports zero successes,
          and it is an observation the chart has to keep -- dropping it would
          hide the failure and leave health describing rows the chart no longer
          shows

    Note: a report that is padded and entirely empty is returned whole. every
          row would otherwise be dropped and the chart would render blank, which
          claims less than the flat zero line an outage of that length deserves

*/}
export function dropPaddedEmpties(chart_data, rate, field_datetime, stream_source) {
    const rows = (chart_data || []).filter(
        (item) => item && item[field_datetime] instanceof Date && !isNaN(item[field_datetime])
    );

    if (!reportIsPadded(rows, rate, field_datetime)) {
        return chart_data;
    }

    const carried = chart_data.filter((item) => item && (stream_source || []).some(
        (source) => item[`${source}${THROUGHPUT_KEY}`] > 0
    ));

    return carried.length ? carried : chart_data;
}
