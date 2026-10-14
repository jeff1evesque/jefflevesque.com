# Model

`GET https://api.jefflevesque.com/v1/public/model`

The models trained every night, and how each one scores. `/model` lists them, and
`/model/<name>` draws one model's nightly attempts and its track record. It serves
scores only: nothing here says how a model is built.

Each night the trainer builds a new version of every model, then scores it and the
live version on the same held-out days. The new version goes live only if its loss is
no higher. Each day a model predicts is scored once that day's prices are in.

!!! note "Built after the pages that read it"

    The pages were built first, to this document. Until the API answers, `/model`
    says it has no models to show yet.

## Parameters

One path, three calls:

| Call | Parameters | `report` |
|---|---|---|
| The listing | none | JSON: every task, and every model with its latest scores |
| A model's history | `Model=<name>&Report=history` | CSV: one row per nightly attempt |
| A model's track record | `Model=<name>&Report=track-record` | CSV: one row per day it predicted |

| Parameter | Values | The application sends |
|---|---|---|
| `Model` | a model's `name`, from the listing | the model whose page is open, each model on `/model` for its trend line, and each one compared |
| `Report` | `history`, `track-record` | `history` for a model's page; `track-record` for its page, its trend line and a comparison |

`Model` and `Report` go together: either one alone is answered with a 400.

## The scores

Every report carries the same four scores:

| Score | What it measures |
|---|---|
| `loss` | how far the predicted chances were from what happened. Lower is better, and it decides whether an attempt goes live |
| `auc_up` | how well the predictions rank the stocks that went up above the ones that went down: 0.5 is a coin toss |
| `auc_beats` | the same, for the stocks that beat the average stock |
| `acc_up` | the share of stocks whose direction was called right, 0 to 1 |

Beside each is the **know-nothing baseline**'s score on the same days: what a model
that knows nothing about any stock would score.

## Response: the listing

`report` is an object of `tasks` and `models`.

A **task** is what a model predicts, and `/model` draws one list per task, in the
listing's order: `id`, the name a model gives it; `name`; and `description`, one line
on what is predicted and when it is scored.

A **model** has:

| Field | |
|---|---|
| `name` | what `Model` takes, and the last part of its address on the site, `/model/<name>` |
| `task` | the `id` of the task it predicts |
| `description` | one line about it |
| `started` | the first day it predicted, as `YYYY-MM-DD` |
| `retired` | the day it stopped being trained, or `null` while it still is |
| `scored_days` | the rows of its track record. Under 20, the model is New |
| `live` | the version making its predictions: `since`, the night it went live, and `kind`, `first` while its first version is still live, or `nightly` or `weekly` for the update or retrain that made it |
| `attempts` | the rows of its history: `total`, and `went_live`, those that replaced the live version |
| `score` | each score averaged over the last 20 rows of its track record, or all of them while it has fewer; `null` while it has none |
| `baseline` | the baseline's scores averaged over the same days |

## Response: a history

A CSV string with a header row, oldest night first. Each row is one nightly attempt:

- `day`, the night it was trained;
- `kind`, `nightly` for a nightly update or `weekly` for a weekly retrain;
- `went_live`, `true` when it replaced the live version;
- each score of the attempt, of the live version and of the baseline, all on the same
  held-out days: `attempt_<score>`, `live_<score>` and `baseline_<score>`.

## Response: a track record

A CSV string with a header row, oldest day first. Each row is one day the model
predicted, written once that day is scored: `day`, each score as `<score>`, and the
baseline's as `baseline_<score>`. A day the model was not running has no row.

The pages work out each day's 20-day average themselves, over the model's own last 20
rows, so a day it was not running neither counts nor shortens the window.

An empty cell is a score the day does not have, and is left out of an average rather
than read as zero.

## Errors

| Status | `report` |
|---|---|
| 400 | an object whose `error` says what was wrong with the request: `Model` without `Report`, or the other way round, or a `Report` the API does not keep |
| 404 | an object whose `error` says no model has that name |
| 500 | an object whose `error` says what could not be read |

## In the application

- Built by `modelUrl`, in
  [`jsx/import/general/api-url.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/api-url.js),
  which refuses `Model` without a `Report` it keeps rather than sending it.
- Fetched by `loadListing` and `loadReport`, in
  [`jsx/import/layout/model/source.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/model/source.js).
- Read in a web worker,
  [`jsx/import/worker/model/report.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/worker/model/report.js),
  which also works out each day's 20-day averages.

## Try it

<swagger-ui src="openapi/model.json"/>
