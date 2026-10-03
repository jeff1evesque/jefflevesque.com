/**
 * scroll-margin.test.js: how far below the top of the screen an element asks to
 * be scrolled to.
 *
 * jsdom computes no stylesheet, so the margin a phone's pinned header gives a
 * view (#177) is handed in through getComputedStyle here, as a browser would
 * compute it from '_navigation_anonymous.scss'.
 */

import scrollMargin from '../../import/general/scroll-margin.js';

afterEach(() => {
    jest.restoreAllMocks();
});

function computed(value) {
    jest.spyOn(window, 'getComputedStyle').mockReturnValue({ scrollMarginTop: value });
}

describe('scrollMargin', () => {
    it('reads a computed scroll-margin-top, in px', () => {
        computed('78.4px');

        expect(scrollMargin(document.body)).toBeCloseTo(78.4);
    });

    it('is 0 where nothing sets one, as jsdom computes for every element', () => {
        const view = document.createElement('div');

        document.body.appendChild(view);

        expect(scrollMargin(view)).toBe(0);

        view.remove();
    });

    it.each([[''], ['auto'], [undefined]])('is 0 for a margin of %p, which is no length', (value) => {
        computed(value);

        expect(scrollMargin(document.body)).toBe(0);
    });
});
