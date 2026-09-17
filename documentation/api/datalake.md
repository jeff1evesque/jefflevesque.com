# Datalake

`GET https://api.jefflevesque.com/v1/public/datalake`

What one dataset holds for a month: how its records are distributed, and how many
partitions they occupy. `/data` charts the distribution for the stream and month a
reader chooses, and `/stream/stockmarket/alarm` reads the partition count.

## Parameters

| Parameter | Values | The application sends |
|---|---|---|
| `Data` | `stock-market`, `stock-split`, `bls`, `sec`, `us-weather-alert` | the dataset of the stream selected in the listing |
| `Scale` | JSON: `year`, a number, and `month`, two digits as a string | the month selected in the date picker, such as `{"year":2026,"month":"08"}` |

`Data` names a **dataset**, not a stream, and for three of the five the two differ. A
stream id is answered with a 400:

| Stream | Dataset |
|---|---|
| `stockmarket` | `stock-market` |
| `stockmarketstocksplit` | `stock-split` |
| `bls` | `bls` |
| `sec` | `sec` |
| `usnationalweather` | `us-weather-alert` |

`Scale`'s year defaults to the current one. Without a month, the year is described
whole; the application always sends one.

## Response

`report` is an object of two CSV strings, each with a header row:

- **`data-distribution`**: one row per group, with a count of what the dataset holds
  for the month. The grouping columns differ by dataset.
- **`partition`**: a single `count` row, the number of partitions the month occupies.

| Dataset | `data-distribution` columns |
|---|---|
| `stock-market` | `sector`, `industry`, `total_tickers`, `total_records` |
| `stock-split` | `split_date`, `total_tickers`, `tickers`, `total_records` |
| `bls` | `category`, `series`, `total_records` |
| `sec` | `category`, `form`, `total_records` |
| `us-weather-alert` | `severity`, `event`, `total_events` |

`/data` stacks the distribution into bars, one per group, and lists the partition
count against the stream. The alarm page reads only the partition count.

## Errors

| Status | `report` |
|---|---|
| 400 | `null`, when `Data` is not one of the datasets or `Scale` names a period the datalake does not hold |
| 500 | an object whose `error` says what could not be computed |

## In the application

- Built by `datalakeUrl`, in
  [`jsx/import/general/api-url.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/api-url.js),
  which also holds each stream's dataset name as `DATASETS`.
- Fetched by `downloadData`, in
  [`jsx/import/layout/data/data.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/data/data.jsx)
  and
  [`jsx/import/layout/stream/alarm.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/stream/alarm.jsx),
  through one loader per dataset under
  [`jsx/import/general/get-data/distribution/`](https://github.com/jeff1evesque/jefflevesque.com/tree/master/jsx/import/general/get-data/distribution).
- Read in a web worker per dataset, under
  [`jsx/import/worker/data/distribution/`](https://github.com/jeff1evesque/jefflevesque.com/tree/master/jsx/import/worker/data/distribution).

## Try it

<swagger-ui src="openapi/datalake.json"/>
