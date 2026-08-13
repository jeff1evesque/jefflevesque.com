# jefflevesque.com

[![unicode](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/unicode.yml/badge.svg)](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/unicode.yml)
[![tests](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/tests.yml/badge.svg)](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/tests.yml)
[![coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/jeff1evesque/jefflevesque.com/badges/coverage.json)](jsx/jest.config.js)

A React single-page application for watching data-ingestion pipelines. It charts how
much each stream ingested and how much of it succeeded, lets you set trigger
conditions against a stream, and surfaces alarms when one stops behaving. Sign-in is
backed by Cognito.

The five streams it reports on are all public feeds: the Bureau of Labor Statistics,
the SEC, stock market pricing, stock splits, and US National Weather alerts.

## What it does

| Route | |
|---|---|
| `/` | landing page, drawn over a D3 force-directed cluster of the knowledge-graph schema |
| `/stream` | every stream's throughput, success rate and ingest coverage, at a chosen minute / hour / day rate |
| `/stream/:stream/trigger` | trigger conditions for one stream, charted against its history |
| `/stream/:stream/alarm` | alarms raised for a stream |
| `/data` | data article listing, with distribution charts |
| `/model` | model article listing, with filters and performance |
| `/login`, `/logout`, `/register`, `/login/reset` | Cognito-backed authentication |
| `/:user`, `/:user/settings` | account and account settings |

**Ingest coverage** is the figure worth knowing about. Health divides successes by
throughput, so an interval where the scraper never ran moves neither side of that
ratio and disappears. Coverage is the only number on the page that can see it, and
[`ingest-schedule.js`](jsx/import/general/ingest-schedule.js) exists to supply the
denominator — what the schedule says *should* have run.

## Architecture

| | |
|---|---|
| UI | React 18, `react-router-dom` 6, Redux, MUI and react-bootstrap |
| Charts | recharts for area and line charts, D3 for the force-directed graph |
| Auth | AWS Amplify `Auth` against Cognito |
| Data | fetched in a web worker (`jsx/import/worker/`), one module per stream |
| Bundler | webpack — `build:prod` and `build:dev` |
| Styles | scss, compiled separately with `sass` |

The application is a static bundle. It is compiled to `static/`, published to object
storage and served through a CDN; there is no server-side rendering and no
application server. Everything it displays comes from a reporting API it calls at
runtime.

Two files carry environment-specific configuration and are **not** committed —
`jsx/aws-exports.js` and `jsx/is_local.js`. Each has a `.replace` template beside it
holding `REPLACE-*` tokens, and whatever builds the application substitutes real
values into a copy. That is why a fresh clone has the templates but not the files.

## Quick start

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

Then edit each, replacing every `REPLACE-*` token with a real value. `is_local.js`
takes `true` for local work. The Cognito identifiers in `aws-exports.js` come from the
deployed user pool — they ship in the browser bundle and are not secrets, but they do
have to match the pool you are authenticating against.

Compile and serve:

```bash
cd jsx  && npm run build:prod && mv content.js ../static/js/content.js
cd ../scss && npm run build:css && mv style.css ../static/css/style.css
cd ..   && npx http-server
```

## Configuration

Three files follow the same `.replace` pattern — a committed template with
`REPLACE-*` tokens, and a real file that is gitignored:

| Template | Becomes | Holds |
|---|---|---|
| `jsx/aws-exports.js.replace` | `jsx/aws-exports.js` | Cognito pool, client and region |
| `jsx/is_local.js.replace` | `jsx/is_local.js` | whether this build is local |
| `deploy.replace` | `deploy` | the identifiers the deploy script substitutes |

The templates are exempted by name in `.gitignore`, because the globs that hide the
generated files would otherwise hide the templates too — and a clone with no templates
has nothing to build from.

## Deployment

For a full local build and publish, copy the deploy script and fill in the values at
the top:

```bash
cp deploy.replace deploy
chmod +x deploy
./deploy --all              # javascript, css and images
./deploy --js               # javascript only
./deploy --css              # css only
./deploy --env=prod         # build:prod rather than build:dev
```

Merges to `master` are built and published automatically. That path compiles the
javascript and stylesheet, copies the result and the image assets to object storage,
and invalidates the CDN so the new bundle is served immediately. It substitutes the
same `REPLACE-*` tokens the local script does, taking the values from deployment
configuration rather than from a file on disk — which is why no real identifier is
committed here.

---

## Lint

`lint.yml` runs on every push and pull request, and [`.githooks/pre-commit`](.githooks/pre-commit) runs the same checks locally so the two cannot disagree.

| Workflow | What it checks |
|---|---|
| [`lint.yml`](.github/workflows/lint.yml) | `ruff check .` — rules in [`.ruff.toml`](.ruff.toml) |
| | `eslint` — the `.js`/`.jsx` files under `jsx/`, config in [`jsx/eslint.config.mjs`](jsx/eslint.config.mjs) |

The rule set is deliberately **correctness-only** (`E4`, `E7`, `E9`, `F`, `W6`): syntax errors, undefined names, unused imports and variables, bare `except`, invalid escape sequences. No formatting, import-ordering, or type-annotation rules are enabled, so a red build always means a real defect rather than a style preference. Notebooks are excluded — several carry pasted tabular output inside code cells and are not parseable Python.

The `ruff` version is pinned in the workflow so a new upstream release cannot redden an untouched branch; bump it deliberately.

The ESLint config mirrors that philosophy: **correctness rules only** — `no-undef`, `no-unused-vars`, `no-dupe-keys`, `no-unreachable`, `no-cond-assign` and similar. No semicolon, quote, indentation or spacing rules.

Two settings are worth knowing about:

- **`eslint-plugin-react` is required, not cosmetic.** This project uses the *classic* JSX transform (see `.babelrc`), so `<Foo />` compiles to `React.createElement(Foo)`. Core ESLint does not treat JSX as a *use* of an identifier, so without the plugin's `jsx-uses-react` / `jsx-uses-vars` rules, `no-unused-vars` reports every imported component — including `React` — as unused.
- **`no-redeclare` is deliberately off.** It fires on a legacy pattern used throughout this codebase (a function-scoped `var` "redeclared" inside `if`/`else` branches). That behaves exactly as written, so it is a style complaint rather than a defect.

ESLint 9 needs Node `^18.18 || ^20.9 || >=21.1`; the workflow pins Node 20 and installs only the two lint packages, not the full runtime dependency tree.

### Running it by hand

```bash
pip install ruff==0.16.1
cd jsx && npm install
ruff check .
cd jsx && npx eslint .
```

### Enabling the hook

```bash
git config core.hooksPath .githooks
```

The hook checks only **staged** files, and skips with a notice (rather than failing) when the linter is not installed — a fresh clone stays committable, and CI remains the enforcement. Bypass with `git commit --no-verify`.

---

## Tests

`tests.yml` runs the Jest suite on every push and pull request.

| Workflow | What it runs |
|---|---|
| [`tests.yml`](.github/workflows/tests.yml) | `npx jest --config jest.config.js` — config in [`jsx/jest.config.js`](jsx/jest.config.js) |

### Running them by hand

```bash
cd jsx
npm install
npx jest --config jest.config.js
```

Node **20** is required, the same version the lint workflow pins. Jest 29 needs `^14.15 || ^16.10 || >=18`, so an older local Node fails to start the suite at all.

### Coverage

Coverage is collected on every run (`collectCoverage` is on) and reported from the
whole source tree, so a file with no test at all shows as 0% rather than being
absent from the report.

**`coverageThreshold` in [`jsx/jest.config.js`](jsx/jest.config.js) is what holds
it.** The run fails if coverage falls below the baseline, so a regression reddens CI
rather than passing quietly.

The baseline is **86% on all four metrics**, and tracks the weakest of them rather
than the strongest — setting it at the statements figure would leave the other three
failing on the next push. The badge carries the current statements percentage.

The figures drift a little with the clock, because a few suites build fixtures from
the rolling window and reach different schedule branches at different hours. Measure
twice before concluding a change moved coverage.

Branches and functions are the two that bind: they carry far less room above the
baseline than statements and lines do. In practice a build reddens on a new untested
BRANCH long before anything else. Keep the room — a baseline with none stops being a
safety net and starts being an obstacle.

The figure comes from CI: `tests.yml` runs jest with `collectCoverage` on. The
`json-summary` reporter writes `jsx/coverage-summary.json`, and
[`scripts/coverage_badge.py`](scripts/coverage_badge.py) turns it into the document
shields.io reads:

```json
{"color":"brightgreen","label":"coverage","message":"90%","schemaVersion":1}
```

The `Publish the coverage badge` step in `tests.yml` force-pushes that document to the
[`badges`](../../tree/badges) branch after every **master** build — not on branches or
pull requests, where the badge would otherwise advertise whatever was pushed last.

**Only the overall statement percentage is published.** That is deliberate and it is
enforced rather than intended: the branch is public, `coverage-summary.json` is not, and
it carries one absolute path per source file — 131 of them at the time of writing,
including the developer's home directory. `coverage_badge.py` refuses to emit a payload
containing a path separator or a source extension, so a future change that widened it
to a per-file breakdown fails the build instead of publishing the tree.

Three things about that destination are worth stating, because each was a choice:

- **Not master.** The branch ruleset requires a pull request there and permits no
  bypass. A badge needing a review on every build is not published, it is
  hand-maintained. The ruleset targets the default branch only, so `badges` is
  writable from CI.
- **An orphan branch.** Cutting `badges` from master would carry a full copy of the
  source tree, frozen on the day it was cut and never updated. The step builds the
  branch from scratch in a temporary directory and force-pushes, so it holds one file
  and one commit — and never checks out source at all.
- **No personal access token.** The push authenticates with the built-in
  `GITHUB_TOKEN`, minted per run, scoped to this repository and expired with the job.
  A gist would work equally well but needs a PAT: a long-lived credential to store and
  rotate, for no extra capability. The job declares `permissions: contents: write`,
  without which that token is read-only and the push fails with a 403.

Coveralls and Codecov are the other route, and both are free for a public repository.
They also publish the full per-file tree — precisely what the guard above exists to
prevent. Choosing them means deciding that tree is fine to publish, which is a
different decision from wanting an accurate badge.

### Setup

Component tests use [`@testing-library/react`](https://testing-library.com/react).

`setup.js` stubs `Worker` and `URL.createObjectURL`, which jsdom does not implement. `jsx/import/worker/web-worker.js` subclasses `Worker` at module load, so anything importing `main-route.jsx` — most of the app — throws `ReferenceError: Worker is not defined` without them. These are environment shims, not test doubles, and removing them takes most of the suite down.

Unexpected console output fails a test, but the failure is raised *after* the test body rather than from inside `console.error`. React reports problems by calling `console.error` during render, so throwing there unwinds React mid-commit and every test dies with `Should not already be working.` instead of the real warning.

### Tests that document defects

Some tests are labelled `DOCUMENTS A DEFECT`. Those assert what the code does **today**, not what it should do, so that a fix breaks the test loudly instead of the behaviour changing unnoticed. Two are worth reading:

- **Registration validates nothing before submitting.** `webform.jsx` imports `valid-string`, `valid-email` and `valid-password`, but calls them only from `onChange` handlers that set state used for the `invalid` CSS class. `handleSubmit` never consults that state, so an empty form reaches `Auth.signUp` with `username: ''`. The field turns red and submits anyway; Cognito is the only thing actually enforcing the password policy.
- **A single unknown URL segment is not a 404.** The route table carries `path='/:user'`, so `/no-such-page` renders the profile layout rather than the error page. Only deeper unmatched paths reach the 404.

---

## License

BSD 3-Clause. See [`LICENSE`](LICENSE).
