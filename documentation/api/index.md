# APIs

Every page that shows data reads it from one of three public APIs, called from the
reader's browser at runtime. The application has no server of its own between them.

| API | Endpoint | Read by |
|---|---|---|
| [Performance](performance.md) | `https://api.jefflevesque.com/v1/public/performance` | `/stream` |
| [Datalake](datalake.md) | `https://api.jefflevesque.com/v1/public/datalake` | `/data`, `/stream/:stream/alarm` |
| [Knowledge graph](knowledge-graph.md) | `https://api.jefflevesque.com/v1/public/knowledge-graph` | `/graph`, `/` |
| [Knowledge graph tables](knowledge-graph.md#response-the-tables) | `https://api.jefflevesque.com/v1/public/knowledge-graph/tables/<question>` | `/graph/retrieval` — see below |

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
by `performanceUrl`, `datalakeUrl`, `knowledgeGraphUrl` and `knowledgeGraphTablesUrl`.

The charts on `/stream` and `/data`, and the graphs on `/graph` and `/graph/retrieval`,
carry icons built from the same functions: a book, which opens that API's page here,
and a pair of braces for each request behind what is on screen, which opens it
exactly. Because the page's fetch and the icon share one builder, the icon cannot name
a request the page did not make. The Retrieval graph draws a day from two requests, and
carries a pair of braces for each.

Each set sits with the thing it describes rather than with the page — in a chart's own
corner, and at the top of the column each graph page draws its graph in.

## Two things called tables

Both graph pages show tables of every node type and edge type below the graph, and
where those rows come from is what tells the two pages apart.

The **Training graph**, `/graph`, reads them out of the selected build's schema, which
the page has already fetched in order to draw it, so they add no request and are exact
for the build in the picker. Its picker names each build by the day of the tables it
holds, but its rows are **not** that day's tables: those keep four node types every
build leaves out, so only the build's own rows are exact for the graph drawn above them.
It asks the tables API for one thing, its `days`, and only while its listing holds a
build too old to record its own day. See
[Knowledge graph](knowledge-graph.md#response-a-builds-schema).

The **Retrieval graph**, `/graph/retrieval`, reads them from that API — one day's
`node-types` and `edge-types` — under a picker of **days**, where every row is exact
for the day selected. It chooses what it draws by what can be looked up rather than by
how many nodes a type holds, so its node table leads with each type's entities and
facts.

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
