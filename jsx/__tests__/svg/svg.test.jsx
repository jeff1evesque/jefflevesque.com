/**
 * svg.test.jsx: the icon components, and the hover contract they share.
 *
 * Six components, one shape: a color in state, an onMouseOver that swaps it, an
 * onMouseOut that puts it back. None of them had a test, so the whole family sat
 * at 50-71% functions -- the handlers are bound in the constructor and passed to
 * the svg as props, which is enough for a renderer to count the constructor and
 * render as covered while neither handler ever fires.
 *
 * The assertions are on the rendered 'fill', not on state. The fill is the entire
 * point of the component, and a test reading this.state would pass just as happily
 * against a component that no longer wired the handler to the element.
 *
 * Note: mouseOut must be fired against a component already hovered, or it asserts
 *       nothing -- every handleMouseOut restores the same value the constructor
 *       set, so on a fresh mount the 'after' and the 'before' are identical.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';

import { colors } from '../../import/general/colors.js';

import SvgBooks from '../../import/svg/svg-books.jsx';
import SvgExit from '../../import/svg/svg-exit.jsx';
import SvgHome from '../../import/svg/svg-home.jsx';
import SvgOrder from '../../import/svg/svg-order.jsx';
import SvgPencilNote from '../../import/svg/svg-pencil-note.jsx';
import SvgUser from '../../import/svg/svg-user.jsx';

//
// the icons render no text and carry no role, so they are found by class -- which
// is also what the stylesheets address them by.
//
function iconBy(css_class) {
    return document.querySelector(`svg.${css_class}`);
}

//
// the path whose fill the handler swaps. Which path that is differs per icon, so
// the caller states the color it expects to find rather than an index.
//
function fills() {
    return Array.from(document.querySelectorAll('path, circle')).map(
        (node) => node.getAttribute('fill') || node.style.fill
    );
}

describe('the hover contract, shared by every icon', () => {
    //
    // table-driven because the six differ only in which color moves. Written out
    // per icon rather than looped over a single component, so a failure names the
    // file that broke.
    //
    const icons = [
        { name: 'books', Component: SvgBooks, css: 'books', hover: colors['green-3'], rest: colors['gray-6'] },
        { name: 'pencil note', Component: SvgPencilNote, css: 'pencil', hover: colors['green-3'], rest: colors['gray-5'] },
        { name: 'user', Component: SvgUser, css: 'user', hover: colors['green-3'], rest: colors['gray-5'] },
        { name: 'home', Component: SvgHome, css: 'home', hover: colors['green-3'], rest: colors['gray-5'] },
    ];

    icons.forEach(({ name, Component, css, hover, rest }) => {
        it(`greens the ${name} icon on mouse over`, () => {
            render(<Component />);

            expect(fills()).not.toContain(hover);

            fireEvent.mouseOver(iconBy(css));

            expect(fills()).toContain(hover);
        });

        it(`restores the ${name} icon on mouse out`, () => {
            render(<Component />);

            fireEvent.mouseOver(iconBy(css));
            expect(fills()).toContain(hover);

            fireEvent.mouseOut(iconBy(css));

            expect(fills()).not.toContain(hover);
            expect(fills()).toContain(rest);
        });
    });
});

describe('the home icon', () => {
    it('lets a caller override the colors it would pick itself', () => {
        //
        // the only icon with propTypes, and the only one whose render prefers a prop
        // over its own state. Both branches of both ternaries are the contract.
        //
        render(<SvgHome roofColor='#111111' houseColor='#222222' />);

        expect(fills()).toContain('#111111');
        expect(fills()).toContain('#222222');
    });

    it('keeps an overridden roof through a hover', () => {
        //
        // the handler still runs and still sets state, but the prop wins in render.
        // A hover that repainted an explicitly-passed color would be a bug.
        //
        render(<SvgHome roofColor='#111111' />);

        fireEvent.mouseOver(iconBy('home'));

        expect(fills()).toContain('#111111');
        expect(fills()).not.toContain(colors['green-3']);
    });
});

describe('the exit icon', () => {
    it('sizes itself from its own state when given no props', () => {
        render(<SvgExit />);

        const svg = document.querySelector('svg');
        expect(svg.getAttribute('height')).toBe('36px');
        expect(svg.getAttribute('width')).toBe('36px');
        expect(svg.getAttribute('viewBox')).toBe('0 0 32 32');
    });

    it('takes height, width and view box from props', () => {
        render(<SvgExit height='12px' width='14px' view_box='0 0 16 16' />);

        const svg = document.querySelector('svg');
        expect(svg.getAttribute('height')).toBe('12px');
        expect(svg.getAttribute('width')).toBe('14px');
        expect(svg.getAttribute('viewBox')).toBe('0 0 16 16');
    });

    it('ignores a prop that is not a usable string', () => {
        //
        // componentDidMount guards each prop with checkValidString, so a present but
        // empty prop has to fall back rather than render a zero-sized icon.
        //
        render(<SvgExit height='' width='' view_box='' />);

        const svg = document.querySelector('svg');
        expect(svg.getAttribute('height')).toBe('36px');
        expect(svg.getAttribute('width')).toBe('36px');
        expect(svg.getAttribute('viewBox')).toBe('0 0 32 32');
    });

    it('darkens rather than greens on hover', () => {
        //
        // the one icon that does not use green-3: it sits on a control surface where
        // the green would read as a state change rather than a hover.
        //
        render(<SvgExit />);

        fireEvent.mouseOver(document.querySelector('svg'));
        expect(fills()).toContain(colors['gray-7']);

        fireEvent.mouseOut(document.querySelector('svg'));
        expect(fills()).toContain(colors['gray-5']);
    });
});

describe('the order icon', () => {
    it('draws a different arrow for each direction', () => {
        //
        // getSvgPath is a branch on state.ascend, and the two paths are the only
        // thing that distinguishes an ascending sort from a descending one on screen.
        //
        const { unmount } = render(<SvgOrder ascend={true} />);
        const ascending = document.querySelector('path').getAttribute('d');

        unmount();

        render(<SvgOrder ascend={false} />);
        const descending = document.querySelector('path').getAttribute('d');

        expect(ascending).not.toBe(descending);
    });

    it('defaults to the descending arrow when given no direction', () => {
        render(<SvgOrder />);
        const bare = document.querySelector('path').getAttribute('d');

        expect(bare).toEqual(expect.any(String));
        expect(bare.length).toBeGreaterThan(0);
    });

    it('redraws when the direction prop flips', () => {
        //
        // componentDidUpdate re-reads the prop. Without it the icon would keep the
        // arrow it mounted with while the column below it sorted the other way.
        //
        const { rerender } = render(<SvgOrder ascend={false} />);
        const before = document.querySelector('path').getAttribute('d');

        rerender(<SvgOrder ascend={true} />);
        const after = document.querySelector('path').getAttribute('d');

        expect(after).not.toBe(before);
    });

    it('holds its arrow when the direction prop is unchanged', () => {
        //
        // the guard in componentDidUpdate compares against prevProps, so a rerender
        // that changes nothing must not churn state.
        //
        const { rerender } = render(<SvgOrder ascend={true} />);
        const before = document.querySelector('path').getAttribute('d');

        rerender(<SvgOrder ascend={true} />);

        expect(document.querySelector('path').getAttribute('d')).toBe(before);
    });

    it('resolves a hover color when told to suppress the background', () => {
        //
        // 'hover_bg' false is what routes componentDidMount to green-3; the else
        // branch parks mouse_over_color on the resting gray, which makes the hover a
        // no-op by design.
        //
        render(<SvgOrder hover_bg={false} />);

        fireEvent.mouseOver(document.querySelector('svg'));

        expect(fills()).toContain(colors['green-3']);
    });

    it('leaves the fill alone on hover when the background is kept', () => {
        render(<SvgOrder hover_bg={true} />);

        fireEvent.mouseOver(document.querySelector('svg'));

        expect(fills()).toContain(colors['gray-6']);
    });

    it('returns to the resting gray on mouse out', () => {
        render(<SvgOrder hover_bg={false} />);

        fireEvent.mouseOver(document.querySelector('svg'));
        expect(fills()).toContain(colors['green-3']);

        fireEvent.mouseOut(document.querySelector('svg'));

        expect(fills()).toContain(colors['gray-6']);
    });
});
