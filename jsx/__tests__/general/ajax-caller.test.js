/**
 * ajax-caller.test.js: the POST helper.
 *
 * Callback-based rather than promise-based, and it swallows every failure into
 * callbackFail, so a caller never sees a rejection. What matters is that the two
 * callbacks are exclusive and that the failure one receives enough to act on.
 */

import ajaxCaller from '../../import/general/ajax-caller.js';

const ARGS = {
    endpoint: 'https://example.com/api',
    data: 'a=1',
    contentType: 'application/x-www-form-urlencoded',
};

afterEach(() => {
    delete global.fetch;
});

function mockOk(json) {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(json),
    });
}

function mockNotOk(status, statusText) {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status, statusText });
}

const flush = () => new Promise(r => setTimeout(r, 0));

describe('a successful call', () => {
    it('posts to the endpoint with the body and content type', async () => {
        mockOk({ ok: 1 });

        ajaxCaller(() => {}, () => {}, ARGS);
        await flush();

        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe(ARGS.endpoint);
        expect(options.method).toBe('post');
        expect(options.body).toBe('a=1');
        expect(options.headers['Content-Type']).toBe(ARGS.contentType);
    });

    it('sends credentials, so the session cookie travels', () => {
        mockOk({});

        ajaxCaller(() => {}, () => {}, ARGS);

        expect(global.fetch.mock.calls[0][1].credentials).toBe('include');
    });

    it('hands the parsed json to the done callback', async () => {
        const done = jest.fn();
        const fail = jest.fn();
        mockOk({ total: 3 });

        ajaxCaller(done, fail, ARGS);
        await flush();

        expect(done).toHaveBeenCalledWith({ total: 3 });
        expect(fail).not.toHaveBeenCalled();
    });

    it('omits the content type header when none is given', async () => {
        //
        // sending 'Content-Type: undefined' would be worse than sending none: some
        // servers reject the request outright rather than inferring.
        //
        mockOk({});

        ajaxCaller(() => {}, () => {}, { ...ARGS, contentType: undefined });
        await flush();

        expect(global.fetch.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');
    });

    it('omits it for an explicit null too', async () => {
        mockOk({});

        ajaxCaller(() => {}, () => {}, { ...ARGS, contentType: null });
        await flush();

        expect(global.fetch.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');
    });
});

describe('a failed call', () => {
    it('reports the status text and code to the fail callback', async () => {
        const done = jest.fn();
        const fail = jest.fn();
        mockNotOk(503, 'Service Unavailable');

        ajaxCaller(done, fail, ARGS);
        await flush();

        expect(fail).toHaveBeenCalledWith('Service Unavailable', 503);
        expect(done).not.toHaveBeenCalled();
    });

    it('routes a network rejection to the fail callback as undefined', async () => {
        //
        // WORTH KNOWING: the catch reads e.statusText and e.status, which a real
        // Error does not carry. So a network failure calls back with
        // (undefined, undefined) -- the caller is told it failed but not why.
        //
        const fail = jest.fn();
        global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

        ajaxCaller(() => {}, fail, ARGS);
        await flush();

        expect(fail).toHaveBeenCalledWith(undefined, undefined);
    });

    it('never rejects to the caller', async () => {
        //
        // every failure path ends in callbackFail, so ajaxCaller itself cannot
        // produce an unhandled rejection.
        //
        global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

        expect(() => ajaxCaller(() => {}, () => {}, ARGS)).not.toThrow();
        await flush();
    });
});
