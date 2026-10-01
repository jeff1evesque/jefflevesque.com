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
    readSort,
    writeSort,
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
        expect(writeChart('data', 'sec')).toBe(true);
        expect(readChart('data', STREAMS)).toBe('sec');
    });

    it('keeps /stream\'s and /data\'s apart', () => {
        writeSort('stream', { key: 'health', dir: 'desc' });
        writeChart('data', 'bls');

        expect(stored().stream).toEqual({ sort: { key: 'health', dir: 'desc' } });
        expect(stored().data).toEqual({ chart: 'bls' });
    });

    it('keeps the order when the chart is written, and the chart when the order is', () => {
        writeOrder('data', ['sec', 'bls']);
        writeChart('data', 'bls');

        expect(stored().data).toEqual({ order: ['sec', 'bls'], chart: 'bls' });
    });

    it('is null for a page never written', () => {
        expect(readChart('data', STREAMS)).toBeNull();
    });

    it('is null for a stream the page no longer lists', () => {
        writeChart('data', 'retired-stream');

        expect(readChart('data', STREAMS)).toBeNull();
    });

    it('is null without the page\'s streams to check it against', () => {
        writeChart('data', 'sec');

        expect(readChart('data', undefined)).toBeNull();
    });

    it('writes nothing for a page it does not keep, or a stream that is not a name', () => {
        expect(writeChart('model', 'sec')).toBe(false);
        expect(writeChart('data', '')).toBe(false);
        expect(writeChart('data', 7)).toBe(false);
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
        writeOrder('data', ['sec', 'bls']);

        expect(readOrder('data', STREAMS)).toEqual(['sec', 'bls', 'stock-market', 'stock-split', 'us-national-weather']);
    });

    it('drops a stream the page no longer lists', () => {
        writeOrder('data', ['retired-stream', 'sec']);

        expect(readOrder('data', STREAMS)[0]).toBe('sec');
        expect(readOrder('data', STREAMS)).not.toContain('retired-stream');
    });

    it('keeps a repeat once', () => {
        put({ v: VERSION, data: { order: ['sec', 'sec', 'bls'] } });

        expect(readOrder('data', STREAMS).filter((name) => name === 'sec')).toHaveLength(1);
    });

    it('writes a repeat once', () => {
        writeOrder('data', ['sec', 'bls', 'sec']);

        expect(stored().data.order).toEqual(['sec', 'bls']);
    });

    it('is null when none of the order is a stream the page lists', () => {
        writeOrder('data', ['retired-stream']);

        expect(readOrder('data', STREAMS)).toBeNull();
    });

    it('clears with null, back to the page\'s own order, and keeps the chart', () => {
        writeChart('data', 'sec');
        writeOrder('data', ['sec', 'bls']);
        writeOrder('data', null);

        expect(readOrder('data', STREAMS)).toBeNull();
        expect(stored().data).toEqual({ chart: 'sec' });
    });

    it('writes nothing for an order that is not a list of names', () => {
        expect(writeOrder('data', 'sec')).toBe(false);
        expect(writeOrder('data', ['sec', 7])).toBe(false);
        expect(writeOrder('data', ['sec', ''])).toBe(false);
        expect(window.localStorage.getItem(KEY)).toBeNull();
    });
});

describe('keeping the sort', () => {
    //
    // /stream keeps the figure its rows were left sorted by (#156)
    //
    const FIGURES = ['health', 'coverage', 'total'];

    it('reads back the sort it wrote', () => {
        expect(writeSort('stream', { key: 'coverage', dir: 'asc' })).toBe(true);
        expect(readSort('stream', FIGURES)).toEqual({ key: 'coverage', dir: 'asc' });
    });

    it('clears with null, back to the page\'s own order', () => {
        writeSort('stream', { key: 'coverage', dir: 'asc' });
        writeSort('stream', null);

        expect(readSort('stream', FIGURES)).toBeNull();
        expect(stored().stream).toEqual({});
    });

    it('is null for a page never written', () => {
        expect(readSort('stream', FIGURES)).toBeNull();
    });

    it('is null for a figure the page no longer offers', () => {
        writeSort('stream', { key: 'lag', dir: 'desc' });

        expect(readSort('stream', FIGURES)).toBeNull();
    });

    it('is null without the page\'s figures to check it against', () => {
        writeSort('stream', { key: 'health', dir: 'desc' });

        expect(readSort('stream', undefined)).toBeNull();
    });

    it('reads a sort running neither way as none', () => {
        put({ v: VERSION, stream: { sort: { key: 'health', dir: 'sideways' } } });

        expect(readSort('stream', FIGURES)).toBeNull();
    });

    it('reads a sort that is not a record as none', () => {
        put({ v: VERSION, stream: { sort: 'health' } });

        expect(readSort('stream', FIGURES)).toBeNull();
    });

    it('keeps only the figure and the direction', () => {
        writeSort('stream', { key: 'total', dir: 'desc', extra: true });

        expect(stored().stream.sort).toEqual({ key: 'total', dir: 'desc' });
    });

    it('writes nothing for a sort that is not one', () => {
        expect(writeSort('stream', 'health')).toBe(false);
        expect(writeSort('stream', { key: '', dir: 'desc' })).toBe(false);
        expect(writeSort('stream', { key: 'health', dir: 'up' })).toBe(false);
        expect(writeSort('stream', [])).toBe(false);
        expect(writeSort('model', { key: 'health', dir: 'desc' })).toBe(false);
        expect(window.localStorage.getItem(KEY)).toBeNull();
    });

    it('leaves what /stream kept before #152 as it was', () => {
        //
        // a charted stream and an order, from when /stream had a chart and a
        // listing to drag. Nothing reads them now, and nothing deletes them
        //
        put({ v: VERSION, stream: { chart: 'sec', order: ['sec', 'bls'] } });

        writeSort('stream', { key: 'health', dir: 'asc' });

        expect(stored().stream).toEqual({ chart: 'sec', order: ['sec', 'bls'], sort: { key: 'health', dir: 'asc' } });
    });

    it('reports the write it could not do rather than throwing', () => {
        hostile();

        expect(writeSort('stream', { key: 'health', dir: 'desc' })).toBe(false);
        expect(readSort('stream', FIGURES)).toBeNull();
    });
});

describe('a stored value that cannot be trusted', () => {
    it('ignores a record it cannot parse', () => {
        put('{not json');

        expect(readChart('data', STREAMS)).toBeNull();
        expect(readOrder('data', STREAMS)).toBeNull();
    });

    it('ignores a record from a version it does not know', () => {
        put({ v: VERSION + 1, data: { chart: 'sec', order: ['sec'] } });

        expect(readChart('data', STREAMS)).toBeNull();
        expect(readOrder('data', STREAMS)).toBeNull();
    });

    it('ignores a page that is not an object', () => {
        put({ v: VERSION, data: ['sec'] });

        expect(readChart('data', STREAMS)).toBeNull();
    });

    it('ignores a chart that is not a name, and an order that is not a list', () => {
        put({ v: VERSION, data: { chart: 7, order: 'sec' } });

        expect(readChart('data', STREAMS)).toBeNull();
        expect(readOrder('data', STREAMS)).toBeNull();
    });

    it('does not merge into a document from an unknown version', () => {
        put({ v: VERSION + 1, data: { chart: 'bls' }, other: true });
        writeChart('data', 'sec');

        expect(stored()).toEqual({ v: VERSION, data: { chart: 'sec' } });
    });
});

describe('a browser that will not store anything', () => {
    it('reads nothing rather than throwing', () => {
        hostile();

        expect(readChart('data', STREAMS)).toBeNull();
        expect(readOrder('data', STREAMS)).toBeNull();
    });

    it('reports the write it could not do rather than throwing', () => {
        hostile();

        expect(writeChart('data', 'sec')).toBe(false);
        expect(writeOrder('data', ['sec'])).toBe(false);
    });
});
