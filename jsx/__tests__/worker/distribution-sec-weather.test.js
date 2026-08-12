/**
 * distribution-sec-weather.test.js: the sec and us-weather-alert workers.
 *
 * These two share bls's shape exactly -- same stringified-validator preamble, same
 * two-section postMessage, same aggregate-and-stack transformation -- and differ
 * only in which fields they key on:
 *
 *     bls      series   / category / total_records
 *     sec      form     / category / total_records
 *     weather  severity / event    / total_events
 *
 * So they are driven from one table. Where the four distribution loaders under
 * general/get-data/ were byte-identical in their first 117 lines, these workers
 * are the same shape re-typed with different field names -- the same duplication
 * one level down.
 *
 * Note: the validators arrive as SOURCE TEXT and are rebuilt with new Function().
 *       The real validators' .toString() is passed here, as data.jsx does, so the
 *       reconstruction is exercised rather than bypassed.
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

import secWorker from '../../import/worker/data/distribution/sec.js';
import weatherWorker from '../../import/worker/data/distribution/us-weather-alert.js';

//
// each worker's stream name, the field it aggregates on, the field it stacks by,
// the field carrying the count, and any prefix applied to the aggregated key.
//
// Note: sec prefixes its key with 'Form '. That is deliberate and documented in the
//       worker -- edgar form types are bare tokens ('4', '8-K', '13F-HR'), so an
//       unprefixed axis reads as a loose number rather than a form. It is the one
//       place these two workers genuinely differ beyond field names.
//
const WORKERS = [
    ['sec', secWorker, 'sec', 'form', 'category', 'total_records', 'Form '],
    ['us-weather-alert', weatherWorker, 'usnationalweather', 'severity', 'event', 'total_events', ''],
];

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
});

afterEach(() => {
    self.postMessage = realPostMessage;
    self.onmessage = null;
    quiet.mockRestore();
});

function row(keyField, stackField, countField, key, stack, count) {
    return { [keyField]: key, [stackField]: stack, [countField]: String(count) };
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
    it.each(WORKERS)('%s reconstructs them without throwing', (name, worker, stream, k, s, c) => {
        worker();

        expect(() => self.onmessage(payload({
            'data-distribution': [row(k, s, c, 'A', 'X', 5)],
            stream,
        }))).not.toThrow();
    });
});

describe('the distribution transformation', () => {
    it.each(WORKERS)('%s totals the counts across rows', (name, worker, stream, k, s, c) => {
        worker();

        self.onmessage(payload({
            'data-distribution': [row(k, s, c, 'A', 'X', 5), row(k, s, c, 'B', 'X', 7)],
            stream,
        }));

        expect(posted[0].records).toBe(12);
    });

    it.each(WORKERS)('%s reports the field it aggregates on', (name, worker, stream, k) => {
        worker();

        self.onmessage(payload({
            'data-distribution': [row(k, 'category', 'total_records', 'A', 'X', 5)],
            stream,
        }));

        expect(posted[0].aggregate_key).toBe(k);
    });

    it.each(WORKERS)('%s stacks the second field onto the keyed row', (name, worker, stream, k, s, c, prefix) => {
        worker();

        self.onmessage(payload({
            'data-distribution': [row(k, s, c, 'A', 'X', 5)],
            stream,
        }));

        expect(posted[0].data_distribution[0]).toEqual({ [k]: `${prefix}A`, X: 5 });
    });

    it('sec labels its axis with a Form prefix', () => {
        //
        // asserted on its own as well as through the table, because it is a
        // presentation decision rather than a mechanical one: '8-K' alone on an axis
        // is ambiguous, 'Form 8-K' is not.
        //
        secWorker();

        self.onmessage(payload({
            'data-distribution': [
                { form: '8-K', category: 'Filings', total_records: '3' },
                { form: '4', category: 'Filings', total_records: '9' },
            ],
            stream: 'sec',
        }));

        const forms = posted[0].data_distribution.map(r => r.form);
        expect(forms).toContain('Form 8-K');
        expect(forms).toContain('Form 4');
    });

    it('us-weather-alert applies no prefix', () => {
        //
        // severities are already words ('Severe', 'Extreme'), so a prefix would only
        // add noise.
        //
        weatherWorker();

        self.onmessage(payload({
            'data-distribution': [{ severity: 'Severe', event: 'Flood', total_events: '4' }],
            stream: 'usnationalweather',
        }));

        expect(posted[0].data_distribution[0].severity).toBe('Severe');
    });

    it('us-weather-alert merges two stack values onto one row', () => {
        weatherWorker();

        self.onmessage(payload({
            'data-distribution': [
                { severity: 'Severe', event: 'Flood', total_events: '5' },
                { severity: 'Severe', event: 'Wind', total_events: '2' },
            ],
            stream: 'usnationalweather',
        }));

        expect(posted[0].data_distribution).toHaveLength(1);
        expect(posted[0].data_distribution[0]).toEqual({ severity: 'Severe', Flood: 5, Wind: 2 });
    });

    it('sec OVERWRITES rather than merging a second category', () => {
        //
        // DOCUMENTS A DEFECT.
        //
        // The merge branch tests the UNPREFIXED key:
        //
        //     'form' in v && trim(v.form) in data_reformat && ...
        //
        // while the store branch writes under the PREFIXED one:
        //
        //     const form_key = `Form ${trim(v.form)}`;
        //     data_reformat[form_key] = record;
        //
        // 'A' is never a key -- 'Form A' is -- so the merge branch can never match.
        // Every row falls to the else branch, which assigns a fresh record, and the
        // second category replaces the first instead of stacking beside it.
        //
        // Latent today: api-datalake's sec query selects a CONSTANT category
        // ("select 'Filings' as category"), so a form only ever has one category and
        // the collision never happens. It would appear the moment sec reported a
        // second category, as a silently under-reported chart rather than an error.
        //
        // bls and us-weather-alert do not have this: both store under the same
        // unprefixed key they test for. The prefix is what breaks the pairing.
        //
        // When fixed, this should assert both categories survive.
        //
        secWorker();

        self.onmessage(payload({
            'data-distribution': [
                { form: 'A', category: 'X', total_records: '5' },
                { form: 'A', category: 'Y', total_records: '2' },
            ],
            stream: 'sec',
        }));

        expect(posted[0].data_distribution).toHaveLength(1);
        expect(posted[0].data_distribution[0]).toEqual({ form: 'Form A', Y: 2 });
        expect(posted[0].data_distribution[0]).not.toHaveProperty('X');
    });

    it('sec still totals every row, even the ones it overwrites', () => {
        //
        // the count is accumulated separately from the reshaping, so the total stays
        // right while the breakdown loses a category. That asymmetry is what makes
        // the defect hard to spot: the headline number agrees with the data.
        //
        secWorker();

        self.onmessage(payload({
            'data-distribution': [
                { form: 'A', category: 'X', total_records: '5' },
                { form: 'A', category: 'Y', total_records: '2' },
            ],
            stream: 'sec',
        }));

        expect(posted[0].records).toBe(7);
    });

    it.each(WORKERS)('%s parses counts to numbers', (name, worker, stream, k, s, c) => {
        worker();

        self.onmessage(payload({
            'data-distribution': [row(k, s, c, 'A', 'X', 12)],
            stream,
        }));

        expect(posted[0].data_distribution[0].X).toBe(12);
        expect(typeof posted[0].records).toBe('number');
    });

    it.each(WORKERS)('%s trims whitespace out of the keys', (name, worker, stream, k, s, c, prefix) => {
        worker();

        self.onmessage(payload({
            'data-distribution': [row(k, s, c, '  A  ', '  X  ', 5)],
            stream,
        }));

        expect(posted[0].data_distribution[0]).toEqual({ [k]: `${prefix}A`, X: 5 });
    });

    it.each(WORKERS)('%s skips a malformed row and keeps the rest', (name, worker, stream, k, s, c) => {
        worker();

        self.onmessage(payload({
            'data-distribution': [row(k, s, c, 'A', 'X', 5), { nonsense: true }],
            stream,
        }));

        expect(posted[0].data_distribution).toHaveLength(1);
        expect(quiet).toHaveBeenCalled();
    });

    it.each(WORKERS)('%s carries source and stream through', (name, worker, stream, k, s, c) => {
        worker();

        self.onmessage(payload({
            'data-distribution': [row(k, s, c, 'A', 'X', 5)],
            stream,
            source: 'a-source',
        }));

        expect(posted[0].selected_stream).toBe(stream);
        expect(posted[0].selected_source).toBe('a-source');
    });

    it.each(WORKERS)('%s posts null for a stream it does not handle', (name, worker, stream, k, s, c) => {
        //
        // each worker answers for exactly one stream, so a mismatched payload posts
        // null rather than transforming it under the wrong shape.
        //
        worker();

        self.onmessage(payload({
            'data-distribution': [row(k, s, c, 'A', 'X', 5)],
            stream: 'some-other-stream',
        }));

        expect(posted[0]).toBeNull();
        expect(quiet).toHaveBeenCalled();
    });

    it.each(WORKERS)('%s posts nothing without a distribution section', (name, worker, stream) => {
        worker();

        self.onmessage(payload({ stream }));

        expect(posted).toHaveLength(0);
    });
});

describe('the partition count', () => {
    it.each(WORKERS)('%s sums the counts and posts them separately', (name, worker, stream) => {
        worker();

        self.onmessage(payload({ partition: [{ count: '3' }, { count: '4' }], stream }));

        expect(posted).toEqual([{ count: 7, selected_stream: stream }]);
    });

    it.each(WORKERS)('%s treats a non-numeric count as zero', (name, worker, stream) => {
        worker();

        self.onmessage(payload({ partition: [{ count: '3' }, { count: 'x' }], stream }));

        expect(posted[0].count).toBe(3);
    });

    it.each(WORKERS)('%s ignores an empty partition array', (name, worker, stream) => {
        worker();

        self.onmessage(payload({ partition: [], stream }));

        expect(posted).toHaveLength(0);
    });

    it.each(WORKERS)('%s posts both sections when both are present', (name, worker, stream, k, s, c) => {
        worker();

        self.onmessage(payload({
            'data-distribution': [row(k, s, c, 'A', 'X', 5)],
            partition: [{ count: '2' }],
            stream,
        }));

        expect(posted).toHaveLength(2);
        expect(posted[1].count).toBe(2);
    });
});
