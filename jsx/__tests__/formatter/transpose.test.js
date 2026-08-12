/**
 * transpose.test.js: object of arrays to array of arrays.
 *
 * The ragged case is the one that matters and is documented in the module's own
 * example: the result is as long as the LONGEST array, so a shorter column
 * contributes 'undefined' in the rows past its end rather than the row being
 * dropped. Callers render these as table rows, so a silently shortened result
 * would lose data.
 */

import transpose from '../../import/formatter/transpose.js';

describe('transpose', () => {
    it('turns columns into rows', () => {
        expect(transpose({ a: [1, 2], b: ['x', 'y'] })).toEqual([
            [1, 'x'],
            [2, 'y'],
        ]);
    });

    it('preserves key order as column order', () => {
        //
        // the header row is built from Object.keys elsewhere, so the two have to
        // agree on order or every value lands under the wrong heading.
        //
        expect(transpose({ first: [1], second: [2], third: [3] })).toEqual([[1, 2, 3]]);
    });

    it('pads a short column with undefined rather than truncating', () => {
        //
        // the exact case from the module's docstring: 'decision_function' has two
        // entries where 'classes' has three.
        //
        expect(transpose({
            decision_function: [1.5, 2.5],
            classes: ['a', 'b', 'c'],
        })).toEqual([
            [1.5, 'a'],
            [2.5, 'b'],
            [undefined, 'c'],
        ]);
    });

    it('is as long as the longest column', () => {
        expect(transpose({ a: [1], b: [1, 2, 3, 4] })).toHaveLength(4);
    });

    it('handles a single column', () => {
        expect(transpose({ only: [1, 2, 3] })).toEqual([[1], [2], [3]]);
    });

    it('returns nothing for an object with no keys', () => {
        //
        // Math.max of no arguments is -Infinity, which Array.from reads as length
        // zero -- so this is [] rather than a throw.
        //
        expect(transpose({})).toEqual([]);
    });

    it('returns nothing when every column is empty', () => {
        expect(transpose({ a: [], b: [] })).toEqual([]);
    });

    it('preserves value types rather than stringifying', () => {
        const result = transpose({ n: [1], s: ['x'], b: [true], z: [null] });

        expect(result).toEqual([[1, 'x', true, null]]);
    });
});
