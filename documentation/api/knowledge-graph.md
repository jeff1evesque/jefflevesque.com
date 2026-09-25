# Knowledge graph

```
GET https://api.jefflevesque.com/v1/public/knowledge-graph
GET https://api.jefflevesque.com/v1/public/knowledge-graph/<id>
GET https://api.jefflevesque.com/v1/public/knowledge-graph/tables/days
GET https://api.jefflevesque.com/v1/public/knowledge-graph/tables/node-types
GET https://api.jefflevesque.com/v1/public/knowledge-graph/tables/edge-types
GET https://api.jefflevesque.com/v1/public/knowledge-graph/tables/find
GET https://api.jefflevesque.com/v1/public/knowledge-graph/tables/facts
GET https://api.jefflevesque.com/v1/public/knowledge-graph/tables/neighborhood
GET https://api.jefflevesque.com/v1/public/knowledge-graph/tables/quotes
GET https://api.jefflevesque.com/v1/public/knowledge-graph/tables/last-quotes
```

The published builds of the knowledge graph, and each build's schema: its node types,
its edge types, and how many of each it holds. The **Training graph**, `/graph`, lets a
reader pick a build and draws it; the front page draws the default build, and is that
graph and nothing else.

The `tables` paths answer a different kind of question. The first two say what a build
**is**; these say what the published tables **contain**, a day at a time — which days
there are, which links and node types a day holds, which entities match some text, what
is held about one of them, and the day's stock quotes. The **Retrieval graph**,
`/graph/retrieval`, draws one day from them.

## The calls

| Request | Answer | The application sends |
|---|---|---|
| `/knowledge-graph` | the listing of builds | on every Training graph load, to find out which builds exist |
| `/knowledge-graph/<id>` | that build's schema | the build selected in the picker, or named in the address |
| `/knowledge-graph/tables/days` | every published day | on every Retrieval graph load, to find out which days exist |
| `/knowledge-graph/tables/node-types` | a day's node types, with what can be looked up in each | the day selected, and a `Limit` of 1000 |
| `/knowledge-graph/tables/edge-types` | the relation catalog | the same `Day`, and a `Limit` of 1000 |
| `/knowledge-graph/tables/find` | entities matching some text | nothing yet |
| `/knowledge-graph/tables/facts` | the values held about one entity | nothing yet |
| `/knowledge-graph/tables/neighborhood` | the edges touching one entity | nothing yet |
| `/knowledge-graph/tables/quotes` | one stock's quotes through a day | nothing yet |
| `/knowledge-graph/tables/last-quotes` | every stock's last quote of a day | nothing yet |

**No query string is accepted on either build path.** Those two are told apart by
their paths, so anything on the query string is a caller error rather than something
ignored — including a `?Graph=<id>`, which is how this api was addressed before.

**Each question has its own path.** It was once one path with an `?Operation=`, and
that could not be described: the questions take different sets of values, and a single
path declares one flat list — so any document of it permitted requests the api rejects.
A value meaningless to the path is a `400`, the same way a query string is on a build
path.

Ids are opaque. Take one from the listing and send it back unchanged: a caller that
builds an id by hand is guessing at a format it does not own.

A build id is a path segment, so it is url-encoded on the way out. Ids published so
far need no encoding, but nothing here assumes what is in one.

## Response: the listing

`report` is an object:

| Field | |
|---|---|
| `default` | the id served when the caller names no build -- the service chooses it, rather than it being implied by the order of `graphs`; `null` when nothing is servable |
| `graphs` | every published build, newest first |

Each build in `graphs` carries:

| Field | |
|---|---|
| `id` | the id to send back as the path segment |
| `label` | how the build reads in a list |
| `dataset`, `variant` | which data went in, and how it was built |
| `period` | the partition the build was published under, as `YYYY-MM`. **Not a window over its data** — see below |
| `run`, `built` | when the build ran and when it finished, in UTC |
| `nodes`, `edges` | every node and every edge in the build |
| `sources` | every source the build's run read. **Not always the sources in its graph** — see below |
| `error` | why the build cannot be served, or `null` when it can |

## Response: a build's schema

`report` is the build's schema:

| Field | |
|---|---|
| `node_types` | keyed by node type, each with its `count` and the ontology term it comes from, `source_type_uri` |
| `edge_types` | keyed by an opaque label, each naming its `src_type`, `relation` and `dst_type`, with its `count` and its `origin`: `raw`, `enrichment` or `unification` |
| `summary` | totals: `total_node_types`, `total_edge_types`, `total_nodes`, `total_edges` |
| `version` | the schema's version, which says which fields the rest of it carries |
| `build_metadata` | how the build was made. `/graph` reads one field of it, `sources_in_graph`, from version `1.4` |
| `relation_groups` | carried through; the application does not read it |

`nodes` in the listing and `node_types` in the schema count different things. A build
holds millions of nodes across well over a hundred node types, and the graph draws one
circle per node **type** -- a slice of them, since not all fit legibly. See
[#46](https://github.com/jeff1evesque/jefflevesque.com/issues/46), where the page
labeled the first figure as the second.

The types the canvas leaves out are not lost: `/graph` lists every `node_types` and
`edge_types` entry in tables below the graph, read from this same response. No further
request is made for them, and nothing there comes from the `tables` paths below -- those
take no build id, which under a build picker would read as something they are not. The
Retrieval graph reads them under a **day** picker instead, where every row is the day's.

**A build's `sources` are what its run read, not what its graph holds.** From schema
`1.4`, `build_metadata.sources_in_graph` names the sources whose node types reached the
graph, and the two lists can differ by a whole source: the daily run reads `noaa` and
leaves every `noaa` node type out, so a `1.4` build of it has `bls, market, noaa, sec`
as its `sources` and `bls, market, sec` in its graph. `/graph`'s Sources row reads
`sources_in_graph` from a `1.4` schema, and the listing's `sources` from an older one,
which has no account of what reached the graph. Which of the two applies is in the
schema's `version`, so that one row waits for the schema rather than showing the
listing's list first.

**`period` is a partition key, not a window over the data.** Builds are published under
a partition -- `YYYY-MM`, nested year then month -- and an `id` is selected from within
it, which is why the listing above holds several builds sharing one `period` and
differing by `run`. It says where a build was published, not what is in it.

Nothing about a build is bounded by its `period`. A build published under `2026-09`
carries 76 distinct dates of its own -- countable as `bls_enrichment_UnifiedDay` in its
schema -- alongside economic series reaching back eighteen years. A caller wanting to
know what a build actually spans has to read the build, and `run` is the only date that
bounds anything: nothing published after it can be in there.

`/graph` deliberately shows no `period`. It read it out first as a derived day range
ending on the run date, then as a month, and both told a reader it was a coverage window.
The partition is in each build's `label`, where it reads as part of a name.

## Response: the tables

One question per path, with the values that path takes. `report.rows` is a list of
objects whose columns depend on the question, and an empty list is a legitimate
answer — it was asked and nothing matched.

| Path | Takes | Answers |
|---|---|---|
| `tables/days` | nothing | every published day, newest first: the days the rest may name |
| `tables/node-types` | `Day` | one row per node type that day: its `count` of nodes, its `entities` — the nodes that carry text, and so can be found by name — and its `facts`, the values held about them |
| `tables/edge-types` | optionally `Day` | the relation catalog: which links exist between which node types, how many of each, and whether each came from a source or was derived |
| `tables/find` | `Text`, optionally `Day` | entities whose text matches, as a case-insensitive substring |
| `tables/facts` | `Uri`, optionally `Day` | the values held about one entity |
| `tables/neighborhood` | `Uri`, `Day` | the edges touching one entity, within that day |
| `tables/quotes` | `Symbol`, `Day` | one stock's snapshots that day, oldest first — about 19, every 20 minutes from 9:40 AM to 3:40 PM Eastern |
| `tables/last-quotes` | `Day` | every stock's last snapshot that day, one row each |

**`Limit`** is taken by every path but `days`, which takes nothing at all. It is 100
when left out and 1000 at most, and a larger one is refused with a `400` rather than
cut to the ceiling. A day holds about 155 node types and 838 edge types, so a `Limit`
of 1000 is all of either.

**`Day` is `YYYY-MM-DD`, and names a day that finished publishing** — one `days`
lists. `neighborhood` requires one because the numeric ids the tables join on are
renumbered daily: an edge only means anything joined within its own day. `node-types`
requires one because every day is written whole, so a node counted across days would
be counted once for each day that holds it. A caller following one entity across days
asks for each day in turn and joins on the `Uri`, which does not change.

Where it is optional, a `Day` narrows the answer to that day. Without one, `edge-types`
and `find` read every day in the window and answer a row once for each day holding
it, with nothing on the row to say which; `facts` takes each entity's newest day.

**The quotes are stocks only.** An option on the same ticker is a snapshot of its
own, a median 13,224 of them a day against a stock's 19, and `quotes` and
`last-quotes` leave them out. Their columns are named as the tables name them:
`market_quotes_symbol`, `market_quotes_captureTime` (UTC), `market_quotes_lastPrice`,
`market_quotes_openPrice`, `market_quotes_closePrice` — the **previous** session's
close — `market_quotes_netChange`, `market_quotes_netPercentChange` and
`market_quotes_totalVolume`. A `Symbol` is a ticker in capitals, such as `NVDA` or
`BRK.B`, compared for equality: `nvda` is a `400`, not an empty answer.

A value meaningless to the path is refused rather than ignored, the same way a query
string is refused on the build paths.

### What the Retrieval graph reads

`/graph/retrieval` draws one day from `days`, `node-types` and `edge-types`, put into
the shape of a build's schema so the page that draws a build draws it. It chooses the
sixty types it draws by their **`entities`**, not their `count`. Weighed by `count`,
a day is its own build again — on 2026-09-23, 56 of the same 60 node types, led by
nine million market snapshots that carry no name and no value to look up. Weighed by
what can be found by name, it draws the day's 49 named types and the 11 that join
them, and shares 21 of the 60 with its build.

## Caching

How long an answer may be kept, by a browser or by the shared cache in front of the
api, depends on whether it names a `Day`:

| Answer | `Cache-Control` |
|---|---|
| one naming a `Day` — always, for `node-types`, `neighborhood`, `quotes` and `last-quotes` | `public, max-age=86400, stale-while-revalidate=604800, stale-if-error=604800` |
| one naming no `Day` | `public, max-age=300` |
| `days` | `public, max-age=300, stale-while-revalidate=86400, stale-if-error=86400` |
| any error | `no-store` |

A published day is written whole and never rewritten, so an answer naming one cannot
change: it is fresh for a day, and usable stale for a week while a fresh copy is
fetched. An answer naming no day reads the newest days, which a landing day changes.
The shared cache keys on the whole url, query string included.

## Errors

| Status | Path | `report` |
|---|---|---|
| 400 | all | an object whose `error` names the problem: a query string on a build path, an id not shaped like one, a value missing that the path requires (`Day is required for NodeTypes`), a value it does not take, or one not shaped as it takes it |
| 404 | `/<id>`, `tables/*` but `days` | an object whose `error` says the id is not in the listing, or that the named `Day` is not a published day |
| 500 | all | an object whose `error` says what failed |
| 504 | `tables/facts`, `tables/neighborhood` | an object whose `error` says the question was too large to answer inside the request window |

404 never belongs to the listing or to `days`: neither has an id to miss or a day to
name, and no day published is an empty list of them. A rejected value is never echoed
back in any of these.

A path the api does not serve — `tables/snapshots`, say — is answered `403` before any
service sees it, with `MISSING_AUTHENTICATION_TOKEN` in place of a `report`. That is
what a wrong path looks like, as distinct from a wrong value.

## In the application

- Built by `knowledgeGraphUrl` and, for the tables, `knowledgeGraphTablesUrl`, in
  [`jsx/import/general/api-url.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/api-url.js).
- Fetched by `getGraphListing`, `getGraphById` and `getGraphSchema`, in
  [`jsx/import/general/get-graph-schema.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/get-graph-schema.js),
  and a day of the tables by `getTableDays` and `getTableDay`, in
  [`jsx/import/general/get-graph-tables.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/get-graph-tables.js).
- Cut down to a slice that can be drawn legibly by
  [`jsx/import/animation/filter-schema.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/animation/filter-schema.js),
  then drawn by
  [`jsx/import/layout/graph/graph.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/graph/graph.jsx)
  and, on the front page,
  [`jsx/import/animation/graph-cluster.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/animation/graph-cluster.jsx).
  What differs between the Training graph and the Retrieval graph — what each picks
  from, loads, weighs its slice by and says about it — is in
  [`jsx/import/layout/graph/source.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/graph/source.js).

## Try it

Ten operations, one for each call, and each takes only what its own path takes —
Execute sends what the form shows and nothing else.

**Every published build** takes no parameter; Execute answers the listing, newest
first. Take an id from that answer and give it to **One build's schema**.

**Every published day** likewise takes nothing, and answers the days. Take one and
give it to **A day's node types** and **The relation catalog**, which together are
the day the Retrieval graph draws. From there the tables follow one another:
**Entities matching some text** to get a `Uri`, that `Uri` to **The values held
about one entity**, and the same `Uri` with a `Day` to **The edges touching one
entity**. **One stock's quotes through a day** takes a ticker and a `Day`, and
**Every stock's last quote of a day** a `Day` alone.

Two filled-in values go stale, and for the same reason. The listing keeps only recent
builds, so an id that has rolled off answers 404 — copy a current one out of the
listing. Published days roll off too, after a year, so a `Day` older than that answers
404 as well; take one from **Every published day** rather than the one filled in here.

<swagger-ui src="openapi/knowledge-graph.json"/>
