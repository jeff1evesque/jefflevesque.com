# jefflevesque.com

[![unicode](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/unicode.yml/badge.svg)](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/unicode.yml)
[![tests](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/tests.yml/badge.svg)](https://github.com/jeff1evesque/jefflevesque.com/actions/workflows/tests.yml)
[![coverage](https://img.shields.io/badge/coverage-92%25-brightgreen.svg)](jsx/jest.config.js)

After [dependencies](https://github.com/jeff1evesque/jefflevesque.com#dependency) have been installed and configured, [local development](https://github.com/jeff1evesque/jefflevesque.com#local-development) can proceed.

## Dependency

The following general dependencies need to be installed:

```bash
$ brew update
$ brew install nvm
$ mkdir ~/.nvm
$ echo 'export NVM_DIR=~/.nvm' >> ~/.bash_profile
$ echo 'source $(brew --prefix nvm)/nvm.sh' >> ~/.bash_profile
$ source ~/.bash_profile
$ nvm install 14
```

The following packages need to be installed in order to compile javascript:

```bash
$ cd [PROJECT-ROOT]/jsx
$ npm install -g browserify http-server
$ npm install --force
$ npm run prebuild:dos2unix
```

The following packages need to be installed in order to compile css:

```bash
$ cd [PROJECT-ROOT]/scss
$ npm install
```

## Local Compile

Once above [dependencies](https://github.com/jeff1evesque/jefflevesque.com#dependency) have been met, code can be compiled as needed for [ReactJS](https://github.com/jeff1evesque/jefflevesque.com#reactjs) or [CSS](https://github.com/jeff1evesque/jefflevesque.com#stylesheet).

### Automated

A sample [`deploy.replace`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/deploy.replace) script has been provided, and needs be copied as `deploy`.  Additionally, variables at the top of the script will need to be updated to correctly reflect the AWS cognito distribution to be used.  Once necessary configurations have been made, the script can deploy both ReactJS and CSS altogether:

```bash
$ ./deploy -all
```

It can be used to compile only [ReactJS](https://github.com/jeff1evesque/jefflevesque.com#reactjs) or [CSS](https://github.com/jeff1evesque/jefflevesque.com#stylesheet):

```bash
$ ./deploy --js
```

It can be used to compiled only [CSS](https://github.com/jeff1evesque/jefflevesque.com#stylesheet):

```bash
$ ./deploy --css
```

### ReactJS

This section discusses javascript related syntax provided in [`deploy.replace`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/deploy.replace). Since the frontend code utilizes [AmplifyJS](https://docs.amplify.aws/start/?sc_icampaign=start&sc_ichannel=docs-home) integration with AWS, necessary configurations need to be copied into [`aws-exports.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/aws-exports.js) prior to the `build:browserify` compilation:

```bash
$ echo 'Updating aws-exports.js with desired values'
$ sed -i 's/REPLACE-IDENTITY-POOL-ID/us-east-1:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/g' aws-exports.js
$ sed -i 's/REPLACE-REGION/CognitoRegion/g' aws-exports.js
$ sed -i 's/REPLACE-IDENTITY-REGION/us-east-1/g' aws-exports.js
$ sed -i 's/REPLACE-USER-POOL-ID/us-east-1_xxxxxxxxx/g' aws-exports.js
$ sed -i 's/REPLACE-USER-POOL-WEB-CLIENT-ID/xxxxxxxxxxxxxxxxxxxxxxx/g' aws-exports.js
```

These values *should* correspond to the cognito distribution already deployed through a frontend cloudformation stack, and are supplied by the deployment pipeline rather than committed here.

While none of the values in [`aws-export.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/aws-exports.js) is sensitive, some were hidden to ensure correct values are manually obtained.

Once correct [`aws-exports.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/aws-exports.js) attributes have been defined, the following commands can be used to compile jsx/reactjs:

```bash
$ mkdir -p [PROJECT-ROOT]/static/js/
$ cd [PROJECT-ROOT]/jsx
$ npm run build:browserify
$ mv content.js [PROJECT-ROOT]/static/js/content.js
```

### Stylesheet

This section discusses css related syntax provided in [`deploy.replace`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/deploy.replace). The following commands can be used to compile scss:

```bash
$ mkdir -p [PROJECT-ROOT]/static/css/
cd [PROJECT-ROOT]/scss
$ npm run build:css
$ mv style.css [PROJECT-ROOT]/static/css/style.css
```

## Local Server

Once code has been [locally compiled](https://github.com/jeff1evesque/jefflevesque.com#local-compile), the local application can be started using the earlier installed `http-server`:

```bash_profile
$ cd [PROJECT-ROOT]
$ http-server
```

---

## Lint

`lint.yml` runs on every push and pull request, and [`.githooks/pre-commit`](.githooks/pre-commit) runs the same checks locally so the two cannot disagree.

| Workflow | What it checks |
|---|---|
| [`lint.yml`](.github/workflows/lint.yml) | `ruff check .` — rules in [`.ruff.toml`](.ruff.toml) |
| | `eslint` — 144 `.js`/`.jsx` files under `jsx/`, config in [`jsx/eslint.config.mjs`](jsx/eslint.config.mjs) |

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

The baseline is **86% on all four metrics**. Current figures:

| metric | current | room above the baseline |
| --- | --- | --- |
| statements | 92.76% | 272 statements |
| branches | 86.68% | 23 branches |
| functions | 87.34% | 10 functions |
| lines | 92.94% | 272 lines |

The badge shows the statements figure.

The room matters as much as the percentage. When the baseline was first set to 80 the
margin was **8 branches and zero functions**, so a single untested function added
anywhere would have reddened CI on the next push — a tripwire rather than a floor.
Covering `animation/graph-cluster.jsx`, the largest file and the least tested, bought
the first margin; raising the baseline to 85 spent part of it deliberately, and
covering the sample-data fallback in `get-data.js` and the distribution detail sheet
in `data.jsx` bought it back. Raising it to 86 spent it again, and covering the
listing's coverage figure in `stream.jsx` — untested until then, despite being the
only number on the page that can see a scraper which never ran — along with that
component's `reset_stream` and control tray and `area-chart.jsx`'s prop syncing, is
what paid for it.

The figures still drift a little with the clock, because a few suites build fixtures
from the rolling window and reach different schedule branches at different hours.
Measure twice before concluding a change moved coverage. It used to be worse:
`stream.jsx` picks a default rate from whether the market is open, and that block was
only ever measured in whichever state the run caught — which also made
`stream.test.jsx` pass overnight and fail every weekday afternoon. Both states are
pinned now.

Branches and functions are the two that bind — 23 and 10 of room against 272 for
statements and lines. In practice a build reddens on a new untested BRANCH long
before anything else. Keep the room: a baseline with none stops being a safety net
and starts being an obstacle.

The baseline tracks the **weakest** metric, which is branches — it moved 80 → 83 once
branches and functions had been carried well past 80. Raising it to the statements
figure instead would leave the other three failing on the next push; leaving it at 80
would let ten points be lost without CI noticing.

The badge above is a **static number and will go stale.** shields.io renders whatever
text sits in the badge URL — nothing reads the coverage report — so the figure is
hardcoded and only correct until someone forgets. It already went wrong once: it read
28% for a long stretch after coverage had passed 80%, which is precisely the failure
mode this paragraph was warning about. Update it in the same commit that moves the
baseline.

A dynamic badge IS possible, and an earlier version of this note wrongly said
otherwise. The pieces are in place; two steps need a GitHub account and so are left to
be done by hand.

CI already has the number: `tests.yml` runs jest with `collectCoverage` on. The
`json-summary` reporter writes `jsx/coverage-summary.json`, and
[`scripts/coverage_badge.py`](scripts/coverage_badge.py) turns it into the document
shields.io reads:

```json
{"color":"brightgreen","label":"coverage","message":"90%","schemaVersion":1}
```

The `Publish the coverage badge` step in `tests.yml` PATCHes that into a gist after
every **master** build — not on branches or pull requests, where the badge would
otherwise advertise whatever was pushed last.

**Only the overall statement percentage is published.** That is deliberate and it is
enforced rather than intended: the gist is public, `coverage-summary.json` is not, and
it carries one absolute path per source file — 131 of them at the time of writing,
including the developer's home directory. `coverage_badge.py` refuses to emit a payload
containing a path separator or a source extension, so a future change that widened it
to a per-file breakdown fails the build instead of publishing the tree.

To finish wiring it up:

1. Create a **public** gist containing one file named `coverage.json`, with any
   placeholder content. Its id is the hex string at the end of the gist url.
2. Add two repository secrets: `COVERAGE_GIST_ID` (that id) and
   `COVERAGE_GIST_TOKEN` (a fine-grained or classic PAT with **only** the `gist`
   scope).
3. Replace the badge at the top of this file with the endpoint form:

   ```
   [![coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/<user>/<gist-id>/raw/coverage.json)](jsx/jest.config.js)
   ```

Until step 3 is done the badge is the static one and has to be updated by hand. The
publish step emits a workflow **warning** when the secrets are absent, so an
unconfigured badge is visible in the run summary rather than silently rotting.

Coveralls and Codecov are the other route and do need a paid plan for a private
repository.

Note `jsx/package.json` still carries `coveralls` and a `report:coveralls` script.
Nothing calls them and there is no `.coveralls.yml` — they predate this work and
have never been wired up.

### React Testing Library, not enzyme

Component tests use [`@testing-library/react`](https://testing-library.com/react). Enzyme was removed: it has no React 18 adapter and has been unmaintained since 2021, while this project is on React 18. The previous suite was configured with `@wojtekmaj/enzyme-adapter-react-17` and **could not run** — all three files failed to load and zero tests executed.

Three things had to change for the suite to work at all, each worth knowing if it ever breaks again:

- **`jest.config.js` named `setupTestFrameworkScriptFile`**, a key Jest removed in version 24. Against Jest 26 it was silently ignored, so `setup.js` never loaded and neither the storage shims nor the console trap were ever active. It is now `setupFilesAfterEnv`.
- **`moduleDirectories` pinned resolution to an absolute `<rootDir>/node_modules`**, which replaces Jest's relative default and disables Node's upward walk. Anything npm nests rather than hoists then cannot be found — Jest 29 fails to start with `Cannot find module 'expect'`. The override is gone.
- **`setup.js` threw from inside `console.error`.** React reports problems by calling `console.error` *during* render, so throwing there unwinds React mid-commit and every test dies with `Should not already be working.` rather than the real warning — react-router's future-flag notice alone was enough. Unexpected console output still fails a test, but the failure is now raised *after* the test body.

`setup.js` also stubs `Worker` and `URL.createObjectURL`, which jsdom does not implement. `jsx/import/worker/web-worker.js` subclasses `Worker` at module load, so anything importing `main-route.jsx` — most of the app — throws `ReferenceError: Worker is not defined` without them. These are environment shims, not test doubles.

### What is covered

| Suite | Covers |
|---|---|
| [`validator.test.js`](jsx/__tests__/validator/validator.test.js) | all 11 input validators, 100% |
| [`login.test.jsx`](jsx/__tests__/content/login.test.jsx) | sign-in form: typing, submit, and that a *rejected* sign-in writes nothing to session storage |
| [`webform.test.jsx`](jsx/__tests__/layout/register/webform.test.jsx) | registration form: fields, field-level validation styling, and what reaches Cognito |
| [`page.test.jsx`](jsx/__tests__/layout/page.test.jsx) | url-to-layout routing through `main-route.jsx` |

Some tests are labelled `DOCUMENTS A DEFECT`. Those assert what the code does **today**, not what it should do, so that a fix breaks the test loudly instead of the behaviour changing unnoticed. Two are worth reading:

- **Registration validates nothing before submitting.** `webform.jsx` imports `valid-string`, `valid-email` and `valid-password`, but calls them only from `onChange` handlers that set state used for the `invalid` CSS class. `handleSubmit` never consults that state, so an empty form reaches `Auth.signUp` with `username: ''`. The field turns red and submits anyway; Cognito is the only thing actually enforcing the password policy.
- **A single unknown URL segment is not a 404.** The route table carries `path='/:user'`, so `/no-such-page` renders the profile layout rather than the error page. Only deeper unmatched paths reach the 404.
