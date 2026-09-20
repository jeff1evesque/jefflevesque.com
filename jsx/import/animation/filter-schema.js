/**
 * filter-schema.js: reduce a published graph_schema.json to what a backdrop can
 *                   legibly carry, WITHOUT tearing the graph apart.
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
 *
 * Note: CONNECTIVITY is the reason this is not simply "the 24 biggest".
 *
 *       It was, and the result was measured against a live build: 24 node types
 *       holding 13 connecting edges, in TWELVE disconnected components, nine of
 *       them single nodes with no edge at all. The cluster's whole premise is
 *       that communities emerge from the edge topology via d3.forceLink, and a
 *       set of floating dots has no topology to emerge from -- the layout was
 *       strictly worse than the 24-type mock it replaced.
 *
 *       The cause is that count is not structural importance. The types that
 *       tie a graph together are frequently small: the live build's
 *       market_enrichment_EquitySector has a count of 11 and links market data
 *       to everything else, while the heaviest type in the graph by three orders
 *       of magnitude sits in a corner with two neighbours. Ranking by count
 *       keeps the mass and discards the connective tissue.
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

//
// how many node types the explorer page carries.
//
// Larger than the front page, which carries 24 because that is the density a
// backdrop reads at. Measured against the published build, the selection stays
// in one connected piece from about 40 upward; 60 is comfortably inside that and
// still legible. It is a look-at-it number and can move.
//
// Note: it lives HERE, beside the other budget, rather than in the page that
//       spends it, because it is no longer only a drawing budget -- encoding.js
//       ranks the shared colour palette over this same slice, so the front page
//       depends on it too. Two copies of 60 in two files is exactly the drift
//       the palette was consolidated to end.
//
const EXPLORER_NODE_TYPES = 60;

//
// what fraction of the budget is spent on the biggest types before connectivity
// gets a say. Two thirds -- 16 of 24 -- keeps the graph's mass on screen (all
// five of the live build's largest types survive) while leaving room for the
// connectors that make it read as one graph rather than a scatter.
//
const SEED_FRACTION = 2 / 3;

//
// how many already-kept types a candidate must touch to be pulled in as a
// connector. Two, not one: a type with a single kept neighbour is a leaf and
// adds a dangling twig, while a type with two JOINS things that were previously
// apart, which is the entire point of spending budget on it.
//
const CONNECTOR_MIN_LINKS = 2;

//
// Note: there is no constant for "how many slots to save for joining things up",
//       and there was one briefly. It was a made-up number: picking 2 worked on
//       one build and nothing justified 2 over 1 or 5. The last pass below
//       replaces it -- it takes exactly as many slots as it needs and no more,
//       so there is no knob to guess at.

/**
 * neighbours per node type, from the edges between them.
 *
 * Note: self-loops are excluded. src === dst is meaningful data -- it reads as a
 *       recurring relation and is kept in the output -- but it connects a type
 *       to nothing, and counting it would let a node qualify as a "connector" on
 *       the strength of pointing at itself. Sixteen of the twenty-nine edges the
 *       old rule kept were self-loops, which is most of why a set that looked
 *       edge-rich rendered as dust.
 */
export function adjacency(node_types, edge_types) {
    const adjacent = new Map(Object.keys(node_types).map((id) => [id, new Set()]));

    Object.keys(edge_types).forEach((key) => {
        const { src_type, dst_type } = edge_types[key];

        if (src_type === dst_type) {
            return;
        }
        if (!adjacent.has(src_type) || !adjacent.has(dst_type)) {
            return;
        }

        adjacent.get(src_type).add(dst_type);
        adjacent.get(dst_type).add(src_type);
    });

    return adjacent;
}

/**
 * order node types by count, descending, ties broken by id.
 *
 * Note: the tie-break is not decoration. Five types share a count of 1,998 in
 *       the live build and three share 371, so a sort that left equal counts in
 *       object-key order would be stable only by accident -- and the backdrop
 *       would quietly reshuffle between builds. Sorting the ids makes the same
 *       schema always produce the same answer.
 */
export function rank(node_types, limit) {
    return Object.keys(node_types)
        .sort((a, b) => {
            const delta = (node_types[b].count || 0) - (node_types[a].count || 0);
            return delta !== 0 ? delta : a.localeCompare(b);
        })
        .slice(0, limit);
}

/**
 * choose the node types to draw: the biggest, then whatever holds them together.
 *
 * Three passes, in order:
 *
 *   1. seed with the largest types, so the backdrop still shows the graph's mass
 *   2. back-fill anything that links two or more of them, so the seeds stop
 *      being islands -- taken biggest-first, and cascading, since a connector
 *      added here can qualify the next one
 *   3. pad any remaining budget with the next largest types
 *
 * Note: pass 3 can re-introduce a disconnected node, and deliberately is not
 *       guarded against. Budget left over means the graph ran out of connectors
 *       to buy, and at that point a large type the reader recognises is worth
 *       more than a small one that happens to touch something. On the live build
 *       it does not arise -- the connectors exhaust the budget first.
 */
export function components(keep, adjacent) {
    const seen = new Set();
    const found = [];

    keep.forEach((start) => {
        if (seen.has(start)) {
            return;
        }

        const stack = [start];
        const part = [];
        seen.add(start);

        while (stack.length) {
            const id = stack.pop();
            part.push(id);

            adjacent.get(id).forEach((next) => {
                if (keep.has(next) && !seen.has(next)) {
                    seen.add(next);
                    stack.push(next);
                }
            });
        }

        found.push(part);
    });

    return found.sort((a, b) => b.length - a.length);
}

export function selectTypes(node_types, edge_types, limit) {
    const ordered = rank(node_types, Object.keys(node_types).length);
    const adjacent = adjacency(node_types, edge_types);
    const seeded = Math.max(1, Math.round(limit * SEED_FRACTION));
    const seeds = new Set(ordered.slice(0, seeded));
    const keep = new Set(seeds);

    {/* anything linking two or more of the ones already kept */}

    ordered.forEach((id) => {
        if (keep.size >= limit || keep.has(id)) {
            return;
        }

        const links = [...adjacent.get(id)].filter((other) => keep.has(other));

        if (links.length >= CONNECTOR_MIN_LINKS) {
            keep.add(id);
        }
    });

    {/* any budget left over goes on size */}

    ordered.forEach((id) => {
        if (keep.size >= limit) {
            return;
        }
        keep.add(id);
    });

    {/*

        Anything still floating gets joined back on, by trading a type away.

        The pass above counts how many kept types a candidate touches, which is
        not the same question as whether it joins the graph up, and the gap was
        visible on the front page: two XBRL types were kept, they link to each
        other, and the one type that links them to everything else touched only
        ONE of the kept set at the moment it was considered -- so it was passed
        over, and they sat in the corner on their own.

        It also cannot be fixed by considering candidates in a different order.
        Whether a type is worth keeping depends on what else was kept, and that
        is not known until the end. So this runs at the end, on the finished set.

        Note: a swap has to EARN its place -- it is only made when it genuinely
              leaves fewer pieces than before. Without that check a trade could
              leave the count unchanged and the loop would keep paying for
              nothing.

    */}

    let parts = components(keep, adjacent);

    while (parts.length > 1) {
        const where = new Map();
        parts.forEach((part, index) => part.forEach((id) => where.set(id, index)));

        const joins_up = ordered.find((id) => {
            if (keep.has(id)) {
                return false;
            }

            const reaches = new Set([...adjacent.get(id)]
                .filter((other) => keep.has(other))
                .map((other) => where.get(other)));

            return reaches.size >= 2;
        });

        if (!joins_up) {
            break;
        }

        {/*

            what to give up for it: the smallest type that is not one of the
            originals, and whose absence does not itself break the graph apart.

        */}

        const give_up = [...keep]
            .filter((id) => !seeds.has(id))
            .sort((a, b) => (node_types[a].count || 0) - (node_types[b].count || 0))
            .find((id) => {
                const swapped = new Set(keep);
                swapped.delete(id);
                swapped.add(joins_up);

                return components(swapped, adjacent).length < parts.length;
            });

        if (!give_up) {
            break;
        }

        keep.delete(give_up);
        keep.add(joins_up);
        parts = components(keep, adjacent);
    }

    return keep;
}

/**
 * reduce a schema to the node types a backdrop can carry, and the edges between
 * them.
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

    const keep = selectTypes(node_types, edge_types, limit);

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

export { BACKDROP_NODE_TYPES, EXPLORER_NODE_TYPES, SEED_FRACTION, CONNECTOR_MIN_LINKS };
