# Datalake

`GET https://api.jefflevesque.com/v1/public/datalake`

What one dataset holds for a month: how its records are distributed, and how many
partitions they occupy. `/data` charts the distribution for the stream and month a
reader chooses.

## Parameters

| Parameter | Values | The application sends |
|---|---|---|
| `Data` | `stock-market`, `stock-split`, `bls`, `sec`, `us-weather-alert` | the dataset of the stream selected in the listing |
| `Scale` | JSON: `year`, a number, and `month`, two digits as a string | the month on screen, from the month control's arrows or its menu, such as `{"year":2026,"month":"08"}` |

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
| `stock-split` | `split_date`, `sector`, `industry`, `total_tickers`, `tickers`, `total_records` |
| `bls` | `category`, `series`, `total_records` |
| `sec` | `category`, `form`, `total_records` |
| `us-weather-alert` | `severity`, `event`, `total_events` |

For `stock-split`, `sector` is the SEC office that reviews the company's
industry, such as `Office of Life Sciences`, and `industry` is that industry's
SIC title, such as `PHARMACEUTICAL PREPARATIONS`. A split with no company on
file is `other` in both. A day's splits come a row per sector and industry, and
add up to the day.

On a wide screen, `/data` draws the distribution as stacked bars built from
cubes, one bar per group, each cube a round number of records. Clicking a bar
lists what it holds under the chart, and so does the "+N more" on a day's
tooltip. The groups' names start folded into a green bar under the chart,
which shows them, and clicking them folds them again. A day of stock splits
stands two cubes wide, a cube a split, banded by sector, each sector in a color
of its own: pointing at a band lists the day's sectors in their colors, over
the tickers of the one pointed at.

On a phone, the page opens on the listing, and a dataset's graph icon opens the
same bars laid on their side: a row per group, with its name, count and share
over its bar of cubes, under titles that sort the rows. A tap on a group opens
what it holds, and a list that runs largest first shows its top 8, then a
button for the rest. Stock splits' rows sit under a legend of the sectors,
which folds away, and a day opens to its tickers under their sectors. Either
way, the listing gives the partition count against the stream.

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
