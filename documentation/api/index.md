# APIs

Every page that shows data reads it from one of three public APIs, called from the
reader's browser at runtime. The application has no server of its own between them.

| API | Endpoint | Read by |
|---|---|---|
| [Performance](performance.md) | `https://api.jefflevesque.com/v1/public/performance` | `/stream` |
| [Datalake](datalake.md) | `https://api.jefflevesque.com/v1/public/datalake` | `/data`, `/stream/:stream/alarm` |
| [Knowledge graph](knowledge-graph.md) | `https://api.jefflevesque.com/v1/public/knowledge-graph` | `/graph`, `/` |

## What they share

- **GET, with a query string.** Each is a single endpoint read with a GET request, and
  every parameter the application sends goes in the query string.
- **The `report` envelope.** Every response, success or failure, is a JSON object with
  one key, `report`. What `report` holds differs by API: a CSV string, an object of CSV
  strings, or JSON.
- **Errors inside the envelope.** A failed request answers a 4xx or 5xx status, and
  `report` carries a message, an object with an `error` message, or `null`. Each API's
  page lists its own.
- **Any origin.** Each answers a plain GET with `Access-Control-Allow-Origin: *`, which
  is what lets the application, and Try it out on these pages, call them from a
  browser. A CORS preflight is refused, so a request that would need one, such as one
  with a custom header or a method other than GET, cannot be made from a browser.

## Where the application builds its requests

Every URL the application fetches from these APIs is built in
[`jsx/import/general/api-url.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/api-url.js),
by `performanceUrl`, `datalakeUrl` and `knowledgeGraphUrl`.

The charts on `/stream` and `/data`, and the header on `/graph`, carry two icons built
from the same functions: a book, which opens that API's page here, and a pair of braces,
which opens the exact request behind what is on screen. Because the page's fetch and the
icon share one builder, the icon cannot name a request the page did not make.

## How these pages are kept true

Each API's page renders an OpenAPI document from
[`documentation/api/openapi/`](https://github.com/jeff1evesque/jefflevesque.com/tree/master/documentation/api/openapi),
and three test suites hold those documents to the application:

- [`jsx/__tests__/meta/openapi.test.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/__tests__/meta/openapi.test.js)
  validates every example against its own schema, and checks that each document offers
  only GET from the public server.
- [`jsx/__tests__/general/api-url.test.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/__tests__/general/api-url.test.js)
  fails when a request sends a parameter its document does not declare, or a document
  declares one no request sends, and checks the documented streams, datasets and rates
  against the ones the pages use.
- [`jsx/__tests__/general/api-examples.test.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/__tests__/general/api-examples.test.js)
  feeds each documented example through the loader that reads the real response, so an
  example the application could not read fails there.

These pages describe what a caller sends and receives. How each service is built is
not documented here.
