# Performance

`GET https://api.jefflevesque.com/v1/public/performance`

How much one ingest stream took in, and how much of it succeeded, bucketed over a
trailing window. `/stream` charts it for the stream and the rate a reader chooses.

## Parameters

| Parameter | Values | The application sends |
|---|---|---|
| `Stream` | `bls`, `sec`, `stockmarket`, `stockmarketstocksplit`, `usnationalweather` | the stream selected in the listing |
| `Interval` | `minute`, `hour`, `day`, `month`; `minute` when omitted | the rate selected beside the chart |
| `Timezone` | an IANA time zone, such as `America/New_York`; `UTC` when omitted | the reader's own, from the browser |

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

The same measurement is also published as static csv, a file per year or per
month, under `https://www.jefflevesque.com/artifact/performance/ingest/`. The
alarm page for each stream links to them in its *Latest Archive* column.

The two are not copies of each other, and each holds what the other cannot:

| | the archive | this endpoint |
|---|---|---|
| a row is | one ingest event | one bucket, summarised |
| columns | `group_by`, `window_start`, `total_success`, `total_fail`, `window_every` | the first four, plus `_mean` and `_max` for each total |
| window | a whole year, historical | trails from now |

So this endpoint cannot answer for March 2024, and the archive cannot answer for
this morning.

| Stream | Where | Filed |
|---|---|---|
| `bls` | `ingest/article/bls/<year>.csv` | by year, from 2024 |
| `sec` | `ingest/article/sec/<year>/<month>.csv` | by month, from 2024 |
| `usnationalweather` | `ingest/article/weather/<year>/<month>.csv` | by month, from 2024 |
| `stockmarket` | `ingest/stock-market/<year>.csv` | by year, from 2023 |
| `stockmarketstocksplit` | `ingest/stock-split/<year>.csv` | by year, from 2023 |

The two stock market streams are filed under their dataset's name -- the one
the datalake api takes as `Data` -- rather than under their stream id:
`stock-market`, not `stockmarket`.

Not every file in that range exists. A path with nothing behind it does **not**
answer 404: the site serves the single-page app's shell for any unmatched path,
with a 200 and `content-type: text/html`. So a reader saving one of these
programmatically should judge the **content type**, not the status -- a status
check accepts every miss, and the file lands on disk as html under a `.csv`
name. The alarm page checks each candidate this way before offering it, in
[`jsx/import/general/archive-links.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/archive-links.js).

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

## Try it

<swagger-ui src="openapi/performance.json"/>
