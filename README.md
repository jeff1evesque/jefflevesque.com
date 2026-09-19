# jefflevesque.com

[![unicode](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/unicode.yml/badge.svg)](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/unicode.yml)
[![tests](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/tests.yml/badge.svg)](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/tests.yml)
[![docs](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/docs.yml/badge.svg)](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/docs.yml)
[![coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/jeff1evesque/jefflevesque.com/badges/coverage.json)](jsx/jest.config.js)

**[Documentation](https://jeff1evesque.github.io/jefflevesque.com/)** — the three APIs the
site is built on, how the application is put together, and how to develop, test and
deploy it. This file is the short version.

<!-- --8<-- [start:overview] -->
A React single-page application for watching data-ingestion pipelines. It charts how
much each stream ingested and how much of it succeeded, lets you set trigger conditions
against a stream, surfaces alarms when one stops behaving, and draws the knowledge graph
built from what was ingested. Sign-in is backed by Cognito.

The five streams it reports on are all public feeds: the Bureau of Labor Statistics,
the SEC, stock market pricing, stock splits, and US National Weather alerts.

The application is a static bundle with no server of its own. Everything it displays
comes from three public APIs, called from the browser at runtime.
<!-- --8<-- [end:overview] -->

## What it does

<!-- --8<-- [start:routes] -->
| Route | | API |
|---|---|---|
| `/` | landing page: a D3 force-directed cluster of the default knowledge graph build, and nothing over it | knowledge graph |
| `/stream` | every stream's throughput, success rate and ingest coverage, at a chosen minute / hour / day / month rate | performance |
| `/stream/:stream/trigger` | trigger conditions for one stream, charted against its history | |
| `/stream/:stream/alarm` | alarms raised for a stream | datalake |
| `/data` | each stream's data as it is stored, with its distribution for a chosen month | datalake |
| `/graph` | every published knowledge graph build, with a picker, a legend, a readable slice of the graph, and tables of every node and edge type it holds | knowledge graph |
| `/graph/:graph` | the same page, opened on one build, so a build can be linked to | knowledge graph |
| `/model` | model article listing, with filters and performance | |
| `/login`, `/logout`, `/register`, `/login/reset` | Cognito-backed authentication | |
| `/:user`, `/:user/settings` | account and account settings | |
<!-- --8<-- [end:routes] -->

**Ingest coverage** is the figure on `/stream` worth knowing about: it is the only
number there that can see an interval where a scraper never ran.
[Ingest coverage](https://jeff1evesque.github.io/jefflevesque.com/application/ingest-coverage/)
explains why.

## APIs

| API | Endpoint | Read by | Reference |
|---|---|---|---|
| Performance | `https://api.jefflevesque.com/v1/public/performance` | `/stream` | [Performance](https://jeff1evesque.github.io/jefflevesque.com/api/performance/) |
| Datalake | `https://api.jefflevesque.com/v1/public/datalake` | `/data`, `/stream/:stream/alarm` | [Datalake](https://jeff1evesque.github.io/jefflevesque.com/api/datalake/) |
| Knowledge graph | `https://api.jefflevesque.com/v1/public/knowledge-graph` | `/graph`, `/` | [Knowledge graph](https://jeff1evesque.github.io/jefflevesque.com/api/knowledge-graph/) |

Each reference page describes the parameters the application sends and the response it
reads, with a Swagger UI whose Try it out sends a live request.

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
