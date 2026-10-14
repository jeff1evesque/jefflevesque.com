/**
 * source.test.js: where the model pages get what they draw (#243): the model
 * api's listing and a model's two reports, each read in a worker.
 *
 * fetch is replaced, so each case says what the api answers. The worker is the
 * real one, run in this process: WorkerBuilder is replaced by a stand-in that
 * hands each message to worker/model/report.js the way a browser's worker
 * would, an answer later. worker/model-report.test.js covers what the worker
 * makes of an answer; these cases cover the requests, the envelope, and what
 * becomes of a failure.
 */

jest.mock('../../../import/worker/web-worker.js', () => {
    const run = jest.requireActual('../../../import/worker/model/report.js').default;

    return {
        __esModule: true,
        default: class MockWorkerBuilder {
            constructor() {
                global.__model_workers = (global.__model_workers || 0) + 1;
                this.terminated = false;
            }

            postMessage(data) {
                if (global.__model_worker_fails) {
                    setTimeout(() => this.onerror(new Error('worker failed')), 0);
                    return;
                }

                const posted = [];
                const realPostMessage = global.self.postMessage;

                global.self.postMessage = (answer) => posted.push(answer);
                run();
                global.self.onmessage({ data: data });
                global.self.postMessage = realPostMessage;
                global.self.onmessage = null;

                setTimeout(() => this.onmessage({ data: posted[0] }), 0);
            }

            terminate() {
                this.terminated = true;
            }
        },
    };
});

import { MODEL, loadListing, loadReport, readInWorker } from '../../../import/layout/model/source.js';
import { ENDPOINTS } from '../../../import/general/api-url.js';
import { listingOf } from '../../../test-support/model-fixtures.js';

function answers(body, ok = true, status = 200) {
    global.fetch = jest.fn(() => Promise.resolve({
        ok: ok,
        status: status,
        headers: { get: () => null },
        json: () => Promise.resolve(body),
    }));
}

//
// the addresses fetch was asked for, as text
//
function asked() {
    return global.fetch.mock.calls.map((call) => String(call[0]));
}

let logged;

beforeEach(() => {
    logged = jest.spyOn(console, 'log').mockImplementation(() => {});
    global.__model_worker_fails = false;
});

afterEach(() => {
    logged.mockRestore();
    delete global.fetch;
});

describe('the listing', () => {
    it('is asked of the model api, with no parameters', async () => {
        answers({ report: listingOf() });

        await loadListing();

        expect(MODEL).toBe(ENDPOINTS.model);
        expect(asked()).toEqual([String(MODEL)]);
    });

    it('resolves to its tasks and models', async () => {
        answers({ report: listingOf() });

        const listing = await loadListing();

        expect(listing.tasks.map((task) => task.id)).toEqual(['direction', 'beats']);
        expect(listing.models.map((model) => model.name)).toEqual(['pt-gnn', 'tables', 'fresh', 'beater']);
    });

    it('resolves to null, and says why, where the api turns it down -- as it does until it is built', async () => {
        answers({ message: 'Forbidden' }, false, 403);

        expect(await loadListing()).toBeNull();
        expect(logged).toHaveBeenCalledWith(`Error: ${MODEL} listing returned status 403`);
    });

    it('resolves to null for an answer that is not a listing', async () => {
        answers({ report: 'not a listing' });

        expect(await loadListing()).toBeNull();
    });

    it('resolves to null where the request never lands', async () => {
        global.fetch = jest.fn(() => Promise.reject(new TypeError('offline')));

        expect(await loadListing()).toBeNull();
        expect(logged.mock.calls[0][0]).toMatch(/listing returned TypeError: offline/);
    });

    it('can be asked of another base', async () => {
        answers({ report: listingOf() });

        await loadListing('https://example.test/model');

        expect(asked()).toEqual(['https://example.test/model']);
    });
});

describe('a report', () => {
    it('is asked for by its model and its kind', async () => {
        answers({ report: 'day,loss\n2026-10-12,1.6' });

        await loadReport('pt-gnn', 'track-record');

        expect(asked()).toEqual([`${MODEL}?Model=pt-gnn&Report=track-record`]);
    });

    it('resolves to its rows, oldest first', async () => {
        answers({ report: 'day,kind,went_live,attempt_loss\n2026-10-13,nightly,false,1.7\n2026-10-12,weekly,true,1.6' });

        const rows = await loadReport('pt-gnn', 'history');

        expect(rows.map((row) => row.day)).toEqual(['2026-10-12', '2026-10-13']);
    });

    it('resolves to no rows for a model with none yet, which is not a failure', async () => {
        answers({ report: null });

        expect(await loadReport('pt-gnn', 'history')).toEqual([]);
    });

    it('resolves to null, and asks for nothing, for a kind the api does not keep', async () => {
        answers({ report: '' });

        expect(await loadReport('pt-gnn', 'forecast')).toBeNull();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(logged.mock.calls[0][0]).toMatch(/Model=pt-gnn Report=forecast returned Error: modelUrl/);
    });

    it('resolves to null for an answer that is not a report', async () => {
        answers({ report: { rows: [] } });

        expect(await loadReport('pt-gnn', 'track-record')).toBeNull();
    });
});

describe('the worker', () => {
    it('answers what the report worker posts, and is let go once it has', async () => {
        const read = await readInWorker('list', listingOf());

        expect(read.kind).toBe('list');
        expect(read.models).toHaveLength(4);
    });

    it('resolves to null where it cannot run, and every load that leans on it does too', async () => {
        global.__model_worker_fails = true;
        answers({ report: listingOf() });

        expect(await readInWorker('list', listingOf(), null)).toBeNull();
        expect(logged).toHaveBeenCalledWith('Error (web-worker): could not read the model report');
        expect(await loadListing()).toBeNull();
        expect(await loadReport('pt-gnn', 'history')).toBeNull();
    });
});
