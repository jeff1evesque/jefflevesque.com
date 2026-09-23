# Performance

`GET https://api.jefflevesque.com/v1/public/performance`

How much one ingest stream took in, and how much of it succeeded, bucketed over a
trailing window. `/stream` charts it for the stream and the rate a reader chooses.

## Parameters

| Parameter | Values | The application sends |
|---|---|---|
| `Stream` | `bls`, `sec`, `stock-market`, `stock-split`, `us-national-weather` | the stream selected in the listing |
| `Interval` | `minute`, `hour`, `day`, `month`; `minute` when omitted | the rate selected beside the chart |
| `Timezone` | an IANA time zone, such as `America/New_York`; `UTC` when omitted | the reader's own, from the browser |

`Stream` takes a stream's id, the same id the website names the stream by in its own
urls. Three streams went by other names before -- `stockmarket`, `stockmarketstocksplit`
and `usnationalweather` -- and the api still accepts those for now. It may also still
name streams by them in its answers, such as the archive listing below; the application
matches a stream by its id either way.

The window trails from now, and its buckets are laid out on a calendar, so the time
zone travels with the request rather than being applied to the answer: a trailing 20
days ending at 22:00 in Tokyo is not the same 20 dates as one ending at 09:00 in New
York.

## Response

`report` is a CSV string with a header row, one row per source and bucket:

| Column | |
|---|---|
| `group_by` | the source within the stream that the row counts |
| `window_start` | the start of the bucket, with its UTC offset |
| `total_success` | records ingested successfully in the bucket |
| `total_fail` | records that failed in the bucket |
| `total_success_mean`, `total_success_max` | the mean and the largest of the rows aggregated into the bucket |
| `total_fail_mean`, `total_fail_max` | the same, for failures |

`report` is `null` when the window holds no rows.

The application reads `group_by`, `window_start`, `total_success` and `total_fail`.
It stacks each source's successes by bucket for the chart, and computes the stream's
health and ingest coverage from the same rows. See
[Ingest coverage](../application/ingest-coverage.md).

## The archive behind it

The same measurement is also published as csv, a file per year or per month,
served by the website. The alarm page for each stream links to them in its
*Latest Archive* column.

The two are not copies of each other, and each holds what the other cannot:

| | the archive | this endpoint |
|---|---|---|
| a row is | one ingest event | one bucket, summarised |
| columns | `group_by`, `window_start`, `total_success`, `total_fail`, `window_every` | the first four, plus `_mean` and `_max` for each total |
| window | a whole year, historical | trails from now |

So this endpoint cannot answer for March 2024, and the archive cannot answer for
this morning.

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
| 400 | a message naming what was not accepted, such as a `Stream` it does not recognise |
| 500 | `null`, when no data could be read for the stream |

## In the application

- Built by `performanceUrl`, in
  [`jsx/import/general/api-url.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/api-url.js).
- Fetched by `downloadData`, in
  [`jsx/import/layout/stream/stream.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/stream/stream.jsx),
  through
  [`jsx/import/general/get-data.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/get-data.js).
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
