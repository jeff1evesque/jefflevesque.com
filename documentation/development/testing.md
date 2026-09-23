# Testing

[`tests.yml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.github/workflows/tests.yml)
runs the Jest suite on every pull request and every push to master, with the
configuration in
[`jsx/jest.config.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/jest.config.js).

## Running it by hand

```bash
cd jsx
npm install
npx jest --config jest.config.js
```

Node **20** is required, the same version the lint workflow pins. Jest 29 needs
`^14.15 || ^16.10 || >=18`, so an older local Node fails to start the suite at all.

The suite pins its clock's zone to `America/New_York` for the whole run. The
application reasons in eastern time throughout -- the ingest schedule and the chart
aggregators bucket by an eastern wall clock -- so a module under test genuinely
behaves differently depending on where the suite runs.

## Coverage

Coverage is collected on every run and reported from the whole source tree, so a file
with no test at all reads 0% rather than being absent from the report.

**`coverageThreshold` in
[`jsx/jest.config.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/jest.config.js)
is what holds it.** The run fails if statements, branches, functions or lines fall
below that floor, so a regression reddens CI rather than passing quietly. The figure
itself is deliberately not repeated here: it is raised periodically, and every prose
copy of it has gone stale between raises. Each raise is recorded in a note beside the
threshold, with what earned it.

Branches and functions are the two that bind: they carry far less room above the floor
than statements and lines do, so a build reddens on a new untested **branch** long
before anything else. New work brings its tests in the same pull request.

The figures drift a little with the clock, because a few suites build fixtures from
the rolling window and reach different schedule branches at different hours. Measure
twice before concluding a change moved coverage, and measure against the committed
tree: an uncommitted test file is still collected, so a working copy can report a
figure CI cannot reach.

## The coverage badge

The badge on the README carries the overall statement percentage.
[`tests.yml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.github/workflows/tests.yml)
writes `jsx/coverage-summary.json` on every run, and
[`scripts/coverage_badge.py`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/scripts/coverage_badge.py)
turns it into the document shields.io reads:

```json
{"color":"brightgreen","label":"coverage","message":"NN%","schemaVersion":1}
```

After every build of **master** -- not on branches or pull requests, where the badge
would advertise whatever was pushed last -- that document is force-pushed to the
[`badges`](https://github.com/jeff1evesque/jefflevesque.com/tree/badges) branch.

**Only the overall statement percentage is published**, and that is enforced rather
than intended. The branch is public and the coverage summary is not: it carries one
absolute path per source file, including the developer's home directory.
`coverage_badge.py` refuses to emit a payload containing a path separator or a source
extension, so a change that widened it to a per-file breakdown fails the build instead
of publishing the tree.

Three things about that destination were choices:

- **Not master.** The branch ruleset requires a pull request there and permits no
  bypass, and a badge needing a review on every build is hand-maintained, not
  published. The ruleset targets the default branch only, so `badges` is writable from
  CI.
- **An orphan branch.** Cutting `badges` from master would carry a copy of the source
  tree, frozen on the day it was cut. The step builds the branch from scratch and
  force-pushes, so it holds one file and one commit, and never checks out source at
  all.
- **No personal access token.** The push authenticates with the built-in
  `GITHUB_TOKEN`, minted per run, scoped to this repository and expired with the job.
  The job declares `permissions: contents: write`, without which that token is
  read-only and the push fails.

Coveralls and Codecov are the other route, and both are free for a public repository.
They also publish the full per-file tree, which is precisely what the guard above
exists to prevent.

## Setup

Component tests use [`@testing-library/react`](https://testing-library.com/docs/react-testing-library/intro/).

[`jsx/setup.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/setup.js)
stubs `Worker` and `URL.createObjectURL`, which jsdom does not implement.
[`jsx/import/worker/web-worker.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/worker/web-worker.js)
subclasses `Worker` when the module loads, so anything importing
[`jsx/import/route/main-route.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/route/main-route.jsx)
-- most of the application -- throws `ReferenceError: Worker is not defined` without
them. These are environment shims, not test doubles.

Unexpected console output fails a test, but the failure is raised **after** the test
body rather than from inside `console.error`. React reports problems by calling
`console.error` during render, so throwing there unwinds React mid-commit and every
test dies with `Should not already be working.` instead of the real warning.

## The API documents

Three suites hold the OpenAPI documents behind the [APIs](../api/index.md) pages to
the application:

- [`jsx/__tests__/meta/openapi.test.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/__tests__/meta/openapi.test.js):
  each document offers only GET from the public server, and every example matches its
  own schema.
- [`jsx/__tests__/general/api-url.test.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/__tests__/general/api-url.test.js):
  every parameter a request sends is documented, and every documented one is sent.
- [`jsx/__tests__/general/api-examples.test.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/__tests__/general/api-examples.test.js):
  every documented example parses through the loader that reads the real response.

## Tests that document defects

Some tests are labeled `DOCUMENTS A DEFECT`. Those assert what the code does
**today**, not what it should do, so that a fix breaks the test loudly instead of the
behavior changing unnoticed. Two are worth reading:

- **Registration validates nothing before submitting.**
  [`jsx/import/layout/register/content/webform.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/register/content/webform.jsx)
  calls its validators only from `onChange` handlers, which set the state used for the
  `invalid` class. `handleSubmit` never consults that state, so an empty form reaches
  `Auth.signUp` with an empty username. The field turns red and submits anyway; Cognito
  is the only thing enforcing the password policy.
- **A single unknown URL segment is not a 404.** The route table carries `/:user`, so
  `/no-such-page` renders the account layout rather than the error page. Only deeper
  unmatched paths reach the 404.
