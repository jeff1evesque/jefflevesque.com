# Model

`GET https://api.jefflevesque.com/v1/public/model`

The models trained every night, and how each one scores. `/model` lists them, and
`/model/<name>` draws one model's nightly attempts and its track record. It serves
scores only: nothing here says how a model is built.

Each night the trainer builds a new version of every model, then scores it and the
live version on the same held-out days. The new version goes live only if its loss is
no higher. Each day a model predicts is scored once that day's prices are in.

A model that keeps doing worse than the baseline has its live version taken down, and
predicts nothing until a new version beats the baseline.

!!! note "Built after the pages that read it"

    The pages were built first, to this document. Until the API answers, `/model`
    says it has no models to show yet.

## Parameters

One path, four calls:

| Call | Parameters | `report` |
|---|---|---|
| The listing | none | JSON: every task, and every model with its latest scores |
| A model's summary | `Model=<name>&Report=summary` | JSON: one model's summary |
| A model's history | `Model=<name>&Report=history` | CSV: one row per nightly attempt |
| A model's track record | `Model=<name>&Report=track-record` | CSV: one row per day it predicted |

| Parameter | Values | The application sends |
|---|---|---|
| `Model` | a model's `name`, from the listing | the model whose page is open, each model on `/model` for its trend line, and each one compared |
| `Report` | `summary`, `history`, `track-record` | `history` for a model's page; `track-record` for its page, its trend line and a comparison. No page asks for `summary` yet |

`Model` and `Report` go together: either one alone is answered with a 400.

## The scores

The listing, a history and a track record carry the same four scores:

| Score | What it measures |
|---|---|
| `loss` | how far the predicted chances were from what happened. Lower is better, and it decides whether an attempt goes live |
| `auc_up` | how well the predictions rank the stocks that went up above the ones that went down: 0.5 is a coin toss |
| `auc_beats` | the same, for the stocks that beat the average stock |
| `acc_up` | the share of stocks whose direction was called right, 0 to 1 |

Beside each is the **know-nothing baseline**'s score on the same days: what a model
that knows nothing about any stock would score.

## Response: the listing

`report` is an object of `tasks` and `models`, and from 2026-10-15 on, `format_version`.

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
| `live` | the version making its predictions: `since`, the night it went live, and `kind`, `first` while its first version is still live, or `nightly` or `weekly` for the update or retrain that made it. For a retired model, or one whose live version was taken down, the last version that predicted |
| `attempts` | the rows of its history: `total`, and `went_live`, those that replaced the live version |
| `score` | each score averaged over the last 20 rows of its track record, or all of them while it has fewer; `null` while it has none |
| `baseline` | the baseline's scores averaged over the same days |
| `down` | `null` while its live version is live. Otherwise `since`, the night it was taken down, and the check that did it: `days`, 1 for each scored day on its own or 5 or 20 for an average over its latest scored days, and `in_a_row`, how many scored days in a row it was worse |
| `behind` | one entry per check, as of the newest scored day: `days`; `in_a_row`, how many scored days in a row it has been worse, or `null` until it has enough days; and `limit`, the count that takes the live version down |

The checks today: each day 5 days in a row, the 5-day average 10 days in a row, and the
20-day average 5 days in a row. A version goes live again only if it beats the baseline
on the days it was tested on. `down` and `behind` are there from `format_version` 2.

**`format_version`** is a whole number: the layout every model report follows. A listing
without it is format 0.

| Version | What it added |
|---|---|
| 0 | the listing and the reports as first published |
| 1 | a history's `started`, `training_seconds` and `total_seconds` |
| 2 | a model's `down` and `behind`, and a track record's `down_days` and `down_in_a_row` |

It goes up with any change to the reports' keys or columns, or to what a value means,
added columns included. A listing is published after every model's reports, so its
`format_version` holds for every report read after it.

## Response: a summary

`report` is an object: one model's summary. No page reads it yet, so its fields are
not listed here.

## Response: a history

A CSV string with a header row, oldest night first. Each row is one nightly attempt:

- `day`, the night it was trained;
- `kind`, `nightly` for a nightly update or `weekly` for a weekly retrain;
- `went_live`, `true` when it replaced the live version;
- `started`, when the attempt began, in UTC with its offset, e.g.
  `2026-10-16T07:58:10+00:00`;
- `training_seconds`, the time spent training, reading the days included, to one
  decimal;
- `total_seconds`, from `started` until the attempt's scores are known, so its training
  and then scoring the held-out days for the attempt and for the live version, to one
  decimal;
- each score of the attempt, of the live version and of the baseline, all on the same
  held-out days: `attempt_<score>`, `live_<score>` and `baseline_<score>`.

`started`, `training_seconds` and `total_seconds` are empty for attempts made before
2026-10-15.

## Response: a track record

A CSV string with a header row, oldest day first. Each row is one day the model
predicted, written once that day is scored: `day`, each score as `<score>`, and the
baseline's as `baseline_<score>`. A day the model was not running has no row.

From format 2, `down_days` and `down_in_a_row` are the check that took the live version
down, as the listing's `down` gives it, on the day whose score set it off. They are
empty on every other row. While a model is down it predicts nothing, so its track
record has no rows until a new version goes live.

The pages work out each day's 20-day average themselves, over the model's own last 20
rows, so a day it was not running neither counts nor shortens the window.

An empty cell is a score the day does not have, and is left out of an average rather
than read as zero.

## Errors

| Status | `report` |
|---|---|
| 400 | an object whose `error` says what was wrong with the request: `Model` without `Report`, or the other way round; a `Report` the API does not keep; any other parameter, even a lowercase `model`; or either one given twice |
| 404 | an object whose `error` says no model has that name |
| 500 | an object whose `error` says the API itself failed |
| 502 | an object whose `error` says what could not be read: the listing, or a model's report |

A report that has not been published yet is a 502 too, even for a model the listing
names. A 404 means only that no model has that name.

## In the application

- Built by `modelUrl`, in
  [`jsx/import/general/api-url.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/api-url.js),
  which refuses `Model` without `history` or `track-record`, the two reports the
  pages read, rather than sending it.
- Fetched by `loadListing` and `loadReport`, in
  [`jsx/import/layout/model/source.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/model/source.js).
- Read in a web worker,
  [`jsx/import/worker/model/report.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/worker/model/report.js),
  which also works out each day's 20-day averages.

## Try it

<swagger-ui src="openapi/model.json"/>
