# Performance

`GET https://api.jefflevesque.com/v1/public/performance`

How much one ingest stream took in, and how much of it succeeded, bucketed over a
trailing window: one ending now, or one ending at an earlier [`End`](#an-earlier-window).
`/stream` draws it as a row of bars for every stream, at the rate a reader chooses.

## Parameters

| Parameter | Values | The application sends |
|---|---|---|
| `Stream` | `bls`, `sec`, `stock-market`, `stock-split`, `us-national-weather` | each stream in turn, one request per row, and one for the SEC's two rows -- see [The sec stream's two feeds](#the-sec-streams-two-feeds) |
| `Interval` | `minute`, `hour`, `day`, `month`; `minute` when omitted | the rate chosen over the rows |
| `Timezone` | an IANA time zone, such as `America/New_York`; `UTC` when omitted | the reader's own, from the browser |
| `End` | an ISO 8601 date-time with a UTC offset or `Z`, such as `2026-09-17T23:00:00-04:00`; now when omitted | the start of the last bar on screen, once a reader opens a bar or pages back; nothing for the window ending now |

`Stream` takes a stream's id, the same id the website names the stream by in its own
urls. Three streams went by other names before -- `stockmarket`, `stockmarketstocksplit`
and `usnationalweather` -- and the api still accepts those for now. It may also still
name streams by them in its answers, such as the archive listing below; the application
matches a stream by its id either way.

The window trails from now, and its buckets are laid out on a calendar, so the time
zone travels with the request rather than being applied to the answer: a trailing 20
days ending at 22:00 in Tokyo is not the same 20 dates as one ending at 09:00 in New
York.

## The sec stream's two feeds

The `sec` stream reads two feeds, and answers each as a series of its own, named in
`group_by`:

| Series | The feed | Runs | `total_success` |
|---|---|---|---|
| `sec` | its filings | every 5 minutes, 06:00 to 22:55 Eastern, Monday to Friday | filings ingested |
| `companyfacts` | the XBRL numbers the S&P 500 companies filed | once a day at 23:15 Eastern, Monday to Saturday, from 2026-10-04 | companies fetched: on a weekday the handful that filed a 10-K or 10-Q that day, and on Saturday all 500 |

A company facts run's `total_fail` is always 0, and a run that fails writes no row, so
a day with no `companyfacts` row is a failed run. Its first run, on 2026-10-04, fetched
all 500. The [archive](#the-archive-behind-it) holds the filings only.

`/stream` draws the two as rows of their own, SEC Filings and SEC Company Facts, from the
one request: each row reads its own series, and the company facts' row is graded on its
own schedule. On the filings' five minutes, each daily run would read as one run among
hundreds missed.

## An earlier window

`End` moves the window back from now. The window is the one the api would give if
now were `End`:

- **Its last bucket is the one holding `End`,** in `Timezone`, and it reaches back the
  same 12 months, 20 days, 24 hours or 60 minutes as ever.
- **Omitted, it is now,** exactly as before.
- **Later than now, it is read as now.**
- **It names an instant, so it carries an offset.** A date alone, a date-time with no
  offset, or anything that does not parse is a `400`, as is `End` without `Stream`.
- **A `+` offset is sent as `%2B`.** Unencoded in a query string, it arrives as a
  space, and is refused rather than read as some other instant.

In New York time:

| Asking for | `Interval` | `End` | Buckets |
|---|---|---|---|
| Sep 17 by the hour | `hour` | `2026-09-17T23:00:00-04:00` | Sep 17, 00:00 to 23:00 |
| Sep 17, 12:00 to 12:59, by the minute | `minute` | `2026-09-17T12:59:00-04:00` | 12:00 to 12:59 |
| the 20 days before a window starting Sep 11 | `day` | `2026-09-10T00:00:00-04:00` | Aug 22 to Sep 10 |
| the 12 months before a window starting Oct 2025 | `month` | `2025-09-01T00:00:00-04:00` | Oct 2024 to Sep 2025 |

A bucket a stream was not scheduled in holds no rows, so a weekday-only stream such as
`stock-market` answers nothing for a Saturday.

A complete report for a window that has ended no longer moves, and is sent
`Cache-Control: public, max-age=86400, stale-while-revalidate=86400, stale-if-error=86400`.
A window that still holds now is kept for minutes, as before, and a short, empty or
failed report is not kept at all.

## Response

`report` is a CSV string with a header row, one row per source and bucket:

| Column | |
|---|---|
| `group_by` | the source within the stream that the row counts: for `sec`, `sec` for its filings and `companyfacts` for its company facts |
| `window_start` | the start of the bucket, with its UTC offset |
| `total_success` | records ingested successfully in the bucket |
| `total_fail` | records that failed in the bucket |
| `total_success_mean`, `total_success_max` | the mean and the largest of the rows aggregated into the bucket |
| `total_fail_mean`, `total_fail_max` | the same, for failures |

`report` is `null` when the window holds no rows.

The application reads `group_by`, `window_start`, `total_success` and `total_fail`.
It sums each source's successes and failures by bucket into one bar per interval,
and computes the stream's health and ingest coverage from the same rows. See
[Ingest coverage](../application/ingest-coverage.md).

## The archive behind it

The same measurement is also published as csv, a file per year or per month,
served by the website. The alarm page for each stream links to them in its
*Latest Archive* column.

The two are not copies of each other, and each holds what the other cannot:

| | the archive | this endpoint |
|---|---|---|
| a row is | one ingest event | one bucket, summarized |
| columns | `group_by`, `window_start`, `total_success`, `total_fail`, `window_every` | the first four, plus `_mean` and `_max` for each total |
| window | a whole year, historical | trails from now, or from `End` |

With `End`, this endpoint answers an earlier window too, as far back as it holds data,
but always as buckets, never one event at a time. The archive cannot answer for this
morning.

### Listing it

`GET https://api.jefflevesque.com/v1/public/performance/archive`

Every file each stream has published, in one answer, each with the url it is
served from:

| Field | |
|---|---|
| `streams` | every stream, whether or not it has published anything |
| `archives[].stream` | the stream, by the same id `Stream` takes above |
| `archives[].period` | `2025` for a year's file, `2025-09` for a month's |
| `archives[].id` | such as `stock-market/2025` or `sec/2025/09`: the path below `archive/` that redirects to the file |
| `archives[].url` | where the file is served from |
| `archives[].bytes` | its size |
| `archives[].modified` | when it was last written |

A stream in `streams` with no entries in `archives` has published nothing. A
file's name says which period it is for, not how much of that period it holds;
`modified` says how recent it is.

### Fetching one file

`GET https://api.jefflevesque.com/v1/public/performance/archive/<stream>/<year>`

`GET https://api.jefflevesque.com/v1/public/performance/archive/<stream>/<year>/<month>`

A `302` to the file's `url` when the listing names it, and a `404` when it does
not. The answer is a redirect rather than the file, because a year of the stock
market archive is about 14MB.

Take a file's url from the listing, or follow the redirect, rather than building
one. Where a stream's files are filed is not part of either answer, and it need not
be the stream's id. A url built by hand with nothing
behind it does **not** answer 404: the website answers any path it does not hold
with its own page, a 200 in `text/html`.

| Status | `report` |
|---|---|
| 302 | the file's url, which `Location` carries too |
| 400 | a message saying a query string was sent; no archive path takes one |
| 404 | a message naming the file the listing does not hold |
| 500 | a message saying the archive could not be listed |

*Try it* below reports a network error for a file that is listed: the browser
follows the redirect to the website, which does not let the documentation read
what it answers.

## Errors

| Status | `report` |
|---|---|
| 400 | a message naming what was not accepted, such as a `Stream` it does not recognize, or an `End` that names no instant |
| 500 | `null`, when no data could be read for the stream |

## In the application

- Built by `performanceUrl`, in
  [`jsx/import/general/api-url.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/api-url.js).
- Fetched by `downloadData`, in
  [`jsx/import/layout/stream/stream.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/stream/stream.jsx),
  through
  [`jsx/import/general/get-data.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/get-data.js).
  The SEC's two rows ask for the same url at once, and get-data.js sends one request
  for both: a url asked for again while its answer is on its way shares that answer.
  `performanceStream`, in `api-url.js`, says which stream a row asks for.
- Read in a web worker,
  [`jsx/import/worker/stream/performance.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/worker/stream/performance.js).
- The archive listing is built by `performanceArchiveUrl`, in the same
  `api-url.js`, and asked for and read by `loadArchiveListing` and
  `archiveFiles`, in
  [`jsx/import/general/archive-links.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/archive-links.js),
  when a stream's *Latest Archive* column is opened in
  [`jsx/import/layout/stream/alarm.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/stream/alarm.jsx).
  The page links each file's `url` rather than the redirect: a link to the api
  is cross-origin, and a browser ignores `download` on one.

## Try it

<swagger-ui src="openapi/performance.json"/>
