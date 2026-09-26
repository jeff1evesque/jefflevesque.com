/**
 * api-examples.test.js: the documented examples, read by the application's own code.
 *
 * openapi.test.js holds each example in documentation/api/openapi/ to its schema. This
 * holds it to the reader that matters more: the loader that parses the real response
 * for a page. An example the application could not read would document an api this
 * site does not use -- and the reader copying it would find out, not this suite.
 *
 * Note: react-papaparse is NOT mocked here. get-data.test.js and
 *       get-data-distribution.test.js mock it, which is right for testing dispatch,
 *       but parsing the documented csv is the whole point of this suite.
 *
 * Note: fetch is stubbed to answer with the documented body, so what reaches the
 *       loader is byte for byte what a reader of the documentation sees.
 */

const fs = require('fs');
const path = require('path');

import getData from '../../import/general/get-data.js';
import getBlsDistribution from '../../import/general/get-data/distribution/bls.js';
import { getGraphListing, getGraphById } from '../../import/general/get-graph-schema.js';
import { getTableDays, getTableDay } from '../../import/general/get-graph-tables.js';
import { buildDay } from '../../import/layout/graph/source.js';
import filterSchema from '../../import/animation/filter-schema.js';
import { sourceNamespace } from '../../import/animation/encoding.js';
import { loadArchiveListing, archiveFiles } from '../../import/general/archive-links.js';
import { performanceUrl, datalakeUrl } from '../../import/general/api-url.js';

const OPENAPI = path.join(__dirname, '..', '..', '..', 'documentation', 'api', 'openapi');

function successOf(name, route = null) {
    const document = JSON.parse(fs.readFileSync(path.join(OPENAPI, `${name}.json`), 'utf8'));
    const [first] = Object.keys(document.paths);

    return document.paths[route || first].get.responses['200'].content['application/json'];
}

function answering(body) {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
    });
}

const realFetch = global.fetch;

afterEach(() => {
    global.fetch = realFetch;
});

describe('performance, as the /stream page loads it', () => {
    it('parses into rows carrying the columns the chart reads', async () => {
        //
        // the documented request is the S&P 500's, by its id, so this loads it
        // the way the page loads that stream.
        //
        answering(successOf('performance').example);
        const callback = jest.fn();

        await getData(
            'stock-market-ingest',
            performanceUrl('stock-market', 'day', 'America/New_York'),
            callback,
            true,
            'stock-market',
            'stock-market'
        );

        const { data } = callback.mock.calls[0][0];
        const rows = data.filter(row => row.group_by);

        expect(rows).toHaveLength(2);
        rows.forEach(row => {
            ['group_by', 'window_start', 'total_success', 'total_fail'].forEach(column => {
                expect(row[column]).toBeTruthy();
            });
        });
        expect(rows[0]).toMatchObject({ group_by: 'price', total_success: '9481', total_fail: '0' });
    });

    it('hands the page nothing, rather than a failure, when the window holds no rows', async () => {
        answering({ report: null });
        const callback = jest.fn();

        await getData('bls-ingest', performanceUrl('bls', 'day', 'UTC'), callback, true, 'bls', 'bls');

        expect(callback).toHaveBeenCalledWith({ data: null, source: 'bls', stream: 'bls' });
    });
});

describe('the performance archive, as each alarm page loads it', () => {
    const media = successOf('performance', '/performance/archive');

    it('offers every stream the documented file, linked where it is served', async () => {
        //
        // the example holds one file per stream, so each stream reads back
        // exactly that one -- including the three filed under a folder that is
        // not their stream id.
        //
        answering(media.example);

        const listing = await loadArchiveListing();

        listing.streams.forEach((stream) => {
            const [entry] = listing.archives.filter((archive) => archive.stream === stream);

            expect({ stream, files: archiveFiles(listing, stream).map((file) => file.href) })
                .toEqual({ stream, files: [entry.url] });
        });
    });

    it('labels the documented files as the page always has', async () => {
        answering(media.example);

        const listing = await loadArchiveListing();

        expect(archiveFiles(listing, 'sec').map((file) => file.label)).toEqual(['09/2025.csv']);
        expect(archiveFiles(listing, 'stock-market').map((file) => file.label)).toEqual(['2025.csv']);
    });
});

describe('datalake, as the /data page loads it', () => {
    it('parses both sections into rows', async () => {
        answering(successOf('datalake').example);
        const callback = jest.fn();

        await getBlsDistribution('data-distribution', datalakeUrl('bls', 2026, 8), callback, true, 'bls', 'bls');

        const answered = Object.assign({}, ...callback.mock.calls.map(([item]) => item));

        expect(answered['data-distribution']).toEqual([
            { category: 'Reports', series: 'EMPSIT', total_records: '626' },
            { category: 'Reports', series: 'REALER', total_records: '36' },
            { category: 'Reports', series: 'XIMPIM', total_records: '1752' },
        ]);
        expect(answered.partition).toEqual([{ count: '5' }]);
    });
});

describe('knowledge graph, as the /graph page loads it', () => {
    //
    // two operations now, so each example is read off the route that documents
    // it rather than out of one media object.
    //
    const listingMedia = successOf('knowledge-graph', '/knowledge-graph');
    const schemaMedia = successOf('knowledge-graph', '/knowledge-graph/{graph}');

    it('reads the listing, and the default build it names', async () => {
        answering(listingMedia.example);

        const listing = await getGraphListing();

        expect(listing.default).toBe(listing.graphs[0].id);
        expect(listing.graphs[0]).toMatchObject({ nodes: 9982993, edges: 74831988, error: null });
    });

    it('reads every build the listing documents, not only the default', async () => {
        //
        // the example shows three builds because the api serves several; a
        // single-entry example read as the whole listing is what /graph's picker
        // exists for.
        //
        answering(listingMedia.example);

        const listing = await getGraphListing();

        expect(listing.graphs.length).toBeGreaterThan(1);
        expect(listing.graphs.map(g => g.id)).toContain(listing.default);
    });

    it('reads each build\'s schema version, and a day of its own only from 1.5', async () => {
        //
        // the Training graph names a build by the day it holds. From 1.5 that is
        // the listing's `day`; an older build's is null, and the page reads its
        // day off the published days instead. A documented day the page would
        // not take as the build's own would document a listing it reads wrong.
        //
        answering(listingMedia.example);

        const listing = await getGraphListing();

        listing.graphs.forEach((build) => {
            expect({ id: build.id, version: typeof build.schema_version })
                .toEqual({ id: build.id, version: 'string' });
            expect({ id: build.id, day: build.day })
                .toEqual({ id: build.id, day: buildDay({ ...build, run: null }, null) });
        });
    });

    it('documents a build older than 1.5, whose day is null', async () => {
        answering(listingMedia.example);

        const listing = await getGraphListing();

        expect(listing.graphs.some((build) => build.day === null)).toBe(true);
    });

    it('reads a build\'s schema and cuts it to a drawable slice', async () => {
        answering(schemaMedia.example);

        const schema = await getGraphById('all-sources.2026-09.20260916T171546Z.1024d');
        const drawn = filterSchema(schema, 60);

        expect(Object.keys(drawn.node_types).sort()).toEqual(['cpi_Category', 'cpi_OneMonthPercentChange']);
        expect(Object.keys(drawn.edge_types)).toHaveLength(1);
    });

    it('resolves the documented uris to the vocabulary that colors them', async () => {
        //
        // the example is what a reader copies, and its uris are what the graph
        // reads a namespace out of -- which is the color channel for both the
        // front page and /graph. A documented uri the namespace rule disagrees
        // with is a documented api this site would draw wrong.
        //
        // 'bls-cpi' rather than 'bls': the builder nests a vocabulary under the
        // source that publishes it, and one source publishes ten of them. The
        // first segment alone would pool them into one color.
        //
        answering(schemaMedia.example);

        const schema = await getGraphById('all-sources.2026-09.20260916T171546Z.1024d');
        const drawn = Object.entries(schema.node_types)
            .map(([id, meta]) => sourceNamespace(meta, id));

        expect([...new Set(drawn)]).toEqual(['bls-cpi']);
    });
});

describe('knowledge graph tables, as the Retrieval graph loads a day', () => {
    //
    // three documented answers make a day: the days, and one day's node types and
    // edge types asked side by side. Each is read off its own route, and the two
    // halves of a day are answered by path -- they are asked at once, and nothing
    // promises which arrives first.
    //
    const days = successOf('knowledge-graph', '/knowledge-graph/tables/days');
    const nodeTypes = successOf('knowledge-graph', '/knowledge-graph/tables/node-types');
    const edgeTypes = successOf('knowledge-graph', '/knowledge-graph/tables/edge-types');

    function answeringByPath(byPath) {
        global.fetch = jest.fn((url) => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(byPath[new URL(String(url)).pathname.split('/').pop()]),
        }));
    }

    it('reads the documented days, newest first', async () => {
        answering(days.example);

        const listed = await getTableDays();

        expect(listed.length).toBeGreaterThan(1);
        expect(listed).toEqual([...listed].sort().reverse());
    });

    it('reads the documented node and edge types as one day', async () => {
        answeringByPath({ 'node-types': nodeTypes.example, 'edge-types': edgeTypes.example });

        const day = await getTableDay('2026-09-23');

        expect(Object.keys(day.node_types)).toEqual(
            nodeTypes.example.report.rows.map((row) => row.node_type)
        );
        expect(Object.keys(day.edge_types)).toHaveLength(edgeTypes.example.report.rows.length);
    });

    it('documents node types that say what can be looked up in them', async () => {
        //
        // the day loader refuses a node type without its entities and facts, so a
        // documented answer that left them out would document a day this site
        // could not draw.
        //
        answeringByPath({ 'node-types': nodeTypes.example, 'edge-types': edgeTypes.example });

        const day = await getTableDay('2026-09-23');

        Object.values(day.node_types).forEach((type) => {
            expect(typeof type.entities).toBe('number');
            expect(typeof type.facts).toBe('number');
        });
    });
});
