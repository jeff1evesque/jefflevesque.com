/**
 * stream-rows-drag.test.jsx: how /stream's rows are dragged (#218).
 *
 * From the grip alone, and held inside the rows' own box, as /data's rows are.
 * jsdom lays nothing out and drags nothing, so this holds the props that decide
 * a drag rather than the drag itself, as listing-table-drag.test.jsx does:
 * framer-motion's Reorder is stood in for by components that draw the same
 * elements and keep what the group and each row were given.
 *
 * Note: its own file, since the stand-in replaces framer-motion for every suite
 *       that imports the rows. stream-rows.test.jsx uses the real one.
 */

jest.mock('framer-motion', () => {
    const actual = jest.requireActual('framer-motion');
    const React = jest.requireActual('react');
    const groups = [];
    const items = [];

    const Group = React.forwardRef(({ as: Tag = 'ul', children, className, ...given }, ref) => {
        groups.push(given);

        return React.createElement(Tag, { ref, className }, children);
    });

    const Item = React.forwardRef(({ as: Tag = 'li', children, className, ...given }, ref) => {
        items.push(given);

        return React.createElement(Tag, { ref, className, 'data-stream': given['data-stream'] }, children);
    });

    return { ...actual, Reorder: { Group, Item }, groups, items };
});

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { DragControls, groups, items } from 'framer-motion';

import StreamRows, { STILL } from '../../../import/layout/stream/stream-rows.jsx';

const ROWS = ['Alpha', 'Beta', 'Gamma'].map((name) => ({
    stream: name.toLowerCase(),
    name: name,
    schedule: 'weekdays, once a day',
    status: 'done',
    retry: () => {},
    bars: [],
    figures: { health: 'n/a', coverage: 'n/a', total: 'n/a' },
    controls: null,
}));

function rows(props = {}) {
    return <StreamRows rows={ROWS} rate='day' onReorder={jest.fn()} {...props} />;
}

beforeEach(() => {
    groups.length = 0;
    items.length = 0;
});

describe('a row that can be dragged', () => {
    it('is dragged from its grip alone, and held inside the rows\' own box', () => {
        render(rows());

        const body = document.querySelector('.stream-rows-body');

        expect(items.map((given) => given.value)).toEqual(['alpha', 'beta', 'gamma']);
        items.forEach((given) => {
            expect(given.dragListener).toBe(false);
            expect(given.dragElastic).toBe(0);
            expect(given.dragConstraints.current).toBe(body);
            expect(given.dragControls).toBeInstanceOf(DragControls);
        });
    });

    it('keeps drag controls of its own, the same from one draw to the next', () => {
        const { rerender } = render(rows());
        const first = new Map(items.map((given) => [given.value, given.dragControls]));

        expect(new Set(first.values()).size).toBe(ROWS.length);

        items.length = 0;
        rerender(rows());

        items.forEach((given) => {
            expect(given.dragControls).toBe(first.get(given.value));
        });
    });

    it('starts its own drag when its grip is pressed', () => {
        const start = jest.spyOn(DragControls.prototype, 'start').mockImplementation(() => {});

        render(rows());

        fireEvent.pointerDown(document.querySelector('[data-stream="beta"] .stream-row-grip-button'));

        expect(start).toHaveBeenCalledTimes(1);
        expect(start.mock.instances[0]).toBe(items.find((given) => given.value === 'beta').dragControls);

        start.mockRestore();
    });
});

describe('the rows, dragged', () => {
    it('move up and down only, and hand the page each new order', () => {
        const onReorder = jest.fn();

        render(rows({ onReorder: onReorder }));

        const [group] = groups;

        expect(group.axis).toBe('y');
        expect(group.values).toEqual(['alpha', 'beta', 'gamma']);

        group.onReorder(['gamma', 'alpha', 'beta']);

        expect(onReorder).toHaveBeenCalledWith(['gamma', 'alpha', 'beta']);
    });

    it('are not dragged at all while they are sorted', () => {
        render(rows({ sort: { key: 'name', dir: 'desc' } }));

        expect(groups).toHaveLength(0);
        expect(items).toHaveLength(0);
        expect(document.querySelectorAll('.stream-rows-body > .stream-row')).toHaveLength(3);
    });
});

describe('the rows, at rest (#220)', () => {
    //
    // what each row was last drawn with
    //
    const latest = () => ROWS.map((row) => items.filter((given) => given.value === row.stream).slice(-1)[0]);

    it('take a new size or place at once, with nothing animated, while no row is dragged', () => {
        render(rows());

        expect(STILL).toEqual({ layout: { type: false } });
        latest().forEach((given) => {
            expect(given.transition).toBe(STILL);
        });
    });

    it('slide into their places while a row is dragged, and stop once it is let go', () => {
        render(rows());

        act(() => latest()[1].onDragStart());

        latest().forEach((given) => {
            expect(given.transition).toBeUndefined();
        });

        act(() => latest()[1].onDragEnd());

        latest().forEach((given) => {
            expect(given.transition).toBe(STILL);
        });
    });
});
