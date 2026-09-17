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
