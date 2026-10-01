# Datalake

`GET https://api.jefflevesque.com/v1/public/datalake`

What one dataset holds for a month: how its records are distributed, and how many
partitions they occupy. `/data` charts the distribution for the stream and month a
reader chooses.

## Parameters

| Parameter | Values | The application sends |
|---|---|---|
| `Data` | `stock-market`, `stock-split`, `bls`, `sec`, `us-weather-alert` | the dataset of the stream selected in the listing |
| `Scale` | JSON: `year`, a number, and `month`, two digits as a string | the month selected in the date picker, such as `{"year":2026,"month":"08"}` |

`Data` names a **dataset**, not a stream. The two are the same string for four of the
five streams, and not for the weather stream, whose id is answered with a 400:

| Stream | Dataset |
|---|---|
| `stock-market` | `stock-market` |
| `stock-split` | `stock-split` |
| `bls` | `bls` |
| `sec` | `sec` |
| `us-national-weather` | `us-weather-alert` |

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

On a wide screen, `/data` draws the distribution as stacked bars built from
cubes, one bar per group, each cube a round number of records. Clicking a bar
lists what it holds under the chart. The groups' names start folded into a
green bar under the chart, which shows them, and clicking them folds them
again. On a phone, the page opens on the listing,
and a dataset's graph icon opens its sunburst, with the groups on the inner ring
and what each holds on the outer ring. Either way, the listing gives the
partition count against the stream.

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
  [`jsx/import/layout/data/data.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/data/data.jsx),
  through one loader per dataset under
  [`jsx/import/general/get-data/distribution/`](https://github.com/jeff1evesque/jefflevesque.com/tree/master/jsx/import/general/get-data/distribution).
- Read in a web worker per dataset, under
  [`jsx/import/worker/data/distribution/`](https://github.com/jeff1evesque/jefflevesque.com/tree/master/jsx/import/worker/data/distribution).

## Try it

<swagger-ui src="openapi/datalake.json"/>
