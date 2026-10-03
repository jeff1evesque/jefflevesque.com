/**
 * scroll-margin.js: how far below the top of the screen an element asks to be
 * scrolled to -- its computed 'scroll-margin-top', in px.
 *
 * A phone's pinned header (#177) gives the views that scroll themselves into
 * sight a margin as tall as the bar and the room under it, so they stop below
 * the bar rather than under it -- see '_navigation_anonymous.scss'. The same
 * margin says when a view needs the scroll at all: when its top is above it.
 * Where nothing sets one -- a wide screen -- it is 0, the top of the screen.
 *
 * Note: jsdom computes no stylesheet, and gives an empty string, so it reads 0
 *       under jest.
 */

export default function scrollMargin(element) {
    const margin = parseFloat(window.getComputedStyle(element).scrollMarginTop);

    return Number.isFinite(margin) ? margin : 0;
}
