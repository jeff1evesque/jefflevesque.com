/**
 * api-url.test.js: the requests to the three public apis, and where they are documented.
 *
 * Two things are held here. The urls are built exactly as the pages have always built
 * them -- the page suites assert the same urls from the outside, through the loaders --
 * and every query parameter a builder sends is one its api's OpenAPI document declares,
 * read from the document rather than retyped here. A parameter added to a request
 * without being documented fails this suite, and so does a documented one no request
 * sends.
 *
 * Note: the documents are read with fs rather than imported, for the same reason
 *       issue-templates.test.js reads its templates that way: they live outside jsx/,
 *       and what is under test is the file in the repository.
 */

const fs = require('fs');
const path = require('path');

import {
    performanceUrl,
    performanceArchiveUrl,
    datalakeUrl,
    knowledgeGraphUrl,
    knowledgeGraphTablesUrl,
    API,
    ENDPOINTS,
    DOCUMENTATION,
    API_DOCS,
    DATASETS,
    TABLES_VALUES,
} from '../../import/general/api-url.js';

const OPENAPI = path.join(__dirname, '..', '..', '..', 'documentation', 'api', 'openapi');

function documentOf(name) {
    return JSON.parse(fs.readFileSync(path.join(OPENAPI, `${name}.json`), 'utf8'));
}

//
// a document may describe more than one operation -- the knowledge graph's two
// calls are two paths -- so everything below reads across all of them rather
// than off the first.
//
function operationsOf(document) {
    return Object.entries(document.paths).map(([route, item]) => ({ route, operation: item.get }));
}

function parametersOf(document, where) {
    return operationsOf(document).flatMap(({ operation }) =>
        (operation.parameters || []).filter(p => where === undefined || p.in === where)
    );
}

function declared(document) {
    return [...new Set(parametersOf(document, 'query').map(p => p.name))].sort();
}

//
// the same, for one route. The knowledge graph's document now holds routes that
// disagree about query strings -- its two build routes refuse one, and its tables
// route is nothing but one -- so a document-wide answer describes neither.
//
function declaredFor(document, route) {
    const { operation } = operationsOf(document).find(entry => entry.route === route);

    return [...new Set((operation.parameters || [])
        .filter(parameter => parameter.in === 'query')
        .map(parameter => parameter.name))].sort();
}

function parameterOf(document, name) {
    return parametersOf(document).find(p => p.name === name);
}

function sent(...urls) {
    return [...new Set(urls.flatMap(url => [...new URL(String(url)).searchParams.keys()]))].sort();
}

//
// the path each url asks for, with the document's own server prefix removed, so
// it can be held against the routes the document templates.
//
function routeSent(document, url) {
    const [{ url: server }] = document.servers;

    return String(url).slice(server.length);
}

describe('performanceUrl', () => {
    it('asks for one stream at one interval on the viewer\'s calendar', () => {
        expect(String(performanceUrl('bls', 'day', 'America/New_York'))).toBe(
            'https://api.jefflevesque.com/v1/public/performance'
            + '?Stream=bls&Interval=day&Timezone=America%2FNew_York'
        );
    });

    it.each([
        ['stock-market', 'stock-market'],
        ['StockMarket', 'stock-market'],
        ['stockmarketstocksplit', 'stock-split'],
        ['USNationalWeather', 'us-national-weather'],
        ['BLS', 'bls'],
    ])('sends %s as the stream id %s', (name, id) => {
        //
        // the api answers to the ids, and to the old names only for now. Whatever
        // a caller hands this, the request names the stream by its id.
        //
        expect(performanceUrl(name, 'day', 'UTC').searchParams.get('Stream')).toBe(id);
    });

    it('sends a name that is no stream\'s as it was given, lower-cased', () => {
        //
        // there is no id to send, and the api's 400 names the ones it accepts --
        // which says more than a request that was quietly never made.
        //
        expect(performanceUrl('Nope', 'day', 'UTC').searchParams.get('Stream')).toBe('nope');
    });

    it('lower-cases the interval, which the page holds capitalized', () => {
        expect(performanceUrl('bls', 'Month', 'UTC').searchParams.get('Interval')).toBe('month');
    });

    it('sends the time zone as given', () => {
        expect(performanceUrl('bls', 'day', 'Asia/Tokyo').searchParams.get('Timezone')).toBe('Asia/Tokyo');
    });

    it('can be pointed elsewhere', () => {
        expect(String(performanceUrl('bls', 'day', 'UTC', 'https://example.com/p')))
            .toMatch(/^https:\/\/example\.com\/p\?Stream=bls/);
    });
});

describe('performanceArchiveUrl', () => {
    it('asks for the whole listing, with nothing on the query string', () => {
        //
        // one request for every stream, and the api refuses a query string on
        // any archive route -- so nothing is sent to narrow it.
        //
        const url = performanceArchiveUrl();

        expect(String(url)).toBe('https://api.jefflevesque.com/v1/public/performance/archive');
        expect([...url.searchParams.keys()]).toEqual([]);
    });

    it('can be pointed elsewhere', () => {
        expect(String(performanceArchiveUrl('https://example.com/a'))).toBe('https://example.com/a');
    });
});

describe('datalakeUrl', () => {
    it('asks for one dataset over one month', () => {
        const url = datalakeUrl('bls', 2026, '08');

        expect(url.origin + url.pathname).toBe('https://api.jefflevesque.com/v1/public/datalake');
        expect(url.searchParams.get('Data')).toBe('bls');
        expect(JSON.parse(url.searchParams.get('Scale'))).toEqual({ year: 2026, month: '08' });
    });

    it('zero-pads a month given as a number', () => {
        //
        // the pages hold the month as a number from a date picker, and the api reads a
        // two-digit string -- '7' names no month it holds.
        //
        expect(JSON.parse(datalakeUrl('bls', 2026, 7).searchParams.get('Scale')).month).toBe('07');
    });

    it('serializes the scale as the pages always have', () => {
        expect(datalakeUrl('bls', 2026, 9).searchParams.get('Scale')).toBe('{"year":2026,"month":"09"}');
    });

    it('can be pointed elsewhere', () => {
        expect(String(datalakeUrl('bls', 2026, 9, 'https://example.com/d')))
            .toMatch(/^https:\/\/example\.com\/d\?Data=bls/);
    });
});

describe('knowledgeGraphUrl', () => {
    it('asks for the listing when given no build', () => {
        expect(String(knowledgeGraphUrl())).toBe(ENDPOINTS.knowledgeGraph);
        expect(String(knowledgeGraphUrl(null))).toBe(ENDPOINTS.knowledgeGraph);
        expect(String(knowledgeGraphUrl(''))).toBe(ENDPOINTS.knowledgeGraph);
    });

    it('asks for one build at its own path, not by a query parameter', () => {
        const url = knowledgeGraphUrl('all-sources.2026-09.20260916T171546Z.1024d');

        expect(String(url)).toBe(
            `${ENDPOINTS.knowledgeGraph}/all-sources.2026-09.20260916T171546Z.1024d`
        );
        expect([...url.searchParams.keys()]).toEqual([]);
    });

    it('sends an id unchanged, however it is shaped', () => {
        //
        // ids are opaque: a caller that reshaped one would be guessing at a format it
        // does not own. On a path that means encoding rather than passing through --
        // an unencoded '/' would address a different resource, and an unencoded '?'
        // would put the rest of the id on the query string, which the api refuses.
        //
        const url = knowledgeGraphUrl('a b/c?d');

        expect(String(url)).toBe(`${ENDPOINTS.knowledgeGraph}/a%20b%2Fc%3Fd`);
        expect(decodeURIComponent(String(url).slice(ENDPOINTS.knowledgeGraph.length + 1))).toBe('a b/c?d');
        expect([...url.searchParams.keys()]).toEqual([]);
    });

    it('can be pointed elsewhere', () => {
        expect(String(knowledgeGraphUrl('x', 'https://example.com/g'))).toBe('https://example.com/g/x');
    });
});

describe('knowledgeGraphTablesUrl', () => {
    it('asks each operation on its own path, and sends no Operation', () => {
        //
        // the operation moved into the path because operations taking different
        // parameter sets cannot be described on one. Sending it as well would be
        // a parameter the path does not take, which the api answers with a 400.
        //
        expect(knowledgeGraphTablesUrl('Days').pathname)
            .toBe('/v1/public/knowledge-graph/tables/days');
        expect(knowledgeGraphTablesUrl('EdgeTypes').pathname)
            .toBe('/v1/public/knowledge-graph/tables/edge-types');
        expect(knowledgeGraphTablesUrl('NodeTypes', { Day: '2026-09-23' }).pathname)
            .toBe('/v1/public/knowledge-graph/tables/node-types');
        expect(knowledgeGraphTablesUrl('Find', { Text: 'a' }).pathname)
            .toBe('/v1/public/knowledge-graph/tables/find');
        expect(knowledgeGraphTablesUrl('Facts', { Uri: 'urn:x' }).pathname)
            .toBe('/v1/public/knowledge-graph/tables/facts');
        expect(knowledgeGraphTablesUrl('Neighborhood', { Uri: 'urn:x', Day: '2026-09-18' }).pathname)
            .toBe('/v1/public/knowledge-graph/tables/neighborhood');
        expect(knowledgeGraphTablesUrl('Quotes', { Symbol: 'NVDA', Day: '2026-09-23' }).pathname)
            .toBe('/v1/public/knowledge-graph/tables/quotes');
        expect(knowledgeGraphTablesUrl('LastQuotes', { Day: '2026-09-23' }).pathname)
            .toBe('/v1/public/knowledge-graph/tables/last-quotes');

        expect(sent(knowledgeGraphTablesUrl('EdgeTypes'))).toEqual([]);
        expect(sent(knowledgeGraphTablesUrl('Days'))).toEqual([]);
    });

    it('sends each operation the values that operation takes', () => {
        expect(sent(knowledgeGraphTablesUrl('Find', { Text: 'apple' })))
            .toEqual(['Text']);
        expect(sent(knowledgeGraphTablesUrl('Facts', { Uri: 'urn:x' })))
            .toEqual(['Uri']);
        expect(sent(knowledgeGraphTablesUrl('Neighborhood', { Uri: 'urn:x', Day: '2026-09-18' })))
            .toEqual(['Day', 'Uri']);
        expect(sent(knowledgeGraphTablesUrl('NodeTypes', { Day: '2026-09-23' })))
            .toEqual(['Day']);
        expect(sent(knowledgeGraphTablesUrl('Quotes', { Symbol: 'NVDA', Day: '2026-09-23' })))
            .toEqual(['Day', 'Symbol']);
        expect(sent(knowledgeGraphTablesUrl('LastQuotes', { Day: '2026-09-23' })))
            .toEqual(['Day']);
    });

    it('narrows the edge types and a search to one day, when asked', () => {
        //
        // across the window each row comes back once per day that holds it, with
        // nothing on it saying which. One day holds each once.
        //
        expect(sent(knowledgeGraphTablesUrl('EdgeTypes', { Day: '2026-09-23' })))
            .toEqual(['Day']);
        expect(sent(knowledgeGraphTablesUrl('Find', { Text: 'nvidia', Day: '2026-09-23' })))
            .toEqual(['Day', 'Text']);
    });

    it('refuses an operation the api does not offer, rather than sending it', () => {
        //
        // the api answers an unknown operation with a 400 and never echoes it
        // back, so a request built from one can only fail.
        //
        expect(() => knowledgeGraphTablesUrl('Snapshots')).toThrow(/no such operation/);
        expect(() => knowledgeGraphTablesUrl()).toThrow(/no such operation/);
    });

    it('refuses a value the named operation does not take', () => {
        //
        // the same 400, for the same reason: the api refuses a parameter
        // meaningless to the operation rather than ignoring it.
        //
        expect(() => knowledgeGraphTablesUrl('EdgeTypes', { Uri: 'urn:x' }))
            .toThrow(/EdgeTypes does not take Uri/);
        expect(() => knowledgeGraphTablesUrl('Find', { Uri: 'urn:x' }))
            .toThrow(/Find does not take Uri/);
        expect(() => knowledgeGraphTablesUrl('LastQuotes', { Day: '2026-09-23', Symbol: 'NVDA' }))
            .toThrow(/LastQuotes does not take Symbol/);
    });

    it('takes a Limit on every operation but the days, being a ceiling rather than a question', () => {
        expect(sent(knowledgeGraphTablesUrl('EdgeTypes', { Limit: 10 })))
            .toEqual(['Limit']);
        expect(knowledgeGraphTablesUrl('EdgeTypes', { Limit: 10 }).searchParams.get('Limit'))
            .toBe('10');
    });

    it('refuses anything at all on the days, a Limit included', () => {
        //
        // every published day is the answer, a year of them at most, and the api
        // refuses a value it would have to ignore.
        //
        expect(() => knowledgeGraphTablesUrl('Days', { Limit: 10 }))
            .toThrow(/Days does not take Limit/);
        expect(() => knowledgeGraphTablesUrl('Days', { Day: '2026-09-23' }))
            .toThrow(/Days does not take Day/);
    });

    it('leaves out a value that was not given', () => {
        //
        // 'Day' is optional for Facts, and an empty one sent as '' is a 400
        // rather than an omission.
        //
        expect(sent(knowledgeGraphTablesUrl('Facts', { Uri: 'urn:x', Day: null })))
            .toEqual(['Uri']);
        expect(sent(knowledgeGraphTablesUrl('Facts', { Uri: 'urn:x', Day: '' })))
            .toEqual(['Uri']);
    });

    it('encodes a value rather than interpolating it', () => {
        const url = knowledgeGraphTablesUrl('Find', { Text: 'a b&c=d' });

        expect(url.searchParams.get('Text')).toBe('a b&c=d');
        expect(String(url)).toContain('Text=a+b%26c%3Dd');
    });

    it('can be pointed elsewhere', () => {
        expect(String(knowledgeGraphTablesUrl('EdgeTypes', {}, 'https://example.com/t')))
            .toBe('https://example.com/t/edge-types');
    });
});

describe('the endpoints and the documentation', () => {
    it('keeps every endpoint under the one public api', () => {
        Object.values(ENDPOINTS).forEach(endpoint => expect(endpoint.startsWith(`${API}/`)).toBe(true));
    });

    it('links each api to its page on the documentation site', () => {
        expect(API_DOCS).toEqual({
            performance: `${DOCUMENTATION}/api/performance/`,
            datalake: `${DOCUMENTATION}/api/datalake/`,
            knowledgeGraph: `${DOCUMENTATION}/api/knowledge-graph/`,
        });
    });

    it('has a documentation page source for every page it links to', () => {
        //
        // the site builds api/performance/ from documentation/api/performance.md, so a
        // link with no page behind it would 404 however the site is deployed.
        //
        const pages = path.join(__dirname, '..', '..', '..', 'documentation', 'api');

        Object.values(API_DOCS).forEach(link => {
            const page = link.slice(`${DOCUMENTATION}/api/`.length, -1);
            expect({ page, exists: fs.existsSync(path.join(pages, `${page}.md`)) })
                .toEqual({ page, exists: true });
        });
    });
});

describe('what is sent is what is documented', () => {
    it('performance: exactly the parameters its report route declares', () => {
        //
        // per route, now that the document holds the archive's routes too. They
        // take no query string, so a document-wide answer would still agree --
        // but only by accident.
        //
        expect(sent(performanceUrl('bls', 'day', 'UTC')))
            .toEqual(declaredFor(documentOf('performance'), '/performance'));
    });

    it('performance archive: sends no query parameter, because its routes declare none', () => {
        const document = documentOf('performance');

        expect(sent(performanceArchiveUrl())).toEqual([]);
        expect(declaredFor(document, '/performance/archive')).toEqual([]);
        expect(declaredFor(document, '/performance/archive/{stream}/{year}')).toEqual([]);
        expect(declaredFor(document, '/performance/archive/{stream}/{year}/{month}')).toEqual([]);
    });

    it('performance: asks for the routes its document templates, save the archive\'s files', () => {
        //
        // the two file routes are documented and never built. The page links
        // each file where the listing says it is served: the api would answer
        // with a redirect to that same url, but a link to the api is
        // cross-origin, and a browser ignores `download` on one.
        //
        const document = documentOf('performance');
        const report = performanceUrl('bls', 'day', 'UTC');

        expect(Object.keys(document.paths).sort()).toEqual([
            '/performance',
            '/performance/archive',
            '/performance/archive/{stream}/{year}',
            '/performance/archive/{stream}/{year}/{month}',
        ]);
        expect(routeSent(document, report.origin + report.pathname)).toBe('/performance');
        expect(routeSent(document, performanceArchiveUrl())).toBe('/performance/archive');
    });

    it('datalake: exactly the parameters its document declares', () => {
        expect(sent(datalakeUrl('bls', 2026, 8))).toEqual(declared(documentOf('datalake')));
    });

    it('knowledge graph: its build routes send no query parameter, because they declare none', () => {
        //
        // the id moved to the path, and the api refuses a query string on either
        // build route -- so 'declared' being empty is the assertion, not an
        // omission. Asked per route rather than per document, because the tables
        // route below is nothing but a query string.
        //
        const document = documentOf('knowledge-graph');

        expect(sent(knowledgeGraphUrl(), knowledgeGraphUrl('x'))).toEqual([]);
        expect(declaredFor(document, '/knowledge-graph')).toEqual([]);
        expect(declaredFor(document, '/knowledge-graph/{graph}')).toEqual([]);
    });

    it.each([
        ['Days', 'days', {}],
        ['EdgeTypes', 'edge-types', { Day: '2026-09-23', Limit: 10 }],
        ['NodeTypes', 'node-types', { Day: '2026-09-23', Limit: 10 }],
        ['Find', 'find', { Text: 'apple', Day: '2026-09-23', Limit: 10 }],
        ['Facts', 'facts', { Uri: 'urn:x', Day: '2026-09-18', Limit: 10 }],
        ['Neighborhood', 'neighborhood', { Uri: 'urn:x', Day: '2026-09-18', Limit: 10 }],
        ['Quotes', 'quotes', { Symbol: 'NVDA', Day: '2026-09-23', Limit: 10 }],
        ['LastQuotes', 'last-quotes', { Day: '2026-09-23', Limit: 10 }],
    ])('knowledge graph tables: %s sends exactly what its own route declares', (operation, segment, values) => {
        //
        // per route, which is the point of the split. One route with a flat list
        // could only say that all four parameters are optional, which permitted
        // every combination the api rejects -- asked here the way the api
        // actually answers, one contract at a time.
        //
        expect(sent(knowledgeGraphTablesUrl(operation, values)))
            .toEqual(declaredFor(documentOf('knowledge-graph'), `/knowledge-graph/tables/${segment}`));
    });

    it('knowledge graph: asks for each of the routes its document templates', () => {
        //
        // the path replaces the query string as the thing that has to agree, so
        // it is checked the same way: what the application builds, against what
        // the document says exists.
        //
        const document = documentOf('knowledge-graph');
        const routes = Object.keys(document.paths).sort();

        expect(routes).toEqual([
            '/knowledge-graph',
            '/knowledge-graph/tables/days',
            '/knowledge-graph/tables/edge-types',
            '/knowledge-graph/tables/facts',
            '/knowledge-graph/tables/find',
            '/knowledge-graph/tables/last-quotes',
            '/knowledge-graph/tables/neighborhood',
            '/knowledge-graph/tables/node-types',
            '/knowledge-graph/tables/quotes',
            '/knowledge-graph/{graph}',
        ]);
        expect(routeSent(document, knowledgeGraphUrl())).toBe('/knowledge-graph');
        expect(routeSent(document, knowledgeGraphUrl('an-id')).replace(/\/[^/]+$/, '/{graph}'))
            .toBe('/knowledge-graph/{graph}');

        //
        // every operation, not a sample: a builder asking for a route the
        // document does not template is the failure this exists to catch, and
        // it can happen to one operation at a time.
        //
        Object.keys(TABLES_VALUES).forEach((operation) => {
            expect(routes).toContain(routeSent(document, knowledgeGraphTablesUrl(operation)));
        });
    });

    it('every stream a page asks performance about is a documented Stream', () => {
        expect(Object.keys(DATASETS).sort())
            .toEqual([...parameterOf(documentOf('performance'), 'Stream').schema.enum].sort());
    });

    it('every stream a page looks up in the archive is one the listing documents', () => {
        //
        // the alarm page finds a stream's files by its stream id, so a listing
        // that named its streams any other way would offer every stream nothing
        // -- quietly, as 'Nothing published yet'.
        //
        const document = documentOf('performance');
        const report = document.paths['/performance/archive'].get
            .responses['200'].content['application/json'].schema.properties.report;

        expect(Object.keys(DATASETS).sort()).toEqual([...report.properties.streams.items.enum].sort());
        expect(Object.keys(DATASETS).sort())
            .toEqual([...parameterOf(document, 'stream').schema.enum].sort());
    });

    it('every dataset a page asks the datalake about is a documented Data', () => {
        //
        // the fault this guards: a page sent the STREAM id 'stockmarket' where the
        // datalake names the dataset 'stock-market', and was answered with a 400.
        //
        expect(Object.values(DATASETS).sort())
            .toEqual([...parameterOf(documentOf('datalake'), 'Data').schema.enum].sort());
    });

    it('every rate the stream page offers is a documented Interval', () => {
        const documented = parameterOf(documentOf('performance'), 'Interval').schema.enum;

        ['Month', 'Day', 'Hour', 'Minute'].forEach(rate => {
            expect(documented).toContain(performanceUrl('bls', rate, 'UTC').searchParams.get('Interval'));
        });
    });
});
