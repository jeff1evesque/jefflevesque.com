/**
 * breakpoints.test.js: the responsive breakpoints handed to rearm.
 *
 * These decide which layout branch every BreakpointRender takes, so a changed
 * number silently reflows the whole app rather than failing. They are pinned to
 * bootstrap's values on purpose -- the stylesheet uses bootstrap's media queries,
 * and if these drift the javascript and the css disagree about what 'medium' is.
 */

import {
    breakpoints,
    breakpoints_exact,
    large_minWidth,
    medium_maxWidth,
    medium_minWidth,
    small_maxWidth
} from '../../import/general/breakpoints.js';

describe('the raw widths', () => {
    it('match bootstrap', () => {
        expect(small_maxWidth).toBe(576);
        expect(medium_minWidth).toBe(768);
        expect(medium_maxWidth).toBe(992);
        expect(large_minWidth).toBe(1200);
    });

    it('ascend, so the bands cannot invert', () => {
        expect(small_maxWidth).toBeLessThan(medium_minWidth);
        expect(medium_minWidth).toBeLessThan(medium_maxWidth);
        expect(medium_maxWidth).toBeLessThan(large_minWidth);
    });
});

describe('breakpoints', () => {
    it('names small, medium and large in ascending order', () => {
        expect(breakpoints.map(b => b.name)).toEqual(['small', 'medium', 'large']);
    });

    it('leaves small open at the bottom and large open at the top', () => {
        //
        // no minWidth on small and no maxWidth on large, so every viewport width
        // falls in some band -- an unmatched width renders no branch at all.
        //
        expect(breakpoints[0]).not.toHaveProperty('minWidth');
        expect(breakpoints[2]).not.toHaveProperty('maxWidth');
    });

    it('derives its bounds from the shared widths', () => {
        expect(breakpoints[0].maxWidth).toBe(small_maxWidth);
        expect(breakpoints[1].minWidth).toBe(medium_minWidth);
        expect(breakpoints[1].maxWidth).toBe(medium_maxWidth);
        expect(breakpoints[2].minWidth).toBe(large_minWidth);
    });

    it('is not flagged exact', () => {
        breakpoints.forEach(b => expect(b.exact).toBeUndefined());
    });
});

describe('breakpoints_exact', () => {
    it('carries the same bands, flagged exact', () => {
        expect(breakpoints_exact.map(b => b.name)).toEqual(['small', 'medium', 'large']);
        breakpoints_exact.forEach(b => expect(b.exact).toBe(true));
    });

    it('uses bounds identical to the non-exact set', () => {
        //
        // the only intended difference between the two is the flag. Divergent
        // bounds would mean two components disagreeing about the same viewport.
        //
        breakpoints_exact.forEach((b, i) => {
            expect(b.minWidth).toBe(breakpoints[i].minWidth);
            expect(b.maxWidth).toBe(breakpoints[i].maxWidth);
        });
    });
});
