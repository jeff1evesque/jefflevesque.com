/**
 * listing-table-drag.test.jsx: how far a dragged row can go.
 *
 * Nowhere past the table's body. The frame around the table scrolls sideways
 * where a window is too narrow for it, which makes it a scroll box both ways, and
 * Chrome counts a row dragged out past the table as more of the frame to scroll:
 * dragging a row down past the last one grew the table a scrollbar of its own,
 * longer the further the row went, until the row snapped back.
 *
 * jsdom lays nothing out and drags nothing, so this holds the props that decide
 * it rather than the drag itself: framer-motion's Reorder is stood in for by
 * components that draw the same elements and keep what each row was given.
 *
 * Note: its own file, since the stand-in replaces framer-motion for every suite
 *       that imports the table. article-listing-table.test.jsx uses the real one.
 */

jest.mock('framer-motion', () => {
    const actual = jest.requireActual('framer-motion');
    const React = jest.requireActual('react');
    const given = [];

    const Group = React.forwardRef(({ as: Tag = 'ul', children, className }, ref) => (
        React.createElement(Tag, { ref, className }, children)
    ));

    const Item = React.forwardRef(({ as: Tag = 'li', children, className, ...drag }, ref) => {
        given.push(drag);

        return React.createElement(Tag, { ref, className }, children);
    });

    return { ...actual, Reorder: { Group, Item }, given };
});

import React from 'react';
import { render } from '@testing-library/react';
import { given } from 'framer-motion';

import ArticleListing from '../../import/general/article-listing.jsx';

const COLUMNS = [{ key: 'Health', numeric: true, sortable: true }];

const ROWS = ['stock-market', 'bls', 'sec'].map((name) => ({ name, detail: { 'Health': '100%' } }));

beforeEach(() => {
    given.length = 0;
});

describe('a dragged row', () => {
    it('is held inside the table\'s body, whatever the pointer does', () => {
        render(<ArticleListing columns={COLUMNS} list_article={ROWS} onReorder={jest.fn()} />);

        const body = document.querySelector('.listing-table tbody');

        expect(given.length).toBeGreaterThanOrEqual(ROWS.length);
        given.forEach((props) => {
            expect(props.dragConstraints.current).toBe(body);
        });
    });

    it('gives nothing past the body\'s edges', () => {
        //
        // framer-motion's default lets a row overshoot its constraints by half the
        // distance, which is enough to scroll the frame again
        //
        render(<ArticleListing columns={COLUMNS} list_article={ROWS} onReorder={jest.fn()} />);

        given.forEach((props) => {
            expect(props.dragElastic).toBe(0);
        });
    });

    it('moves only from its grip', () => {
        render(<ArticleListing columns={COLUMNS} list_article={ROWS} onReorder={jest.fn()} />);

        given.forEach((props) => {
            expect(props.dragListener).toBe(false);
            expect(props.dragControls).toBeDefined();
        });
    });
});
