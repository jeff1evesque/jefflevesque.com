# Knowledge graph

```
GET https://api.jefflevesque.com/v1/public/knowledge-graph
GET https://api.jefflevesque.com/v1/public/knowledge-graph/<id>
GET https://api.jefflevesque.com/v1/public/knowledge-graph/tables?Operation=<operation>
```

The published builds of the knowledge graph, and each build's schema: its node types,
its edge types, and how many of each it holds. `/graph` lets a reader pick a build and
draws it; the front page draws the default build behind its content.

The third path answers a different kind of question. The first two say what a build
**is**; `tables` says what a build **contains** — which links exist, which entities
match some text, and what is held about one of them.

## The calls

| Request | Answer | The application sends |
|---|---|---|
| `/knowledge-graph` | the listing of builds | on every page load, to find out which builds exist |
| `/knowledge-graph/<id>` | that build's schema | the build selected in the picker, or named in the address |
| `/knowledge-graph/tables` | rows answering one question | an `Operation`, and the values that operation takes |

**No query string is accepted on either build path.** Those two are told apart by
their paths, so anything on the query string is a caller error rather than something
ignored — including a `?Graph=<id>`, which is how this api was addressed before. The
`tables` path is the opposite: it is addressed entirely by its query string.

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
| `period` | the year and month the build covers, as `YYYY-MM` |
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

## Response: the tables

One `Operation` per request, with the values that operation takes. `report.rows` is a
list of objects whose columns depend on the operation, and an empty list is a
legitimate answer — the question was asked and nothing matched.

| `Operation` | Takes | Answers |
|---|---|---|
| `EdgeTypes` | — | the relation catalogue: which links exist between which node types, and how many of each |
| `Find` | `Text` | entities whose text matches, as a case-insensitive substring |
| `Facts` | `Uri`, optionally `Day` | the values held about one entity |
| `Neighborhood` | `Uri`, `Day` | the edges touching one entity, within that day |

`Limit` is accepted by all four and caps the rows returned. The service applies a
ceiling of its own, so a larger `Limit` does not widen the answer.

**`Day` is `YYYY-MM-DD`, and names a day that finished publishing.** `Neighborhood`
requires one because the numeric ids the tables join on are renumbered daily — an edge
only means anything joined within its own day. A caller following one entity across
days asks for each day in turn and joins on the `Uri`, which does not change. `Facts`
takes a `Day` too, and reads across the published window without one.

A value meaningless to the named operation is refused rather than ignored, the same
way a query string is refused on the build paths.

## Errors

| Status | Path | `report` |
|---|---|---|
| 400 | all three | an object whose `error` names the problem: a query string on a build path, an id not shaped like one, an unknown `Operation`, or a value that operation does not take |
| 404 | `/<id>`, `tables` | an object whose `error` says the id is not in the listing, or that the named `Day` is not a published day |
| 500 | all three | an object whose `error` says what failed |
| 504 | `tables` | an object whose `error` says the question was too large to answer inside the request window |

404 never belongs to the listing: it has no id to miss, and no day to name. A rejected
value is never echoed back in any of these.

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

Three operations, one for each call. **Every published build** takes no parameter --
Execute answers the listing, newest first. Take an id from that answer and give it to
**One build's schema** for the build itself.

**Ask one question of the published tables** starts with `Operation=EdgeTypes`, which
takes nothing else and answers the relation catalogue. `Find` a term to get a `Uri`,
then give that `Uri` to `Facts`. `Neighborhood` needs a `Day` as well, and the day
filled in below will stop resolving for the same reason the id does.

The id filled in below will stop resolving. The listing keeps only the recent builds,
and a build that has rolled off answers 404; copy a current id out of the listing
rather than the one filled in here.

<swagger-ui src="openapi/knowledge-graph.json"/>
