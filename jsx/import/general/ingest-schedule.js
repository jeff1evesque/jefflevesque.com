/**
 * ingest-schedule.js: when each stream's scraper is supposed to run.
 *
 * a health ratio cannot see a scraper that never ran: no rows means no
 * successes AND no failures, so the ratio never moves and only the total does.
 * counting the gap needs a denominator -- how many intervals SHOULD have
 * carried data -- and that is what this file supplies.
 *
 * Note: the schedules are declared by the scrapers themselves, as eventbridge
 *       expressions ('lambda-api-scraper/lambda/configs/*.json' and
 *       'scrape-rss-feed-v2/playbook/play/*.py'). they are restated here rather
 *       than read, because the page has no access to that infrastructure -- so
 *       this table is a COPY, and a cron changed there has to be changed here
 *       too. every entry below was confirmed against the live performance
 *       report before being written down, which is the check to repeat if a
 *       stream starts reporting a coverage it should not
 *
 * Note: the hours are eastern for every stream. the cron expressions mostly
 *       name no timezone, and eventbridge reads a bare one as utc, so the
 *       intent was verified against the data: stockmarket lands in 9-15
 *       eastern, sec in 6-22 eastern, bls at 15 eastern. a utc reading would
 *       have put stockmarket at 4-10 eastern, which is not what the report
 *       shows
 *
 * Note: bls is the one entry whose collection schedule states its zone outright
 *       rather than leaving it to be inferred, so its hour is the one below
 *       that did not have to be verified against the report first
 *
 */

import { ROLLING_WINDOW, windowStart, stepInterval } from './rolling-window.js';


{/*

    the scrapers run on eastern wall-clock, so an hour has to be read in that
    zone rather than the viewer's -- a reader in california asking whether 09:00
    eastern was expected must not have their own 09:00 answered instead

*/}
const SCHEDULE_TIMEZONE = 'America/New_York';


{/*

    one entry per stream, keyed the way the page keys its state.

      - 'hours'    the eastern hours a run falls in, or null for every hour
      - 'weekdays' true when the scraper only runs monday to friday
      - 'partition' how the report is fetched, 'day' or 'year'
      - 'every'    minutes between runs inside an expected hour, counted from
                   the top of the hour, or null when the runs do not land on a
                   predictable minute

    Note: 'every' is what decides whether the minute rate can be graded at all,
          and it is null where a stream runs only a couple of times a day at
          fixed minutes ('bls', 'stockmarketstocksplit'). all but a handful of
          minute intervals are legitimately empty for those two, and a ratio
          over them would report an outage that never happened.

    Note: 'stockmarket' names its minutes outright ('0,10,20,30,40,50'), so its
          spacing is read straight off the cron. the other two spacings are
          'rate(5 minutes)', which eventbridge counts from whenever the rule was
          last created rather than from the top of the hour -- the runs could
          fall on :02, :07, :12 as easily as :00, :05, :10, so the alignment is a
          fact about the deployed rule and not about the expression. both were
          left ungraded on that argument until it was measured. the live minute
          report settles it: every 'weather' and 'sec' bucket in a trailing hour
          sits on a multiple of five, with nothing off it

    Note: so these two spacings are read off the REPORT rather than off the
          cron, and are the entries to re-measure if a rule is ever recreated. a
          rule that comes back on :02 matches no interval at all and reports 0%,
          which the listing renders as 'n/a' -- the same thing it showed while
          the rate was ungraded, so a drift degrades quietly rather than lying

    Note: 'sec' merges two feeds -- one hourly at :00, one every five minutes --
          and it was the merge that kept it ungraded: the 22:00 hour was thought
          to carry the hourly feed alone, where a five minute spacing expects
          twelve runs and would report ~8% for a feed behaving exactly as
          scheduled. the report does not bear that out. runs per hour come off it
          as 'total_success / total_success_mean', and 2026-08-18 reads twelve
          for every hour from 16:00 through 22:00 inclusive -- 22:00 included, so
          the five minute feed covers the hour the objection was about

    Note: what 'sec' does carry, and 'weather' does not, is quiet runs. its rows
          are new filings, so a run that found none writes no artifact and leaves
          no bucket -- indistinguishable here from a run that never happened, and
          counted against coverage either way. seven consecutive hours at a full
          twelve of twelve say a healthy hour fills every slot, so the figure is
          reporting the stream rather than the filing rate; a market-wide lull
          would still read low. 'weather' has no such gap, since the national
          alert set is never empty

    Note: bls merges ten feeds, and they no longer report in on schedules of
          their own. between them they used to land at 8, 10, 12 and 14 eastern,
          which is what this entry named; since 2026-08-15 all ten are collected
          together once a day, and 15 eastern is the only hour the stream
          reports in

    Note: eight of the ten report daily and two ('eci', 'wkyeng') only on
          tuesdays, so the union still covers every day and the stream stays
          ungraded by weekday. the hourly rate is the only one this narrowing
          reaches -- 'intervalExpected' answers true for a day or a month before
          it ever consults the hours

*/}
export const INGEST_SCHEDULE = {
    usnationalweather: { hours: null, weekdays: false, every: 5, partition: 'day' },
    sec: { hours: [6, 22], weekdays: true, every: 5, partition: 'day' },
    stockmarket: { hours: [9, 15], weekdays: true, every: 10, partition: 'day' },
    stockmarketstocksplit: { hours: [0, 0], weekdays: true, every: null, partition: 'year' },
    bls: { hours: [15], weekdays: false, every: null, partition: 'year' }
};


{/*

    the stream's own hour and weekday, read on the schedule's clock rather than
    the viewer's

*/}
function easternParts(date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: SCHEDULE_TIMEZONE,
        hour12: false,
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric'
    }).formatToParts(date).reduce((acc, p) => {
        acc[p.type] = p.value;
        return acc;
    }, {});

    return {
        weekday: parts.weekday,
        hour: parseInt(parts.hour, 10) % 24,
        minute: parseInt(parts.minute, 10)
    };
}


function hourExpected(schedule, hour) {
    if (!schedule.hours) {
        return true;
    }

    {/*

        a two element entry names a RANGE ('sec' runs every hour from 6 to 22),
        anything longer names the hours themselves ('bls' runs at 8, 10, 12 and
        14 and at no hour between them)

    */}

    return schedule.hours.length === 2
        ? hour >= schedule.hours[0] && hour <= schedule.hours[1]
        : schedule.hours.includes(hour);
}


{/*

    whether a run was due in the interval starting at 'date', for a chart drawn
    at 'rate'.

    Note: the question is asked of the interval, not of the instant: a daily
          interval is expected when the scraper runs at any point that day, so
          the hours only narrow an hourly or finer chart

*/}
export function intervalExpected(stream, rate, date) {
    const schedule = INGEST_SCHEDULE[String(stream).toLowerCase()];

    if (!schedule) {
        return false;
    }

    const r = String(rate).toLowerCase();
    const { weekday, hour, minute } = easternParts(date);

    if (r === 'month') {
        return true;
    }

    if (schedule.weekdays && ['Sat', 'Sun'].includes(weekday)) {
        return false;
    }

    if (r === 'day') {
        return true;
    }

    if (!hourExpected(schedule, hour)) {
        return false;
    }

    return r === 'hour' ? true : minute % schedule.every === 0;
}


{/*

    whether coverage can be stated for this stream at this rate.

    Note: the monthly rate used to turn on how the report is fetched. a day
          partitioned stream named one path per day, and a trailing twelve
          months is ~365 of them -- past both the url length a gateway carries
          and the api's own 31 item cap -- so that rate asked only for the
          current month, and the eleven months never requested would have
          counted as gaps. the page no longer names paths at all: it sends the
          stream and the interval, and api-stream-performance resolves the whole
          window itself. so the gate is gone

    Note: the minute rate is excluded for a stream whose runs sit at fixed
          times rather than a spacing, for the reason given on 'every' above

*/}
export function coverageSupported(stream, rate) {
    const schedule = INGEST_SCHEDULE[String(stream).toLowerCase()];
    const r = String(rate).toLowerCase();

    if (!schedule || !(r in ROLLING_WINDOW)) {
        return false;
    }

    return r === 'minute' ? Boolean(schedule.every) : true;
}


{/*

    whether every interval in the window is expected to carry data.

    Note: this is what decides whether the REPORT is asked to fill its empty
          intervals ('FillEmptyBuckets'), which is a separate question from
          whether coverage can be stated. the fill treats every empty interval
          as a gap, so it only suits a scraper that never stops: asking for it
          on a weekday-only stream would draw a zero across every weekend, and
          the chart would show an outage the stream never had. coverage does
          not need the fill at all -- it counts the intervals it expects and
          checks which of them arrived

*/}
export function runsContinuously(stream) {
    const schedule = INGEST_SCHEDULE[String(stream).toLowerCase()];

    return Boolean(schedule) && !schedule.hours && !schedule.weekdays;
}


{/*

    every interval in the window a run was due in, oldest first.

    the intervals are generated rather than read off the report, because the
    report only carries an interval something landed in -- the missing ones are
    exactly what is being counted, and they are absent by definition

*/}
export function expectedIntervals(stream, rate, now = new Date()) {
    if (!coverageSupported(stream, rate)) {
        return [];
    }

    const r = String(rate).toLowerCase();
    const start = windowStart(r, now);

    if (!start) {
        return [];
    }

    const intervals = [];
    let cursor = new Date(start.getTime());

    {/*

        the cursor steps by the interval it is enumerating, so each stop is the
        start of the next one -- stepping a month by days would enumerate ~365
        stops for a twelve month window and count each of them as an interval.

        Note: 'stepInterval' cannot answer null here -- 'coverageSupported'
              above already refused any rate outside 'ROLLING_WINDOW', which is
              exactly the set the stepper knows

    */}

    while (cursor <= now) {
        if (intervalExpected(stream, r, cursor)) {
            intervals.push(new Date(cursor.getTime()));
        }

        cursor = stepInterval(cursor, r);
    }

    return intervals;
}
