# jefflevesque.com

[![unicode](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/unicode.yml/badge.svg)](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/unicode.yml)
[![tests](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/tests.yml/badge.svg)](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/tests.yml)
[![docs](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/docs.yml/badge.svg)](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/docs.yml)
[![coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/jeff1evesque/jefflevesque.com/badges/coverage.json)](jsx/jest.config.js)

**[Documentation](https://jeff1evesque.github.io/jefflevesque.com/)** — a
[guide to alarms](https://jeff1evesque.github.io/jefflevesque.com/guide/alarms/) for
readers, the APIs the site is built on, how the application is put together, and how to
develop, test and deploy it. This file is the short version.

<!-- --8<-- [start:overview] -->
A React single-page application for watching data-ingestion pipelines. It charts how
much each stream ingested and how much of it succeeded, lets you set trigger conditions
against a stream, surfaces alarms when one stops behaving, and draws the knowledge graph
built from what was ingested. Sign-in is backed by Cognito.

The five streams it reports on are all public feeds: the Bureau of Labor Statistics,
the SEC, stock market pricing, stock splits, and US National Weather alerts.

The application is a static bundle with no server of its own. Everything it displays
comes from three public APIs, called from the browser at runtime, and a signed-in
reader's alarm subscriptions are kept by a fourth, the account API, which answers only
them.
<!-- --8<-- [end:overview] -->

## What it does

<!-- --8<-- [start:routes] -->
| Route | | API |
|---|---|---|
| `/` | landing page: a D3 force-directed cluster of the default knowledge graph build, and nothing over it | knowledge graph |
| `/stream` | every stream as a row of bars, one per interval of a trailing month / day / hour / minute window: a bar as tall as the records that succeeded, shaded darker the taller it stands on its row (brighter by night), and a crossed box where a run was due and nothing reported. Pointing at a bar brings up when it was and what it holds; on a phone a tapped bar says so under the rows. Each row ends with its health, ingest coverage and total records, which sort the rows -- by their headings, or a sort button on a phone -- and the page reopens sorted the same way, in that browser. The figures start folded into a green rail, which opens them, set off by a divider as /graph's columns are: its arrow folds them, and it drags them wider or narrower, and the page reopens arranged the same way. A stream's name, with an arrow after it, opens it on its own, its figures in three boxes over a taller graph, with an All streams button over its title. On a phone the streams are a list, each showing the figure it is sorted by, and a tap opens one. Clicking a bar opens its interval one rate finer -- a day's hours, an hour's minutes, a month's days -- and arrows page back a window at a time, with Now to return. Each stream's bell rings, in green, for a signed-in reader subscribed to the stream's alarm. It asks for every stream again every 5 minutes while it is showing, which a button beside the api icons turns off. `?rate=` opens it at a rate, `?end=` at a window that has ended, and `?item=` with one stream open on its own | performance, account |
| `/stream/:stream/trigger` | trigger conditions for one stream, charted against its history | |
| `/stream/:stream/alarm` | a stream's ingest alarms, which a signed-in reader switches on and off once they have accepted the terms | account |
| `/data` | each stream's data as it is stored, with its distribution for a chosen month. It reopens on the stream last charted, with the rows in the order the reader dragged them into, in that browser. On a wide screen the chart's group names fold into a green bar under it, which shows them, and it reopens with them shown or folded as the reader left them. A phone opens on the listing, and a dataset's graph icon opens its chart: the same bars of cubes laid on their side, a row per group, and a tap on a group opens what it holds. On a phone the month sits in the title row: its arrows step a month back or forward, and its menu picks any month | datalake |
| `/graph` | the **Training Graph**: every published knowledge graph build — the graph a graph neural network trains on — with a picker of the days its builds hold, a legend that lights what it names on the graph, and tables of every node and edge type it holds. Its columns fold and narrow, and the graph drags shorter or a little taller, and it opens the way it was last left | knowledge graph |
| `/graph/:graph` | the same page, opened on one build, so a build can be linked to | knowledge graph |
| `/graph/retrieval` | the **Retrieval Graph**: the same layout, drawn from one published day of the query tables — the graph an LLM's retrieval step reads — with a picker of days, the run that published each and when it finished, the sources the day holds, the day's node types chosen by what can be found by name and named by the vocabularies its predicates file them under, and tables of their entities, facts and edges. Arranged apart from the Training Graph | knowledge graph tables |
| `/graph/retrieval/:day` | the same page, opened on one day, so a day can be linked to | knowledge graph tables |
| `/model` | model article listing, with filters and performance | |
| `/login`, `/logout`, `/register`, `/login/reset` | Cognito-backed authentication | |
| `/:user` | the reader's profile, a placeholder | |
| `/:user/settings` | account settings: the reader's email address, which alarms go to, and a code to verify it with; the alarms the reader is subscribed to, each with a way to unsubscribe; and their ID token to copy, for calling the account API from a script | account |

Every page comes in a light and a dark theme: light from 7 in the morning until 7 in the
evening on the reader's own clock, and dark the rest of the day. The sun and moon beside
Login switches to the other one until the next 7 o'clock, through reloads, and then the
schedule takes over again.
<!-- --8<-- [end:routes] -->

**Ingest coverage** is the figure on `/stream` worth knowing about: it is the only
number there that can see an interval where a scraper never ran.
[Ingest coverage](https://jeff1evesque.github.io/jefflevesque.com/application/ingest-coverage/)
explains why.

## APIs

| API | Endpoint | Read by | Reference |
|---|---|---|---|
| Performance | `https://api.jefflevesque.com/v1/public/performance` | `/stream` | [Performance](https://jeff1evesque.github.io/jefflevesque.com/api/performance/) |
| Datalake | `https://api.jefflevesque.com/v1/public/datalake` | `/data` | [Datalake](https://jeff1evesque.github.io/jefflevesque.com/api/datalake/) |
| Knowledge graph | `https://api.jefflevesque.com/v1/public/knowledge-graph` | `/graph`, `/` | [Knowledge graph](https://jeff1evesque.github.io/jefflevesque.com/api/knowledge-graph/) |
| Account | `https://api.jefflevesque.com/v1/private/account` | `/stream/:stream/alarm`, `/stream`, `/:user/settings` | [Account](https://jeff1evesque.github.io/jefflevesque.com/api/account/) |

Each reference page describes the parameters the application sends and the response it
reads. A public API's has a Swagger UI whose Try it out sends a live request; the account
API's has none, since its requests need a signed-in reader's token.

## Quick start

<!-- --8<-- [start:quick-start] -->
Node **20** is required. Jest 29 and ESLint 9 both refuse to start on older runtimes,
and it is the version CI pins.

```bash
nvm install 20
nvm use 20
```

Install both dependency trees:

```bash
cd jsx  && npm install --force
cd ../scss && npm install
```

Create the two local configuration files from their templates:

```bash
cd jsx
cp aws-exports.js.replace aws-exports.js
cp is_local.js.replace is_local.js
```

Then edit each, replacing every `REPLACE-*` token with a real value. `is_local.js` takes
`true` for local work. The Cognito identifiers in `aws-exports.js` come from the
deployed user pool — they ship in the browser bundle and are not secrets, but they do
have to match the pool you are authenticating against.

Compile and serve:

```bash
cd jsx  && npm run build:prod && mv dist/content.js ../static/js/content.js
cd ../scss && npm run build:css && mv style.css ../static/css/style.css
cd ..   && npx http-server
```
<!-- --8<-- [end:quick-start] -->

## Development

The lint and test machinery, the coverage floor, deployment and this project's
documentation site each have a page:

- [Testing](https://jeff1evesque.github.io/jefflevesque.com/development/testing/)
- [Lint and hooks](https://jeff1evesque.github.io/jefflevesque.com/development/lint/)
- [Deployment](https://jeff1evesque.github.io/jefflevesque.com/operations/deployment/)
- [Workflows](https://jeff1evesque.github.io/jefflevesque.com/operations/workflows/)
- [This documentation](https://jeff1evesque.github.io/jefflevesque.com/operations/documentation/)

## License

BSD 3-Clause. See [`LICENSE`](LICENSE).
