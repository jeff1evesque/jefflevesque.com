/**
 * get-data-distribution.test.js: the four per-stream distribution loaders.
 *
 * bls.js, sec.js, stock-market.js and us-weather-alert.js are four separate
 * modules that share one contract, so they are driven from one table here rather
 * than duplicated into four suites.
 *
 * They also share their implementation, which is the thing worth recording. The
 * first 117 lines of each -- isValidUrl, get_promise, and the function signatures
 * -- are IDENTICAL across all four; the only textual difference in that span is
 * the filename inside the opening docstring. That is roughly 460 lines of copied
 * infrastructure, and it means a fix to the fetch or error handling has to be
 * made four times or it is only made once.
 *
 * Only the get() body differs, and by a lot: 43 lines for bls against 180 for
 * stock-market. That part is genuinely per stream.
 *
 * Note: the body shape is NOT the same as get-data.js's, despite the shared
 *       function names. There, 'report' holds csv text; here it holds an OBJECT
 *       with a 'data-distribution' section and a 'partition' section, and both
 *       must be present or the whole response is rejected. The callback then fires
 *       twice, once per section.
 *
 * Note: the tests drive fetch rather than mocking the loaders, because the copied
 *       code IS the fetch and error handling -- mocking it away would test
 *       nothing.
 */

jest.mock('react-papaparse', () => ({
    readString: jest.fn(),
    readRemoteFile: jest.fn(),
}));

import { readString } from 'react-papaparse';

import getBls from '../../import/general/get-data/distribution/bls.js';
import getSec from '../../import/general/get-data/distribution/sec.js';
import getStockMarket from '../../import/general/get-data/distribution/stock-market.js';
import getUsWeatherAlert from '../../import/general/get-data/distribution/us-weather-alert.js';

const URL = 'https://example.com/distribution.csv';

const ROWS = [{ category: 'Reports', series: 'CPI', total_records: '12' }];

//
// the body shape all four require: a 'report' object carrying BOTH sections.
// Either one missing sends the whole response down the rejection path.
//
const REPORT = {
    report: {
        'data-distribution': 'total_records,category,series\n1,Reports,CPI',
        'partition': 'count\n3',
    },
};

//
// the four modules under test, named as data.jsx imports them.
//
const LOADERS = [
    ['bls', getBls],
    ['sec', getSec],
    ['stock-market', getStockMarket],
    ['us-weather-alert', getUsWeatherAlert],
];

beforeEach(() => {
    jest.clearAllMocks();
    readString.mockImplementation((csv, options) => {
        if (options && options.complete) {
            options.complete({ data: ROWS });
        }
        return { data: ROWS };
    });
});

afterEach(() => {
    delete global.fetch;
});

function mockFetch(json, ok = true) {
    global.fetch = jest.fn().mockResolvedValue({
        ok,
        json: () => Promise.resolve(json),
    });
}

describe('all four expose the same shape', () => {
    it.each(LOADERS)('%s exports a function', (name, loader) => {
        expect(typeof loader).toBe('function');
    });

    it.each(LOADERS)('%s logs and returns undefined for an unrecognised type', (name, loader) => {
        //
        // all four accept exactly one type. Anything else logs
        // 'not a valid choice' and returns undefined, with no request made.
        //
        global.fetch = jest.fn();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        expect(loader('not-a-type', URL, () => {})).toBeUndefined();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(quiet).toHaveBeenCalled();

        quiet.mockRestore();
    });
});

describe('the shared fetch path', () => {
    it.each(LOADERS)('%s fetches the url with GET', async (name, loader) => {
        mockFetch(REPORT);

        await loader('data-distribution', URL, () => {});

        expect(global.fetch).toHaveBeenCalledWith(URL, { method: 'GET' });
    });

    it.each(LOADERS)('%s delivers distribution and partition separately', async (name, loader) => {
        //
        // the callback fires TWICE per load, once per section, rather than once
        // with both. A caller that assumed a single call would see only whichever
        // arrived last.
        //
        const callback = jest.fn();
        mockFetch(REPORT);

        await loader('data-distribution', URL, callback);

        expect(callback).toHaveBeenCalledTimes(2);
        const keys = callback.mock.calls.map(c => Object.keys(c[0]).filter(k => k !== 'source' && k !== 'stream')[0]);
        expect(keys.sort()).toEqual(['data-distribution', 'partition']);
    });

    it.each(LOADERS)('%s tags every callback with source and stream', async (name, loader) => {
        //
        // load-bearing: data.jsx fires all four of these at once and has no other
        // way to tell the responses apart, since they arrive out of order. Both
        // calls have to carry the tags, not just the first.
        //
        const callback = jest.fn();
        mockFetch(REPORT);

        await loader('data-distribution', URL, callback, false, 'src-tag', 'stream-tag');

        callback.mock.calls.forEach(([arg]) => {
            expect(arg.source).toBe('src-tag');
            expect(arg.stream).toBe('stream-tag');
        });
    });

    it.each(LOADERS)('%s defaults source and stream to null', async (name, loader) => {
        const callback = jest.fn();
        mockFetch(REPORT);

        await loader('data-distribution', URL, callback);

        expect(callback.mock.calls[0][0].source).toBeNull();
        expect(callback.mock.calls[0][0].stream).toBeNull();
    });

    it.each(LOADERS)('%s skips empty lines greedily', async (name, loader) => {
        //
        // the api pads its csv with trailing ',,,' rows; without this option they
        // arrive as blank records and render as an empty chart segment.
        //
        mockFetch(REPORT);

        await loader('data-distribution', URL, () => {});

        readString.mock.calls.forEach(([, options]) => {
            expect(options.skipEmptyLines).toBe('greedy');
        });
    });

    it.each(LOADERS)('%s parses with a header row', async (name, loader) => {
        mockFetch(REPORT);

        await loader('data-distribution', URL, () => {});

        readString.mock.calls.forEach(([, options]) => {
            expect(options.header).toBe(true);
        });
    });
});

describe('the shared failure paths', () => {
    it.each(LOADERS)('%s calls back with nulls when a section parses to nothing', async (name, loader) => {
        const callback = jest.fn();
        mockFetch(REPORT);
        readString.mockImplementation((csv, options) => {
            options.complete({});
            return {};
        });

        await loader('data-distribution', URL, callback);

        expect(callback).toHaveBeenCalledWith({ 'data-distribution': null, source: null, stream: null });
        expect(callback).toHaveBeenCalledWith({ partition: null, source: null, stream: null });
    });

    it.each(LOADERS)('%s swallows a report missing the partition section', async (name, loader) => {
        //
        // BOTH sections are required. A body carrying only 'data-distribution'
        // falls through to the rejection and is logged -- the caller is told
        // nothing at all rather than being given the half that arrived.
        //
        const callback = jest.fn();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockFetch({ report: { 'data-distribution': 'category,series\nReports,CPI' } });

        await loader('data-distribution', URL, callback);

        expect(callback).not.toHaveBeenCalled();
        expect(quiet).toHaveBeenCalled();

        quiet.mockRestore();
    });

    it.each(LOADERS)('%s swallows a non-ok response without calling back', async (name, loader) => {
        //
        // a failed request must not take the chart down, so it is logged and
        // dropped. The cost, shared by all four: a failure is indistinguishable
        // from a request still in flight.
        //
        const callback = jest.fn();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockFetch({}, false);

        await loader('data-distribution', URL, callback);

        expect(callback).not.toHaveBeenCalled();
        expect(quiet).toHaveBeenCalled();

        quiet.mockRestore();
    });

    it.each(LOADERS)('%s swallows a body with no report key', async (name, loader) => {
        const callback = jest.fn();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockFetch({ unexpected: true });

        await loader('data-distribution', URL, callback);

        expect(callback).not.toHaveBeenCalled();
        expect(quiet).toHaveBeenCalled();

        quiet.mockRestore();
    });

    it.each(LOADERS)('%s swallows a network failure', async (name, loader) => {
        const callback = jest.fn();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

        await loader('data-distribution', URL, callback);

        expect(callback).not.toHaveBeenCalled();
        expect(quiet).toHaveBeenCalled();

        quiet.mockRestore();
    });
});

describe('the fallback path, given no url', () => {
    it.each(LOADERS)('%s serves embedded sample data without touching the network', async (name, loader) => {
        //
        // WORTH KNOWING: not an error path. A caller with no url gets sample data
        // shaped like the real thing, so the chart renders and looks correct.
        // There is no warning.
        //
        const callback = jest.fn();
        global.fetch = jest.fn();

        await loader('data-distribution', null, callback);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(callback).toHaveBeenCalledTimes(2);
    });

    it.each(LOADERS)('%s reads its sample partition from a differently named key', async (name, loader) => {
        //
        // DOCUMENTS AN INCONSISTENCY, harmless but confusing: the fetch path reads
        // json.report.partition, while the fallback builds an object keyed
        // 'count' and reads url['count']. Two names for the same section, and both
        // then call back under the key 'partition'.
        //
        const callback = jest.fn();

        await loader('data-distribution', null, callback);

        const keys = callback.mock.calls.map(c => Object.keys(c[0]).filter(k => k !== 'source' && k !== 'stream')[0]);
        expect(keys).toContain('partition');
        expect(keys).not.toContain('count');
    });
});

describe('the fallback path, when a sample section parses to nothing', () => {
    it.each(LOADERS)('%s calls back with nulls rather than omitting the section', async (name, loader) => {
        //
        // the same guard as the fetch path, written a second time further down
        // the file -- the fallback builds its own pair of readString calls
        // rather than routing the sample csv through the ones above. Only the
        // fetch copy was exercised, so a caller of the fallback had no evidence
        // it degraded the same way.
        //
        const callback = jest.fn();
        global.fetch = jest.fn();
        readString.mockImplementation((csv, options) => {
            options.complete({});
            return {};
        });

        await loader('data-distribution', null, callback);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(callback).toHaveBeenCalledWith({ 'data-distribution': null, source: null, stream: null });
        expect(callback).toHaveBeenCalledWith({ partition: null, source: null, stream: null });
    });
});

describe('the shared failure paths, continued', () => {
    it.each(LOADERS)('%s logs a non-object rejection without stringifying it', async (name, loader) => {
        //
        // the catch has two arms because JSON.stringify on a bare string yields
        // a quoted string rather than the message, so a rejection that is not
        // an object is logged as itself. fetch rejects with an Error in
        // practice, which is why only the object arm had ever run.
        //
        const callback = jest.fn();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        global.fetch = jest.fn().mockRejectedValue('offline');

        await loader('data-distribution', URL, callback);

        expect(callback).not.toHaveBeenCalled();
        expect(quiet).toHaveBeenCalledWith(expect.stringContaining('offline'));
        expect(quiet).not.toHaveBeenCalledWith(expect.stringContaining('"offline"'));

        quiet.mockRestore();
    });
});

describe('the argument defaults', () => {
    it.each(LOADERS)('%s serves the sample data when called with only a type', async (name, loader) => {
        //
        // 'url' defaults to null and 'callback' to a no-op, so the one argument
        // form is a complete call rather than a crash: it takes the fallback
        // branch and parses the sample csv with nothing to hand the rows to.
        // data.jsx always passes both, which is why neither default was covered.
        //
        global.fetch = jest.fn();

        await expect(loader('data-distribution')).resolves.toBeDefined();

        expect(global.fetch).not.toHaveBeenCalled();
        expect(readString).toHaveBeenCalled();
    });
});

describe('the duplication itself', () => {
    it('all four behave identically on the shared failure path', async () => {
        //
        // The claim in the file header: the fetch and error handling are copied,
        // not shared. If one module is ever fixed in isolation, this is what
        // notices -- the four stop agreeing.
        //
        const observed = [];

        for (const [, loader] of LOADERS) {
            const callback = jest.fn();
            mockFetch(REPORT);
            readString.mockImplementation((csv, options) => {
                options.complete({});
                return {};
            });

            await loader('data-distribution', URL, callback);

            observed.push(JSON.stringify(callback.mock.calls));
            delete global.fetch;
        }

        expect(new Set(observed).size).toBe(1);
    });
});
