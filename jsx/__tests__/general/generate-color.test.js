/**
 * generate-color.test.js: HSV to RGB, for evenly spaced wheel colours.
 *
 * Used to generate a colour per series when the count is not known ahead of
 * time, by walking the hue wheel at a fixed interval. The six switch branches
 * are the six 60-degree sectors of the wheel, and each is covered here -- an
 * error in one shows up as a single wrong band of hues rather than as a failure.
 */

import getColor from '../../import/general/generate-color.js';

describe('getColor, primary and secondary hues', () => {
    it('h=0 is red', () => {
        expect(getColor(0, 1, 1)).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('h=1/6 is yellow', () => {
        expect(getColor(1 / 6, 1, 1)).toEqual({ r: 255, g: 255, b: 0 });
    });

    it('h=2/6 is green', () => {
        expect(getColor(2 / 6, 1, 1)).toEqual({ r: 0, g: 255, b: 0 });
    });

    it('h=3/6 is cyan', () => {
        expect(getColor(3 / 6, 1, 1)).toEqual({ r: 0, g: 255, b: 255 });
    });

    it('h=4/6 is blue', () => {
        expect(getColor(4 / 6, 1, 1)).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('h=5/6 is magenta', () => {
        expect(getColor(5 / 6, 1, 1)).toEqual({ r: 255, g: 0, b: 255 });
    });
});

describe('saturation and value', () => {
    it('zero saturation is grey at the given value', () => {
        expect(getColor(0.5, 0, 1)).toEqual({ r: 255, g: 255, b: 255 });
        expect(getColor(0.5, 0, 0.5)).toEqual({ r: 128, g: 128, b: 128 });
    });

    it('zero value is black whatever the hue', () => {
        [0, 0.25, 0.5, 0.75].forEach(h => {
            expect(getColor(h, 1, 0)).toEqual({ r: 0, g: 0, b: 0 });
        });
    });

    it('half value halves the channel', () => {
        expect(getColor(0, 1, 0.5)).toEqual({ r: 128, g: 0, b: 0 });
    });
});

describe('output shape', () => {
    it('returns integers in 0..255', () => {
        for (let i = 0; i < 24; i++) {
            const { r, g, b } = getColor(i / 24, 1, 1);

            [r, g, b].forEach(c => {
                expect(Number.isInteger(c)).toBe(true);
                expect(c).toBeGreaterThanOrEqual(0);
                expect(c).toBeLessThanOrEqual(255);
            });
        }
    });

    it('gives 24 distinct colours around the wheel, as the docstring describes', () => {
        const seen = new Set();

        for (let i = 0; i < 24; i++) {
            const { r, g, b } = getColor(i / 24, 1, 1);
            seen.add(`${r},${g},${b}`);
        }

        expect(seen.size).toBe(24);
    });

    it('does NOT accept a single object argument, despite the code for it', () => {
        //
        // DOCUMENTS DEAD CODE.
        //
        // HSVtoRGB opens with a destructuring convenience:
        //
        //     if (arguments.length === 1) { s = h.s, v = h.v, h = h.h; }
        //
        // but the only export forwards three arguments unconditionally:
        //
        //     return HSVtoRGB(h, s, v)
        //
        // so arguments.length is always 3 and that branch can never run. Passing
        // an object gives h={...}, s=undefined, v=undefined, and the arithmetic
        // yields NaN channels -- which render as no colour rather than raising.
        //
        // Either the export should forward its arguments, or the branch should go.
        //
        const { r, g, b } = getColor({ h: 0, s: 1, v: 1 });

        expect(Number.isNaN(r)).toBe(true);
        expect(Number.isNaN(g)).toBe(true);
        expect(Number.isNaN(b)).toBe(true);
    });
});

describe('out of range hue', () => {
    it('wraps a hue at or above 1 back to the start of the wheel', () => {
        expect(getColor(1, 1, 1)).toEqual(getColor(0, 1, 1));
    });

    it('yields NaN channels for a negative hue', () => {
        //
        // DOCUMENTS A LIMIT, not intended behaviour. The sector is chosen with
        // 'i % 6', and javascript's remainder keeps the sign -- so a negative hue
        // produces a negative index, matches no case in the switch, and leaves
        // r/g/b undefined. Math.round(undefined * 255) is NaN, which renders as
        // no colour at all rather than as an error.
        //
        // Callers walk i/count upward from zero, so this is unreachable today.
        //
        const { r, g, b } = getColor(-0.1, 1, 1);

        expect(Number.isNaN(r)).toBe(true);
        expect(Number.isNaN(g)).toBe(true);
        expect(Number.isNaN(b)).toBe(true);
    });
});
