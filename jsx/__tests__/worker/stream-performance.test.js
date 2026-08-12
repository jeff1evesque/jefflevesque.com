/**
 * stream-performance.test.js: the ingest-performance web-worker.
 *
 * Reshapes the performance report into chart rows: one row per instant, one series
 * per source, plus a throughput figure kept beside each series rather than as a
 * single scalar for the whole report.
 *
 * Same stringified-validator preamble as the four distribution workers, driven the
 * same way -- the factory assigns self.onmessage, and the handler is invoked with a
 * synthetic event carrying the real validators' source text.
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 *   - the report stamps every row with its own utc offset, so the timestamp string
 *     parses straight to the instant it names. It used to be re-read through a New
 *     York toLocaleString, producing a Date holding eastern wall-clock in the local
 *     zone's slot -- not the instant, and three hours off it in California.
 *
 *   - throughput is per-series, not per-report. The listing's health has to
 *     describe the same rows the chart is showing, and a single scalar cannot be
 *     narrowed to a date window after the fact.
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
import THROUGHPUT_KEY from '../../import/general/throughput-key.js';

import performanceWorker from '../../import/worker/stream/performance.js';

const FIELD = 'window_start';

function payload(item) {
    return {
        data: {
            item,
            field_datetime: FIELD,
            throughput_key: THROUGHPUT_KEY,
            stringifiedTrim: trim.toString(),
            stringifiedCheckValidInt: checkValidInt.toString(),
            stringifiedCheckValidObject: checkValidObject.toString(),
            stringifiedCheckValidArray: checkValidArray.toString(),
            stringifiedCheckValidString: checkValidString.toString(),
        },
    };
}

function row(overrides = {}) {
    return {
        [FIELD]: '2026-03-16T14:00:00-04:00',
        group_by: 'price',
        total_success: '900',
        total_fail: '100',
        ...overrides,
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
    performanceWorker();
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
        expect(() => send({ data: [row()] })).not.toThrow();
    });
});

describe('reshaping a row', () => {
    it('keys the series by group_by', () => {
        send({ data: [row({ group_by: 'price' })] });

        expect(posted[0].chart_data_original[0].price).toBe(900);
    });

    it('lowercases and trims the series key', () => {
        send({ data: [row({ group_by: '  PRICE  ' })] });

        expect(posted[0].chart_data_original[0].price).toBe(900);
    });

    it('uses the name the report already gave the stream', () => {
        //
        // api-stream-performance maps the upstream host to the stream's name before
        // it reports, so the worker keys on what it receives. this used to hold that
        // table itself, which meant a source that moved hosts rendered as the raw
        // hostname until the OTHER repo was edited.
        //
        send({ data: [row({ group_by: 'weather' })] });

        const chart = posted[0].chart_data_original[0];
        expect(chart.weather).toBe(900);
    });

    it('does not rewrite a value the report did not map', () => {
        //
        // the worker must not second-guess the report. a source the API has no
        // mapping for arrives as its own host and has to pass straight through --
        // visible in the legend, rather than silently renamed to something else or
        // dropped from the series entirely.
        //
        send({ data: [row({ group_by: 'api.unmapped.example' })] });

        const chart = posted[0].chart_data_original[0];
        expect(chart['api.unmapped.example']).toBe(900);
    });

    it('zero-fills series a row carries but has no figure for', () => {
        //
        // a row may arrive with a 'source' map naming series it should report; any
        // of those without a figure is filled with 0 rather than left undefined, so
        // a bucket does not read as a gap in the chart.
        //
        // Note: rows from the report do not carry 'source' today -- the message
        //       does, not the row -- so this pins the loop's behaviour for the
        //       shape that reaches it rather than describing current traffic.
        //
        send({ data: [row({ source: { price: true, volume: true } })] });

        const chart = posted[0].chart_data_original[0];
        expect(chart.volume).toBe(0);
        expect(chart.price).toBe(900);
    });

    it('keeps a renamed source as one series across the change', () => {
        //
        // the bug this removed the table for. SEC reported 'sec' before it moved to
        // the generic scraper and 'efts.sec.gov' after; the API now names both 'sec',
        // so a window spanning the change is one series rather than two.
        //
        send({
            data: [
                row({ group_by: 'sec' }),
                row({ group_by: 'sec', total_success: '100', total_fail: '0' })
            ]
        });

        const chart = posted[0].chart_data_original;
        const keys = chart.flatMap(v => Object.keys(v));
        expect(keys).not.toContain('efts.sec.gov');
        expect(keys).toContain('sec');
    });

    it('keeps throughput beside the series, suffixed', () => {
        //
        // success + fail, stored as 'price__throughput' rather than returned once for
        // the whole report, so health describes the same rows the chart shows.
        //
        send({ data: [row()] });

        expect(posted[0].chart_data_original[0][`price${THROUGHPUT_KEY}`]).toBe(1000);
    });

    it('parses the timestamp to the instant it names, honouring its offset', () => {
        //
        // the row carries -04:00, so this is 18:00 UTC. A re-read through a New York
        // toLocaleString would land three hours out for a californian reader.
        //
        send({ data: [row({ [FIELD]: '2026-03-16T14:00:00-04:00' })] });

        const when = posted[0].chart_data_original[0][FIELD];
        expect(when).toBeInstanceOf(Date);
        expect(when.toISOString()).toBe('2026-03-16T18:00:00.000Z');
    });

    it('strips the raw fields it has consumed', () => {
        //
        // group_by, total_success and total_fail are deleted once folded into the
        // series, so the chart row carries no duplicate of its own inputs.
        //
        send({ data: [row()] });

        const chart = posted[0].chart_data_original[0];
        expect(chart).not.toHaveProperty('group_by');
        expect(chart).not.toHaveProperty('total_success');
        expect(chart).not.toHaveProperty('total_fail');
    });

    it('drops a row whose timestamp will not parse', () => {
        //
        // an unparseable date becomes an Invalid Date, which the filter removes --
        // otherwise d3 would place the point at NaN and the line would break.
        //
        send({ data: [row(), row({ [FIELD]: 'not-a-date' })] });

        expect(posted[0].chart_data_original).toHaveLength(1);
    });
});

describe('merging rows on the same instant', () => {
    it('folds two sources into one row', () => {
        //
        // the chart wants one row per instant with a field per series, not one row
        // per source.
        //
        send({
            data: [
                row({ group_by: 'price' }),
                row({ group_by: 'volume', total_success: '400', total_fail: '10' }),
            ],
        });

        expect(posted[0].chart_data_original).toHaveLength(1);
        const chart = posted[0].chart_data_original[0];
        expect(chart.price).toBe(900);
        expect(chart.volume).toBe(400);
    });

    it('keeps each source’s throughput separate in the merged row', () => {
        send({
            data: [
                row({ group_by: 'price' }),
                row({ group_by: 'volume', total_success: '400', total_fail: '10' }),
            ],
        });

        const chart = posted[0].chart_data_original[0];
        expect(chart[`price${THROUGHPUT_KEY}`]).toBe(1000);
        expect(chart[`volume${THROUGHPUT_KEY}`]).toBe(410);
    });

    it('matches on the instant, not the string', () => {
        //
        // the same moment written with different offsets has to merge: the comparison
        // is on valueOf(), so '14:00-04:00' and '18:00Z' are one row.
        //
        send({
            data: [
                row({ [FIELD]: '2026-03-16T14:00:00-04:00', group_by: 'price' }),
                row({ [FIELD]: '2026-03-16T18:00:00Z', group_by: 'volume' }),
            ],
        });

        expect(posted[0].chart_data_original).toHaveLength(1);
    });

    it('keeps different instants as separate rows', () => {
        send({
            data: [
                row({ [FIELD]: '2026-03-16T14:00:00-04:00' }),
                row({ [FIELD]: '2026-03-16T15:00:00-04:00' }),
            ],
        });

        expect(posted[0].chart_data_original).toHaveLength(2);
    });
});

describe('the throughput total', () => {
    it('sums success and fail across every counted row', () => {
        send({
            data: [
                row({ total_success: '900', total_fail: '100' }),
                row({ [FIELD]: '2026-03-16T15:00:00-04:00', total_success: '400', total_fail: '10' }),
            ],
        });

        expect(posted[0].stream_throughput).toBe(1410);
    });

    it('counts only rows carrying both figures', () => {
        //
        // a row with no total_fail column at all is not half-counted: it contributes
        // nothing to throughput, because a denominator built from partial rows would
        // understate health rather than flag it.
        //
        const partial = row({ [FIELD]: '2026-03-16T15:00:00-04:00', total_success: '400' });
        delete partial.total_fail;

        send({
            data: [row({ total_success: '900', total_fail: '100' }), partial],
        });

        expect(posted[0].stream_throughput).toBe(1000);
    });

    it('skips a row whose field is present but undefined', () => {
        //
        // FIXED, in valid-object.js. checkValidObject used to guard with:
        //
        //     v[k] !== 'undefined'      // the STRING, not the value
        //     && v[k].trim !== ''       // reads .trim on whatever it is
        //
        // so a real undefined passed the first clause and raised on the second. A row
        // carrying the KEY with an undefined VALUE took the worker down, while a row
        // missing the key entirely was skipped cleanly.
        //
        // Now both shapes are skipped: the row is still charted for the figure it does
        // carry, and only its throughput is withheld.
        //
        // valid-object.js has its own test for this in isolation; this one records
        // that a report row is enough to reach it.
        //
        expect(() => send({
            data: [row({ total_fail: undefined })],
        })).not.toThrow();

        expect(posted[0].chart_data_original).toHaveLength(1);
        expect(posted[0].chart_data_original[0].price).toBe(900);
        expect(posted[0].stream_throughput).toBe(0);
    });

    it('reports zero when no row carries both figures', () => {
        //
        // FIXED, in performance.js. stream_throughput only gains an entry for a row
        // with BOTH figures valid, and the total was:
        //
        //     stream_throughput.reduce((a, b) => a + b)
        //
        // -- no initial value, so an empty array threw TypeError rather than
        // returning 0, and a report of nothing but partial rows took the worker down
        // instead of reporting no throughput. Seeded with 0, it now answers.
        //
        send({
            data: [row({ total_success: undefined, total_fail: undefined })],
        });

        expect(posted[0].stream_throughput).toBe(0);
    });

    it('still charts the rows behind a zero throughput', () => {
        //
        // zero throughput is a health figure, not an empty chart: the rows are still
        // published, which is what lets the page say 'nothing got through' rather than
        // showing nothing at all.
        //
        send({
            data: [row({ total_success: undefined, total_fail: undefined })],
        });

        expect(posted[0].chart_data_original).toHaveLength(1);
    });
});

describe('the source and stream tags', () => {
    it('duplicates the payload under a source-keyed name', () => {
        //
        // stream.jsx fires several of these at once and reads back
        // 'chart_data_<source>', so the same rows are published twice: once
        // generically and once tagged.
        //
        send({ data: [row()], source: 'price-source' });

        expect(posted[0].chart_data_price_source ?? posted[0]['chart_data_price-source'])
            .toEqual(posted[0].chart_data_original);
        expect(posted[0].selected_source).toBe('price-source');
    });

    it('tags the throughput by source as well', () => {
        send({ data: [row()], source: 'price-source' });

        expect(posted[0]['stream_throughput_price-source']).toBe(1000);
    });

    it('reports the selected stream when given one', () => {
        send({ data: [row()], stream: 'stockmarket' });

        expect(posted[0].selected_stream).toBe('stockmarket');
    });

    it('omits the tags when neither is supplied', () => {
        send({ data: [row()] });

        expect(posted[0]).not.toHaveProperty('selected_source');
        expect(posted[0]).not.toHaveProperty('selected_stream');
    });
});

describe('an unusable payload', () => {
    it('posts an empty result rather than throwing', () => {
        //
        // the shape the chart can render as "nothing yet" instead of breaking.
        //
        send({});

        expect(posted[0]).toEqual({
            chart_data_original: [],
            stream_throughput: 0,
            selected_source: null,
            selected_stream: null,
        });
    });

    it('treats a non-array data field as unusable', () => {
        send({ data: 'not-an-array' });

        expect(posted[0].chart_data_original).toEqual([]);
        expect(posted[0].stream_throughput).toBe(0);
    });

    it('treats an empty data array as unusable', () => {
        //
        // checkValidArray requires a non-empty array, so [] takes the empty-result
        // branch -- which is what saves it from the reduce defect above.
        //
        send({ data: [] });

        expect(posted[0].chart_data_original).toEqual([]);
        expect(posted[0].stream_throughput).toBe(0);
    });

    it('always posts exactly once', () => {
        //
        // unlike the distribution workers, which post a section at a time, this one
        // answers with a single message on every path.
        //
        send({ data: [row()] });

        expect(posted).toHaveLength(1);
    });
});
