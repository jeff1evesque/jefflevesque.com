# Ingest coverage

`/stream` reports three figures for each stream: its throughput, its health and its
ingest coverage. Coverage is the one worth knowing about.

## Why health is not enough

Health divides successes by throughput. An interval in which a scraper never ran
writes no rows at all -- no successes, and no failures -- so it moves neither side of
that ratio, and it disappears. A stream whose scraper stopped for a day can still read
a health of 100%.

Coverage is the only figure on the page that can see that day. It counts the
intervals in the window that a run was **due** in, and checks how many of them carried
data. Its denominator comes from
[`jsx/import/general/ingest-schedule.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/ingest-schedule.js),
which records when each stream's scraper is supposed to run.

!!! warning "The schedule is a copy"

    Each scraper's schedule is declared where the scraper is deployed, and restated in
    `ingest-schedule.js` because the application has no access to that
    infrastructure. A schedule changed there has to be changed here too, or the stream
    reports a coverage it should not. Each entry was confirmed against the live
    performance report before it was written down, which is the check to repeat.

The schedule reads every hour in eastern time, including for a reader elsewhere: a
reader in California asking whether 09:00 eastern was due must not have their own
09:00 answered instead.

## Gaps in the rows

Each stream's row on `/stream` draws a bar per interval of the window. An interval a
run was due in, but that carried no row, is drawn as a short box outlined in red and
crossed, rather than as nothing -- against the same schedule the coverage figure
counts, so a coverage under 100% has a visible miss to point at. See
[`jsx/import/general/ingest-gaps.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/ingest-gaps.js),
which finds the missed intervals, and
[`jsx/import/general/stream-bars.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/stream-bars.js),
which draws them.

Two kinds of interval are not misses, and are drawn apart from them:

- an interval no run was due in -- a weekend on a weekday-only stream, an hour outside
  its hours, a minute between its runs -- is a thin hatched strip;
- an interval older than the first row the report returned, or the one still filling,
  is left empty: neither can be called a miss yet.

A bar's shade is the stream's health in that interval, not its coverage. The report
carries one row per interval, so a daily bar can say how many records a day brought
and how many failed, but not how many of that day's runs landed.

## History

- [#30](https://github.com/jeff1evesque/jefflevesque.com/issues/30): the bls stream's
  schedule, corrected to the one hour it reports at.
- [#34](https://github.com/jeff1evesque/jefflevesque.com/issues/34): coverage read
  `n/a` at the minute rate for every stream but the S&P 500.
- [#36](https://github.com/jeff1evesque/jefflevesque.com/issues/36): the stock market
  stream's cadence, corrected from 10 minutes to 20.
- [#152](https://github.com/jeff1evesque/jefflevesque.com/issues/152): `/stream` draws
  every stream as a row of bars, and a missed interval as a crossed box.
