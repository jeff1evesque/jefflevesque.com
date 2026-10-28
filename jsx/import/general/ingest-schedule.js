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
 *       intent was verified against the data: stock-market lands in 9-15
 *       eastern, sec in 6-22 eastern, bls at 15 eastern. a utc reading would
 *       have put stock-market at 4-10 eastern, which is not what the report
 *       shows
 *
 * Note: bls is the one entry whose collection schedule states its zone outright
 *       rather than leaving it to be inferred, so its hour is the one below
 *       that did not have to be verified against the report first
 *
 */

import { ROLLING_WINDOW, windowStart, stepInterval } from './rolling-window.js';
import {
    STOCK_MARKET,
    STOCK_TICKERS,
    STOCK_SPLIT,
    BLS,
    SEC,
    SEC_COMPANYFACTS,
    US_NATIONAL_WEATHER,
    canonicalStream,
} from './stream-id.js';
import { federalHoliday } from './federal-holidays.js';
import { EARLY_CLOSE, earlyClose, marketHoliday } from './market-calendar.js';
import THROUGHPUT_KEY from './throughput-key.js';


{/*

    the scrapers run on eastern wall-clock, so an hour has to be read in that
    zone rather than the viewer's -- a reader in california asking whether 09:00
    eastern was expected must not have their own 09:00 answered instead

*/}
const SCHEDULE_TIMEZONE = 'America/New_York';


{/*

    one entry per stream, keyed by the stream's id -- see stream-id.js.

      - 'hours'    the eastern hours a run falls in, or null for every hour
      - 'weekdays' true when the scraper only runs monday to friday
      - 'days'     the eastern weekdays a run falls on, for a scraper that runs
                   on neither every day nor monday to friday alone. optional
      - 'since'    the instant the schedule began, for a stream younger than
                   the longest window: nothing was due before it. Or
                   FIRST_RUN, for a stream whose first run was not known when
                   it was written down: nothing was due before the first run
                   its report holds, and nothing at all until it holds one.
                   optional
      - 'holidays' 'federal' when nothing is due on a US federal holiday, as
                   for 'sec': EDGAR takes no filings that day. 'market' when
                   nothing is due on a market holiday, nor from an early
                   close on -- see market-calendar.js. optional
      - 'opens'    the first minute of a day a run is due, [hour, minute], for
                   a stream whose runs begin partway through its first hour.
                   optional
      - 'closes'   the last, likewise, both included. optional
      - 'partition' how the report is fetched, 'day' or 'year'
      - 'every'    minutes between runs inside an expected hour, or null when
                   the stream has no regular minute spacing at all
      - 'minutes_named' true when the schedule states WHICH minutes those are,
                   false when it only states how often. see below -- this is
                   what decides whether a run has to land on the expected minute
                   or merely inside its window

    Note: 'every' is what decides whether the minute rate can be graded at all,
          and it is null where a stream runs only a couple of times a day at
          fixed minutes ('bls', 'stock-split'). all but a handful of
          minute intervals are legitimately empty for those two, and a ratio
          over them would report an outage that never happened.

    Note: the two schedule kinds differ in what they promise, and that is what
          'minutes_named' records. 'stock-market' is a cron naming its minutes
          outright ('0,20,40'), so a run is due AT :00, :20, :40 and landing
          anywhere else is a real fault. 'weather' and 'sec' are
          'rate(5 minutes)', which promises only the spacing: eventbridge counts
          from whenever the rule was created, so a rule made at 09:02 fires at
          :02, :07, :12 and one made at 09:00 fires at :00, :05, :10. Both are
          the schedule working exactly as written.

    Note: so a run on a 'rate()' stream is counted against the five minute
          WINDOW it falls in rather than against an exact instant -- see
          'coverageBucket'. Nothing about which minute the rule happens to have
          been created on can move the figure, which is what the exact match
          used to do: measured against :00, :05, :10, a rule firing on :02
          matched nothing at all and reported 0%.

    Note: 'stock-market' fires every TWENTY minutes, not ten. this entry said ten
          until 2026-08-20, which put 42 runs a day in the denominator against
          the 19 the stream actually makes, and reported ~45% for a scraper that
          had missed nothing. the collection schedule ran every five minutes
          until 2026-05-19 and every twenty since -- the ten matched neither

    Note: the 9 eastern hour carries ONE run rather than three, because
          collection gates on the market opening at 09:30 -- the 09:00 and 09:20
          runs are skipped and only 09:40 collects. 'hours' cannot state that, so
          a minute window spanning the open expects three runs where one was due.
          the reach is bounded: 'ROLLING_WINDOW' gives the minute rate 60
          minutes, so only a window overlapping 09:00-09:40 reads low, and the
          hour, day and month rates never consult minutes at all

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

    Note: 'sec' is due on no federal holiday (#241). EDGAR takes no filings that
          day, so the stream brings nothing, and Columbus Day 2026 was drawn as
          a miss. The market can be open that day, so the weekday gate cannot
          say it -- see federal-holidays.js. The company facts keep running
          Monday to Saturday, holiday or not

    Note: the company facts are the sec stream's second feed, and graded on
          their own schedule rather than the filings' (#211): once a day at
          23:15 eastern, monday to saturday. the performance api answers them as
          a series of the sec report, 'companyfacts', and on the filings' five
          minutes each daily run would read as a run among hundreds missed. a
          failed run writes no row, so a day without one is a miss. they began
          on 2026-10-04, so a window reaching back before it was due nothing
          there, and reads its coverage from the first day it could have

    Note: 'stock-tickers' is the S&P 500's stocks quoted every minute (#314): a
          schedule every minute from 9:00 to 15:59 eastern on weekdays, and a
          second at 16:00. The poll checks each minute against the market's
          calendar and quotes nothing before the 09:30 open, so a run is due
          from 09:30 to 16:00, both included -- 391 a day. A market holiday has
          none, and an early-close day none from 13:00, the 16:00 run included.
          See market-calendar.js

    Note: its first run was not known when this was written, so it is due from
          the first run its report holds (FIRST_RUN), and until the report
          holds one nothing is due and its coverage reads n/a. A stream older
          than the window cannot tell its first run from an outage at the start
          of the window, which then goes uncounted: a date, once known, can
          take FIRST_RUN's place

*/}
export const FIRST_RUN = 'first-run';

export const INGEST_SCHEDULE = {
    [US_NATIONAL_WEATHER]: { hours: null, weekdays: false, every: 5, minutes_named: false, partition: 'day' },
    [SEC]: { hours: [6, 22], weekdays: true, holidays: 'federal', every: 5, minutes_named: false, partition: 'day' },
    [SEC_COMPANYFACTS]: {
        hours: [23],
        weekdays: false,
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        since: '2026-10-04T00:00:00-04:00',
        every: null,
        minutes_named: false,
        partition: 'day'
    },
    [STOCK_MARKET]: { hours: [9, 15], weekdays: true, every: 20, minutes_named: true, partition: 'day' },
    [STOCK_TICKERS]: {
        hours: [9, 16],
        opens: [9, 30],
        closes: [16, 0],
        weekdays: true,
        holidays: 'market',
        since: FIRST_RUN,
        every: 1,
        minutes_named: true,
        partition: 'day'
    },
    [STOCK_SPLIT]: { hours: [0, 0], weekdays: true, every: null, minutes_named: false, partition: 'year' },
    [BLS]: { hours: [15], weekdays: false, every: null, minutes_named: false, partition: 'year' }
};


{/*

    the stream's own hour and weekday, read on the schedule's clock rather than
    the viewer's

*/}
function easternParts(date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: SCHEDULE_TIMEZONE,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric'
    }).formatToParts(date).reduce((acc, p) => {
        acc[p.type] = p.value;
        return acc;
    }, {});

    return {
        day: `${parts.year}-${parts.month}-${parts.day}`,
        weekday: parts.weekday,
        hour: parseInt(parts.hour, 10) % 24,
        minute: parseInt(parts.minute, 10)
    };
}


{/*

    the expected interval a row observed at 'date' counts toward.

    coverage compares two sets of instants: the intervals a scraper owed, and
    the intervals rows arrived in. This is what makes the second comparable to
    the first, and it is the identity for every case except one.

    Note: ONLY the minute rate needs it. At the hour, day and month rates the
          aggregator has already filed each row under its unit -- it builds a
          bucket keyed '${year}/${month}/${day} ${hour}' and dates the row to
          the top of that hour -- so a run at :02 already sits on the hour
          boundary that 'expectedIntervals' enumerates. Snapping there would
          move nothing.

    Note: and only for a stream whose schedule does NOT name its minutes. A
          cron naming '0,20,40' promises the instant, so a run at :02
          really is off schedule and should count as a miss. A 'rate(5 minutes)'
          promises the spacing alone, so the run is on time wherever in its
          window it lands, and only the window can be graded.

*/}
export function coverageBucket(stream, rate, date) {
    const schedule = INGEST_SCHEDULE[canonicalStream(stream)];

    if (
        !schedule
        || !schedule.every
        || schedule.minutes_named
        || String(rate).toLowerCase() !== 'minute'
        || !(date instanceof Date)
        || isNaN(date)
    ) {
        return date;
    }

    {/*

        the window is measured from the top of the hour, and both spacings in
        the table divide 60 evenly, so a window never straddles an hour
        boundary and the snap cannot walk a row into the previous hour.

        Note: the minutes are read with the LOCAL getter rather than through
              'easternParts', matching the rows themselves -- the aggregator
              buckets on local getters and 'expectedIntervals' steps a local
              cursor. Minutes past the hour agree across every zone this would
              be read in regardless, since no time zone in use is offset by a
              fraction of five minutes

    */}

    const bucket = new Date(date.getTime());
    bucket.setMinutes(bucket.getMinutes() - (bucket.getMinutes() % schedule.every), 0, 0);

    return bucket;
}


function hourExpected(schedule, hour) {
    if (!schedule.hours) {
        return true;
    }

    {/*

        a two element entry names a RANGE ('sec' runs every hour from 6 to 22),
        any other names the hours themselves ('bls' runs at 15 alone, and once
        ran at 8, 10, 12 and 14 and at no hour between them)

    */}

    return schedule.hours.length === 2
        ? hour >= schedule.hours[0] && hour <= schedule.hours[1]
        : schedule.hours.includes(hour);
}


{/*

    the holiday a day is on the schedule's own calendar, or null: the federal
    one for 'sec', the market's for 'stock-tickers'

*/}
const HOLIDAYS = {
    federal: federalHoliday,
    market: marketHoliday,
};

function scheduleHoliday(schedule, day) {
    const holiday = HOLIDAYS[schedule.holidays];

    return holiday ? holiday(day) : null;
}


{/*

    the first and the last minute of a day a run is due, as minutes after
    midnight eastern, or null where the schedule names none. An early close
    ends the day at the minute before it, for a schedule on the market's
    calendar

*/}
const minutesOf = ([hour, minute]) => hour * 60 + minute;

function firstMinute(schedule) {
    return schedule.opens ? minutesOf(schedule.opens) : null;
}

function lastMinute(schedule, day) {
    if (schedule.holidays === 'market' && earlyClose(day)) {
        return minutesOf(EARLY_CLOSE) - 1;
    }

    return schedule.closes ? minutesOf(schedule.closes) : null;
}

{/*

    whether any minute of the hour falls inside the day's runs, and whether
    the minute does

*/}
function hourInSession(schedule, day, hour) {
    const first = firstMinute(schedule);
    const last = lastMinute(schedule, day);

    return (first === null || hour * 60 + 59 >= first) && (last === null || hour * 60 <= last);
}

function minuteInSession(schedule, day, hour, minute) {
    const at = hour * 60 + minute;
    const first = firstMinute(schedule);
    const last = lastMinute(schedule, day);

    return (first === null || at >= first) && (last === null || at <= last);
}


{/*

    whether a run was due in the interval starting at 'date', for a chart drawn
    at 'rate'.

    Note: the question is asked of the interval, not of the instant: a daily
          interval is expected when the scraper runs at any point that day, so
          the hours only narrow an hourly or finer chart

    Note: 'first_run' is the interval the first run fell in, for a schedule
          whose 'since' is FIRST_RUN -- see firstRun. Without one, nothing is
          due yet. Any other schedule ignores it

*/}
export function intervalExpected(stream, rate, date, first_run = null) {
    const schedule = INGEST_SCHEDULE[canonicalStream(stream)];

    if (!schedule) {
        return false;
    }

    const r = String(rate).toLowerCase();
    const { day, weekday, hour, minute } = easternParts(date);

    {/*

        nothing was due before the schedule began. a month is due once any
        of it is, since a month is due whenever its stream ran at all. A finer
        interval is due from the one starting at the beginning: it is read by
        its start, as its weekday and hour are below

    */}
    if (schedule.since) {
        const since = schedule.since === FIRST_RUN ? first_run : new Date(schedule.since);

        if (!since) {
            return false;
        }

        const begun = r === 'month' ? stepInterval(date, r) > since : date >= since;

        if (!begun) {
            return false;
        }
    }

    if (r === 'month') {
        return true;
    }

    if (schedule.weekdays && ['Sat', 'Sun'].includes(weekday)) {
        return false;
    }

    if (schedule.days && !schedule.days.includes(weekday)) {
        return false;
    }

    if (scheduleHoliday(schedule, day)) {
        return false;
    }

    if (r === 'day') {
        return true;
    }

    if (!hourExpected(schedule, hour) || !hourInSession(schedule, day, hour)) {
        return false;
    }

    if (r === 'hour') {
        return true;
    }

    return minuteInSession(schedule, day, hour, minute) && minute % schedule.every === 0;
}


{/*

    the holiday no run was due on in the interval starting at 'date', for a
    chart drawn at 'rate', or null: what a bar names as the reason it is not
    scheduled (#261). The federal one for 'sec', the market's for
    'stock-tickers' (#314).

    Note: an hour or a minute is named only inside the hours the stream runs.
          outside them nothing is due on any day, so the holiday is not why
          that interval is empty. a day is named whole, and a month never,
          since a month is due whenever any of it is

*/}
export function intervalHoliday(stream, rate, date) {
    const schedule = INGEST_SCHEDULE[canonicalStream(stream)];
    const r = String(rate).toLowerCase();

    if (!schedule || !HOLIDAYS[schedule.holidays] || r === 'month') {
        return null;
    }

    const { day, hour } = easternParts(date);
    const holiday = scheduleHoliday(schedule, day);

    if (!holiday || (r !== 'day' && !hourExpected(schedule, hour))) {
        return null;
    }

    return holiday;
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
    const schedule = INGEST_SCHEDULE[canonicalStream(stream)];
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
    const schedule = INGEST_SCHEDULE[canonicalStream(stream)];

    return Boolean(schedule) && !schedule.hours && !schedule.weekdays;
}


{/*

    every interval in the window a run was due in, oldest first.

    the intervals are generated rather than read off the report, because the
    report only carries an interval something landed in -- the missing ones are
    exactly what is being counted, and they are absent by definition

    Note: 'first_run' is intervalExpected's, for a schedule whose 'since' is
          FIRST_RUN

*/}
export function expectedIntervals(stream, rate, now = new Date(), first_run = null) {
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
        if (intervalExpected(stream, r, cursor, first_run)) {
            intervals.push(new Date(cursor.getTime()));
        }

        cursor = stepInterval(cursor, r);
    }

    return intervals;
}


{/*

    the interval the first run in 'rows' reported in, for a schedule whose
    'since' is FIRST_RUN: the earliest row carrying a record or a failure,
    since a run that got nothing still ran. A zero the page drew in for a gap
    carries neither, so it is not taken for a run. null when no row reports,
    and then nothing is due yet

    Note: 'rows' are the chart's, already one per interval at the rate drawn,
          so the earliest is dated to the start of the interval it fell in

*/}
export function firstRun(rows, field_datetime, stream_source) {
    let first = null;

    (rows || []).forEach((item) => {
        const when = item ? item[field_datetime] : null;

        if (!(when instanceof Date) || isNaN(when)) {
            return;
        }

        const ran = (stream_source || []).some((source) => (
            Number(item[source]) > 0 || Number(item[`${source}${THROUGHPUT_KEY}`]) > 0
        ));

        if (ran && (!first || when < first)) {
            first = when;
        }
    });

    return first ? new Date(first.valueOf()) : null;
}
