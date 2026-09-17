# This documentation

These pages are built with [MkDocs](https://www.mkdocs.org/) and
[Material for MkDocs](https://squidfunk.github.io/mkdocs-material/), from
[`mkdocs.yml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/mkdocs.yml)
and the Markdown under
[`documentation/`](https://github.com/jeff1evesque/jefflevesque.com/tree/master/documentation).
They live in the repository so they change in the same pull request as the code they
describe.

## Previewing

From the repository root:

```bash
pip install -r requirements-docs.txt
mkdocs serve          # http://127.0.0.1:8000
```

The versions are pinned in
[`requirements-docs.txt`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/requirements-docs.txt),
for the same reason ruff is pinned in the lint workflow. `mkdocs build` and
`mkdocs serve` have to run from the root, because some pages pull sections out of the
README by path.

`docs/` is ignored, as the scratch area for issue drafts, which is why the pages are
not there. `site/` is the build output, and is ignored too.

## Written once

The overview, the route table and the quick start are written in
[`README.md`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/README.md),
between `--8<--` markers, and pulled into pages with `pymdownx.snippets`. Edit them
there. A link inside one of those sections is a full URL, because the same text is read
both on GitHub and here.

## Strict builds

[`.github/workflows/docs.yml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.github/workflows/docs.yml)
builds the site on every pull request with `strict: true`, so a link to a page or an
anchor that does not exist, or a README section that has moved, fails the check instead
of shipping a 404. On a push to master it deploys the build to GitHub Pages; a branch
can never publish over the live site.

## The API pages

Each API's page renders an OpenAPI document from
[`documentation/api/openapi/`](https://github.com/jeff1evesque/jefflevesque.com/tree/master/documentation/api/openapi)
as a Swagger UI, with `mkdocs-swagger-ui-tag`. Try it out sends a real GET from the
reader's browser, and Swagger UI's online validator is switched off; the documents are
validated by the test suite instead. See [APIs](../api/index.md#how-these-pages-are-kept-true).

## Links

Every GitHub issue mentioned in these pages links to the issue, and every file in the
repository they mention links to that file on GitHub.
[`jsx/__tests__/meta/documentation.test.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/__tests__/meta/documentation.test.js)
fails when one does not.

[`.github/workflows/links.yml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.github/workflows/links.yml)
checks that the URLs in these pages and the README still resolve, weekly and by hand.
URLs it must not follow are listed, one pattern per line, in
[`.lycheeignore`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.lycheeignore):
the local preview server, the API endpoints, which answer an error when called without
parameters, and ontology terms, which are identifiers rather than addresses.
