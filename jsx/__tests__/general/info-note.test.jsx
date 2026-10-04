/**
 * info-note.test.jsx: a name, the info icon after it, and the note that says
 * what the name means (#206).
 *
 * Held here: that the note shows wherever a reader reaches for it -- under the
 * pointer, from the keyboard, at a tap -- that it describes the name rather than
 * replacing it, and that it is anchored on the icon rather than the middle of
 * the name.
 *
 * Note: jsdom lays nothing out, so where the note lands is the browser's. What
 *       can be held is which element the tooltip's popper measures itself
 *       against.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import InfoNote from '../../import/general/info-note.jsx';

const NOTE = 'Percent of records that succeeded';

function draw() {
    render(<InfoNote note={NOTE} className='a-figure'>Health</InfoNote>);

    const name = document.querySelector('.a-figure');

    return { name: name, icon: name.querySelector('svg') };
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

    it('shows at a tap, without the touch being held', async () => {
        jest.useFakeTimers();

        try {
            const { name } = draw();

            fireEvent.touchStart(name);

            //
            // a tooltip's own short wait, and no more: by default a touch has to
            // be held for 700ms
            //
            act(() => {
                jest.advanceTimersByTime(150);
            });

            expect(screen.getByRole('tooltip')).toHaveTextContent(NOTE);
        } finally {
            jest.useRealTimers();
        }
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
