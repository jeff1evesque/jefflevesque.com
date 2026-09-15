/**
 * get-graph-schema.test.js: fetching a published graph schema.
 *
 * Two calls, and the second depends on the first: the listing says which builds
 * exist and which is the default, and only then can a schema be asked for by id.
 * There is no single-request shortcut to test.
 *
 * Note: every failure resolves to null rather than rejecting. The front page
 *       draws no cluster for a pending fetch, a failed one and an unusable
 *       payload alike, so distinguishing them here would only invite a caller to
 *       branch three ways into the same outcome. What each case asserts is that
 *       it reaches null WITHOUT throwing, and without logging through a channel
 *       that fails the suite.
 *
 * Note: console.log, not console.error. setup.js turns an unexpected
 *       console.error or console.warn into a failed test, and a front page that
 *       cannot reach the graph api is not a defect in whatever mounted it -- so
 *       the logging channel is part of the contract, and is asserted.
 */

import getGraphSchema, { KNOWLEDGE_GRAPH } from '../../import/general/get-graph-schema.js';

const BUILD_ID = 'example-build-id';

const LISTING = {
    report: {
        default: BUILD_ID,
        graphs: [{ id: BUILD_ID, nodes: 1_000 }],
    },
};

const SCHEMA = {
    report: {
        version: '1.3',
        node_types: { example_Type: { count: 1_000, category: 'entity' } },
        edge_types: {},
    },
};

function ok(body) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function notOk(status) {
    return Promise.resolve({ ok: false, status: status, json: () => Promise.resolve({}) });
}

//
// answer each call in order, so the listing and the schema request can differ and a
// test can fail only the second one.
//
function answering(...responses) {
    const fetcher = jest.fn();
    responses.forEach(response => fetcher.mockImplementationOnce(() => response));
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

describe('the happy path', () => {
    it('resolves the schema behind the default id', async () => {
        answering(ok(LISTING), ok(SCHEMA));

        await expect(getGraphSchema()).resolves.toEqual(SCHEMA.report);
    });

    it('asks for the listing first, with no query string', async () => {
        const fetcher = answering(ok(LISTING), ok(SCHEMA));

        await getGraphSchema();

        expect(String(fetcher.mock.calls[0][0])).toBe(KNOWLEDGE_GRAPH);
    });

    it('asks for the schema by the id the listing named', async () => {
        //
        // ids are opaque and come from the listing -- the caller never builds one.
        //
        const fetcher = answering(ok(LISTING), ok(SCHEMA));

        await getGraphSchema();

        const url = new URL(String(fetcher.mock.calls[1][0]));
        expect(url.searchParams.get('Graph')).toBe(BUILD_ID);
    });

    it('sends the parameter as Graph, capitalised', async () => {
        //
        // the service accepts 'Graph' and nothing else -- a lowercase 'graph' comes
        // back as a 400 rather than being tolerated.
        //
        const fetcher = answering(ok(LISTING), ok(SCHEMA));

        await getGraphSchema();

        expect(String(fetcher.mock.calls[1][0])).toContain('Graph=');
    });

    it('makes exactly two requests', async () => {
        const fetcher = answering(ok(LISTING), ok(SCHEMA));

        await getGraphSchema();

        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('unwraps the report envelope', async () => {
        //
        // every api-* service answers inside 'report', and the component takes the
        // document itself -- so a caller handed the envelope would read node_types as
        // undefined.
        //
        answering(ok(LISTING), ok(SCHEMA));

        const schema = await getGraphSchema();

        expect(schema).not.toHaveProperty('report');
        expect(schema).toHaveProperty('node_types');
    });

    it('accepts a base url other than the default', async () => {
        const fetcher = answering(ok(LISTING), ok(SCHEMA));

        await getGraphSchema('https://example.com/graph');

        expect(String(fetcher.mock.calls[0][0])).toBe('https://example.com/graph');
    });
});

describe('when the listing cannot be had', () => {
    it('answers null for a rejected fetch', async () => {
        answering(Promise.reject(new Error('offline')));

        await expect(getGraphSchema()).resolves.toBeNull();
    });

    it('answers null for a non-ok response', async () => {
        answering(notOk(500));

        await expect(getGraphSchema()).resolves.toBeNull();
    });

    it('answers null for a body with no report', async () => {
        answering(ok({ something: 'else' }));

        await expect(getGraphSchema()).resolves.toBeNull();
    });

    it('never asks for a schema', async () => {
        const fetcher = answering(notOk(503));

        await getGraphSchema();

        expect(fetcher).toHaveBeenCalledTimes(1);
    });
});

describe('when the listing has nothing servable', () => {
    //
    // 'default' can be null when the listing holds no usable build. Asking for it
    // anyway would send '?Graph=null' and be rejected.
    //
    it('answers null for a null default', async () => {
        answering(ok({ report: { default: null, graphs: [] } }));

        await expect(getGraphSchema()).resolves.toBeNull();
    });

    it('does not request a schema', async () => {
        const fetcher = answering(ok({ report: { default: null, graphs: [] } }));

        await getGraphSchema();

        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('answers null for an empty report', async () => {
        answering(ok({ report: null }));

        await expect(getGraphSchema()).resolves.toBeNull();
    });
});

describe('when the schema itself cannot be had', () => {
    it('answers null for a rejected second fetch', async () => {
        answering(ok(LISTING), Promise.reject(new Error('dropped')));

        await expect(getGraphSchema()).resolves.toBeNull();
    });

    it('answers null when the build vanished between listing and reading', async () => {
        //
        // a listed build can stop being available before it is fetched, so a 404 on
        // the second call is a normal outcome rather than a caller error.
        //
        answering(ok(LISTING), notOk(404));

        await expect(getGraphSchema()).resolves.toBeNull();
    });

    it('answers null for a malformed schema response', async () => {
        answering(ok(LISTING), ok({ no_report: true }));

        await expect(getGraphSchema()).resolves.toBeNull();
    });
});

describe('how a failure is reported', () => {
    it('logs through console.log rather than console.error', async () => {
        //
        // setup.js fails any test that logs an error or a warning, so this is what
        // keeps an unreachable api from reddening every suite that mounts the page.
        //
        answering(notOk(500));

        await getGraphSchema();

        expect(quiet).toHaveBeenCalled();
    });

    it('names the endpoint and the status', async () => {
        answering(notOk(503));

        await getGraphSchema();

        const logged = quiet.mock.calls.map(c => String(c[0])).join(' ');
        expect(logged).toContain(KNOWLEDGE_GRAPH);
        expect(logged).toContain('503');
    });

    it('does not reject', async () => {
        //
        // the caller does a bare .then() -- an unhandled rejection here would surface
        // as an unhandled promise rather than as an empty backdrop.
        //
        answering(Promise.reject(new Error('offline')));

        await expect(getGraphSchema()).resolves.toBeNull();
    });
});
