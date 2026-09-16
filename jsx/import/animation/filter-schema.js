/**
 * filter-schema.js: reduce a published graph_schema.json to what a backdrop can
 *                   legibly carry.
 *
 * The builder publishes the whole ontology -- 152 node types and 826 edge types
 * in the September 2026 all-sources build, against the 24 and 26 the front page
 * was designed around. GraphCluster draws one circle per node TYPE, so this is a
 * readability limit rather than a payload one: a few hundred KB of json arrives
 * fine, and then 152 labelled circles sit behind the hero text and the backdrop
 * stops reading as a backdrop.
 *
 * This runs in the client rather than at build or publish time. The published
 * artifact stays canonical, and the graph explorer page will want a larger slice
 * of the same document than the front page does -- filtering upstream would have
 * to pick one answer for both.
 *
 * Note: a pure function in its own module, deliberately not a method on the
 *       component. It is input -> output with no dom and no d3, which is the
 *       only part of "does this still read as a backdrop" that can honestly be
 *       tested; the rest is a judgment made by looking at it.
 */

//
// how many node types the front page carries.
//
// 24 is not a round number picked for its own sake -- it is the size of the
// schema the cluster was built and tuned against, so it is the one density this
// layout is known to work at. Raising it is a visual decision that should be
// made by looking at the result, not by reasoning about the payload.
//
const BACKDROP_NODE_TYPES = 24;

/**
 * pick the node types to keep: the largest by count, ties broken by id.
 *
 * Note: the tie-break is not decoration. Five types share a count of 1,998 in
 *       the live build and three share 371, so a sort that left equal counts in
 *       object-key order would be stable only by accident -- and the backdrop
 *       would quietly reshuffle between builds. Sorting the ids makes the same
 *       schema always produce the same 24.
 */
function rank(node_types, limit) {
    return Object.keys(node_types)
        .sort((a, b) => {
            const delta = (node_types[b].count || 0) - (node_types[a].count || 0);
            return delta !== 0 ? delta : a.localeCompare(b);
        })
        .slice(0, limit);
}

/**
 * reduce a schema to its top `limit` node types and the edges that survive them.
 *
 * Returns null for anything that is not a usable schema, so a caller has one
 * check to make rather than several: a rejected fetch, a non-ok response and a
 * malformed body all arrive here as the same answer.
 *
 * Note: the whole document is spread back out, not just the two filtered keys.
 *       'build_metadata' and 'summary' cost nothing to carry and the explorer
 *       page will want them -- and a caller that reads 'summary.total_node_types'
 *       should still see the TRUE total rather than the filtered one.
 */
export default function filterSchema(schema, limit = BACKDROP_NODE_TYPES) {
    if (!schema || typeof schema !== 'object') {
        return null;
    }

    const { node_types, edge_types } = schema;

    if (!node_types || typeof node_types !== 'object'
        || !edge_types || typeof edge_types !== 'object') {
        return null;
    }

    const keep = new Set(rank(node_types, limit));

    const kept_nodes = {};
    keep.forEach((id) => { kept_nodes[id] = node_types[id]; });

    {/*

        Note: an edge whose endpoint was filtered out is DROPPED, not kept with a
              dangling reference. d3.forceLink resolves source/target by id and
              throws on one it cannot find, so with 826 edges over 24 surviving
              nodes this is load-bearing rather than defensive.

    */}

    const kept_edges = {};
    Object.keys(edge_types).forEach((key) => {
        const edge = edge_types[key];
        if (keep.has(edge.src_type) && keep.has(edge.dst_type)) {
            kept_edges[key] = edge;
        }
    });

    return { ...schema, node_types: kept_nodes, edge_types: kept_edges };
}

export { BACKDROP_NODE_TYPES, rank };
