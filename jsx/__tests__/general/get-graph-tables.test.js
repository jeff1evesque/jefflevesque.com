/**
 * get-graph-tables.test.js: a day of the published tables, for the Retrieval graph.
 *
 * Two things are held. A day is two requests asked side by side and put into the
 * shape of a build's schema, and a failure of either half is a failure of the day.
 * And the rows are held to the shape they were asked for: a day whose node types do
 * not say what can be looked up in them would draw a canvas of connectors with
 * nothing to connect.
 *
 * Note: every failure resolves to null rather than rejecting, as get-graph-schema's
 *       do, and is logged through console.log -- setup.js fails a test on an
 *       unexpected console.error.
 */

import {
    daySchema,
    dayRequests,
    daysRequest,
    getTableDay,
    getTableDays,
    LIMIT,
    TABLES,
} from '../../import/general/get-graph-tables.js';

const DAY = '2026-09-23';

const NODE_ROWS = [
    { node_type: 'market_quotes_OptionSnapshot', count: 9603436, entities: 0, facts: 0 },
    { node_type: 'filings_SECFiling', count: 2441, entities: 2441, facts: 24800 },
    { node_type: 'filings_Issuer', count: 1600, entities: 1600, facts: 5176 },
];

const EDGE_ROWS = [
    {
        src_type: 'filings_SECFiling',
        relation: 'filings_hasIssuer',
        dst_type: 'filings_Issuer',
        count: 2441,
        predicate_uri: 'https://jefflevesque.com/ontology/sec/filings/hasIssuer',
        origin: 'raw',
        relation_group: 'filings_hasIssuer',
    },
];

function ok(rows) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ report: { rows: rows } }) });
}

function notOk(status) {
    return Promise.resolve({ ok: false, status: status, json: () => Promise.resolve({}) });
}

//
// answers by path, so the two halves of a day can be answered, or failed, apart
// -- they are asked at once, and nothing promises which arrives first
//
function answering(byPath) {
    const fetcher = jest.fn((url) => {
        const path = new URL(String(url)).pathname.split('/').pop();

        return byPath[path] ? byPath[path]() : notOk(404);
    });

    global.fetch = fetcher;

    return fetcher;
}

const realFetch = global.fetch;
let quiet;

beforeEach(() => {
    quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    global.fetch = realFetch;
    quiet.mockRestore();
});

describe('the requests', () => {
    it('lists the days with nothing on the query string', () => {
        //
        // the api refuses any value on the days, a Limit included.
        //
        const url = daysRequest();

        expect(String(url)).toBe(`${TABLES}/days`);
        expect([...url.searchParams.keys()]).toEqual([]);
    });

    it('asks a day for its node types and its edge types, all of each', () => {
        //
        // about 155 node types and 838 edge types a day, both under the api's
        // ceiling -- so one request each is the whole day.
        //
        const { nodeTypes, edgeTypes } = dayRequests(DAY);

        expect(nodeTypes.pathname.endsWith('/tables/node-types')).toBe(true);
        expect(edgeTypes.pathname.endsWith('/tables/edge-types')).toBe(true);

        [nodeTypes, edgeTypes].forEach((url) => {
            expect(url.searchParams.get('Day')).toBe(DAY);
            expect(url.searchParams.get('Limit')).toBe(String(LIMIT));
        });
        expect(LIMIT).toBe(1000);
    });
});

describe('the published days', () => {
    //
    // two days as the api answers them: each names the run that published it and
    // when that finished.
    //
    const PUBLISHED = [
        { day: '2026-09-23', run: '2026-09-24T05:00:42Z', published: '2026-09-24T06:41:18Z' },
        { day: '2026-09-22', run: '2026-09-23T05:00:25Z', published: '2026-09-23T06:43:55Z' },
    ];

    it('answers them newest first, as the api lists them', async () => {
        answering({ days: () => ok(PUBLISHED) });

        const days = await getTableDays();

        expect(days.map((row) => row.day)).toEqual(['2026-09-23', '2026-09-22']);
    });

    it('keeps the run that published each day, and when that finished', async () => {
        answering({ days: () => ok(PUBLISHED) });

        await expect(getTableDays()).resolves.toEqual(PUBLISHED);
    });

    it.each([
        ['missing', {}],
        ['null', { run: null, published: null }],
        ['not a string', { run: 20260924050042, published: { at: '06:41' } }],
    ])('reads a run and a published that are %s as null', async (_, fields) => {
        //
        // every day's row carried neither before the api said where a day came
        // from. The page reads null as a build's missing run, 'n/a'.
        //
        answering({ days: () => ok([{ day: '2026-09-23', ...fields }]) });

        await expect(getTableDays()).resolves.toEqual([{ day: '2026-09-23', run: null, published: null }]);
    });

    it('answers an empty list as an empty list', async () => {
        answering({ days: () => ok([]) });

        await expect(getTableDays()).resolves.toEqual([]);
    });

    it('drops a row that is not a day rather than failing the list', async () => {
        //
        // the list is what the picker offers, and one row nobody could name is no
        // reason to offer none of the rest -- whatever run it names.
        //
        answering({
            days: () => ok([
                PUBLISHED[0],
                { day: 'today', run: '2026-09-24T05:00:42Z', published: '2026-09-24T06:41:18Z' },
                null,
                { nope: 1 },
            ]),
        });

        await expect(getTableDays()).resolves.toEqual([PUBLISHED[0]]);
    });

    it('resolves null when the days cannot be had', async () => {
        answering({ days: () => notOk(500) });

        await expect(getTableDays()).resolves.toBeNull();
        expect(quiet).toHaveBeenCalled();
    });

    it('resolves null for an answer with no rows in it', async () => {
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ report: { error: 'nope' } }),
        }));

        await expect(getTableDays()).resolves.toBeNull();
    });
});

describe('one day', () => {
    it('asks for both halves at once', async () => {
        const fetcher = answering({ 'node-types': () => ok(NODE_ROWS), 'edge-types': () => ok(EDGE_ROWS) });

        await getTableDay(DAY);

        expect(fetcher.mock.calls.map(([url]) => new URL(String(url)).pathname.split('/').pop()).sort())
            .toEqual(['edge-types', 'node-types']);
    });

    it('answers the day in the shape of a build\'s schema', async () => {
        answering({ 'node-types': () => ok(NODE_ROWS), 'edge-types': () => ok(EDGE_ROWS) });

        const day = await getTableDay(DAY);

        expect(Object.keys(day.node_types)).toEqual([
            'market_quotes_OptionSnapshot', 'filings_SECFiling', 'filings_Issuer',
        ]);
        expect(day.node_types.filings_SECFiling).toEqual({
            count: 2441,
            entities: 2441,
            facts: 24800,
            vocabulary: 'sec/filings',
        });
        expect(day.edge_types['(filings_SECFiling, filings_hasIssuer, filings_Issuer)']).toMatchObject({
            src_type: 'filings_SECFiling',
            relation: 'filings_hasIssuer',
            dst_type: 'filings_Issuer',
            count: 2441,
            origin: 'raw',
        });
    });

    it.each([
        ['node types', { 'node-types': () => notOk(500), 'edge-types': () => ok(EDGE_ROWS) }],
        ['edge types', { 'node-types': () => ok(NODE_ROWS), 'edge-types': () => notOk(500) }],
    ])('fails the whole day when its %s cannot be had', async (half, answers) => {
        //
        // node types without the edges between them, or edges without the types
        // they join, is a picture of something the tables do not hold.
        //
        answering(answers);

        await expect(getTableDay(DAY)).resolves.toBeNull();
    });

    it('fails the day when its node types do not say what can be looked up in them', async () => {
        //
        // an answer from before the api counted entities and facts. Drawn anyway,
        // every type would weigh nothing and the canvas would be connectors with
        // nothing to connect.
        //
        answering({
            'node-types': () => ok([{ node_type: 'filings_SECFiling', count: 2441 }]),
            'edge-types': () => ok(EDGE_ROWS),
        });

        await expect(getTableDay(DAY)).resolves.toBeNull();
    });

    it('asks for nothing without a day', async () => {
        const fetcher = answering({});

        await expect(getTableDay(null)).resolves.toBeNull();
        expect(fetcher).not.toHaveBeenCalled();
    });
});

describe('daySchema', () => {
    it('keys each edge type by its two ends and its relation, as a schema does', () => {
        const day = daySchema(NODE_ROWS, EDGE_ROWS);

        expect(Object.keys(day.edge_types)).toEqual(['(filings_SECFiling, filings_hasIssuer, filings_Issuer)']);
    });

    it('carries an edge\'s predicate and group through, where the row has them', () => {
        const [edge] = Object.values(daySchema(NODE_ROWS, EDGE_ROWS).edge_types);

        expect(edge.predicate_uri).toBe('https://jefflevesque.com/ontology/sec/filings/hasIssuer');
        expect(edge.relation_group).toBe('filings_hasIssuer');
    });

    it.each([
        ['a node row without a count', [{ node_type: 'x', entities: 1, facts: 1 }], EDGE_ROWS],
        ['a node row without its facts', [{ node_type: 'x', count: 1, entities: 1 }], EDGE_ROWS],
        ['an edge row without an end', NODE_ROWS, [{ src_type: 'a', relation: 'r', count: 1 }]],
        ['rows that are not a list', null, EDGE_ROWS],
    ])('answers null for %s', (label, nodes, edges) => {
        expect(daySchema(nodes, edges)).toBeNull();
    });

    it('answers an empty day as an empty schema, which is a day with nothing in it', () => {
        expect(daySchema([], [])).toEqual({ node_types: {}, edge_types: {} });
    });
});

//
// a day's node types carry no uri, and their names can leave the source out:
// 'jolts_Industry' is a type of 'bls/jolts'. The day's predicates say so, and what
// they say is what a build's uri says of the same type.
//
describe('the vocabulary a day names each node type under', () => {
    const node = (node_type) => ({ node_type: node_type, count: 1, entities: 1, facts: 1 });
    const edge = (relation, predicate_uri) => ({
        src_type: 'jolts_JobOpeningsLevel',
        relation: relation,
        dst_type: 'jolts_Industry',
        count: 1,
        predicate_uri: predicate_uri,
    });

    const named = (nodes, edges) => {
        const day = daySchema(nodes.map(node), edges);

        return Object.fromEntries(Object.keys(day.node_types).map((id) => [id, day.node_types[id].vocabulary]));
    };

    it('is the vocabulary of the predicates named under its prefix', () => {
        expect(named(
            ['jolts_Industry', 'jolts_JobOpeningsLevel', 'bls_enrichment_PriceIndex'],
            [
                edge('jolts_hasIndustry', 'https://jefflevesque.com/ontology/bls/jolts/hasIndustry'),
                edge('bls_enrichment_observedInPeriod', 'https://jefflevesque.com/ontology/bls/enrichment/observedInPeriod'),
            ]
        )).toEqual({
            jolts_Industry: 'bls/jolts',
            jolts_JobOpeningsLevel: 'bls/jolts',
            bls_enrichment_PriceIndex: 'bls/enrichment',
        });
    });

    it('is nothing for a prefix no predicate is named under', () => {
        //
        // market_quotes, sec_common, temporal and weather, on every day published
        // so far. Their names stand in -- see vocabulary in encoding.js.
        //
        expect(named(
            ['market_quotes_EquitySnapshot'],
            [edge('jolts_hasIndustry', 'https://jefflevesque.com/ontology/bls/jolts/hasIndustry')]
        )).toEqual({ market_quotes_EquitySnapshot: undefined });
    });

    it('is nothing for a prefix named under two vocabularies', () => {
        //
        // picking one would be a guess dressed as the tables' answer
        //
        expect(named(
            ['jolts_Industry'],
            [
                edge('jolts_hasIndustry', 'https://jefflevesque.com/ontology/bls/jolts/hasIndustry'),
                edge('jolts_hasRegion', 'https://jefflevesque.com/ontology/jolts/hasRegion'),
            ]
        )).toEqual({ jolts_Industry: undefined });
    });

    it('passes over a predicate that says nothing of a prefix', () => {
        //
        // owl:sameAs is the W3C's and every source uses it, and a predicate whose
        // own name is not the end of its relation's does not say where the
        // relation's prefix ends.
        //
        expect(named(
            ['owl_Thing', 'jolts_Industry'],
            [
                edge('owl_sameAs', 'http://www.w3.org/2002/07/owl#sameAs'),
                edge('jolts_hasIndustry', 'https://jefflevesque.com/ontology/bls/jolts/inIndustry'),
            ]
        )).toEqual({ owl_Thing: undefined, jolts_Industry: undefined });
    });

    it('is nothing for a relation with no prefix before its name', () => {
        //
        // '_hasIndustry' names nothing a node type could be filed under
        //
        expect(named(
            ['jolts_Industry'],
            [edge('_hasIndustry', 'https://jefflevesque.com/ontology/bls/jolts/hasIndustry')]
        )).toEqual({ jolts_Industry: undefined });
    });

    it('is nothing for a node type whose name has no prefix', () => {
        expect(named(
            ['Standalone', '_Odd'],
            [edge('jolts_hasIndustry', 'https://jefflevesque.com/ontology/bls/jolts/hasIndustry')]
        )).toEqual({ Standalone: undefined, _Odd: undefined });
    });

    it('is the flat vocabulary a day published before the nesting names', () => {
        //
        // every day published before 2026-09-21 names 'ontology/jolts/', and the
        // build of the same run names its types the same way. Each page reads
        // what was published for the day it draws.
        //
        expect(named(
            ['jolts_Industry'],
            [edge('jolts_hasIndustry', 'https://jefflevesque.com/ontology/jolts/hasIndustry')]
        )).toEqual({ jolts_Industry: 'jolts' });
    });
});
