# Workflows

What gates a pull request, so nobody has to open the workflows to find out.

| Workflow | Runs on | Checks |
|---|---|---|
| [`lint.yml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.github/workflows/lint.yml) | pull requests, pushes to master | ruff and ESLint, correctness rules only; see [Lint and hooks](../development/lint.md) |
| [`unicode.yml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.github/workflows/unicode.yml) | pull requests, pushes to master | invisible and confusable characters in tracked files, with [`scripts/check_unicode.py`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/scripts/check_unicode.py) |
| [`tests.yml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.github/workflows/tests.yml) | pull requests, pushes to master | the Jest suite and its coverage floor, and on master the coverage badge; see [Testing](../development/testing.md) |
| [`gitleaks.yml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.github/workflows/gitleaks.yml) | pull requests, pushes to master | committed secrets, over the full history |
| [`trivy.yml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.github/workflows/trivy.yml) | pull requests, pushes to master, and weekly | HIGH and CRITICAL dependency advisories |
| [`docs.yml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.github/workflows/docs.yml) | pull requests, pushes to master | a strict build of these pages; deploys them on master |
| [`links.yml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.github/workflows/links.yml) | weekly, and by hand | that the URLs in these pages and the README still resolve |

Two of these can go red with no push behind them. `trivy.yml` runs on a schedule, so a
new advisory against an existing dependency fails it on an untouched branch.
`links.yml` runs only on a schedule and by hand, and never on a pull request: it
depends on other people's servers, and an upstream outage should be information, not a
blocked merge.

Push-triggered workflows are scoped to master. With a bare `push` beside
`pull_request`, every commit on a branch with an open pull request would run each
workflow twice for the same answer.

## Before the push

[`.githooks/pre-commit`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.githooks/pre-commit)
runs the Unicode, secret and lint checks against staged files, so those fail before the
push rather than after, and
[`.githooks/pre-push`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.githooks/pre-push)
refuses a push to master. See [Lint and hooks](../development/lint.md#the-hooks).

## Issues and commits

Issues use the templates under
[`.github/ISSUE_TEMPLATE/`](https://github.com/jeff1evesque/jefflevesque.com/tree/master/.github/ISSUE_TEMPLATE).
Work goes on a `feature-<issue>` branch, one commit per file, each commit reading
`#<issue>: <file>, <what changed>`. Merges are squashes, so what lands on master is the
pull request's title.
