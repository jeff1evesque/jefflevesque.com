# Knowledge graph

```
GET https://api.jefflevesque.com/v1/public/knowledge-graph
GET https://api.jefflevesque.com/v1/public/knowledge-graph/<id>
```

The published builds of the knowledge graph, and each build's schema: its node types,
its edge types, and how many of each it holds. `/graph` lets a reader pick a build and
draws it; the front page draws the default build behind its content.

## The two calls

| Request | Answer | The application sends |
|---|---|---|
| `/knowledge-graph` | the listing of builds | on every page load, to find out which builds exist |
| `/knowledge-graph/<id>` | that build's schema | the build selected in the picker, or named in the address |

**No query string is accepted on either path.** The two calls are told apart by their
paths, so anything on the query string is a caller error rather than something
ignored — including a `?Graph=<id>`, which is how this api was addressed before.

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

## Errors

| Status | Path | `report` |
|---|---|---|
| 400 | both | an object whose `error` names the problem: a query string, or an id not shaped like one |
| 404 | `/<id>` | an object whose `error` says the id is not in the listing, or its build is no longer available |
| 500 | both | an object whose `error` says what failed |

404 belongs to the schema path alone. The listing has no id to miss.

## In the application

- Built by `knowledgeGraphUrl`, in
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

Two operations, one for each call. **Every published build** takes no parameter --
Execute answers the listing, newest first. Take an id from that answer and give it to
**One build's schema** for the build itself.

The id filled in below will stop resolving. The listing keeps only the recent builds,
and a build that has rolled off answers 404; copy a current id out of the listing
rather than the one filled in here.

<swagger-ui src="openapi/knowledge-graph.json"/>
