/**
 * listing-preference.test.js: a chart and an order kept between visits.
 *
 * As in layout-preference.test.js, most of what is worth testing is a way the
 * stored value can be wrong: a string in somebody's browser, which they can edit,
 * an older version of this code may have written, and a newer one will read. The
 * page has to open on a stream it lists, in an order of the streams it lists,
 * whatever it finds there -- or on its own first stream, in its own order.
 *
 * Note: setup.js installs a localStorage shim for every suite. The failure paths
 *       replace it deliberately -- Safari's private mode throws on access rather
 *       than returning empty, and that is the case a guard is for.
 */

import {
    readChart,
    writeChart,
    readOrder,
    writeOrder,
    KEY,
    VERSION,
} from '../../import/general/listing-preference.js';

const STREAMS = ['stock-market', 'stock-split', 'bls', 'sec', 'us-national-weather'];

//
// the shim from setup.js, put back by whatever replaced it
//
const real = window.localStorage;

function stored() {
    return JSON.parse(window.localStorage.getItem(KEY));
}

function put(value) {
    window.localStorage.setItem(KEY, typeof value === 'string' ? value : JSON.stringify(value));
}

//
// a storage that throws on everything, which is what a blocked or private
// browser gives rather than an empty one
//
function hostile() {
    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
            getItem() { throw new Error('access denied'); },
            setItem() { throw new Error('quota exceeded'); },
        },
    });
}

beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: real });
    window.localStorage.clear();
});

afterEach(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: real });
});

describe('keeping the chart', () => {
    it('reads back the stream it wrote', () => {
        expect(writeChart('stream', 'sec')).toBe(true);
        expect(readChart('stream', STREAMS)).toBe('sec');
    });

    it('keeps /stream\'s and /data\'s apart', () => {
        writeChart('stream', 'sec');
        writeChart('data', 'bls');

        expect(readChart('stream', STREAMS)).toBe('sec');
        expect(readChart('data', STREAMS)).toBe('bls');
    });

    it('keeps the order when the chart is written, and the chart when the order is', () => {
        writeOrder('stream', ['sec', 'bls']);
        writeChart('stream', 'bls');

        expect(stored().stream).toEqual({ order: ['sec', 'bls'], chart: 'bls' });
    });

    it('is null for a page never written', () => {
        expect(readChart('stream', STREAMS)).toBeNull();
    });

    it('is null for a stream the page no longer lists', () => {
        writeChart('stream', 'retired-stream');

        expect(readChart('stream', STREAMS)).toBeNull();
    });

    it('is null without the page\'s streams to check it against', () => {
        writeChart('stream', 'sec');

        expect(readChart('stream', undefined)).toBeNull();
    });

    it('writes nothing for a page it does not keep, or a stream that is not a name', () => {
        expect(writeChart('model', 'sec')).toBe(false);
        expect(writeChart('stream', '')).toBe(false);
        expect(writeChart('stream', 7)).toBe(false);
        expect(window.localStorage.getItem(KEY)).toBeNull();
    });
});

describe('keeping the order', () => {
    it('reads back the order it wrote', () => {
        writeOrder('data', ['sec', 'bls', 'stock-market', 'stock-split', 'us-national-weather']);

        expect(readOrder('data', STREAMS)).toEqual(['sec', 'bls', 'stock-market', 'stock-split', 'us-national-weather']);
    });

    it('adds a stream the order does not name at the end, in the page\'s order', () => {
        //
        // a stream the site gained after the reader made their order
        //
        writeOrder('stream', ['sec', 'bls']);

        expect(readOrder('stream', STREAMS)).toEqual(['sec', 'bls', 'stock-market', 'stock-split', 'us-national-weather']);
    });

    it('drops a stream the page no longer lists', () => {
        writeOrder('stream', ['retired-stream', 'sec']);

        expect(readOrder('stream', STREAMS)[0]).toBe('sec');
        expect(readOrder('stream', STREAMS)).not.toContain('retired-stream');
    });

    it('keeps a repeat once', () => {
        put({ v: VERSION, stream: { order: ['sec', 'sec', 'bls'] } });

        expect(readOrder('stream', STREAMS).filter((name) => name === 'sec')).toHaveLength(1);
    });

    it('writes a repeat once', () => {
        writeOrder('stream', ['sec', 'bls', 'sec']);

        expect(stored().stream.order).toEqual(['sec', 'bls']);
    });

    it('is null when none of the order is a stream the page lists', () => {
        writeOrder('stream', ['retired-stream']);

        expect(readOrder('stream', STREAMS)).toBeNull();
    });

    it('clears with null, back to the page\'s own order, and keeps the chart', () => {
        writeChart('stream', 'sec');
        writeOrder('stream', ['sec', 'bls']);
        writeOrder('stream', null);

        expect(readOrder('stream', STREAMS)).toBeNull();
        expect(stored().stream).toEqual({ chart: 'sec' });
    });

    it('writes nothing for an order that is not a list of names', () => {
        expect(writeOrder('stream', 'sec')).toBe(false);
        expect(writeOrder('stream', ['sec', 7])).toBe(false);
        expect(writeOrder('stream', ['sec', ''])).toBe(false);
        expect(window.localStorage.getItem(KEY)).toBeNull();
    });
});

describe('a stored value that cannot be trusted', () => {
    it('ignores a record it cannot parse', () => {
        put('{not json');

        expect(readChart('stream', STREAMS)).toBeNull();
        expect(readOrder('stream', STREAMS)).toBeNull();
    });

    it('ignores a record from a version it does not know', () => {
        put({ v: VERSION + 1, stream: { chart: 'sec', order: ['sec'] } });

        expect(readChart('stream', STREAMS)).toBeNull();
        expect(readOrder('stream', STREAMS)).toBeNull();
    });

    it('ignores a page that is not an object', () => {
        put({ v: VERSION, stream: ['sec'] });

        expect(readChart('stream', STREAMS)).toBeNull();
    });

    it('ignores a chart that is not a name, and an order that is not a list', () => {
        put({ v: VERSION, stream: { chart: 7, order: 'sec' } });

        expect(readChart('stream', STREAMS)).toBeNull();
        expect(readOrder('stream', STREAMS)).toBeNull();
    });

    it('does not merge into a document from an unknown version', () => {
        put({ v: VERSION + 1, stream: { chart: 'bls' }, other: true });
        writeChart('stream', 'sec');

        expect(stored()).toEqual({ v: VERSION, stream: { chart: 'sec' } });
    });
});

describe('a browser that will not store anything', () => {
    it('reads nothing rather than throwing', () => {
        hostile();

        expect(readChart('stream', STREAMS)).toBeNull();
        expect(readOrder('stream', STREAMS)).toBeNull();
    });

    it('reports the write it could not do rather than throwing', () => {
        hostile();

        expect(writeChart('stream', 'sec')).toBe(false);
        expect(writeOrder('stream', ['sec'])).toBe(false);
    });
});
