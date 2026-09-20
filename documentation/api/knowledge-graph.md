# Knowledge graph

```
GET https://api.jefflevesque.com/v1/public/knowledge-graph
GET https://api.jefflevesque.com/v1/public/knowledge-graph/<id>
GET https://api.jefflevesque.com/v1/public/knowledge-graph/tables/edge-types
GET https://api.jefflevesque.com/v1/public/knowledge-graph/tables/find
GET https://api.jefflevesque.com/v1/public/knowledge-graph/tables/facts
GET https://api.jefflevesque.com/v1/public/knowledge-graph/tables/neighborhood
```

The published builds of the knowledge graph, and each build's schema: its node types,
its edge types, and how many of each it holds. `/graph` lets a reader pick a build and
draws it; the front page draws the default build, and is that graph and nothing else.

The `tables` paths answer a different kind of question. The first two say what a build
**is**; these say what a build **contains** — which links exist, which entities match
some text, and what is held about one of them.

## The calls

| Request | Answer | The application sends |
|---|---|---|
| `/knowledge-graph` | the listing of builds | on every page load, to find out which builds exist |
| `/knowledge-graph/<id>` | that build's schema | the build selected in the picker, or named in the address |
| `/knowledge-graph/tables/edge-types` | the relation catalogue | a `Limit` |
| `/knowledge-graph/tables/find` | entities matching some text | a `Text`, and a `Limit` |
| `/knowledge-graph/tables/facts` | the values held about one entity | a `Uri`, optionally a `Day` |
| `/knowledge-graph/tables/neighborhood` | the edges touching one entity | a `Uri` and a `Day` |

**No query string is accepted on either build path.** Those two are told apart by
their paths, so anything on the query string is a caller error rather than something
ignored — including a `?Graph=<id>`, which is how this api was addressed before.

**Each question has its own path.** It was once one path with an `?Operation=`, and
that could not be described: the four take four different sets of values, and a
single path declares one flat list — so any document of it permitted requests the api
rejects. A value meaningless to the path is a `400`, the same way a query string is on
a build path.

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
| `sources` | the sources that went into it |
| `error` | why the build cannot be served, or `null` when it can |

## Response: a build's schema

`report` is the build's schema:

| Field | |
|---|---|
| `node_types` | keyed by node type, each with its `count` and the ontology term it comes from, `source_type_uri` |
| `edge_types` | keyed by an opaque label, each naming its `src_type`, `relation` and `dst_type`, with its `count` and its `origin`: `raw`, `enrichment` or `unification` |
| `summary` | totals: `total_node_types`, `total_edge_types`, `total_nodes`, `total_edges` |
| `version`, `build_metadata`, `relation_groups` | carried through; the application does not read them |

`nodes` in the listing and `node_types` in the schema count different things. A build
holds millions of nodes across well over a hundred node types, and the graph draws one
circle per node **type** -- a slice of them, since not all fit legibly. See
[#46](https://github.com/jeff1evesque/jefflevesque.com/issues/46), where the page
labelled the first figure as the second.

The types the canvas leaves out are not lost: `/graph` lists every `node_types` and
`edge_types` entry in tables below the graph, read from this same response. No further
request is made for them, and nothing there comes from the `tables` paths below -- those
answer across the published window rather than for one build, which under a build picker
would read as something they are not.

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
| `tables/edge-types` | — | the relation catalogue: which links exist between which node types, and how many of each |
| `tables/find` | `Text` | entities whose text matches, as a case-insensitive substring |
| `tables/facts` | `Uri`, optionally `Day` | the values held about one entity |
| `tables/neighborhood` | `Uri`, `Day` | the edges touching one entity, within that day |

`Limit` is accepted by all four and caps the rows returned. The service applies a
ceiling of its own, so a larger `Limit` does not widen the answer.

**`Day` is `YYYY-MM-DD`, and names a day that finished publishing.** `Neighborhood`
requires one because the numeric ids the tables join on are renumbered daily — an edge
only means anything joined within its own day. A caller following one entity across
days asks for each day in turn and joins on the `Uri`, which does not change. `Facts`
takes a `Day` too, and reads across the published window without one.

A value meaningless to the path is refused rather than ignored, the same way a query
string is refused on the build paths.

## Errors

| Status | Path | `report` |
|---|---|---|
| 400 | all | an object whose `error` names the problem: a query string on a build path, an id not shaped like one, or a value the `tables` path asked for does not take |
| 404 | `/<id>`, `tables/*` | an object whose `error` says the id is not in the listing, or that the named `Day` is not a published day |
| 500 | all | an object whose `error` says what failed |
| 504 | `tables/*` | an object whose `error` says the question was too large to answer inside the request window |

404 never belongs to the listing: it has no id to miss, and no day to name. A rejected
value is never echoed back in any of these.

A path the api does not serve — `tables/snapshots`, say — is refused by API Gateway
before the service sees it, so it answers `MISSING_AUTHENTICATION_TOKEN` rather than a
`report`. That is what a wrong path looks like, as distinct from a wrong value.

## In the application

- Built by `knowledgeGraphUrl` and, for the tables, `knowledgeGraphTablesUrl`, in
  [`jsx/import/general/api-url.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/api-url.js).
- Fetched by `getGraphListing`, `getGraphById` and `getGraphSchema`, in
  [`jsx/import/general/get-graph-schema.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/get-graph-schema.js).
- Cut down to a slice that can be drawn legibly by
  [`jsx/import/animation/filter-schema.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/animation/filter-schema.js),
  then drawn by
  [`jsx/import/layout/graph/graph.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/graph/graph.jsx)
  and, on the front page,
  [`jsx/import/animation/graph-cluster.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/animation/graph-cluster.jsx).

## Try it

Six operations, one for each call, and each takes only what its own path takes —
Execute sends what the form shows and nothing else.

**Every published build** takes no parameter; Execute answers the listing, newest
first. Take an id from that answer and give it to **One build's schema**.

**The relation catalogue** likewise takes nothing, so Execute answers it outright.
From there the tables follow one another: **Entities matching some text** to get a
`Uri`, that `Uri` to **The values held about one entity**, and the same `Uri` with a
`Day` to **The edges touching one entity**.

Two filled-in values go stale, and for the same reason. The listing keeps only recent
builds, so an id that has rolled off answers 404 — copy a current one out of the
listing. Published days roll off too, so a `Day` older than the window answers 404 as
well; take one from a recent answer rather than the one filled in here.

<swagger-ui src="openapi/knowledge-graph.json"/>
