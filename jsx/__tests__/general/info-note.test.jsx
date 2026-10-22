/**
 * info-note.test.jsx: a name, the info icon after it, and the note that says
 * what the name means (#206).
 *
 * Held here: that the note shows wherever a reader reaches for it -- under the
 * pointer, from the keyboard, at a tap -- that it describes the name rather than
 * replacing it, and that it is anchored on the icon rather than the middle of
 * the name.
 *
 * And that a tapped note stays until the next tap, as long as reading it takes
 * (#281).
 *
 * And that the note's box stands as far from the text on its right as on its
 * left, however the note's lines break (#237).
 *
 * Note: jsdom lays nothing out, so where the note lands is the browser's. What
 *       can be held is which element the tooltip's popper measures itself
 *       against, and what the box is set to for the lines a browser reports.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import InfoNote, { fitNote } from '../../import/general/info-note.jsx';

const NOTE = 'Percent of records that succeeded';
const OTHER = 'Minutes since the last record arrived';

function draw() {
    render(<InfoNote note={NOTE} className='a-figure'>Health</InfoNote>);

    const name = document.querySelector('.a-figure');

    return { name: name, icon: name.querySelector('svg') };
}

//
// a tap, as a phone sends one: the touch, the mouse event a browser follows it
// with, and the click it ends in. The mouse event is the one a tooltip must not
// take for a pointer arriving
//
function tap(element) {
    fireEvent.touchStart(element);
    fireEvent.touchEnd(element);
    fireEvent.mouseOver(element);
    fireEvent.click(element);
}

describe('the name', () => {
    it('is drawn as it was handed in, in the class it was given', () => {
        const { name } = draw();

        expect(name.tagName).toBe('SPAN');
        expect(name).toHaveTextContent('Health');
    });

    it('is followed by an info icon, hidden from screen readers', () => {
        const { icon } = draw();

        expect(icon).toHaveAttribute('data-testid', 'InfoOutlinedIcon');
        expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('is still read by its name, with the note describing it', () => {
        const { name } = draw();

        expect(name).toHaveAccessibleDescription(NOTE);
    });

    it('carries no class of its own when it is given none', () => {
        render(<InfoNote note={NOTE}>Health</InfoNote>);

        expect(screen.getByText('Health').getAttribute('class') || '').toBe('');
    });
});

describe('the note', () => {
    it('shows under the pointer, over the name', async () => {
        const { name } = draw();

        fireEvent.mouseOver(name);

        expect(await screen.findByRole('tooltip')).toHaveTextContent(NOTE);
    });

    it('shows under the pointer, over the icon', async () => {
        const { icon } = draw();

        fireEvent.mouseOver(icon);

        expect(await screen.findByRole('tooltip')).toHaveTextContent(NOTE);
    });

    it('shows from the keyboard, since the name can take focus', async () => {
        const { name } = draw();

        expect(name).toHaveAttribute('tabindex', '0');

        //
        // MUI shows a tooltip on focus only when the focus came from the
        // keyboard, as a Tab does
        //
        fireEvent.keyDown(document.body, { key: 'Tab' });
        act(() => name.focus());

        expect(await screen.findByRole('tooltip')).toHaveTextContent(NOTE);
    });

    it('is anchored on the icon, not the middle of the name', async () => {
        const { name, icon } = draw();
        const box = { x: 60, y: 40, top: 40, left: 60, right: 72, bottom: 52, width: 12, height: 12 };

        icon.getBoundingClientRect = jest.fn(() => ({ ...box, toJSON: () => box }));

        fireEvent.mouseOver(name);

        await screen.findByRole('tooltip');

        expect(icon.getBoundingClientRect).toHaveBeenCalled();
    });
});

describe('the note at a tap (#281)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // time passing, long enough for a tooltip to open or close all the way
    function wait(ms) {
        act(() => {
            jest.advanceTimersByTime(ms);
        });
    }

    it('shows at once, without the touch being held', () => {
        //
        // by default a touch has to be held for 700ms
        //
        const { name } = draw();

        tap(name);

        expect(screen.getByRole('tooltip')).toHaveTextContent(NOTE);
    });

    it('stays after the finger lifts, for as long as reading it takes', () => {
        //
        // by default it is gone 1500ms after the touch ends
        //
        const { name } = draw();

        tap(name);
        wait(60000);

        expect(screen.getByRole('tooltip')).toHaveTextContent(NOTE);
    });

    it('goes at a second tap on the name', () => {
        const { name } = draw();

        tap(name);
        wait(150);
        tap(name);
        wait(1000);

        expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('goes at a tap anywhere else', () => {
        const { name } = draw();

        tap(name);
        wait(150);
        tap(document.body);
        wait(1000);

        expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('stays while the page is scrolled under it', () => {
        const { name } = draw();

        tap(name);
        wait(150);

        //
        // a touch that moves is a scroll, and ends in no click
        //
        fireEvent.touchStart(document.body);
        fireEvent.touchMove(document.body);
        fireEvent.touchEnd(document.body);
        wait(1000);

        expect(screen.getByRole('tooltip')).toHaveTextContent(NOTE);
    });

    it('gives way to another note tapped after it', () => {
        render(
            <>
                <InfoNote note={NOTE} className='one'>Health</InfoNote>
                <InfoNote note={OTHER} className='two'>Lag</InfoNote>
            </>
        );

        tap(document.querySelector('.one'));
        wait(150);
        tap(document.querySelector('.two'));
        wait(1000);

        const notes = screen.getAllByRole('tooltip');

        expect(notes).toHaveLength(1);
        expect(notes[0]).toHaveTextContent(OTHER);
    });

    it('does not show for a touch that scrolls the page from the name', () => {
        const { name } = draw();

        fireEvent.touchStart(name);
        fireEvent.touchMove(name);
        fireEvent.touchEnd(name);
        wait(1000);

        expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('is not held by a click from a mouse, which the pointer shows it for and takes it from', () => {
        const { name } = draw();

        fireEvent.mouseOver(name);
        wait(150);

        expect(screen.getByRole('tooltip')).toHaveTextContent(NOTE);

        fireEvent.click(name);
        fireEvent.mouseLeave(name);

        //
        // the pointer leaving starts a wait of its own, and the note's closing
        // plays out only after that one has run
        //
        wait(0);
        wait(1000);

        expect(screen.queryByRole('tooltip')).toBeNull();
    });
});

describe('the note\'s box (#237)', () => {
    //
    // what a browser reports of a note's lines, which jsdom cannot: each line's
    // width, as drawn. Range has no getClientRects here, so it is lent one.
    //
    let lines = [];
    let boxes = [];

    beforeEach(() => {
        window.Range.prototype.getClientRects = () => lines.map((width) => ({ width: width }));
    });

    afterEach(() => {
        delete window.Range.prototype.getClientRects;
        boxes.forEach((box) => box.remove());
        boxes = [];
        lines = [];
    });

    //
    // a box holding a note, laid out at `laidOut` px and drawn at `drawn` px --
    // narrower while it opens, growing out of a smaller scale
    //
    function noteBox({ laidOut = 340, drawn = laidOut, sizing = 'border-box' } = {}) {
        const box = document.createElement('div');

        box.textContent = NOTE;
        box.style.boxSizing = sizing;
        box.style.padding = '7px 14px';
        Object.defineProperty(box, 'offsetWidth', { value: laidOut });
        box.getBoundingClientRect = () => ({ width: drawn });
        document.body.appendChild(box);
        boxes.push(box);

        return box;
    }

    it('is set as wide as the note\'s widest line, and its padding', () => {
        //
        // the Variant's note as Safari's engine broke it, balanced: 230px,
        // 187px and 216px, with 14px of padding either side of them
        //
        lines = [230, 186.8, 215.6];

        const box = noteBox();

        fitNote(box);

        expect(box.style.width).toBe('259px');
    });

    it('measures the lines at full size while the box is still opening', () => {
        //
        // the box grows out of three quarters of its size, and the lines are
        // measured at that scale
        //
        lines = [230, 186.8, 215.6].map((width) => width * 0.75);

        const box = noteBox({ drawn: 340 * 0.75 });

        fitNote(box);

        expect(box.style.width).toBe('259px');
    });

    it('spares at least half a pixel, so the widest line keeps its last word', () => {
        lines = [229.9, 120];

        const box = noteBox();

        fitNote(box);

        expect(box.style.width).toBe('259px');
    });

    it('adds no padding where the box\'s width does not include it', () => {
        lines = [230, 186.8];

        const box = noteBox({ sizing: 'content-box' });

        fitNote(box);

        expect(box.style.width).toBe('231px');
    });

    it('leaves a note of one line as the theme draws it, already as wide as its text', () => {
        lines = [180];

        const box = noteBox();

        fitNote(box);

        expect(box.style.width).toBe('');
    });

    it('measures again from the theme\'s width, not the one it set before', () => {
        lines = [180];

        const box = noteBox();

        box.style.width = '259px';
        fitNote(box);

        expect(box.style.width).toBe('');
    });

    it('leaves a box with nothing laid out alone, as jsdom has, and one taken off the page', () => {
        lines = [230, 186.8];

        const box = noteBox({ laidOut: 0 });

        fitNote(box);
        fitNote(null);

        expect(box.style.width).toBe('');
    });

    it('is what the note\'s tooltip is put on the page with', async () => {
        //
        // mui hands the box to fitNote as it puts it on the page, so the box
        // is set before the popper places it
        //
        lines = [200, 150];

        const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
        const rect = HTMLElement.prototype.getBoundingClientRect;
        const isBox = (element) => element.classList.contains('MuiTooltip-tooltip');

        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
            configurable: true,
            get() {
                return isBox(this) ? 340 : 0;
            },
        });
        HTMLElement.prototype.getBoundingClientRect = function boundingRect() {
            return isBox(this) ? { width: 340 } : rect.call(this);
        };

        try {
            const { name } = draw();

            fireEvent.mouseOver(name);

            const tooltip = (await screen.findByRole('tooltip')).querySelector('.MuiTooltip-tooltip');

            //
            // the widest line and half a pixel, rounded up. Under test the box
            // is not border-box, so its padding is outside its width
            //
            expect(tooltip.style.width).toBe('201px');
        } finally {
            Object.defineProperty(HTMLElement.prototype, 'offsetWidth', width);
            HTMLElement.prototype.getBoundingClientRect = rect;
        }
    });
});
