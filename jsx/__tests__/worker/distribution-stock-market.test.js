/**
 * distribution-stock-market.test.js: the stock-market distribution worker.
 *
 * The only one of the four that serves TWO streams from one module, with a
 * different shape for each:
 *
 *     stockmarket            sector / industry / total_records
 *     stockmarketstocksplit  split_date -> 'Day N', counting total_tickers
 *
 * Both report 'sector' as the aggregate key, even though the split branch puts a
 * date in that field -- the chart reads one key name regardless of stream.
 *
 * This worker also settles a question raised by sec.js: its merge branch tests and
 * stores under the SAME unprefixed key, so merging works here. sec tests the bare
 * form while storing the prefixed one, which is why sec cannot merge. The contrast
 * is asserted below.
 */

//
// the REAL validators, imported only to assert the copies below still match them.
//
import realCheckValidArray from '../../import/validator/valid-array.js';
import realCheckValidInt from '../../import/validator/valid-int.js';
import realCheckValidObject from '../../import/validator/valid-object.js';
import realCheckValidString from '../../import/validator/valid-string.js';
import realTrim from '../../import/general/trim-object.js';

//
// uninstrumented copies, whose .toString() is what a production bundle would hand
// the worker. See test-support/validator-source.js for why the real ones cannot be
// stringified here: under coverage they carry istanbul counter references that
// new Function() cannot resolve.
//
import {
    checkValidArray,
    checkValidInt,
    checkValidObject,
    checkValidString,
    trim
} from '../../test-support/validator-source.js';

import stockMarketWorker from '../../import/worker/data/distribution/stock-market.js';

function payload(item) {
    return {
        data: {
            item,
            stringifiedTrim: trim.toString(),
            stringifiedCheckValidInt: checkValidInt.toString(),
            stringifiedCheckValidObject: checkValidObject.toString(),
            stringifiedCheckValidArray: checkValidArray.toString(),
            stringifiedCheckValidString: checkValidString.toString(),
        },
    };
}

let posted;
let realPostMessage;
let quiet;

beforeEach(() => {
    posted = [];
    realPostMessage = self.postMessage;
    self.postMessage = (m) => posted.push(m);
    quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
    stockMarketWorker();
});

afterEach(() => {
    self.postMessage = realPostMessage;
    self.onmessage = null;
    quiet.mockRestore();
});

function send(item) {
    self.onmessage(payload(item));
}

describe('the stringified copies match the real validators', () => {
    //
    // the copies exist only so their source is clean; they must not drift. Each pair
    // is compared on the inputs the workers actually feed them.
    //
    it.each([
        ['5', true], ['0', true], ['abc', false], ['', false],
    ])('checkValidInt(%s)', (input, expected) => {
        expect(checkValidInt(input)).toBe(expected);
        expect(realCheckValidInt(input)).toBe(expected);
    });

    it.each([
        ['Tech', true], ['', false],
    ])('checkValidString(%s)', (input, expected) => {
        expect(checkValidString(input)).toBe(expected);
        expect(realCheckValidString(input)).toBe(expected);
    });

    it('checkValidObject agrees on a present and an absent key', () => {
        const v = { a: 'x' };
        expect(checkValidObject('a', v)).toBe(realCheckValidObject('a', v));
        expect(checkValidObject('b', v)).toBe(realCheckValidObject('b', v));
    });

    it('checkValidArray agrees on a bare array and a keyed one', () => {
        expect(checkValidArray([1])).toBe(realCheckValidArray([1]));
        expect(checkValidArray('a', { a: [1] })).toBe(realCheckValidArray('a', { a: [1] }));
        expect(checkValidArray('a', { a: [] })).toBe(realCheckValidArray('a', { a: [] }));
    });

    it('trim agrees on a padded string and a nested object', () => {
        expect(trim('  x  ')).toBe(realTrim('  x  '));
        expect(trim({ a: { b: ' y ' } })).toEqual(realTrim({ a: { b: ' y ' } }));
    });
});

describe('the rebuilt validators', () => {
    it('reconstruct and run without throwing', () => {
        expect(() => send({
            'data-distribution': [{ sector: 'Tech', industry: 'Software', total_records: '5' }],
            stream: 'stockmarket',
        })).not.toThrow();
    });
});

describe('the stockmarket stream', () => {
    it('keys on sector and stacks by industry', () => {
        send({
            'data-distribution': [{ sector: 'Tech', industry: 'Software', total_records: '5' }],
            stream: 'stockmarket',
        });

        expect(posted[0].aggregate_key).toBe('sector');
        expect(posted[0].data_distribution[0]).toEqual({ sector: 'Tech', Software: 5 });
    });

    it('MERGES a second industry onto the same sector', () => {
        //
        // the contrast with sec.js: here the merge branch tests 'trim(v.sector) in
        // data_reformat' and the store branch writes 'data_reformat[trim(v.sector)]'
        // -- the same key both times -- so the second row stacks instead of
        // replacing. sec's prefix breaks exactly this pairing.
        //
        send({
            'data-distribution': [
                { sector: 'Tech', industry: 'Software', total_records: '5' },
                { sector: 'Tech', industry: 'Hardware', total_records: '3' },
            ],
            stream: 'stockmarket',
        });

        expect(posted[0].data_distribution).toHaveLength(1);
        expect(posted[0].data_distribution[0]).toEqual({
            sector: 'Tech',
            Software: 5,
            Hardware: 3,
        });
    });

    it('keeps separate sectors as separate rows', () => {
        send({
            'data-distribution': [
                { sector: 'Tech', industry: 'Software', total_records: '5' },
                { sector: 'Energy', industry: 'Oil', total_records: '3' },
            ],
            stream: 'stockmarket',
        });

        expect(posted[0].data_distribution).toHaveLength(2);
    });

    it('totals total_records', () => {
        send({
            'data-distribution': [
                { sector: 'Tech', industry: 'Software', total_records: '5' },
                { sector: 'Energy', industry: 'Oil', total_records: '3' },
            ],
            stream: 'stockmarket',
        });

        expect(posted[0].records).toBe(8);
    });

    it('trims whitespace from sector and industry', () => {
        send({
            'data-distribution': [{ sector: '  Tech  ', industry: '  Software  ', total_records: '5' }],
            stream: 'stockmarket',
        });

        expect(posted[0].data_distribution[0]).toEqual({ sector: 'Tech', Software: 5 });
    });

    it('skips a row missing its industry', () => {
        send({
            'data-distribution': [
                { sector: 'Tech', industry: 'Software', total_records: '5' },
                { sector: 'Energy', total_records: '3' },
            ],
            stream: 'stockmarket',
        });

        expect(posted[0].data_distribution).toHaveLength(1);
        expect(quiet).toHaveBeenCalled();
    });
});

describe('the stockmarketstocksplit stream', () => {
    it('labels each bar by split date rather than sector', () => {
        //
        // the field is still called 'sector' because the chart reads one key name for
        // every stream; what it holds here is a day.
        //
        send({
            'data-distribution': [{ split_date: '03', total_tickers: '4' }],
            stream: 'stockmarketstocksplit',
        });

        expect(posted[0].aggregate_key).toBe('sector');
        expect(posted[0].data_distribution[0].sector).toBe('Day 03');
    });

    it('counts splits rather than records', () => {
        //
        // documented: stacking 'total_tickers' put a handful of tickers per bar where
        // the market stream counts quote records, so splits get their own measure.
        //
        send({
            'data-distribution': [{ split_date: '03', total_tickers: '4' }],
            stream: 'stockmarketstocksplit',
        });

        expect(posted[0].data_distribution[0].splits).toBe(4);
    });

    it('totals total_tickers, not total_records', () => {
        send({
            'data-distribution': [
                { split_date: '03', total_tickers: '4' },
                { split_date: '04', total_tickers: '6' },
            ],
            stream: 'stockmarketstocksplit',
        });

        expect(posted[0].records).toBe(10);
    });

    it('carries the ticker list along for the tooltip when present', () => {
        //
        // the tickers ride on the record so the tooltip can name them; the bar itself
        // is coloured by a single series.
        //
        send({
            'data-distribution': [{ split_date: '03', total_tickers: '2', tickers: 'nvdl 3:1, mull 25:1' }],
            stream: 'stockmarketstocksplit',
        });

        expect(posted[0].data_distribution[0].tickers).toBe('nvdl 3:1, mull 25:1');
    });

    it('omits the tickers field entirely when absent', () => {
        //
        // omitted rather than set to null or '', so the tooltip can test presence.
        //
        send({
            'data-distribution': [{ split_date: '03', total_tickers: '2' }],
            stream: 'stockmarketstocksplit',
        });

        expect(posted[0].data_distribution[0]).not.toHaveProperty('tickers');
    });

    it('gives each split date its own bar', () => {
        send({
            'data-distribution': [
                { split_date: '03', total_tickers: '2' },
                { split_date: '04', total_tickers: '5' },
            ],
            stream: 'stockmarketstocksplit',
        });

        expect(posted[0].data_distribution).toHaveLength(2);
    });

    it('does not order the bars, since data.jsx sorts them', () => {
        //
        // documented in the worker: any ordering applied here is discarded, because
        // data.jsx sorts by label with numeric collation before rendering. So this
        // asserts only that both survive, not their order.
        //
        send({
            'data-distribution': [
                { split_date: '10', total_tickers: '1' },
                { split_date: '03', total_tickers: '1' },
            ],
            stream: 'stockmarketstocksplit',
        });

        const labels = posted[0].data_distribution.map(r => r.sector);
        expect(labels).toContain('Day 10');
        expect(labels).toContain('Day 03');
    });
});

describe('stream dispatch', () => {
    it('posts null for a stream it does not serve', () => {
        send({
            'data-distribution': [{ sector: 'Tech', industry: 'Software', total_records: '5' }],
            stream: 'bls',
        });

        expect(posted[0]).toBeNull();
        expect(quiet).toHaveBeenCalled();
    });

    it('does not apply the split shape to the market stream', () => {
        //
        // a split-shaped row under the market stream matches neither branch and is
        // reported rather than silently reshaped.
        //
        send({
            'data-distribution': [{ split_date: '03', total_tickers: '4' }],
            stream: 'stockmarket',
        });

        expect(posted[0].data_distribution).toHaveLength(0);
        expect(quiet).toHaveBeenCalled();
    });

    it('carries source and stream through', () => {
        send({
            'data-distribution': [{ sector: 'Tech', industry: 'Software', total_records: '5' }],
            stream: 'stockmarket',
            source: 'market-source',
        });

        expect(posted[0].selected_stream).toBe('stockmarket');
        expect(posted[0].selected_source).toBe('market-source');
    });
});

describe('the partition count', () => {
    it('sums the counts and posts them separately', () => {
        send({ partition: [{ count: '3' }, { count: '4' }], stream: 'stockmarket' });

        expect(posted).toEqual([{ count: 7, selected_stream: 'stockmarket' }]);
    });

    it('treats a non-numeric count as zero', () => {
        send({ partition: [{ count: '3' }, { count: 'x' }], stream: 'stockmarket' });

        expect(posted[0].count).toBe(3);
    });

    it('posts both sections when both are present', () => {
        send({
            'data-distribution': [{ sector: 'Tech', industry: 'Software', total_records: '5' }],
            partition: [{ count: '2' }],
            stream: 'stockmarket',
        });

        expect(posted).toHaveLength(2);
        expect(posted[1].count).toBe(2);
    });
});
