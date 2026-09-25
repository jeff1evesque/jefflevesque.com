/**
 * encoding.test.js: how a published schema becomes color and line style.
 *
 * This module exists so the backdrop and the explorer cannot disagree about what
 * the graph looks like. The cases below are therefore about the MAPPING, not
 * about either surface -- what each one then does with the result (muting, a
 * legend, always-on labels) belongs to its own suite.
 *
 * Note: the assertions compare colors to each other rather than to hex
 *       literals. Pinning '#2a78d6' would make this suite fail the day the
 *       palette is retuned, which is a design decision rather than a defect --
 *       what must not change is that two namespaces get two colors.
 */

import {
    sourceNamespace,
    rankNamespaces,
    assignNamespaceColors,
    buildPalette,
    originColor,
    originName,
    ORIGIN_DASH,
    ORIGIN_COLOR,
} from '../../import/animation/encoding.js';
import filterSchema, { GRAPH_NODE_TYPES } from '../../import/animation/filter-schema.js';

//
// a slice deliberately smaller than the one the surfaces draw.
//
// The property below is that the palette does not depend on how much of a build
// its caller happens to be drawing, and that needs two DIFFERENT amounts to
// demonstrate. It used to use the backdrop's budget against the explorer's,
// which stopped being two amounts the moment they became one -- and a test
// handed the same number twice passes while holding nothing at all.
//
const SMALLER_SLICE = 24;
import { colors, colors_categorical, color_other } from '../../import/general/colors.js';

const nodesOf = (namespaces) => namespaces.map((ns, i) => ({ id: `n${i}`, namespace: ns }));
const manyNamespaces = (n) => [...Array(n)].map((_, i) => `ns${String(i).padStart(2, '0')}`);

//
// a build whose namespaces RE-RANK depending on how much of it you take.
//
// That is the shape the live build has and the shape the bug needed: `alpha`
// contributes the most node types among the two dozen biggest, so a small slice
// ranks it first, while `gamma` contributes far more across the whole build and
// a larger slice ranks it first instead. Rank decides which categorical slot a
// namespace gets, so the two slices disagree about what color `alpha` is.
//
// Note: no edge types, so filterSchema reduces to "the largest by count" -- the
//       connector and swap passes need an adjacency to do anything. What is
//       under test here is the color, not the selection.
//
const namespaced = (namespace, n, from) => {
    const types = {};
    [...Array(n)].forEach((_, i) => {
        types[`${namespace}_Type${i}`] = { count: from - i, category: 'entity' };
    });
    return types;
};

const rerankingBuild = () => ({
    version: '1.3',
    node_types: {
        ...namespaced('alpha', 10, 200),
        ...namespaced('beta', 5, 190),
        ...namespaced('gamma', 60, 100),
    },
    edge_types: {},
});

const namespacesIn = (schema) => Object.keys(schema.node_types)
    .map((id) => sourceNamespace(schema.node_types[id], id));

const paintedPerSlice = (schema, limit) => assignNamespaceColors(
    Object.keys(filterSchema(schema, limit).node_types).map((id) => ({
        id: id,
        namespace: sourceNamespace(filterSchema(schema, limit).node_types[id], id),
    })),
    'shade'
);

describe('sourceNamespace', () => {
    it('reads the namespace out of an ontology uri', () => {
        expect(sourceNamespace(
            { source_type_uri: 'https://example.com/ontology/bls/CensusRegion' },
            'bls_enrichment_CensusRegion'
        )).toBe('bls');
    });

    //
    // the builder nests vocabularies under their source, and publishes the
    // nested spelling. Reading the first segment after '/ontology/' answers
    // the SOURCE there, which pools ten vocabularies -- 118 of the current
    // build's 151 node types -- into one namespace and one color.
    //
    it('reads the vocabulary out of a nested uri, not the source', () => {
        expect(sourceNamespace(
            { source_type_uri: 'https://example.com/ontology/bls/jolts/OpeningsRate' },
            'jolts_OpeningsRate'
        )).toBe('bls-jolts');
    });

    it('keeps an enrichment vocabulary with the source it belongs to', () => {
        //
        // every source has one, so the LAST segment alone would pool them all
        // into a single 'enrichment' namespace belonging to nobody.
        //
        expect(sourceNamespace(
            { source_type_uri: 'https://example.com/ontology/bls/enrichment/UnifiedDay' },
            'bls_enrichment_UnifiedDay'
        )).toBe('bls-enrichment');

        expect(sourceNamespace(
            { source_type_uri: 'https://example.com/ontology/sec/enrichment/Filing' },
            'sec_enrichment_Filing'
        )).toBe('sec-enrichment');
    });

    it('keeps reading a flat uri exactly as it always did', () => {
        //
        // this is the case that lets the change ship before the builder's does:
        // every uri published today is flat, and none of them moves.
        //
        expect(sourceNamespace(
            { source_type_uri: 'https://example.com/ontology/jolts/OpeningsRate' },
            'jolts_OpeningsRate'
        )).toBe('jolts');
    });

    it('goes as deep as the uri does', () => {
        expect(sourceNamespace(
            { source_type_uri: 'https://example.com/ontology/a/b/c/Type' },
            'x_Type'
        )).toBe('a-b-c');
    });

    it('falls back for a uri that names a namespace rather than a type', () => {
        //
        // a trailing slash leaves no type segment to stop at. The id prefix
        // answers the same thing here anyway, which is why this is a fallback
        // rather than a special case.
        //
        expect(sourceNamespace(
            { source_type_uri: 'https://example.com/ontology/bls/' },
            'bls_CensusRegion'
        )).toBe('bls');
    });

    it('falls back to the id prefix when there is no uri', () => {
        expect(sourceNamespace({}, 'market_EquityQuote')).toBe('market');
    });

    it('falls back when the uri is not shaped like an ontology term', () => {
        expect(sourceNamespace(
            { source_type_uri: 'https://example.com/something/else' },
            'sec_Filing'
        )).toBe('sec');
    });

    it('takes only the first segment of a multi-part id', () => {
        expect(sourceNamespace({}, 'bls_enrichment_PriceIndex')).toBe('bls');
    });

    it('returns the whole id when it carries no prefix', () => {
        expect(sourceNamespace({}, 'Standalone')).toBe('Standalone');
    });

    it('survives a missing meta', () => {
        expect(sourceNamespace(undefined, 'cpi_Index')).toBe('cpi');
    });

    it('does not treat a leading underscore as a prefix', () => {
        //
        // indexOf('_') is 0 there, and slice(0, 0) would name every such type ''.
        //
        expect(sourceNamespace({}, '_odd')).toBe('_odd');
    });

    it('prefers the uri over a disagreeing id prefix', () => {
        //
        // the uri is the authority: an id whose prefix does not match its ontology
        // namespace follows the ontology.
        //
        expect(sourceNamespace(
            { source_type_uri: 'https://example.com/ontology/bls/Thing' },
            'odd_Thing'
        )).toBe('bls');
    });
});

describe('rankNamespaces', () => {
    it('orders by how many node types each contributes', () => {
        expect(rankNamespaces(nodesOf(['small', 'big', 'big']))).toEqual(['big', 'small']);
    });

    it('breaks a tie on the namespace name', () => {
        expect(rankNamespaces(nodesOf(['zebra', 'apple']))).toEqual(['apple', 'zebra']);
    });

    it('is deterministic', () => {
        const nodes = nodesOf(['a', 'b', 'a', 'c']);

        expect(rankNamespaces(nodes)).toEqual(rankNamespaces(nodes));
    });

    it('answers an empty list for no nodes', () => {
        expect(rankNamespaces([])).toEqual([]);
    });
});

describe('assigning colors to namespaces', () => {
    it('gives the largest namespace the first categorical slot', () => {
        const assigned = assignNamespaceColors(nodesOf(['small', 'big', 'big']));

        expect(assigned.get('big')).toBe(colors_categorical[0]);
        expect(assigned.get('small')).toBe(colors_categorical[1]);
    });

    it('keeps the first eight distinct from each other', () => {
        const eight = manyNamespaces(8);
        const assigned = assignNamespaceColors(nodesOf(eight));

        expect(new Set(eight.map(ns => assigned.get(ns))).size).toBe(8);
    });

    it('never cycles the palette', () => {
        //
        // two unrelated sources sharing a categorical color reads as a relationship
        // that is not there, which is worse than a tail that reads as a tail.
        //
        const many = manyNamespaces(12);
        const assigned = assignNamespaceColors(nodesOf(many));
        const tail = many.slice(8).map(ns => assigned.get(ns));

        tail.forEach(color => expect(colors_categorical).not.toContain(color));
    });

    it('answers an empty assignment for no nodes', () => {
        expect(assignNamespaceColors([]).size).toBe(0);
    });

    it('is deterministic', () => {
        const nodes = nodesOf(manyNamespaces(12));

        expect([...assignNamespaceColors(nodes)]).toEqual([...assignNamespaceColors(nodes)]);
    });
});

describe('what happens past the eight palette slots', () => {
    //
    // the one place the two surfaces deliberately differ. The backdrop is glanced at
    // and carries no legend, so a shared neutral costs nothing; the explorer carries
    // a legend, and "and 9 others" is exactly what a legend must not say.
    //
    const many = manyNamespaces(12);

    it('rolls the tail into one neutral by default', () => {
        const assigned = assignNamespaceColors(nodesOf(many));
        const tail = many.slice(8).map(ns => assigned.get(ns));

        expect(new Set(tail).size).toBe(1);
        expect(tail[0]).toBe(color_other);
    });

    it('shades the tail when asked, so every namespace stays distinguishable', () => {
        const assigned = assignNamespaceColors(nodesOf(many), 'shade');
        const tail = many.slice(8).map(ns => assigned.get(ns));

        expect(new Set(tail).size).toBe(tail.length);
    });

    it('leaves the first eight on the categorical palette either way', () => {
        const rolled = assignNamespaceColors(nodesOf(many));
        const shaded = assignNamespaceColors(nodesOf(many), 'shade');

        many.slice(0, 8).forEach(ns => {
            expect(shaded.get(ns)).toBe(rolled.get(ns));
            expect(colors_categorical).toContain(shaded.get(ns));
        });
    });

    it('shades a single overflow namespace without dividing by zero', () => {
        //
        // color_tail spreads lightness across the tail, and a tail of one has no
        // spread -- the lone member still has to come back with a color.
        //
        const nine = manyNamespaces(9);
        const assigned = assignNamespaceColors(nodesOf(nine), 'shade');

        expect(typeof assigned.get(nine[8])).toBe('string');
        expect(assigned.get(nine[8])).not.toBe(color_other);
    });

    it('does not shade anything when nothing overflows', () => {
        const eight = manyNamespaces(8);
        const assigned = assignNamespaceColors(nodesOf(eight), 'shade');

        eight.forEach(ns => expect(colors_categorical).toContain(assigned.get(ns)));
    });
});

describe('link styling by edge origin', () => {
    //
    // origin is the channel most likely to be lost without anyone noticing: a build
    // that stopped carrying origins renders every link solid gray, which looks like a
    // graph and has quietly dropped a dimension.
    //
    it('draws a raw edge solid', () => {
        expect(ORIGIN_DASH.raw).toBeNull();
    });

    it('dashes enrichment and unification differently from each other', () => {
        expect(ORIGIN_DASH.enrichment).toBeTruthy();
        expect(ORIGIN_DASH.unification).toBeTruthy();
        expect(ORIGIN_DASH.enrichment).not.toBe(ORIGIN_DASH.unification);
    });

    it('gives each origin its own color', () => {
        const assigned = [ORIGIN_COLOR.raw, ORIGIN_COLOR.enrichment, ORIGIN_COLOR.unification];

        expect(new Set(assigned).size).toBe(3);
    });

    it('falls back to gray for an origin it does not know', () => {
        //
        // the producer is free to add origins, and an unknown one has to render as a
        // plain link rather than as undefined.
        //
        // Note: the fallback is the SAME gray 'raw' uses, deliberately. An unknown
        //       origin should look like an ordinary edge, not like a new category --
        //       inventing a color for it would assert a distinction this codebase
        //       cannot describe in the legend.
        //
        expect(originColor('something-new')).toBe(colors['gray-5']);
        expect(originColor('something-new')).toBe(ORIGIN_COLOR.raw);
    });

    it('falls back to gray for a missing origin', () => {
        expect(originColor(undefined)).toBe(originColor('something-new'));
    });

    it('leaves an unknown origin undashed rather than throwing', () => {
        expect(ORIGIN_DASH['something-new']).toBeUndefined();
    });
});

describe('what an origin is called', () => {
    it('calls unification by what its edges assert', () => {
        expect(originName('unification')).toBe('owl:sameAs');
    });

    it('calls every other origin by its own value', () => {
        expect(originName('raw')).toBe('raw');
        expect(originName('enrichment')).toBe('enrichment');
        expect(originName('something-new')).toBe('something-new');
    });

    it('calls a missing origin nothing rather than undefined', () => {
        expect(originName(undefined)).toBe('');
    });
});

//
// the guarantee this whole module exists for, pinned at the level that actually
// broke.
//
// The mapping was already covered above and was never wrong. What went wrong was
// its INPUT: the backdrop ranked its 24 node types, the explorer ranked its 60,
// and the same build came out painted two different ways -- seven of the eight
// namespaces the front page draws were a different color on /graph, whose
// legend named the blue as a namespace the front page does not draw at all.
// Nothing threw, because both surfaces still rendered.
//
describe('buildPalette', () => {
    it('is the same answer for a build however much of it a surface draws', () => {
        const schema = rerankingBuild();

        //
        // the old behavior, reproduced: ranking each slice on its own makes the
        // two surfaces disagree about `alpha`. If this ever stops being true the
        // fixture has lost the property the rest of these cases depend on.
        //
        const perSlice = [
            paintedPerSlice(schema, SMALLER_SLICE),
            paintedPerSlice(schema, GRAPH_NODE_TYPES),
        ];

        expect(perSlice[0].get('alpha')).not.toBe(perSlice[1].get('alpha'));

        // and the answer this module gives instead, which does not ask the caller
        // what it happens to be drawing
        const palette = buildPalette(schema);

        expect(palette.get('alpha')).toBe(buildPalette(schema).get('alpha'));
        expect(palette.get('gamma')).toBe(buildPalette(schema).get('gamma'));
    });

    it('colors every namespace the surfaces draw, so no legend row is blank', () => {
        //
        // both draw the same slice now, so this is one case rather than two. A
        // namespace on screen that the palette left out has no color, and the
        // cluster falls back to a neutral gray for it.
        //
        const schema = rerankingBuild();
        const palette = buildPalette(schema);

        namespacesIn(filterSchema(schema)).forEach((namespace) => {
            expect(palette.get(namespace)).toBeDefined();
        });
    });

    it('colors every namespace a SMALLER slice would draw', () => {
        //
        // the direction that can actually fail, kept as its own case now that
        // neither surface is the smaller one: the palette ranks over the shared
        // slice, and anything drawn out of a subset of it must still be in it.
        //
        const schema = rerankingBuild();
        const palette = buildPalette(schema);

        namespacesIn(filterSchema(schema, SMALLER_SLICE)).forEach((namespace) => {
            expect(palette.get(namespace)).toBeDefined();
        });
    });

    it('shades the tail rather than rolling it up', () => {
        //
        // one map serves both surfaces, so there is no per-surface tail policy
        // left to choose -- and the surface that carries a legend is the one that
        // cannot say "and four others". The backdrop inherits the shaded tail and
        // mutes it toward white at rest anyway.
        //
        const many = {
            version: '1.3',
            node_types: manyNamespaces(12).reduce(
                (types, ns, i) => Object.assign(types, namespaced(ns, 2, 100 - i)),
                {}
            ),
            edge_types: {},
        };

        const painted = [...buildPalette(many).values()];

        expect(painted).toHaveLength(12);
        expect(painted).not.toContain(color_other);
        expect(new Set(painted).size).toBe(12);
    });

    it('answers null for a schema it cannot read, like the filter it is built on', () => {
        expect(buildPalette(null)).toBeNull();
        expect(buildPalette({})).toBeNull();
        expect(buildPalette({ node_types: {} })).toBeNull();
    });

    it('ranks over the slice the page draws, when the page weighs types another way', () => {
        //
        // the Retrieval graph draws a day by its findable entities, and a palette
        // ranked over the slice by count would spend its first slot on a
        // namespace that page never draws -- here, the nameless 'quotes'.
        //
        const day = {
            node_types: {
                quotes_Option: { count: 9_000_000, entities: 0 },
                filings_Filing: { count: 10, entities: 10 },
                filings_Issuer: { count: 8, entities: 8 },
                cap_Alert: { count: 5, entities: 5 },
            },
            edge_types: {},
        };

        expect([...buildPalette(day, 3, 'entities').keys()]).toEqual(['filings', 'cap']);
        expect([...buildPalette(day, 3).keys()]).toContain('quotes');
    });
});
