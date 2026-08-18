/**
 * get-data.test.js: the data loader every chart goes through.
 *
 * One 431 line function dispatching on a 'type' string. Each branch has the same
 * shape: given a url it calls a real loader, and given no url it falls back to a
 * hardcoded sample csv embedded in the module. That fallback is most of the
 * file's length, and it means a caller that forgets a url gets plausible-looking
 * demo data rather than an error -- which is the single most important thing to
 * pin here, because it fails silently.
 *
 * The loaders themselves are mocked. What is under test is dispatch: which loader
 * each type reaches, in what argument order, and what happens on the paths where
 * the api answers badly.
 *
 * Note: 'ingest' types go through the private get_promise, which expects the
 *       response body to carry a 'report' key holding csv text. Those paths are
 *       driven through fetch rather than through the loader mocks.
 */

jest.mock('../../import/general/parse-csv.js', () => ({
    parseCsv: jest.fn(),
    papaParseCsv: jest.fn(),
}));

jest.mock('react-papaparse', () => ({
    readString: jest.fn(),
}));

import { readString } from 'react-papaparse';
import { papaParseCsv, parseCsv } from '../../import/general/parse-csv.js';
import getData from '../../import/general/get-data.js';

const URL = 'https://example.com/report.csv';

const ROWS = [{ group_by: 'bls', total_success: '292' }];

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

describe('list-months', () => {
    it('returns the twelve month names in order', () => {
        //
        // the one branch that is pure: no url, no loader, no io. It backs a select
        // control, so order is the contract.
        //
        expect(getData('list-months')).toEqual([
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
        ]);
    });

    it('ignores a url, since it fetches nothing', () => {
        getData('list-months', URL);

        expect(parseCsv).not.toHaveBeenCalled();
        expect(papaParseCsv).not.toHaveBeenCalled();
    });
});

describe('an unrecognised type', () => {
    it('returns undefined rather than throwing', () => {
        //
        // every branch is an else-if with no trailing else, so an unknown type
        // falls out of the chain and the function returns undefined. The caller
        // sees no data and no error.
        //
        expect(getData('not-a-type', URL)).toBeUndefined();
    });

    it('reaches no loader at all', () => {
        getData('not-a-type', URL, () => {});

        expect(parseCsv).not.toHaveBeenCalled();
        expect(papaParseCsv).not.toHaveBeenCalled();
    });
});

describe('dispatch, given a url', () => {
    it.each([
        ['stock-split-report'],
        ['ticker-custom'],
        ['ticker-nasdaq'],
        ['stock-market-candlestick-triggers'],
    ])('%s reads through parseCsv', (type) => {
        getData(type, URL);

        expect(parseCsv).toHaveBeenCalled();
        expect(parseCsv.mock.calls[0][0]).toBe(URL);
    });

    it('stock-split reads through papaParseCsv, with the callback and tags', () => {
        //
        // papaParseCsv rather than parseCsv because this branch is callback
        // driven: the split chart is fed asynchronously and tagged so a caller
        // firing several loads at once can tell the results apart.
        //
        const callback = jest.fn();

        getData('stock-split', URL, callback, false, 'stockmarket', 'split');

        expect(papaParseCsv).toHaveBeenCalled();
        const [csv, cb, worker, , header, source, stream] = papaParseCsv.mock.calls[0];
        expect(csv).toBe(URL);
        expect(cb).toBe(callback);
        expect(worker).toBe(false);
        expect(header).toBe(true);
        expect(source).toBe('stockmarket');
        expect(stream).toBe('split');
    });

    it('forwards the worker flag', () => {
        getData('stock-split', URL, () => {}, true);

        expect(papaParseCsv.mock.calls[0][2]).toBe(true);
    });
});

describe('dispatch, given no url: the embedded sample data', () => {
    it.each([
        ['stock-split', 'parseCsv'],
        ['bls-ingest', 'papaParseCsv'],
        ['stock-split-report', 'parseCsv'],
        ['ticker-custom', 'parseCsv'],
    ])('%s silently falls back to a hardcoded csv', (type, loader) => {
        //
        // WORTH KNOWING: this is not an error path. A caller that omits the url --
        // or passes one that resolves to null -- gets sample data shaped exactly
        // like the real thing, so the chart renders and looks right. There is no
        // warning of any kind.
        //
        getData(type, null, () => {});

        const used = loader === 'parseCsv' ? parseCsv : papaParseCsv;
        expect(used).toHaveBeenCalled();
        expect(used.mock.calls[0][0]).not.toBe(URL);
        expect(typeof used.mock.calls[0][0]).toBe('string');
        expect(used.mock.calls[0][0]).toContain(',');
    });

    it('the sample data is csv text, not a url', () => {
        getData('bls-ingest', null, () => {});

        const csv = papaParseCsv.mock.calls[0][0];
        expect(csv).toContain('group_by');
        expect(csv).toContain('total_success');
    });

    it('reaches no network', () => {
        global.fetch = jest.fn();

        getData('bls-ingest', null, () => {});

        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('stock-split changes delivery mechanism between its two paths', () => {
        //
        // DOCUMENTS AN INCONSISTENCY.
        //
        // With a url this branch calls papaParseCsv, which is CALLBACK driven and
        // returns nothing useful. Without one it calls parseCsv, which is PROMISE
        // driven and never invokes the callback at all:
        //
        //     if (url) { papaParseCsv(url, callback, ...) }
        //     else     { parseCsv(csv, false) }
        //
        // So how a caller receives the data depends on whether a url was
        // supplied. Code written against the callback silently receives nothing
        // in the fallback path, and code written against the promise receives
        // nothing in the real one.
        //
        const callback = jest.fn();

        getData('stock-split', URL, callback);
        expect(papaParseCsv).toHaveBeenCalled();
        expect(parseCsv).not.toHaveBeenCalled();

        jest.clearAllMocks();

        getData('stock-split', null, callback);
        expect(parseCsv).toHaveBeenCalled();
        expect(papaParseCsv).not.toHaveBeenCalled();
    });
});

describe('the ingest types, through get_promise', () => {
    it('fetches the url and hands the parsed report to the callback', async () => {
        const callback = jest.fn();
        mockFetch({ report: 'group_by,total_success\nbls,292' });

        await getData('bls-ingest', URL, callback, false, 'bls', 'cpi');

        expect(global.fetch).toHaveBeenCalledWith(URL, { method: 'GET' });
        expect(callback).toHaveBeenCalledWith({
            data: ROWS,
            source: 'bls',
            stream: 'cpi',
        });
    });

    it('calls back with null data when the report is empty', async () => {
        //
        // an empty report is an ordinary answer -- a window with nothing in it --
        // so the callback still fires, with data null, and the caller can tell
        // "no rows" from "never answered".
        //
        const callback = jest.fn();
        mockFetch({ report: '' });

        await getData('bls-ingest', URL, callback);

        expect(callback).toHaveBeenCalledWith({
            data: null,
            source: null,
            stream: null,
        });
    });

    it('calls back with null data when the parse yields nothing', async () => {
        const callback = jest.fn();
        mockFetch({ report: 'header-only' });
        readString.mockImplementation((csv, options) => {
            options.complete({});
            return {};
        });

        await getData('bls-ingest', URL, callback);

        expect(callback).toHaveBeenCalledWith({
            data: null,
            source: null,
            stream: null,
        });
    });

    it('swallows a non-ok response, logging rather than calling back', async () => {
        //
        // a failed request must not take the chart down, so the rejection is
        // caught and logged. The cost is that the caller is never told: no
        // callback fires at all, which is indistinguishable from a request still
        // in flight.
        //
        const callback = jest.fn();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockFetch({}, false);

        await getData('bls-ingest', URL, callback);

        expect(callback).not.toHaveBeenCalled();
        expect(quiet).toHaveBeenCalled();

        quiet.mockRestore();
    });

    it('swallows a body with no report key', async () => {
        const callback = jest.fn();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockFetch({ unexpected: true });

        await getData('bls-ingest', URL, callback);

        expect(callback).not.toHaveBeenCalled();
        expect(quiet).toHaveBeenCalled();

        quiet.mockRestore();
    });

    it('swallows a network failure', async () => {
        const callback = jest.fn();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

        await getData('bls-ingest', URL, callback);

        expect(callback).not.toHaveBeenCalled();
        expect(quiet).toHaveBeenCalled();

        quiet.mockRestore();
    });

    it('logs a non-object rejection as itself', async () => {
        //
        // the catch splits on 'typeof e', because JSON.stringify of a bare string
        // yields a quoted string rather than the message. fetch rejects with an
        // Error in practice, so only the object arm above had ever run -- the
        // same untested pair sits in all four distribution loaders.
        //
        const callback = jest.fn();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        global.fetch = jest.fn().mockRejectedValue('offline');

        await getData('bls-ingest', URL, callback);

        expect(callback).not.toHaveBeenCalled();
        expect(quiet).toHaveBeenCalledWith(expect.stringContaining('offline'));
        expect(quiet).not.toHaveBeenCalledWith(expect.stringContaining('"offline"'));

        quiet.mockRestore();
    });

    it.each([
        ['sec-ingest'],
        ['us-national-weather-ingest'],
        ['stock-market-ingest'],
        ['stock-split-ingest'],
    ])('%s takes the same fetch path', async (type) => {
        const callback = jest.fn();
        mockFetch({ report: 'group_by,total_success\nx,1' });

        await getData(type, URL, callback);

        expect(global.fetch).toHaveBeenCalledWith(URL, { method: 'GET' });
        expect(callback).toHaveBeenCalled();
    });
});

describe('every remaining type falls back to sample data', () => {
    //
    // the fallback is the half of this module that never runs in production, so it
    // is also the half that rots unnoticed. Each type is asserted to reach a loader
    // with csv TEXT rather than a url, which is the whole contract of the branch.
    //
    it.each([
        ['ticker-nasdaq', 'parseCsv', 'Symbol,Name,Sector,Industry'],
        ['sec-ingest', 'papaParseCsv', 'group_by,window_start,total_success'],
        ['us-national-weather-ingest', 'papaParseCsv', 'group_by,window_start,total_success'],
        ['stock-market-ingest', 'papaParseCsv', 'group_by,window_start,total_success'],
        ['stock-split-ingest', 'papaParseCsv', 'group_by,window_start,total_success'],
        ['stock-market-candlestick-triggers', 'parseCsv', 'group_by,window_start,total_detected'],
    ])('%s builds its own csv when no url is given', (type, loader, header) => {
        getData(type, null, () => {});

        const used = loader === 'parseCsv' ? parseCsv : papaParseCsv;
        const csv = used.mock.calls[0][0];

        expect(typeof csv).toBe('string');
        expect(csv).toContain(header);
        expect(csv).not.toContain('https://');
    });

    it('logs rather than throws for a type it does not know', () => {
        //
        // the trailing else is the only branch that reports anything at all. It
        // returns undefined either way, so the log is the sole signal.
        //
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        expect(getData('not-a-type', null, () => {})).toBeUndefined();
        expect(quiet).toHaveBeenCalledWith('Error: not-a-type not a valid choice.');

        quiet.mockRestore();
    });
});

describe('the sample data around a month boundary', () => {
    //
    // the fallback csv dates three rows off 'today' -- today, yesterday, and the day
    // before -- by subtracting from the day NUMBER. On the 1st and 2nd that would
    // underflow to '00' and '-1', so both are clamped to '01' instead.
    //
    afterEach(() => {
        jest.useRealTimers();
    });

    function atDate(iso) {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(iso));
    }

    it.each([
        ['bls-ingest'],
        ['sec-ingest'],
        ['us-national-weather-ingest'],
        ['stock-market-ingest'],
        ['stock-split-ingest'],
    ])('%s clamps both trailing days to the 1st on the 1st', (type) => {
        atDate('2026-06-01T12:00:00');

        getData(type, null, () => {});

        const csv = papaParseCsv.mock.calls[0][0];

        expect(csv).toContain('2026-06-01');
        expect(csv).not.toContain('2026-06-00');
        expect(csv).not.toContain('2026-06--1');
    });

    it('candlestick triggers clamp the same way', () => {
        atDate('2026-06-01T12:00:00');

        getData('stock-market-candlestick-triggers', null, () => {});

        const csv = parseCsv.mock.calls[0][0];

        expect(csv).toContain('2026-06-01');
        expect(csv).not.toContain('2026-06-00');
    });

    it('counts back normally once clear of the boundary', () => {
        atDate('2026-06-15T12:00:00');

        getData('bls-ingest', null, () => {});

        const csv = papaParseCsv.mock.calls[0][0];

        expect(csv).toContain('2026-06-15');
        expect(csv).toContain('2026-06-14');
        expect(csv).toContain('2026-06-13');
    });

    it('renders December as 12 through a branch that changes nothing', () => {
        //
        // WORTH KNOWING: the month is built as
        //
        //     today.getMonth() === 11 ? '12' : String(today.getMonth() + 1).padStart(2, '0')
        //
        // getMonth() is 11 in December, so the false arm computes '12' as well. The
        // ternary has no effect in either direction -- asserted here so that a
        // future reader does not assume December is special-cased for a reason.
        //
        atDate('2026-12-15T12:00:00');

        getData('bls-ingest', null, () => {});

        expect(papaParseCsv.mock.calls[0][0]).toContain('2026-12-15');
    });

    it('DEFECT: the weather fallback subtracts from a padded month STRING', () => {
        //
        // DOCUMENTS A DEFECT, in get-data.js. Half the us-national-weather rows are
        // dated '${yyyy}-${mm-1}-${before_yesterday}' to place them in the previous
        // month. 'mm' is a zero-padded string, so 'mm - 1' is coerced to a NUMBER and
        // loses the padding: in June it renders '2026-5-13' rather than '2026-05-13',
        // and in January '01 - 1' is 0, giving '2026-0-01' -- neither of which is a
        // month any parser will accept.
        //
        // Sample data only, so nothing in production reads it. The intended fix is to
        // step a Date object back a month, as rolling-window.js does, rather than to
        // do arithmetic on the formatted string.
        //
        atDate('2026-06-15T12:00:00');

        getData('us-national-weather-ingest', null, () => {});

        const csv = papaParseCsv.mock.calls[0][0];

        expect(csv).toContain('2026-5-');
        expect(csv).not.toContain('2026-05-13');
    });
});

describe('argument forwarding', () => {
    it('getData passes its arguments through unchanged', () => {
        //
        // worth asserting because parse-csv.js in the same directory does NOT --
        // 'parseCsv' overwrites its own parameters with literals before
        // forwarding. This one is written correctly, which is the contrast that
        // makes the other clearly a mistake.
        //
        const callback = jest.fn();

        getData('stock-split', URL, callback, true, 'src', 'stm');

        const call = papaParseCsv.mock.calls[0];
        expect(call[1]).toBe(callback);
        expect(call[2]).toBe(true);
        expect(call[5]).toBe('src');
        expect(call[6]).toBe('stm');
    });

    it('defaults source and stream to null', () => {
        getData('stock-split', URL, () => {});

        expect(papaParseCsv.mock.calls[0][5]).toBeNull();
        expect(papaParseCsv.mock.calls[0][6]).toBeNull();
    });
});
