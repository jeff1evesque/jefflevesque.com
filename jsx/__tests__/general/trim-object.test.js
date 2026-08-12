/**
 * trim-object.test.js: recursive whitespace trim.
 *
 * Implemented through JSON.stringify with a replacer and a re-parse, which is
 * what makes it recursive for free -- and also what gives it the limits covered
 * below. Values arriving from a form or a query string carry stray whitespace
 * that would otherwise reach a validator or an api param.
 */

import trim from '../../import/general/trim-object.js';

describe('trim', () => {
    it('trims string values', () => {
        expect(trim({ a: '  x  ' })).toEqual({ a: 'x' });
    });

    it('trims nested values at any depth', () => {
        expect(trim({ a: { b: { c: ' deep ' } } })).toEqual({ a: { b: { c: 'deep' } } });
    });

    it('trims strings inside arrays', () => {
        expect(trim({ a: [' x ', ' y '] })).toEqual({ a: ['x', 'y'] });
    });

    it('leaves non-strings alone', () => {
        expect(trim({ n: 1, b: true, z: null })).toEqual({ n: 1, b: true, z: null });
    });

    it('reduces a whitespace-only string to empty', () => {
        //
        // this is what makes checkValidString meaningful downstream: '   ' becomes
        // '' and is then correctly rejected as empty.
        //
        expect(trim({ a: '   ' })).toEqual({ a: '' });
    });

    it('accepts a bare string or array, not only an object', () => {
        expect(trim(' x ')).toBe('x');
        expect(trim([' x ', ' y '])).toEqual(['x', 'y']);
    });

    it('does not mutate its argument', () => {
        const input = { a: '  x  ' };

        trim(input);

        expect(input.a).toBe('  x  ');
    });

    it('drops undefined values, as JSON does', () => {
        //
        // a limit of the stringify/parse approach rather than a decision: JSON has
        // no undefined, so the key disappears entirely.
        //
        expect(trim({ a: ' x ', b: undefined })).toEqual({ a: 'x' });
    });

    it('turns a Date into its ISO string', () => {
        //
        // another consequence of round-tripping through JSON: Date has a toJSON,
        // so it comes back as text and is no longer a Date.
        //
        const result = trim({ when: new Date(Date.UTC(2026, 0, 1)) });

        expect(typeof result.when).toBe('string');
        expect(result.when).toContain('2026-01-01');
    });
});
