/**
 * data-rows-sort.test.jsx: what the page keeps of how a phone's rows of cubes
 * were arranged (#192) -- the order their titles put them in, for the rest of
 * the visit, and whether the stock splits' legend is folded away, and the
 * company facts' (#230), for the next.
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

    //
    // the rows' own helpers as they are, which the page reads too (#232)
    //
    const actual = jest.requireActual('../../../import/general/cube-rows.jsx');

    return { __esModule: true, default: Rows, openedGroup: actual.openedGroup };
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
    it('start in their own order, with every legend shown', () => {
        setup();
        open('S&P 500');

        expect(handed.sort).toBeNull();
        expect(handed.folds).toEqual({});
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

        act(() => handed.onFold('sectors', true));
        expect(handed.folds).toEqual({ sectors: true });
        expect(readLayout('data', 'phone').fold).toEqual({ sectors: true });
        expect(readLayout('data', 'wide').fold).toEqual({});
        view.unmount();

        //
        // the next visit, from a bare address
        //
        window.history.replaceState(null, '', '/');
        setup();
        open('Stock Splits');
        expect(handed.folds).toEqual({ sectors: true });
    });

    it('keep the company facts\' legend folded beside the sectors\', each its own (#230)', () => {
        setup();
        open('Stock Splits');
        act(() => handed.onFold('sectors', true));

        fireEvent.click(document.querySelector('button.data-back'));
        open('SEC Company Facts');
        act(() => handed.onFold('statuses', true));
        expect(readLayout('data', 'phone').fold).toEqual({ sectors: true, statuses: true });

        act(() => handed.onFold('sectors', false));
        expect(handed.folds).toEqual({ sectors: false, statuses: true });
        expect(readLayout('data', 'phone').fold).toEqual({ sectors: false, statuses: true });
    });
});
