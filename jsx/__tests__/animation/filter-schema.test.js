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

import filterSchema, { BACKDROP_NODE_TYPES, rank } from '../../import/animation/filter-schema.js';

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

    it('defaults to the backdrop limit', () => {
        const schema = schemaOf(new Array(40).fill(1));

        expect(Object.keys(filterSchema(schema).node_types))
            .toHaveLength(BACKDROP_NODE_TYPES);
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
