# Model

`GET https://api.jefflevesque.com/v1/public/model`

The models trained every night, and how each one scores. `/model` lists them, and
`/model/<name>` draws one model's nightly attempts and its track record. It serves
scores to anyone, and an options model's nightly picks to signed-in readers alone, on a
path of their own: see [Signed-in readers: the picks](#signed-in-readers-the-picks).
Nothing here says how a model is built.

Each model has a task, what it predicts. A stock model predicts the same three things
about each of the roughly 500 stocks in the S&P 500 for the next trading day, the three
that its loss scores: the chance its price goes up, the chance it beats the average
stock, and how far it moves. An options model predicts, for every S&P 500 option, the
chance it makes money if bought at 9:40 AM on the next trading day and sold at 3:40 PM
1, 5 or 20 trading days later, after the gap between the buy and sell prices, and how
much it makes. The api serves how those predictions score, and to a signed-in reader,
each night's picks of an options model: the options it ranks best.

Each night the trainer builds a new version of every model, then scores it and the
live version on the same held-out days. The new version goes live only if its loss is
no higher. Each day a model predicts is scored once that day's prices are in, an
options model's once each hold's sell day is.

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
| `Report` | `summary`, `history`, `track-record` | `history` for a model's page; `track-record` for its page, its trend line, a comparison, and an options model's picks page. No page asks for `summary` yet |

`Model` and `Report` go together: either one alone is answered with a 400. This path
answers `Report=picks` with a 403: the picks are for signed-in readers, on the path
below.

## The scores

From format 3, each task in the listing names its models' scores, in the order `/model`
offers them. A task that names none has the four of the stock models. A stock model's:

| Score | What it measures |
|---|---|
| `loss` | three scores added up, below. Lower is better, and it decides whether an attempt goes live |
| `auc_up` | how well the predictions rank the stocks that went up above the ones that went down: 0.5 is a coin toss |
| `auc_beats` | the same, for the stocks that beat the average stock |
| `acc_up` | the share of stocks whose direction was called right, 0 to 1 |
| `top10_gain` | from format 3: the average gain of each night's top 10, the 10 stocks it is surest will go up, bought at the 9:40 AM ask and sold at the 3:40 PM bid the same day, as a share of what they cost |
| `top10_wins` | from format 3: how many of each night's top 10 made money, 0 to 10 |

An options model's, from format 3:

| Score | What it measures |
|---|---|
| `loss` | for each hold that is on, the log loss of its chance and the pinball loss of its gain, added up. Lower is better, and it decides whether an attempt goes live |
| `profit_auc` | how well its chance ranks the options that made money above the ones that didn't: 0.5 is a coin flip |
| `top10_gain` | the average gain of each night's 10 best options for a hold, bought at the 9:40 AM ask and sold at the 3:40 PM bid on the sell day, as a share of what they cost |
| `top10_wins` | how many of them made money, 0 to 10 |

The listing still gives every model `auc_up`, `auc_beats` and `acc_up`, null for an
options model, which has none of them.

Beside each is the **know-nothing baseline**'s score on the same days: what a model
that knows nothing about any stock would score. For `top10_gain` and `top10_wins` it is
the average of everything the model could have picked: what a random pick got. Those
two are of what following each model's picks would have made, so `/model` compares
models of different tasks on them.

A stock model's `loss` is not a single log loss. It is three scores added up, each
lower-is-better:

| Part | What it measures |
|---|---|
| `up_log_loss` | the log loss of whether each stock went up |
| `beats_log_loss` | the log loss of whether it beat the average stock |
| `move_pinball` | the pinball loss of the size of its move |

A coin flip scores 0.693 on each of the first two, so a stock model that knows nothing
scores about 1.65. A history and a track record carry each part as they carry a score,
under the same prefixes: `attempt_up_log_loss`, `live_up_log_loss` and
`baseline_up_log_loss` in a history, and `up_log_loss` and `baseline_up_log_loss` in a
track record. The listing carries only `loss`.

## Response: the listing

`report` is an object of `tasks` and `models`, and from 2026-10-15 on, `format_version`.

A **task** is what a model predicts, and `/model` draws one list per task, in the
listing's order: `id`, the name a model gives it; `name`; `description`, one line on
what is predicted and when it is scored; and from format 3, `scores`, the names of its
models' scores, in the order `/model` offers them.

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
| `score` | each score averaged over the last 20 rows of its track record, or all of them while it has fewer; `null` while it has none. `loss`, `auc_up`, `auc_beats` and `acc_up` are always there, `null` where its task has none of them, and from format 3 `profit_auc`, `top10_gain` and `top10_wins` where it has them. An options model's are its 1-day hold's |
| `baseline` | the baseline's scores averaged over the same days |
| `down` | `null` while its live version is live. Otherwise `since`, the night it was taken down, and the check that did it: `days`, 1 for each scored day on its own or 5 or 20 for an average over its latest scored days, and `in_a_row`, how many scored days in a row it was worse. From format 3, `hold`: for an options model, the hold the check ran on, in trading days |
| `behind` | one entry per check, as of the newest scored day: `days`; `in_a_row`, how many scored days in a row it has been worse, or `null` until it has enough days; and `limit`, the count that takes the live version down. From format 3, `hold`, as in `down`: an options model has every check for each hold |

The checks today: each day 5 days in a row, the 5-day average 10 days in a row, and the
20-day average 5 days in a row. A version goes live again only if it beats the baseline
on the days it was tested on. `down` and `behind` are there from `format_version` 2. A
`hold` of `null`, or none at all, is a check of a model with no holds.

**`format_version`** is a whole number: the layout every model report follows. A listing
without it is format 0.

| Version | What it added |
|---|---|
| 0 | the listing and the reports as first published |
| 1 | a history's `started`, `training_seconds` and `total_seconds` |
| 2 | a model's `down` and `behind`, and a track record's `down_days` and `down_in_a_row` |
| 3 | a task's `scores`; `top10_gain` and `top10_wins`, and an options model's `profit_auc` and its track record's columns for each hold; the `hold` of `down` and of each check in `behind`; and the picks |

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
- each score of the attempt, of the live version and of the baseline, loss's three
  parts among them, all on the same held-out days: `attempt_<score>`, `live_<score>`
  and `baseline_<score>`.

`started`, `training_seconds` and `total_seconds` are empty for attempts made before
2026-10-15. From format 3, a history carries every score its task names, an options
model's as its plain scores, which decide what goes live.

## Response: a track record

A CSV string with a header row, oldest day first. Each row is one day the model
predicted, written once that day is scored: `day`, each score as `<score>`, loss's
three parts among them, and the baseline's as `baseline_<score>`. A day the model was
not running has no row.

From format 2, `down_days` and `down_in_a_row` are the check that took the live version
down, as the listing's `down` gives it, on the day whose score set it off. They are
empty on every other row. While a model is down it predicts nothing, so its track
record has no rows until a new version goes live.

From format 3, an options model's track record has a set of columns for each hold:
each score again as `<score>_1d`, `<score>_5d` and `<score>_20d`, and the baseline's as
`baseline_<score>_1d` and so on. Its plain columns repeat the 1-day hold's. A day is
written once its 1-day hold's sell day is in, and its 5 and 20-day columns are empty
until theirs are: 6 and 21 trading days after the day it was predicted.

The pages work out each day's 20-day average themselves, over the model's own last 20
rows, so a day it was not running neither counts nor shortens the window. Loss's three
parts are averaged over the same rows, so on a model's page they add up to its 20-day
loss.

An empty cell is a score the day does not have, and is left out of an average rather
than read as zero.

## Signed-in readers: the picks

`GET https://api.jefflevesque.com/v1/private/model?Model=<name>&Report=picks`

An options model's picks are served to signed-in readers alone, on a path of their own,
as the [Account API](account.md) serves a reader's subscriptions. `/model/<name>/picks`
shows them. Each request carries the reader's ID token, as a bearer token. A signed-in
reader can copy theirs from Account Settings, under API access:

```
Authorization: Bearer <ID token>
```

From format 3, an options model publishes its picks each night: with no `Ticker`, the
top 10 options for each hold; with `Ticker=<symbol>`, that stock's options, best first,
up to 100 for each hold. A symbol is `AAPL`, or `BRK.B` for a share class, never
`BRK/B`: `^[A-Z]{1,5}(\.[A-Z])?$`. A CSV string with a header row, each hold's rows
together, best first. Each row is one option:

- `day`, the day the picks were made from;
- `hold`, the trading days it is held: 1, 5 or 20;
- `rank`, 1 for the best of its hold;
- `ticker`, its stock, e.g. `BRK.B`;
- `contract`, the option's contract name, which holds spaces but never a comma;
- `call_put`, `C` for a call or `P` for a put;
- `strike`, in dollars;
- `expiry`, the day it expires;
- `buy_on`, the day it is bought, at 9:40 AM, and `sell_on`, the day it is sold, at
  3:40 PM;
- `last_bid` and `last_ask`, its last quotes, in dollars;
- `chance`, the model's chance it makes money, bought at the ask and sold at the bid,
  and `usual_chance`, the usual chance for options like it;
- `gain_low`, `gain_middle` and `gain_high`, the gain the model guesses, low, middle and
  high, as a share of the price paid: `0.12` is 12%.

Days are `YYYY-MM-DD`. Each hold's rows are ranked by how far `chance` is above
`usual_chance`. They are the model's guesses, not trading advice.

| Status | When |
|---|---|
| 200 | the picks, as above, with `Cache-Control: private, no-store`: no cache keeps them |
| 400 | `Report` other than `picks`, a `Ticker` that is not a stock's symbol, or any other parameter |
| 401 | no valid ID token: none, a malformed one, or one past its hour. Most are refused before they reach the API, with `{"message": "Unauthorized", ...}` |
| 404 | a model with no picks, as no stock model has, or a stock it has none for |

## Errors

| Status | `report` |
|---|---|
| 400 | an object whose `error` says what was wrong with the request: `Model` without `Report`, or the other way round; a `Report` the API does not keep; any other parameter, even a lowercase `model`; or any of them given twice |
| 403 | an object whose `error` says the picks are for signed-in readers: `Report=picks`, which this path answers to no one |
| 404 | an object whose `error` says no model has that name |
| 500 | an object whose `error` says the API itself failed |
| 502 | an object whose `error` says what could not be read: the listing, or a model's report |

A summary, history or track record that has not been published yet is a 502 too, even
for a model the listing names. A 404 means only that no model has that name.

## In the application

- Built by `modelUrl`, in
  [`jsx/import/general/api-url.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/api-url.js),
  which refuses `Model` without `history` or `track-record`, the reports the pages
  read, rather than sending it. The picks are built by `modelPicksUrl`, beside it,
  which refuses a `Ticker` that is not a stock's symbol.
- Fetched by `loadListing`, `loadReport` and `loadOptionPicks`, in
  [`jsx/import/layout/model/source.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/model/source.js).
  The picks are asked as the signed-in reader, by `readAsReader` in
  [`jsx/import/general/account-api.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/account-api.js),
  which makes no request at all while signed out.
- Read in a web worker,
  [`jsx/import/worker/model/report.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/worker/model/report.js),
  which also works out each day's 20-day averages.

## Try it

<swagger-ui src="openapi/model.json"/>
