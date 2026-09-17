# Knowledge graph

`GET https://api.jefflevesque.com/v1/public/knowledge-graph`

The published builds of the knowledge graph, and each build's schema: its node types,
its edge types, and how many of each it holds. `/graph` lets a reader pick a build and
draws it; the front page draws the default build behind its content.

## Parameters

| Parameter | Values | The application sends |
|---|---|---|
| `Graph` | an id taken from the listing | nothing, for the listing; the build selected in the picker, for its schema |

Without `Graph`, the answer is the listing of builds. With it, the answer is that
build's schema. `Graph` is the only query parameter accepted, and may be given once.

Ids are opaque. Take one from the listing and send it back unchanged: a caller that
builds an id by hand is guessing at a format it does not own.

## Response: the listing

`report` is an object:

| Field | |
|---|---|
| `default` | the id of the build to show when none is chosen, or `null` when nothing is servable |
| `graphs` | every published build, newest first |

Each build in `graphs` carries:

| Field | |
|---|---|
| `id` | the id to send back as `Graph` |
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

| Status | `report` |
|---|---|
| 400 | an object whose `error` names the problem: a parameter other than `Graph`, `Graph` given twice, or an id not shaped like one |
| 404 | an object whose `error` says the id is not in the listing, or its build is no longer available |
| 500 | an object whose `error` says what failed |

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

<swagger-ui src="openapi/knowledge-graph.json"/>
