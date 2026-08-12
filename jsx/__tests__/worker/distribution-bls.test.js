/**
 * distribution-bls.test.js: the bls distribution web-worker.
 *
 * These modules are the reason the 'new Function()' pattern in this codebase is
 * worth pinning. A worker cannot receive functions through postMessage, so
 * data.jsx sends five validators as SOURCE TEXT:
 *
 *     stringifiedTrim: trim.toString(),
 *     stringifiedCheckValidInt: checkValidInt.toString(),
 *     ...
 *
 * and each worker rebuilds them with `new Function('return ' + text)()`. So the
 * validator that runs inside the worker is not the module I unit tested -- it is a
 * reconstruction of its source. These tests pass the REAL validators' .toString()
 * output, exactly as data.jsx does, which is the only way to know the
 * reconstruction actually works.
 *
 * Note: the worker is driven directly rather than through a real Worker. The
 *       exported factory assigns 'self.onmessage', and jsdom provides 'self', so
 *       calling the factory and then invoking that handler runs the genuine
 *       transformation without needing a Worker at all.
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

import blsWorker from '../../import/worker/data/distribution/bls.js';

//
// a module-scope constant, used only by the test below that demonstrates why a
// validator may not reference anything outside itself. This is defined here and so
// resolves normally in this file -- which is precisely the point: it resolves at
// module scope and is still absent from the function's own source text.
//
const OUTER_CONSTANT = ['CPI'];

//
// the payload data.jsx builds, with the validators as source text.
//
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
    blsWorker();
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

describe('the stringified validators', () => {
    it('reconstruct and run without throwing', () => {
        //
        // the load-bearing assertion for the whole pattern. If any of the five
        // validators stopped being reconstructible -- by gaining an import, a
        // closure, or anything else not captured by toString() -- the worker would
        // throw here, and in production it would fail inside a Worker where nothing
        // surfaces it.
        //
        expect(() => send({
            'data-distribution': [{ series: 'CPI', category: 'Reports', total_records: '5' }],
            stream: 'bls',
        })).not.toThrow();
    });

    it('behave identically to the imported originals', () => {
        //
        // proves the reconstruction is faithful rather than merely runnable: the
        // rebuilt checkValidInt has to reject a non-integer exactly as the real one
        // does, or rows would be counted that should not be.
        //
        send({
            'data-distribution': [
                { series: 'CPI', category: 'Reports', total_records: '5' },
                { series: 'PPI', category: 'Reports', total_records: 'not-a-number' },
            ],
            stream: 'bls',
        });

        expect(checkValidInt('not-a-number')).toBe(false);
        expect(posted[0].records).toBe(5);
    });

    it('cannot rebuild a validator the build has rewritten', () => {
        //
        // DOCUMENTS THE SHARPEST FORM OF THE HAZARD, and it is not hypothetical --
        // this is what made these suites fail the moment coverage was switched on.
        //
        // toString() returns whatever the BUILD left behind, not what was written.
        // Under coverage, babel-plugin-istanbul rewrites each validator to bump a
        // counter:
        //
        //     function checkValidObject(k, v) { cov_2d45h1a6k4().f[0]++; ... }
        //
        // new Function() evaluates that text in global scope, where 'cov_...' does not
        // exist, so the rebuilt validator throws the first time it runs.
        //
        // The implication for production is the point: ANY build step that injects a
        // reference into these five functions -- an instrumenter, a transpiler helper,
        // a minifier that hoists something -- breaks every worker, at runtime, inside
        // a Worker where nothing surfaces it. The functions have to survive being
        // stringified and re-evaluated with NO surrounding scope, and nothing in the
        // build guarantees that.
        //
        // The assertion branches on whether instrumentation is actually present, so
        // this test says something true whether the suite runs with coverage or
        // without, rather than passing only in CI.
        //
        const source = realCheckValidObject.toString();
        const rewritten = /cov_[0-9a-z]+/.test(source);

        const attempt = () => self.onmessage({
            data: {
                ...payload({}).data,
                stringifiedCheckValidObject: source,
                item: {
                    'data-distribution': [{ series: 'CPI', category: 'Reports', total_records: '5' }],
                    stream: 'bls',
                },
            },
        });

        if (rewritten) {
            expect(attempt).toThrow(ReferenceError);
        } else {
            //
            // uninstrumented, the real validator is self-contained and rebuilds
            // cleanly -- which is the property the workers silently depend on.
            //
            expect(attempt).not.toThrow();
        }
    });

    it('breaks if a validator stops being self-contained', () => {
        //
        // DOCUMENTS THE UNDOCUMENTED CONSTRAINT this pattern imposes.
        //
        // toString() captures a function's SOURCE, not its scope. The function below
        // resolves OUTER_CONSTANT perfectly well here, because it is defined at the
        // top of this file -- but its source text says only 'OUTER_CONSTANT', and
        // new Function() evaluates that in global scope where nothing of that name
        // exists. So it reconstructs successfully and throws when called, inside the
        // worker, where nothing surfaces it.
        //
        // Nothing states this requirement anywhere, and nothing enforces it. All
        // five validators happen to be self-contained today.
        //
        const withOuterReference = function (v) { return OUTER_CONSTANT.includes(v); };

        const broken = {
            data: {
                ...payload({}).data,
                stringifiedCheckValidString: withOuterReference.toString(),
                item: {
                    'data-distribution': [{ series: 'CPI', category: 'Reports', total_records: '5' }],
                    stream: 'bls',
                },
            },
        };

        expect(() => self.onmessage(broken)).toThrow(ReferenceError);
    });
});

describe('the distribution transformation', () => {
    it('totals the records across rows', () => {
        send({
            'data-distribution': [
                { series: 'CPI', category: 'Reports', total_records: '5' },
                { series: 'PPI', category: 'Reports', total_records: '7' },
            ],
            stream: 'bls',
        });

        expect(posted[0].records).toBe(12);
    });

    it('keys the x-axis on series, not category', () => {
        //
        // the documented reason: a single month often returns one category, and
        // keying on it collapsed the whole chart into one fat striped bar. One bar
        // per series is what makes it readable.
        //
        send({
            'data-distribution': [
                { series: 'CPI', category: 'Reports', total_records: '5' },
                { series: 'PPI', category: 'Reports', total_records: '7' },
            ],
            stream: 'bls',
        });

        expect(posted[0].aggregate_key).toBe('series');
        expect(posted[0].data_distribution).toHaveLength(2);
    });

    it('stacks a category as a field on its series row', () => {
        send({
            'data-distribution': [{ series: 'CPI', category: 'Reports', total_records: '5' }],
            stream: 'bls',
        });

        expect(posted[0].data_distribution[0]).toEqual({ series: 'CPI', Reports: 5 });
    });

    it('merges two categories onto one series row', () => {
        //
        // the stacking case: same series, different category, one bar with two
        // segments rather than two bars.
        //
        send({
            'data-distribution': [
                { series: 'CPI', category: 'Reports', total_records: '5' },
                { series: 'CPI', category: 'Revisions', total_records: '2' },
            ],
            stream: 'bls',
        });

        expect(posted[0].data_distribution).toHaveLength(1);
        expect(posted[0].data_distribution[0]).toEqual({ series: 'CPI', Reports: 5, Revisions: 2 });
    });

    it('parses counts to numbers rather than leaving them as text', () => {
        //
        // they arrive as csv strings; left as text the chart would sort them
        // lexically and stack them by concatenation.
        //
        send({
            'data-distribution': [{ series: 'CPI', category: 'Reports', total_records: '12' }],
            stream: 'bls',
        });

        expect(posted[0].data_distribution[0].Reports).toBe(12);
        expect(typeof posted[0].records).toBe('number');
    });

    it('trims whitespace out of series and category names', () => {
        send({
            'data-distribution': [{ series: '  CPI  ', category: '  Reports  ', total_records: '5' }],
            stream: 'bls',
        });

        expect(posted[0].data_distribution[0]).toEqual({ series: 'CPI', Reports: 5 });
    });

    it('skips a malformed row and reports it, keeping the rest', () => {
        //
        // one bad row must not lose the chart.
        //
        send({
            'data-distribution': [
                { series: 'CPI', category: 'Reports', total_records: '5' },
                { nonsense: true },
            ],
            stream: 'bls',
        });

        expect(posted[0].data_distribution).toHaveLength(1);
        expect(quiet).toHaveBeenCalled();
    });

    it('carries the source and stream tags through', () => {
        send({
            'data-distribution': [{ series: 'CPI', category: 'Reports', total_records: '5' }],
            stream: 'bls',
            source: 'bls-source',
        });

        expect(posted[0].selected_stream).toBe('bls');
        expect(posted[0].selected_source).toBe('bls-source');
    });

    it('posts null for a stream it does not handle', () => {
        //
        // each worker handles exactly one stream, so a mismatched payload posts null
        // rather than transforming it wrongly.
        //
        send({
            'data-distribution': [{ series: 'CPI', category: 'Reports', total_records: '5' }],
            stream: 'sec',
        });

        expect(posted[0]).toBeNull();
        expect(quiet).toHaveBeenCalled();
    });

    it('posts nothing at all when there is no distribution section', () => {
        send({ stream: 'bls' });

        expect(posted).toHaveLength(0);
    });
});

describe('the partition count', () => {
    it('sums the counts and posts them separately', () => {
        //
        // a second postMessage rather than a field on the first: the two sections
        // arrive independently, so the consumer gets each as it is ready.
        //
        send({
            partition: [{ count: '3' }, { count: '4' }],
            stream: 'bls',
        });

        expect(posted).toHaveLength(1);
        expect(posted[0]).toEqual({ count: 7, selected_stream: 'bls' });
    });

    it('treats a non-numeric count as zero rather than NaN', () => {
        //
        // a NaN would propagate into the total and render as a blank partition
        // figure instead of a wrong one, which is harder to notice.
        //
        send({
            partition: [{ count: '3' }, { count: 'nonsense' }],
            stream: 'bls',
        });

        expect(posted[0].count).toBe(3);
    });

    it('posts both sections when both are present', () => {
        send({
            'data-distribution': [{ series: 'CPI', category: 'Reports', total_records: '5' }],
            partition: [{ count: '2' }],
            stream: 'bls',
        });

        expect(posted).toHaveLength(2);
        expect(posted[0].aggregate_key).toBe('series');
        expect(posted[1].count).toBe(2);
    });

    it('ignores an empty partition array', () => {
        send({ partition: [], stream: 'bls' });

        expect(posted).toHaveLength(0);
    });
});
