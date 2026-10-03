/**
 * data-rows-sort.test.jsx: what the page keeps of how a phone's rows of cubes
 * were arranged (#192) -- the order their titles put them in, for the rest of
 * the visit, and whether the stock splits' legend is folded away, for the next.
 *
 * The rows themselves are held by cube-rows.test.jsx. Here they are stood in
 * for, so the props the page hands them, and what it does with what they tell
 * it, can be read without a month of data to draw.
 */

import React from 'react';

jest.mock('react-device-detect', () => ({ isMobile: true }));

let handed = null;
jest.mock('../../../import/general/cube-rows.jsx', () => {
    const Rows = (props) => {
        handed = props;
        return <div className='cube-rows' />;
    };

    return { __esModule: true, default: Rows };
});

const { render, fireEvent, screen, act } = require('@testing-library/react');
const { MemoryRouter } = require('react-router-dom');
const DataLayout = require('../../../import/layout/data/data.jsx').default;
const { readLayout } = require('../../../import/general/layout-preference.js');

beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
    handed = null;
});

function setup() {
    return render(
        <MemoryRouter>
            <DataLayout />
        </MemoryRouter>
    );
}

function open(label) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Chart ${label}`) }));
}

describe('a phone\'s rows of cubes, as the page keeps them (#192)', () => {
    it('start in their own order, with the sectors\' legend shown', () => {
        setup();
        open('S&P 500');

        expect(handed.sort).toBeNull();
        expect(handed.sectorsShown).toBe(true);
    });

    it('keep the order their titles put them in from one month to the next', () => {
        setup();
        open('S&P 500');

        act(() => handed.onSort({ key: 'count', direction: 'ascending' }));
        expect(handed.sort).toEqual({ key: 'count', direction: 'ascending' });

        fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }));
        expect(handed.sort).toEqual({ key: 'count', direction: 'ascending' });
    });

    it('start another dataset in its own order, and keep each dataset\'s own', () => {
        setup();
        open('S&P 500');
        act(() => handed.onSort({ key: 'name', direction: 'descending' }));

        fireEvent.click(document.querySelector('button.data-back'));
        open('SEC Filings');
        expect(handed.sort).toBeNull();

        fireEvent.click(document.querySelector('button.data-back'));
        open('S&P 500');
        expect(handed.sort).toEqual({ key: 'name', direction: 'descending' });
    });

    it('go back to their own order when the rows say so', () => {
        setup();
        open('S&P 500');
        act(() => handed.onSort({ key: 'count', direction: 'ascending' }));
        act(() => handed.onSort(null));

        expect(handed.sort).toBeNull();
    });

    it('keep the sectors\' legend folded for this browser\'s next visit, apart from a wide screen\'s', () => {
        const view = setup();
        open('Stock Splits');

        act(() => handed.onSectors(false));
        expect(handed.sectorsShown).toBe(false);
        expect(readLayout('data', 'phone').fold).toEqual({ sectors: true });
        expect(readLayout('data', 'wide').fold).toEqual({});
        view.unmount();

        //
        // the next visit, from a bare address
        //
        window.history.replaceState(null, '', '/');
        setup();
        open('Stock Splits');
        expect(handed.sectorsShown).toBe(false);
    });
});
