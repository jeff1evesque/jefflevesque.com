/**
 * parse-csv.test.js: csv parsing, from a string or a url.
 *
 * The interesting part is the argument handling. 'parseCsv' forwards to the
 * private 'parse' like this:
 *
 *     return parse(csv, download=false, header=true)
 *
 * which looks like named arguments and is not -- javascript has none. Those are
 * assignment EXPRESSIONS: each writes to the local parameter and evaluates to
 * the value written, so the call is always parse(csv, false, true) and whatever
 * the caller passed is discarded. That is covered below as a defect.
 *
 * Note: 'react-papaparse' and 'fetch' are mocked. The point is which options
 *       reach the parser, not whether papaparse can parse.
 */

jest.mock('react-papaparse', () => ({
    readString: jest.fn(),
    readRemoteFile: jest.fn(),
}));

import { readRemoteFile, readString } from 'react-papaparse';
import { papaParseCsv, parseCsv } from '../../import/general/parse-csv.js';

const CSV = 'ticker,count\naapl,10\nmsft,20';
const URL_CSV = 'https://example.com/data.csv';

const ROWS = [
    { ticker: 'aapl', count: '10' },
    { ticker: 'msft', count: '20' },
];

beforeEach(() => {
    jest.clearAllMocks();
    readString.mockReturnValue({ data: ROWS });
    global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(CSV) });
});

afterEach(() => {
    delete global.fetch;
});

describe('parseCsv, given a string', () => {
    it('returns the parsed rows', async () => {
        await expect(parseCsv(CSV)).resolves.toEqual(ROWS);
    });

    it('parses the string directly rather than fetching it', async () => {
        await parseCsv(CSV);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(readString).toHaveBeenCalledWith(CSV, expect.anything());
    });

    it('returns an empty array when the parser finds no rows', async () => {
        //
        // an empty csv is an ordinary outcome -- a stream with nothing in the
        // window -- so it is [] rather than a throw, and the caller can map over
        // it unconditionally.
        //
        readString.mockReturnValue({ data: [] });

        await expect(parseCsv(CSV)).resolves.toEqual([]);
    });

    it('returns an empty array when the parser returns no data key at all', async () => {
        readString.mockReturnValue({});

        await expect(parseCsv(CSV)).resolves.toEqual([]);
    });
});

describe('parseCsv, given a url', () => {
    it('fetches the url and parses the response text', async () => {
        await expect(parseCsv(URL_CSV)).resolves.toEqual(ROWS);

        expect(global.fetch).toHaveBeenCalledWith(URL_CSV);
        expect(readString).toHaveBeenCalledWith(CSV, expect.anything());
    });

    it('returns an empty array when the fetch fails', async () => {
        //
        // the error is logged and swallowed: 'r' is never assigned, so the
        // trailing guard returns []. A missing artifact must not take the chart
        // down.
        //
        global.fetch.mockRejectedValue(new Error('network'));
        const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(parseCsv(URL_CSV)).resolves.toEqual([]);

        quiet.mockRestore();
    });
});

describe('parseCsv argument forwarding', () => {
    it('defaults to header parsing on', () => {
        //
        // header: true is what makes rows objects keyed by column name rather
        // than positional arrays, which every caller downstream assumes.
        //
        return parseCsv(CSV).then(() => {
            expect(readString).toHaveBeenCalledWith(
                CSV,
                expect.objectContaining({ header: true, download: false })
            );
        });
    });

    //
    // DOCUMENTS A DEFECT, not intended behaviour.
    //
    // 'parseCsv' accepts 'download' and 'header' and then throws them away:
    //
    //     return parse(csv, download=false, header=true)
    //
    // Those are assignments, not named arguments, so the parameters are
    // overwritten with the literals before being passed on. Calling
    // parseCsv(csv, true, false) is indistinguishable from parseCsv(csv).
    //
    // The fix is 'return parse(csv, download, header)'. When that lands, these
    // two tests should assert the caller's values are honoured.
    //
    it('ignores an explicit header argument', async () => {
        await parseCsv(CSV, false, false);

        expect(readString).toHaveBeenCalledWith(
            CSV,
            expect.objectContaining({ header: true })
        );
    });

    it('ignores an explicit download argument', async () => {
        await parseCsv(CSV, true, true);

        expect(readString).toHaveBeenCalledWith(
            CSV,
            expect.objectContaining({ download: false })
        );
    });
});

describe('papaParseCsv', () => {
    it('reads a url through readRemoteFile', () => {
        papaParseCsv(URL_CSV);

        expect(readRemoteFile).toHaveBeenCalled();
        expect(readRemoteFile.mock.calls[0][0]).toBe(URL_CSV);
        expect(readString).not.toHaveBeenCalled();
    });

    it('reads a string through readString', () => {
        papaParseCsv(CSV);

        expect(readString).toHaveBeenCalled();
        expect(readRemoteFile).not.toHaveBeenCalled();
    });

    it('hands the rows to the callback, tagged with source and stream', () => {
        //
        // the tags are how a caller firing several parses at once tells the
        // results apart -- they arrive out of order.
        //
        const callback = jest.fn();
        readString.mockImplementation((csv, options) => {
            options.complete({ data: ROWS });
        });

        papaParseCsv(CSV, callback, false, false, true, 'bls', 'cpi');

        expect(callback).toHaveBeenCalledWith({
            data: ROWS,
            source: 'bls',
            stream: 'cpi',
        });
    });

    it('parses without a callback rather than throwing', () => {
        //
        // the default callback is a no-op, and it is the only thing standing between
        // a caller that wants the parse for its side effects and a TypeError -- the
        // completion handler calls it unconditionally once the rows are in.
        //
        readString.mockImplementation((csv, options) => {
            options.complete({ data: ROWS });
        });

        expect(() => papaParseCsv(CSV)).not.toThrow();
        expect(readString).toHaveBeenCalled();
    });

    it('defaults source and stream to null rather than leaving them undefined', () => {
        const callback = jest.fn();
        readString.mockImplementation((csv, options) => {
            options.complete({ data: ROWS });
        });

        papaParseCsv(CSV, callback);

        expect(callback).toHaveBeenCalledWith({
            data: ROWS,
            source: null,
            stream: null,
        });
    });

    it('tags the rows from a url the same way it tags a string', () => {
        //
        // the remote branch builds its own 'complete' with a signature that shadows
        // the outer source and stream:
        //
        //     complete: (results, source, stream) => ...
        //
        // papaparse calls it with the file handle in those positions, so reading the
        // parameters would tag every remote row with whatever papaparse passed. It
        // reads the captured 'obj' instead, which is what this pins -- the shadowing
        // is live, and only the closure keeps it correct.
        //
        const callback = jest.fn();
        readRemoteFile.mockImplementation((csv, options) => {
            options.complete({ data: ROWS }, 'shadowed', 'shadowed');
        });

        papaParseCsv(URL_CSV, callback, false, false, true, 'bls', 'cpi');

        expect(callback).toHaveBeenCalledWith({
            data: ROWS,
            source: 'bls',
            stream: 'cpi',
        });
    });

    it('forwards the header flag to a remote read', () => {
        papaParseCsv(URL_CSV, () => {}, false, false, false);

        expect(readRemoteFile).toHaveBeenCalledWith(
            URL_CSV,
            expect.objectContaining({ header: false })
        );
    });

    it('forwards the worker flag, unlike parseCsv', () => {
        //
        // papaParseCsv does pass its arguments through properly, which is the
        // contrast that makes the parseCsv defect above clearly a mistake rather
        // than a convention.
        //
        papaParseCsv(CSV, () => {}, true);

        expect(readString).toHaveBeenCalledWith(
            CSV,
            expect.objectContaining({ worker: true })
        );
    });
});
