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
import filterSchema from '../../import/animation/filter-schema.js';
import { performanceUrl, datalakeUrl } from '../../import/general/api-url.js';

const OPENAPI = path.join(__dirname, '..', '..', '..', 'documentation', 'api', 'openapi');

function successOf(name) {
    const document = JSON.parse(fs.readFileSync(path.join(OPENAPI, `${name}.json`), 'utf8'));
    const [route] = Object.keys(document.paths);

    return document.paths[route].get.responses['200'].content['application/json'];
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
        answering(successOf('performance').example);
        const callback = jest.fn();

        await getData('bls-ingest', performanceUrl('bls', 'day', 'America/New_York'), callback, true, 'bls', 'bls');

        const { data } = callback.mock.calls[0][0];
        const rows = data.filter(row => row.group_by);

        expect(rows).toHaveLength(2);
        rows.forEach(row => {
            ['group_by', 'window_start', 'total_success', 'total_fail'].forEach(column => {
                expect(row[column]).toBeTruthy();
            });
        });
        expect(rows[0]).toMatchObject({ group_by: 'bls', total_success: '6941', total_fail: '0' });
    });

    it('hands the page nothing, rather than a failure, when the window holds no rows', async () => {
        answering({ report: null });
        const callback = jest.fn();

        await getData('bls-ingest', performanceUrl('bls', 'day', 'UTC'), callback, true, 'bls', 'bls');

        expect(callback).toHaveBeenCalledWith({ data: null, source: 'bls', stream: 'bls' });
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
    const media = successOf('knowledge-graph');

    it('reads the listing, and the default build it names', async () => {
        answering(media.examples.listing.value);

        const listing = await getGraphListing();

        expect(listing.default).toBe(listing.graphs[0].id);
        expect(listing.graphs[0]).toMatchObject({ nodes: 9982993, edges: 74831988, error: null });
    });

    it('reads a build\'s schema and cuts it to a drawable slice', async () => {
        answering(media.examples.schema.value);

        const schema = await getGraphById('all-sources.2026-09.20260916T171546Z.1024d');
        const drawn = filterSchema(schema, 60);

        expect(Object.keys(drawn.node_types).sort()).toEqual(['cpi_Category', 'cpi_OneMonthPercentChange']);
        expect(Object.keys(drawn.edge_types)).toHaveLength(1);
    });
});
