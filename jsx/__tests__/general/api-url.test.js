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
    datalakeUrl,
    knowledgeGraphUrl,
    API,
    ENDPOINTS,
    DOCUMENTATION,
    API_DOCS,
    DATASETS,
} from '../../import/general/api-url.js';

const OPENAPI = path.join(__dirname, '..', '..', '..', 'documentation', 'api', 'openapi');

function documentOf(name) {
    return JSON.parse(fs.readFileSync(path.join(OPENAPI, `${name}.json`), 'utf8'));
}

function operationOf(document) {
    const [route] = Object.keys(document.paths);

    return document.paths[route].get;
}

function declared(document) {
    return operationOf(document).parameters.map(p => p.name).sort();
}

function parameterOf(document, name) {
    return operationOf(document).parameters.find(p => p.name === name);
}

function sent(...urls) {
    return [...new Set(urls.flatMap(url => [...new URL(String(url)).searchParams.keys()]))].sort();
}

describe('performanceUrl', () => {
    it('asks for one stream at one interval on the viewer\'s calendar', () => {
        expect(String(performanceUrl('bls', 'day', 'America/New_York'))).toBe(
            'https://api.jefflevesque.com/v1/public/performance'
            + '?Stream=bls&Interval=day&Timezone=America%2FNew_York'
        );
    });

    it('lower-cases the stream and the interval, which the pages hold capitalised', () => {
        const params = performanceUrl('StockMarket', 'Month', 'UTC').searchParams;

        expect(params.get('Stream')).toBe('stockmarket');
        expect(params.get('Interval')).toBe('month');
    });

    it('sends the time zone as given', () => {
        expect(performanceUrl('bls', 'day', 'Asia/Tokyo').searchParams.get('Timezone')).toBe('Asia/Tokyo');
    });

    it('can be pointed elsewhere', () => {
        expect(String(performanceUrl('bls', 'day', 'UTC', 'https://example.com/p')))
            .toMatch(/^https:\/\/example\.com\/p\?Stream=bls/);
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

    it('serialises the scale as the pages always have', () => {
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

    it('asks for one build by the id the listing gave', () => {
        const url = knowledgeGraphUrl('all-sources.2026-09.20260916T171546Z.1024d');

        expect(url.searchParams.get('Graph')).toBe('all-sources.2026-09.20260916T171546Z.1024d');
    });

    it('sends an id unchanged, however it is shaped', () => {
        //
        // ids are opaque: a caller that reshaped one would be guessing at a format it
        // does not own.
        //
        expect(knowledgeGraphUrl('a b/c?d').searchParams.get('Graph')).toBe('a b/c?d');
    });

    it('can be pointed elsewhere', () => {
        expect(String(knowledgeGraphUrl('x', 'https://example.com/g'))).toBe('https://example.com/g?Graph=x');
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
    it('performance: exactly the parameters its document declares', () => {
        expect(sent(performanceUrl('bls', 'day', 'UTC'))).toEqual(declared(documentOf('performance')));
    });

    it('datalake: exactly the parameters its document declares', () => {
        expect(sent(datalakeUrl('bls', 2026, 8))).toEqual(declared(documentOf('datalake')));
    });

    it('knowledge graph: exactly the parameters its document declares, across both requests', () => {
        expect(sent(knowledgeGraphUrl(), knowledgeGraphUrl('x'))).toEqual(declared(documentOf('knowledge-graph')));
    });

    it('every stream a page asks performance about is a documented Stream', () => {
        expect(Object.keys(DATASETS).sort())
            .toEqual([...parameterOf(documentOf('performance'), 'Stream').schema.enum].sort());
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
