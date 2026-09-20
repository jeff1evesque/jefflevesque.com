/**
 * filter-schema.test.js: reducing a published schema to a legible backdrop.
 *
 * The rule is pure input -> output, which is the whole reason it lives in its own
 * module rather than inside the component: whether the result still READS as a
 * backdrop is a judgment made by looking at it, but which types survive is not.
 *
 * Note: the fixtures here are built inline rather than taken from the committed
 *       mock. The cases are about counts, ties and dangling endpoints, and naming
 *       the exact numbers is what makes each one legible -- a fixture whose counts
 *       happen to produce the right answer tests nothing a reader can check.
 */

import filterSchema, {
    GRAPH_NODE_TYPES,
    CONNECTOR_MIN_LINKS,
    adjacency,
    components,
    rank,
    selectTypes,
} from '../../import/animation/filter-schema.js';

//
// a schema with `counts` as its node types, named n0..nN, and no edges.
//
function schemaOf(counts, edge_types = {}) {
    const node_types = {};
    counts.forEach((count, i) => {
        node_types[`n${i}`] = { count: count, category: 'entity' };
    });

    return { version: '1.3', node_types: node_types, edge_types: edge_types };
}

function edge(src, dst) {
    return { src_type: src, dst_type: dst, relation: 'rel', origin: 'raw', count: 1 };
}

describe('choosing which node types survive', () => {
    it('keeps the largest by count', () => {
        const schema = schemaOf([5, 100, 50, 1]);

        const kept = Object.keys(filterSchema(schema, 2).node_types);

        expect(kept.sort()).toEqual(['n1', 'n2']);
    });

    it('keeps a schema smaller than the limit unchanged', () => {
        const schema = schemaOf([5, 4, 3]);

        const filtered = filterSchema(schema, 24);

        expect(Object.keys(filtered.node_types)).toHaveLength(3);
    });

    it('keeps exactly the limit when the schema is larger', () => {
        const schema = schemaOf(new Array(60).fill(0).map((_, i) => i));

        expect(Object.keys(filterSchema(schema, 24).node_types)).toHaveLength(24);
    });

    it('carries each kept type\'s own metadata across', () => {
        //
        // the values are the component's content -- count drives the label and
        // category the colour -- so a filter that rebuilt them would be a second
        // place for the shape to drift.
        //
        const schema = schemaOf([9]);

        expect(filterSchema(schema, 1).node_types.n0).toBe(schema.node_types.n0);
    });

    it('defaults to the budget both surfaces draw', () => {
        //
        // one budget, because there is one graph -- the backdrop and the
        // explorer used to ask for 24 and 60 and now neither asks for anything.
        //
        const schema = schemaOf(new Array(80).fill(1));

        expect(Object.keys(filterSchema(schema).node_types))
            .toHaveLength(GRAPH_NODE_TYPES);
    });
});

describe('ties at the cutoff', () => {
    //
    // not decoration: five node types share a count of 1,998 in the live build and
    // three share 371. Without a tie-break the survivors would depend on object key
    // order, and the backdrop would quietly reshuffle between builds.
    //
    it('resolves deterministically across repeated calls', () => {
        const schema = schemaOf([7, 7, 7, 7]);

        const first = Object.keys(filterSchema(schema, 2).node_types);
        const second = Object.keys(filterSchema(schema, 2).node_types);

        expect(first).toEqual(second);
    });

    it('breaks a tie on the node type id', () => {
        const schema = { version: '1', edge_types: {}, node_types: {
            zebra: { count: 7 },
            apple: { count: 7 },
        } };

        expect(Object.keys(filterSchema(schema, 1).node_types)).toEqual(['apple']);
    });

    it('prefers a higher count over an earlier id', () => {
        //
        // the id is the SECOND key, not the first -- a sort that read them the other
        // way round would drop the biggest type in the graph for an alphabetical one.
        //
        const schema = { version: '1', edge_types: {}, node_types: {
            apple: { count: 1 },
            zebra: { count: 9_000 },
        } };

        expect(Object.keys(filterSchema(schema, 1).node_types)).toEqual(['zebra']);
    });

    it('treats a missing count as zero rather than sorting on undefined', () => {
        const schema = { version: '1', edge_types: {}, node_types: {
            counted: { count: 3 },
            bare: {},
        } };

        expect(Object.keys(filterSchema(schema, 1).node_types)).toEqual(['counted']);
    });
});

describe('edges whose endpoints did not survive', () => {
    //
    // load-bearing rather than defensive: d3.forceLink resolves source and target by
    // id and throws on one it cannot find, and the live build has 826 edges over the
    // 24 surviving nodes.
    //
    it('drops an edge into a filtered-out type', () => {
        const schema = schemaOf([100, 1], {
            'kept': edge('n0', 'n0'),
            'dangling': edge('n0', 'n1'),
        });

        const kept = filterSchema(schema, 1).edge_types;

        expect(Object.keys(kept)).toEqual(['kept']);
    });

    it('drops an edge out of a filtered-out type', () => {
        const schema = schemaOf([100, 1], { 'dangling': edge('n1', 'n0') });

        expect(filterSchema(schema, 1).edge_types).toEqual({});
    });

    it('keeps an edge whose endpoints both survive', () => {
        const schema = schemaOf([100, 90], { 'both': edge('n0', 'n1') });

        expect(Object.keys(filterSchema(schema, 2).edge_types)).toEqual(['both']);
    });

    it('keeps a self-loop on a surviving type', () => {
        //
        // src === dst is tolerated by d3 and reads as a recurring relation, so it is
        // not special-cased away.
        //
        const schema = schemaOf([100], { 'loop': edge('n0', 'n0') });

        expect(Object.keys(filterSchema(schema, 1).edge_types)).toEqual(['loop']);
    });

    it('leaves every edge in place when nothing was filtered', () => {
        const schema = schemaOf([3, 2], { 'a': edge('n0', 'n1'), 'b': edge('n1', 'n0') });

        expect(Object.keys(filterSchema(schema, 24).edge_types).sort()).toEqual(['a', 'b']);
    });

    it('does not parse the edge key', () => {
        //
        // the builder writes keys as '(src, rel, dst)', and reading them instead of
        // the values would couple this to a format the producer is free to change.
        //
        const schema = schemaOf([5, 4], { '(nonsense, at, all)': edge('n0', 'n1') });

        expect(Object.keys(filterSchema(schema, 24).edge_types))
            .toEqual(['(nonsense, at, all)']);
    });
});

describe('keeping the graph in one piece', () => {
    //
    // the rule this replaced was simply "the 24 biggest", and measured against a live
    // build it produced 24 node types in TWELVE components, nine of them single nodes
    // with no edge at all. The cluster exists to let communities emerge from the edge
    // topology, and floating dots have none -- so which types survive is now partly a
    // question of what holds the rest together, not only of size.
    //
    // Note: these fixtures put the connector LAST in count order on purpose. A rule
    //       that kept it by size rather than by structure would pass anyway, and the
    //       test would be proving nothing.
    //
    function connected() {
        //
        // big0..big3 are the four largest and touch nothing. 'bridge' is the smallest
        // type in the schema and is the only thing joining any of them.
        //
        return {
            version: '1',
            node_types: {
                big0: { count: 100 },
                big1: { count: 90 },
                big2: { count: 80 },
                big3: { count: 70 },
                bridge: { count: 1 },
            },
            edge_types: {
                a: edge('bridge', 'big0'),
                b: edge('bridge', 'big1'),
            },
        };
    }

    it('spends budget on a connector over a larger isolated type', () => {
        //
        // limit 3: the seed takes the top 2, and the third slot goes to the type that
        // joins them rather than to big2, which is 80x larger and touches nothing.
        //
        const kept = Object.keys(filterSchema(connected(), 3).node_types);

        expect(kept).toContain('bridge');
        expect(kept).not.toContain('big2');
    });

    it('leaves no node without an edge when a connector was available', () => {
        const filtered = filterSchema(connected(), 3);
        const ids = new Set(Object.keys(filtered.node_types));
        const linked = new Set();

        Object.values(filtered.edge_types).forEach((e) => {
            if (e.src_type === e.dst_type) return;
            linked.add(e.src_type);
            linked.add(e.dst_type);
        });

        [...ids].forEach(id => expect(linked.has(id)).toBe(true));
    });

    it('ignores a type that touches only one of the kept set', () => {
        //
        // a single link makes a leaf, not a bridge -- it adds a twig rather than
        // joining anything that was apart, and the budget buys nothing.
        //
        const schema = {
            version: '1',
            node_types: {
                big0: { count: 100 },
                big1: { count: 90 },
                big2: { count: 80 },
                leaf: { count: 1 },
            },
            edge_types: { a: edge('leaf', 'big0') },
        };

        expect(Object.keys(filterSchema(schema, 3).node_types)).not.toContain('leaf');
    });

    it('does not count a self-loop as a connection', () => {
        //
        // src === dst is real data and is kept in the output, but it joins a type to
        // nothing. Sixteen of the twenty-nine edges the old rule kept were self-loops,
        // which is most of why a set that looked edge-rich rendered as dust.
        //
        const schema = {
            version: '1',
            node_types: {
                big0: { count: 100 },
                big1: { count: 90 },
                big2: { count: 80 },
                loopy: { count: 1 },
            },
            edge_types: { a: edge('loopy', 'loopy'), b: edge('loopy', 'big0') },
        };

        expect(Object.keys(filterSchema(schema, 3).node_types)).not.toContain('loopy');
    });

    it('cascades, so a connector can qualify the next one', () => {
        //
        // 'far' touches big0 and 'near'; 'near' touches big0 and big1. 'near' has to be
        // taken first for 'far' to reach two kept types at all.
        //
        const schema = {
            version: '1',
            node_types: {
                big0: { count: 100 },
                big1: { count: 90 },
                near: { count: 5 },
                far: { count: 4 },
            },
            edge_types: {
                a: edge('near', 'big0'),
                b: edge('near', 'big1'),
                c: edge('far', 'big0'),
                d: edge('far', 'near'),
            },
        };

        const kept = Object.keys(filterSchema(schema, 4).node_types);

        expect(kept).toContain('near');
        expect(kept).toContain('far');
    });

    it('still keeps the graph\'s mass', () => {
        //
        // the failure mode on the other side: a rule that chased connectivity alone
        // dropped four of the five biggest types in the live build, and every market
        // type with them. The seed is what prevents that.
        //
        const kept = Object.keys(filterSchema(connected(), 3).node_types);

        expect(kept).toContain('big0');
        expect(kept).toContain('big1');
    });

    it('pads with the largest remaining when connectors run out', () => {
        //
        // budget left over means the graph had nothing else holding it together, and at
        // that point a type the reader recognises beats a small one that happens to
        // touch something.
        //
        const schema = schemaOf([100, 90, 80, 70]);

        expect(Object.keys(filterSchema(schema, 4).node_types)).toHaveLength(4);
    });

    it('is deterministic', () => {
        const first = Object.keys(filterSchema(connected(), 3).node_types);
        const second = Object.keys(filterSchema(connected(), 3).node_types);

        expect(first).toEqual(second);
    });
});

describe('adjacency', () => {
    it('links both directions of an edge', () => {
        const { node_types } = schemaOf([1, 1]);
        const adj = adjacency(node_types, { a: edge('n0', 'n1') });

        expect([...adj.get('n0')]).toEqual(['n1']);
        expect([...adj.get('n1')]).toEqual(['n0']);
    });

    it('omits a self-loop', () => {
        const { node_types } = schemaOf([1]);

        expect([...adjacency(node_types, { a: edge('n0', 'n0') }).get('n0')]).toEqual([]);
    });

    it('ignores an edge naming a type the schema does not have', () => {
        //
        // the filtered document is built from this, so an unknown endpoint would put a
        // key in the map that no node ever matches.
        //
        const { node_types } = schemaOf([1]);
        const adj = adjacency(node_types, { a: edge('n0', 'ghost') });

        expect(adj.has('ghost')).toBe(false);
        expect([...adj.get('n0')]).toEqual([]);
    });

    it('counts a repeated pair once', () => {
        const { node_types } = schemaOf([1, 1]);
        const adj = adjacency(node_types, { a: edge('n0', 'n1'), b: edge('n1', 'n0') });

        expect(adj.get('n0').size).toBe(1);
    });
});

describe('selectTypes', () => {
    it('never seeds fewer than one type', () => {
        //
        // round(1 * 2/3) is 1, but round(0.5) and below would be 0 -- a seed of nothing
        // means nothing is kept and the back-fill has no anchor to measure against.
        //
        const { node_types } = schemaOf([5, 4]);

        expect(selectTypes(node_types, {}, 1).size).toBe(1);
    });

    it('returns everything when the limit exceeds the schema', () => {
        const { node_types } = schemaOf([3, 2]);

        expect(selectTypes(node_types, {}, 99).size).toBe(2);
    });

    it('requires two links to qualify as a connector', () => {
        expect(CONNECTOR_MIN_LINKS).toBe(2);
    });
});

describe('bridging separate components', () => {
    //
    // The case the connector rule cannot see, and it was visible on the front page:
    // filings_XbrlFact and filings_XbrlDimension are both big enough to seed, they
    // link to each other, and their only route to the rest of the graph is
    // filings_SECFiling -- which touches ONE kept type and so never qualified as a
    // connector. Two nodes floated beside a twenty-two node body.
    //
    // Counting kept neighbours is not the same as joining the graph up. A node with
    // one neighbour in each of two islands has one of those and joins them; a node
    // with two neighbours inside a single island has two and joins nothing.
    //

    //
    // two clusters that do not touch, plus `span`, the smallest type in the schema,
    // with a single link into each.
    //
    function split() {
        return {
            version: '1',
            node_types: {
                a0: { count: 100 },
                a1: { count: 95 },
                b0: { count: 90 },
                b1: { count: 85 },
                span: { count: 1 },
            },
            edge_types: {
                inA: edge('a0', 'a1'),
                inB: edge('b0', 'b1'),
                toA: edge('span', 'a0'),
                toB: edge('span', 'b0'),
            },
        };
    }

    const partsOf = (filtered) => components(
        new Set(Object.keys(filtered.node_types)),
        adjacency(filtered.node_types, filtered.edge_types)
    );

    it('takes a bridge that has only one link into each side', () => {
        const kept = Object.keys(filterSchema(split(), 5).node_types);

        expect(kept).toContain('span');
    });

    it('joins the graph into one piece', () => {
        expect(partsOf(filterSchema(split(), 5))).toHaveLength(1);
    });

    it('leaves the graph split when nothing bridges it', () => {
        //
        // `lonely` touches only the a-side, so it reaches one component and cannot
        // join anything. The budget goes on size instead, and the split stands --
        // this rule buys connections, it does not manufacture them.
        //
        const schema = {
            version: '1',
            node_types: {
                a0: { count: 100 },
                a1: { count: 95 },
                b0: { count: 90 },
                b1: { count: 85 },
                lonely: { count: 1 },
            },
            edge_types: {
                inA: edge('a0', 'a1'),
                inB: edge('b0', 'b1'),
                toA: edge('lonely', 'a0'),
            },
        };

        expect(partsOf(filterSchema(schema, 5))).toHaveLength(2);
    });

    it('spends leftover budget on size when nothing is floating', () => {
        //
        // joining things up costs nothing when there is nothing to join: the budget
        // goes on the largest remaining type, exactly as it would have anyway.
        //
        const schema = {
            version: '1',
            node_types: {
                n0: { count: 100 },
                n1: { count: 90 },
                n2: { count: 80 },
                n3: { count: 70 },
                n4: { count: 60 },
            },
            edge_types: {
                a: edge('n0', 'n1'),
                b: edge('n1', 'n2'),
                c: edge('n2', 'n3'),
                d: edge('n3', 'n4'),
            },
        };

        expect(Object.keys(filterSchema(schema, 4).node_types).sort())
            .toEqual(['n0', 'n1', 'n2', 'n3']);
    });

    it('is deterministic', () => {
        const first = Object.keys(filterSchema(split(), 5).node_types);
        const second = Object.keys(filterSchema(split(), 5).node_types);

        expect(first).toEqual(second);
    });

    //
    // The real-world shape, and the one the earlier passes cannot reach.
    //
    // `join` is the smallest type here, so by the time it comes up the budget is
    // already spent on c1 and c2 -- it is never even considered. On the live build
    // this is filings_SECFiling: it was passed over, and the two XBRL types it would
    // have connected sat in the corner by themselves.
    //
    // The only way to buy it is to give something up, which is what the last pass
    // does.
    //
    function exhausted() {
        return {
            version: '1',
            node_types: {
                big0: { count: 100 },
                big1: { count: 90 },
                big2: { count: 80 },
                c1: { count: 70 },
                c2: { count: 60 },
                join: { count: 10 },
            },
            edge_types: {
                pair: edge('big0', 'big1'),
                c1a: edge('c1', 'big0'),
                c1b: edge('c1', 'big1'),
                c2a: edge('c2', 'big0'),
                c2b: edge('c2', 'big1'),
                toBody: edge('join', 'big0'),
                toStray: edge('join', 'big2'),
            },
        };
    }

    it('buys a joiner by giving something up once the budget is spent', () => {
        expect(Object.keys(filterSchema(exhausted(), 5).node_types)).toContain('join');
    });

    it('gives up the smallest it can rather than the largest', () => {
        const kept = Object.keys(filterSchema(exhausted(), 5).node_types);

        expect(kept).toContain('c1');
        expect(kept).not.toContain('c2');
    });

    it('never gives up one of the largest types to do it', () => {
        //
        // the graph's mass is the one thing the seed exists to protect, so it is not
        // available to trade away no matter how much it would help connectivity.
        //
        const kept = Object.keys(filterSchema(exhausted(), 5).node_types);

        ['big0', 'big1', 'big2'].forEach(id => expect(kept).toContain(id));
    });

    it('leaves nothing floating once it has', () => {
        expect(partsOf(filterSchema(exhausted(), 5))).toHaveLength(1);
    });

    it('still keeps exactly the limit after a swap', () => {
        //
        // a trade, not an addition -- one out for one in.
        //
        expect(Object.keys(filterSchema(exhausted(), 5).node_types)).toHaveLength(5);
    });

    it('can trade away a type that carries no count', () => {
        //
        // exhausted() with the two connectors' counts missing. A missing count ranks as
        // zero everywhere else in this module, and choosing what to give up has to agree.
        // Subtracting undefined gives NaN, which a sort reads as 'equal' to anything --
        // so a count missing beside a present one would make the comparison
        // inconsistent, and the order the sort settles on would be the engine's choice.
        //
        // the joiner is renamed so it still ranks last: at a count of zero it ties
        // with the connectors, and the tie is broken on the id.
        //
        const schema = exhausted();
        delete schema.node_types.c1.count;
        delete schema.node_types.c2.count;
        schema.node_types.zjoin = { count: 0 };
        delete schema.node_types.join;
        schema.edge_types.toBody = edge('zjoin', 'big0');
        schema.edge_types.toStray = edge('zjoin', 'big2');

        const filtered = filterSchema(schema, 5);

        expect(Object.keys(filtered.node_types)).toContain('zjoin');
        expect(Object.keys(filtered.node_types)).toHaveLength(5);
        expect(partsOf(filtered)).toHaveLength(1);
    });

    it('keeps what it has when no trade would join anything up', () => {
        //
        // `m` holds s0 and s1 together, and `j` would join s2 on -- but only by taking
        // m's place, which splits s0 off instead. The graph is in two pieces either way,
        // so the trade buys nothing and is not made.
        //
        const schema = {
            version: '1',
            node_types: {
                s0: { count: 100 },
                s1: { count: 90 },
                s2: { count: 80 },
                m: { count: 20 },
                j: { count: 10 },
            },
            edge_types: {
                m0: edge('m', 's0'),
                m1: edge('m', 's1'),
                j1: edge('j', 's1'),
                j2: edge('j', 's2'),
            },
        };

        const filtered = filterSchema(schema, 4);

        expect(Object.keys(filtered.node_types).sort()).toEqual(['m', 's0', 's1', 's2']);
        expect(partsOf(filtered)).toHaveLength(2);
    });
});

describe('components', () => {
    const adjOf = (schema) => adjacency(schema.node_types, schema.edge_types);

    it('finds one component for a connected pair', () => {
        const schema = schemaOf([2, 1], { a: edge('n0', 'n1') });

        expect(components(new Set(['n0', 'n1']), adjOf(schema))).toHaveLength(1);
    });

    it('finds one per isolated node', () => {
        const schema = schemaOf([2, 1]);

        expect(components(new Set(['n0', 'n1']), adjOf(schema))).toHaveLength(2);
    });

    it('does not join a node to itself through a self-loop', () => {
        //
        // adjacency drops self-loops, so a type whose only edge points at itself is
        // still its own component.
        //
        const schema = schemaOf([2, 1], { a: edge('n0', 'n0') });

        expect(components(new Set(['n0', 'n1']), adjOf(schema))).toHaveLength(2);
    });

    it('orders the components largest first', () => {
        const schema = schemaOf([4, 3, 2, 1], { a: edge('n0', 'n1'), b: edge('n1', 'n2') });

        const found = components(new Set(['n0', 'n1', 'n2', 'n3']), adjOf(schema));

        expect(found[0]).toHaveLength(3);
        expect(found[1]).toHaveLength(1);
    });

    it('ignores neighbours outside the kept set', () => {
        //
        // the walk is over the FILTERED graph -- a neighbour that did not survive is
        // not a route between two types that did.
        //
        const schema = schemaOf([3, 2, 1], { a: edge('n0', 'n2'), b: edge('n2', 'n1') });

        expect(components(new Set(['n0', 'n1']), adjOf(schema))).toHaveLength(2);
    });

    it('answers nothing for an empty set', () => {
        expect(components(new Set(), adjOf(schemaOf([1])))).toEqual([]);
    });
});

describe('what comes back', () => {
    it('carries the rest of the document through', () => {
        //
        // build_metadata and summary cost nothing to keep and the explorer page will
        // want them.
        //
        const schema = { ...schemaOf([1]), summary: { total_node_types: 152 } };

        expect(filterSchema(schema, 1).summary).toEqual({ total_node_types: 152 });
    });

    it('reports the true total in summary, not the filtered one', () => {
        //
        // the summary describes the BUILD, not this slice of it -- a reader asking how
        // big the graph is should not be told how much of it fits on the front page.
        //
        const schema = { ...schemaOf([3, 2, 1]), summary: { total_node_types: 3 } };

        const filtered = filterSchema(schema, 1);

        expect(filtered.summary.total_node_types).toBe(3);
        expect(Object.keys(filtered.node_types)).toHaveLength(1);
    });

    it('does not mutate the schema it was given', () => {
        const schema = schemaOf([3, 2, 1], { 'a': edge('n0', 'n2') });

        filterSchema(schema, 1);

        expect(Object.keys(schema.node_types)).toHaveLength(3);
        expect(Object.keys(schema.edge_types)).toHaveLength(1);
    });
});

describe('what is not a usable schema', () => {
    //
    // one answer for every way the fetch can fail to produce a graph, so the caller
    // has a single check rather than several.
    //
    it('answers null for null', () => {
        expect(filterSchema(null)).toBeNull();
    });

    it('answers null for undefined', () => {
        expect(filterSchema(undefined)).toBeNull();
    });

    it('answers null for a non-object', () => {
        expect(filterSchema('a schema')).toBeNull();
    });

    it('answers null when node_types is missing', () => {
        expect(filterSchema({ edge_types: {} })).toBeNull();
    });

    it('answers null when edge_types is missing', () => {
        expect(filterSchema({ node_types: {} })).toBeNull();
    });

    it('answers null when node_types is not an object', () => {
        expect(filterSchema({ node_types: [], edge_types: {} })).not.toBeNull();
        expect(filterSchema({ node_types: 'x', edge_types: {} })).toBeNull();
    });

    it('answers an empty graph for an empty one rather than null', () => {
        //
        // a build with nothing in it is a valid answer from the service, and it is not
        // the same as a failed fetch -- though both end up drawing no cluster.
        //
        expect(filterSchema({ node_types: {}, edge_types: {} }))
            .toEqual({ node_types: {}, edge_types: {} });
    });
});

describe('rank', () => {
    //
    // exported so the ordering can be read directly, rather than inferred from which
    // types happened to survive a cut.
    //
    it('orders by count, descending', () => {
        const { node_types } = schemaOf([1, 9, 5]);

        expect(rank(node_types, 3)).toEqual(['n1', 'n2', 'n0']);
    });

    it('takes only as many as asked for', () => {
        const { node_types } = schemaOf([1, 9, 5]);

        expect(rank(node_types, 1)).toEqual(['n1']);
    });

    it('returns everything when the limit exceeds the schema', () => {
        const { node_types } = schemaOf([1, 2]);

        expect(rank(node_types, 99)).toHaveLength(2);
    });
});
