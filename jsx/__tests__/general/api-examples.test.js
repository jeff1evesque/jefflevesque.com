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
import getSecCompanyFactsDistribution from '../../import/general/get-data/distribution/sec-companyfacts.js';
import { getGraphListing, getGraphById } from '../../import/general/get-graph-schema.js';
import { getTableDays, getTableDay } from '../../import/general/get-graph-tables.js';
import { buildDay, graphSources, sourceTypes, outsideGraph } from '../../import/layout/graph/source.js';
import filterSchema from '../../import/animation/filter-schema.js';
import { sourceNamespace } from '../../import/animation/encoding.js';
import { loadArchiveListing, archiveFiles } from '../../import/general/archive-links.js';
import { performanceUrl, datalakeUrl } from '../../import/general/api-url.js';
import modelReport from '../../import/worker/model/report.js';
import { LOSS_PARTS, SCORES, statusOf } from '../../import/layout/model/scores.js';

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
        answering(successOf('performance').examples.now.value);
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

    it('reads an earlier window the same way: one row per source and hour of Sep 17', async () => {
        //
        // the example of an End: the S&P 500's two sources, by the hour, through
        // the hours the market is open on Sep 17
        //
        answering(successOf('performance').examples.earlier.value);
        const callback = jest.fn();

        await getData(
            'stock-market-ingest',
            performanceUrl('stock-market', 'hour', 'America/New_York'),
            callback,
            true,
            'stock-market',
            'stock-market'
        );

        const { data } = callback.mock.calls[0][0];
        const rows = data.filter(row => row.group_by);
        const hours = rows.map(row => row.window_start);

        expect(new Set(rows.map(row => row.group_by))).toEqual(new Set(['options', 'price']));
        expect(hours.every(hour => hour.startsWith('2026-09-17 '))).toBe(true);
        expect(new Set(hours).size * 2).toBe(rows.length);
        rows.forEach(row => {
            ['group_by', 'window_start', 'total_success', 'total_fail'].forEach(column => {
                expect(row[column]).toBeTruthy();
            });
        });
    });

    it('reads the sec report\'s two series, the company facts\' a row per run (#211)', async () => {
        //
        // the company facts' row of /stream asks the sec stream, as the filings'
        // row does, and reads its own series out of the one report
        //
        answering(successOf('performance').examples.companyfacts.value);
        const callback = jest.fn();

        await getData(
            'sec-ingest',
            performanceUrl('sec-companyfacts', 'day', 'America/New_York'),
            callback,
            true,
            'companyfacts',
            'sec-companyfacts'
        );

        const { data, source, stream } = callback.mock.calls[0][0];
        const rows = data.filter(row => row.group_by);

        expect({ source, stream }).toEqual({ source: 'companyfacts', stream: 'sec-companyfacts' });
        expect(new Set(rows.map(row => row.group_by))).toEqual(new Set(['sec', 'companyfacts']));
        expect(rows.filter(row => row.group_by === 'companyfacts')).toEqual([
            expect.objectContaining({ total_success: '500', total_fail: '0' }),
        ]);
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
        answering(successOf('datalake').examples.bls.value);
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

    it('parses the company facts\' rows, a form a row per status (#211)', async () => {
        //
        // read by the filings' own parse: the two answer one shape, the company
        // facts' categories their statuses
        //
        answering(successOf('datalake').examples['sec-companyfacts'].value);
        const callback = jest.fn();

        await getSecCompanyFactsDistribution(
            'data-distribution',
            datalakeUrl('sec-companyfacts', 2026, 8),
            callback,
            true,
            'sec-companyfacts',
            'sec-companyfacts'
        );

        const answered = Object.assign({}, ...callback.mock.calls.map(([item]) => item));
        const rows = answered['data-distribution'];

        expect(rows).toHaveLength(28);
        expect(rows).toContainEqual({ category: 'new', form: '10-Q', total_records: '41970' });
        expect(rows).toContainEqual({ category: 'repeated', form: '10-Q', total_records: '37190' });
        expect(new Set(rows.map((row) => row.category))).toEqual(new Set(['new', 'repeated', 'changed']));
        expect(rows.reduce((sum, row) => sum + Number(row.total_records), 0)).toBe(97343);
        expect(answered.partition).toEqual([{ count: '21' }]);
        expect(answered.stream).toBe('sec-companyfacts');
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
        answering(schemaMedia.examples['1.3'].value);

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
        // 'bls/cpi' rather than 'bls': the builder nests a vocabulary under the
        // source that publishes it, and one source publishes ten of them. The
        // first segment alone would pool them into one color.
        //
        answering(schemaMedia.examples['1.3'].value);

        const schema = await getGraphById('all-sources.2026-09.20260916T171546Z.1024d');
        const drawn = Object.entries(schema.node_types)
            .map(([id, meta]) => sourceNamespace(meta, id));

        expect([...new Set(drawn)]).toEqual(['bls/cpi']);
    });

    it('reads a 1.6 build\'s company facts: the source in its graph, and CompanyFact under it (#211)', async () => {
        //
        // the Training graph's Sources row reads sources_in_graph from a schema of
        // 1.4 or later, and the canvas files CompanyFact under the vocabulary its
        // uri names, sec/companyfacts
        //
        answering(schemaMedia.examples['1.6'].value);

        const schema = await getGraphById('all-sources.2026-10.20261006T050015Z.1024d');

        expect(graphSources({ sources: [] }, schema)).toBe('bls, market, sec, sec-companyfacts');
        expect(sourceNamespace(schema.node_types.companyfacts_CompanyFact, 'companyfacts_CompanyFact'))
            .toBe('sec/companyfacts');
        expect(Object.keys(filterSchema(schema, 60).node_types).sort())
            .toEqual(['companyfacts_CompanyFact', 'filings_Issuer']);
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

        const listed = (await getTableDays()).map((row) => row.day);

        expect(listed.length).toBeGreaterThan(1);
        expect(listed).toEqual([...listed].sort().reverse());
    });

    it('reads each documented day with the run that published it, and when', async () => {
        //
        // the Retrieval graph's Run and Published rows read these. A documented
        // row that gives neither would read null for both, which the page shows
        // as 'n/a', the way it shows a build's missing run -- and every row the
        // api answers now gives both.
        //
        answering(days.example);

        const listed = await getTableDays();

        expect(listed).toEqual(days.example.report.rows.map((row) => ({
            day: row.day,
            run: typeof row.run === 'string' ? row.run : null,
            published: typeof row.published === 'string' ? row.published : null,
            sources: Array.isArray(row.sources) ? row.sources : null,
        })));
        listed.forEach((row) => {
            expect({ day: row.day, run: typeof row.run, published: typeof row.published })
                .toEqual({ day: row.day, run: 'string', published: 'string' });
        });
    });

    it('documents each day\'s sources, null for the days published before the builder recorded them', async () => {
        //
        // the Retrieval graph's Sources row reads the list, and falls back to a
        // day's vocabularies where it is null. The builder has recorded them from
        // 2026-09-29, so every day from it lists them, and none before it
        //
        answering(days.example);

        const listed = await getTableDays();

        days.example.report.rows.forEach((row) => {
            expect({ day: row.day, documented: 'sources' in row }).toEqual({ day: row.day, documented: true });
        });
        listed.forEach((row) => {
            expect({ day: row.day, listed: Array.isArray(row.sources) })
                .toEqual({ day: row.day, listed: row.day >= '2026-09-29' });
        });
    });

    it('documents a day that holds the company facts, and names them as the Sources row does (#211)', async () => {
        answering(days.example);

        const listed = await getTableDays();
        const first = listed.find((row) => (row.sources || []).includes('sec-companyfacts'));

        expect(first.day).toBe('2026-10-05');
        expect(first.sources).toEqual(['bls', 'market', 'noaa', 'sec', 'sec-companyfacts', 'stock-split']);

        //
        // and a day whose rows hold CompanyFact, under sec/companyfacts, holds the
        // source in its graph: it is not noted as outside it, as the split feed
        // is, and the canvas is handed its one type to draw
        //
        const types = {
            companyfacts_CompanyFact: { count: 15600, entities: 0, facts: 0, vocabulary: 'sec/companyfacts' },
            filings_Issuer: { count: 3412, entities: 3412, facts: 0, vocabulary: 'sec/filings' },
        };

        expect(outsideGraph(first, types)).not.toContain('sec-companyfacts');
        expect(outsideGraph(first, types)).toContain('stock-split');
        expect(sourceTypes(first, types)).toContainEqual(['companyfacts_CompanyFact']);
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

describe('model, as /model and /model/:model read it (#243)', () => {
    const media = successOf('model');

    //
    // what the model pages' worker makes of an answer, run in this process --
    // see worker/model-report.test.js
    //
    function read(kind, body, name = null) {
        const posted = [];
        const realPostMessage = self.postMessage;

        self.postMessage = (answer) => posted.push(answer);
        modelReport();
        self.onmessage({ data: { kind: kind, report: body.report, name: name } });
        self.postMessage = realPostMessage;
        self.onmessage = null;

        return posted[0];
    }

    const listing = read('list', media.examples.list.value);
    const fiveDay = () => listing.models.find((model) => model.name === 'pt-gnn-5day');

    it('reads the listing: every model, each with a task the listing describes', () => {
        expect(listing.models.length).toBeGreaterThan(1);
        listing.models.forEach((model) => {
            expect(listing.tasks.map((task) => task.id)).toContain(model.task);
            expect(model.live.kind).not.toBeNull();
            expect(model.score).not.toBeNull();
        });
    });

    it('lists models of every status, so a reader sees each shape', () => {
        expect([...new Set(listing.models.map(statusOf))].sort()).toEqual(['down', 'live', 'new', 'retired']);
    });

    it('reads the listing\'s format_version, and the documented reports have the columns it added (#248, #263)', () => {
        const header = (report) => media.examples[report].value.report.split('\n')[0].split(',');

        expect(listing.format_version).toBe(2);
        expect(header('history')).toEqual(expect.arrayContaining(['started', 'training_seconds', 'total_seconds']));
        expect(header('track-record')).toEqual(expect.arrayContaining(['down_days', 'down_in_a_row']));
    });

    it('reads a model taken down, and every model\'s checks, as format 2 gives them (#263)', () => {
        const down = listing.models.filter((model) => model.down);

        expect(down.map((model) => model.name)).toEqual(['tables-gnn-5day']);
        expect(down[0].down).toEqual({ since: '2026-10-16', days: 1, in_a_row: 5 });
        listing.models.forEach((model) => {
            expect(model.behind.map((check) => check.days)).toEqual([1, 5, 20]);
        });
        expect(fiveDay().behind[2].in_a_row).toBeNull();
    });

    it('reads the documented track record as no day taking its live version down', () => {
        const rows = read('track-record', media.examples['track-record'].value, 'pt-gnn-5day').rows;

        rows.forEach((row) => expect(row).toMatchObject({ down_days: null, down_in_a_row: null }));
    });

    it('reads the history: every night, and as many went live as the listing says', () => {
        const rows = read('history', media.examples.history.value, 'pt-gnn-5day').rows;

        expect(rows).toHaveLength(fiveDay().attempts.total);
        expect(rows.filter((row) => row.went_live)).toHaveLength(fiveDay().attempts.went_live);
        expect(rows.some((row) => row.kind === 'weekly')).toBe(true);
        rows.forEach((row) => {
            ['attempt', 'live', 'baseline'].forEach((field) => {
                Object.values(row[field]).forEach((value) => expect(Number.isFinite(value)).toBe(true));
            });
        });
    });

    it('reads the track record: as many days as the listing scored, averaging to its score', () => {
        const rows = read('track-record', media.examples['track-record'].value, 'pt-gnn-5day').rows;
        const last = rows[rows.length - 1];

        expect(rows).toHaveLength(fiveDay().scored_days);
        SCORES.forEach(({ key }) => {
            expect(last.average[key]).toBeCloseTo(fiveDay().score[key], 3);
            expect(last.baseline_average[key]).toBeCloseTo(fiveDay().baseline[key], 3);
        });
    });

    describe('loss\'s three parts (#265)', () => {
        const sum = (scores) => LOSS_PARTS.reduce((total, part) => total + scores[part.key], 0);

        it('reads them in the history, each side\'s adding up to its loss', () => {
            read('history', media.examples.history.value, 'pt-gnn-5day').rows.forEach((row) => {
                ['attempt', 'live', 'baseline'].forEach((field) => expect(sum(row[field])).toBeCloseTo(row[field].loss, 4));
            });
        });

        it('reads them in the track record, so the newest day\'s 20-day averages add up to the listing\'s score', () => {
            const rows = read('track-record', media.examples['track-record'].value, 'pt-gnn-5day').rows;
            const last = rows[rows.length - 1];

            rows.forEach((row) => {
                expect(sum(row.score)).toBeCloseTo(row.score.loss, 4);
                expect(sum(row.baseline)).toBeCloseTo(row.baseline.loss, 4);
            });
            expect(sum(last.average)).toBeCloseTo(fiveDay().score.loss, 3);
            expect(sum(last.baseline_average)).toBeCloseTo(fiveDay().baseline.loss, 3);
        });

        it('reads none in the listing, which carries only loss', () => {
            listing.models.forEach((model) => {
                LOSS_PARTS.forEach((part) => expect(model.score[part.key]).toBeNull());
            });
        });
    });
});
