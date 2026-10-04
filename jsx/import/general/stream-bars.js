/**
 * stream-bars.js: one stream's window as a row of bars, one per interval.
 *
 * /stream draws every stream as a row: a bar for each interval of the window the
 * rate reports, from the oldest to the one holding now. What a bar is comes from
 * two places, the rows the report carried and the scraper's own schedule, and
 * nothing here knows what kind of data a stream holds:
 *
 *   - 'reported'  the interval carried rows. Its height is the records that
 *                 succeeded, and its health the share of them that did.
 *                 'failed' is what did not.
 *   - 'missed'    a run was due and the interval carried nothing, by the same
 *                 test the Coverage figure counts -- see 'missingIntervals'.
 *   - 'between'   a minute that holds no run of its own, because the run due in
 *                 its window landed in another minute of it (a 'rate(5 minutes)'
 *                 stream fires wherever its rule was created). Not a miss.
 *   - 'off'       no run was due: a weekend on a weekday-only stream, an hour
 *                 outside its hours, a minute between its runs.
 *   - 'pending'   a run was due but cannot be called missed yet: the interval
 *                 holding now, or one older than the first row the report
 *                 returned. See 'missingIntervals' for why neither counts.
 *
 * Note: 'now' is where the window ends, and 'clock' the present. They are one
 *       instant for the window ending now. A window that has ended (#159) ends
 *       before the clock, so its last interval is not still filling, and can be
 *       missed like any other.
 *
 * Note: the bars take the rows the page has already scaled -- bucketed to the
 *       rate, narrowed to its window, the report's padding off and the missing
 *       intervals zeroed (see toggleChartScale in stream.jsx). A zeroed row
 *       carries no throughput, so it is not read as a report.
 *
 * Note: a bar carries its health rather than its coverage. A report carries one
 *       row per interval, so a daily bar can say how many records a day brought
 *       and how many failed, but not how many of that day's runs landed.
 *       Coverage is the figure beside the row, and a miss is drawn where it can
 *       be pointed at.
 *
 * Note: a bar's shade is its height again, not its health (#167) -- see
 *       'heightShade' in stream-rows.jsx. Nearly every interval is fully
 *       healthy, so a shade by health drew nearly every bar the same blue. A
 *       bar with failures is marked by a red dot, and its summary says how many
 *       failed and its health.
 *
 */

import THROUGHPUT_KEY from './throughput-key.js';
import { INGEST_SCHEDULE, coverageBucket, intervalExpected } from './ingest-schedule.js';
import { missingIntervals } from './ingest-gaps.js';
import { stepInterval, windowStart } from './rolling-window.js';
import { canonicalStream } from './stream-id.js';

//
// a row's records and throughput, summed over the stream's series
//
function rowTotals(item, stream_source) {
    return (stream_source || []).reduce((totals, source) => {
        const records = item[source];
        const throughput = item[`${source}${THROUGHPUT_KEY}`];

        return {
            records: totals.records + (Number.isFinite(records) ? records : 0),
            throughput: totals.throughput + (Number.isFinite(throughput) ? throughput : 0),
        };
    }, { records: 0, throughput: 0 });
}

//
// every interval of the window, oldest first, as a bar -- see the top of this
// file for what each kind means
//
export function streamBars(chart_data, stream, rate, field_datetime, stream_source, now = new Date(), clock = now) {
    const r = String(rate || '').toLowerCase();
    const start = windowStart(r, now);

    if (!start) {
        return [];
    }

    const reported = new Map();

    (chart_data || []).forEach((item) => {
        const when = item ? item[field_datetime] : null;

        if (!(when instanceof Date) || isNaN(when)) {
            return;
        }

        const totals = rowTotals(item, stream_source);

        if (totals.throughput > 0) {
            reported.set(when.valueOf(), { when, ...totals });
        }
    });

    //
    // a miss is asked of the rows that reported, not of every row: the page has
    // already zeroed each missing interval, and a zeroed row would answer that
    // the interval arrived
    //
    const rows = [...reported.values()].map((row) => ({ [field_datetime]: row.when }));
    const missing = new Set(
        missingIntervals(rows, stream, r, field_datetime, now, clock).map((when) => when.valueOf())
    );
    const covered = new Set(
        rows.map((row) => coverageBucket(stream, r, row[field_datetime]).valueOf())
    );

    const bars = [];

    for (let cursor = start; cursor && cursor <= now; cursor = stepInterval(cursor, r)) {
        const key = cursor.valueOf();
        const row = reported.get(key);

        if (row) {
            bars.push({
                start: new Date(key),
                kind: 'reported',
                records: row.records,
                failed: Math.max(0, row.throughput - row.records),
                health: Math.min(1, row.records / row.throughput),
            });
        } else if (missing.has(key)) {
            bars.push({ start: new Date(key), kind: 'missed' });
        } else if (!intervalExpected(stream, r, cursor)) {
            bars.push({ start: new Date(key), kind: 'off' });
        } else if (covered.has(key)) {
            bars.push({ start: new Date(key), kind: 'between' });
        } else {
            bars.push({ start: new Date(key), kind: 'pending' });
        }
    }

    return bars;
}

//
// when a bar's interval was, in the reader's own zone, to the unit of the rate
//
export function barWhen(start, rate) {
    const r = String(rate || '').toLowerCase();
    const options = {
        month: { year: 'numeric', month: 'long' },
        day: { weekday: 'short', month: 'short', day: 'numeric' },
        hour: { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric' },
        minute: { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
    }[r] || {};

    return start.toLocaleString('en-US', options);
}

//
// what a bar says of itself, under the pointer and to a screen reader
//
export function barSummary(bar) {
    const count = (n) => n.toLocaleString('en-US');

    if (bar.kind === 'reported') {
        const records = `${count(bar.records)} ${bar.records === 1 ? 'record' : 'records'}`;

        return bar.failed
            ? `${records}, ${count(bar.failed)} failed (health ${Math.floor(bar.health * 1000) / 10}%)`
            : records;
    }

    return {
        missed: 'Missed: a run was due, and nothing reported',
        between: 'Between runs: the run due here landed in another minute',
        off: 'Not scheduled',
        pending: 'Nothing reported yet',
    }[bar.kind] || '';
}

//
// how often a stream runs, in a few words, from its schedule -- 'weekdays, every
// 20 min'. Empty for a stream with no schedule.
//
// Note: a stream that runs on days of its own names the first and the last of
//       them -- 'Mon-Sat, once a day' -- which reads right for a run of days in
//       a row, as the only such schedule is (#211)
//
export function scheduleLabel(stream) {
    const schedule = INGEST_SCHEDULE[canonicalStream(stream)];

    if (!schedule) {
        return '';
    }

    if (schedule.every) {
        return `${schedule.weekdays ? 'weekdays' : 'daily'}, every ${schedule.every} min`;
    }

    if (schedule.days) {
        return `${schedule.days[0]}-${schedule.days[schedule.days.length - 1]}, once a day`;
    }

    return schedule.weekdays ? 'weekdays, once a day' : 'once a day';
}
