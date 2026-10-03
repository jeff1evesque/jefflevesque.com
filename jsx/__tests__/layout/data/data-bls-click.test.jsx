/**
 * data-bls-click.test.jsx: selecting bls moves the date picker.
 *
 * data-bls-landing.test.jsx covers the rule as a pure function. This covers the
 * wiring -- that selecting bls in the listing actually applies it, and that
 * selecting another stream does not. And that a page opening on a bls the reader
 * charted last time lands where choosing it would have.
 *
 * The two halves fail differently. A broken rule reports the wrong month; a
 * broken wiring reports the right month from a function nothing calls, and the
 * page still lands on today showing 'Records 0'. Only the click proves the
 * date picker moved.
 *
 * Note: no network is mocked. setup.js provides a fetch resolving not-ok, so
 *       the downloadData() the click also triggers is a no-op here -- the date
 *       is what this asserts on.
 *
 * Note: a click keeps the stream it charts for the next visit, in localStorage,
 *       which lasts the whole of this file. Each case starts from an empty one.
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import DataLayout from '../../../import/layout/data/data.jsx';
import { KEY, VERSION } from '../../../import/general/listing-preference.js';

beforeEach(() => {
    window.localStorage.clear();
});

function setup() {
    return render(
        <MemoryRouter>
            <DataLayout />
        </MemoryRouter>
    );
}

{/* the month on screen: what the month control's menu shows (#192 -- it was the date picker's field) */}
function selectedMonth() {
    const menu = document.querySelector('.data-month select');

    return menu ? menu.options[menu.selectedIndex].textContent : null;
}

{/* the chart button of the stream whose name starts `label` */}
function selectStream(label) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Chart ${label}`) }));
}

function monthsBack(value, back) {
    const now = new Date();
    const then = new Date(now.getFullYear(), now.getMonth() - back, 1);

    return then.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

{/* pick the month the month menu offers at `index`, newest first, as a reader would */}
function pickMonth(index) {
    const menu = document.querySelector('.data-month select');

    fireEvent.change(menu, { target: { value: menu.options[index].value } });
}

function saved(stream) {
    window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, data: { chart: stream } }));
}

describe('selecting a stream', () => {
    it('starts on the current month', () => {
        setup();

        expect(selectedMonth()).toBe(monthsBack(null, 0));
    });

    it('steps bls back two months', () => {
        /*
         * bls publishes a period's reading the period after it measures, so the
         * current month never holds bls data. two months back is the first that
         * carries eight of the ten feeds -- see data-bls-landing.test.jsx.
         */
        setup();
        selectStream('Bureau of Labor');

        expect(selectedMonth()).toBe(monthsBack(null, 2));
    });

    it('leaves other streams on the current month', () => {
        /*
         * the shift is bls-only. stock-market data exists today, and moving its
         * date would hide the current day's quotes.
         */
        setup();
        selectStream('S&P 500');

        expect(selectedMonth()).toBe(monthsBack(null, 0));
    });

    it('does not step twice when bls is selected again', () => {
        /*
         * the rule only fires from the current month, so a second click is a
         * no-op rather than another two months back.
         */
        setup();
        selectStream('Bureau of Labor');
        selectStream('Bureau of Labor');

        expect(selectedMonth()).toBe(monthsBack(null, 2));
    });

    it('goes back to the latest month when another stream is charted after bls (#198)', () => {
        /*
         * only bls is lagged. the step back is bls's own, so leaving it for a
         * stream that holds the latest month goes back there -- where the date
         * once stayed two months back for every stream charted after it.
         */
        setup();
        selectStream('Bureau of Labor');
        selectStream('SEC Filings');

        expect(selectedMonth()).toBe(monthsBack(null, 0));
    });

    it('keeps a month the reader picked while on bls, whichever stream is charted next (#198)', () => {
        setup();
        selectStream('Bureau of Labor');
        pickMonth(1);
        selectStream('SEC Filings');

        expect(selectedMonth()).toBe(monthsBack(null, 1));
    });

    it('steps bls back again from the latest month it went back to (#198)', () => {
        setup();
        selectStream('Bureau of Labor');
        selectStream('SEC Filings');
        selectStream('Bureau of Labor');

        expect(selectedMonth()).toBe(monthsBack(null, 2));
    });

    it('downloads every stream when the month changes for bls, either way, and only the one charted otherwise (#198)', () => {
        /*
         * the listing counts the month on screen: downloading only bls for its
         * month left every other row on the latest month's counts
         */
        const spy = jest.spyOn(DataLayout.prototype, 'downloadData');
        const streams = () => new Set(spy.mock.calls.map((call) => call[0]));
        setup();

        spy.mockClear();
        selectStream('Bureau of Labor');
        expect(streams().size).toBe(5);

        spy.mockClear();
        selectStream('SEC Filings');
        expect(streams().size).toBe(5);

        spy.mockClear();
        selectStream('S&P 500');
        expect([...streams()]).toEqual(['stock-market']);

        spy.mockRestore();
    });

    it('keeps the stream it charts, for the next visit', () => {
        setup();
        selectStream('SEC Filings');

        expect(JSON.parse(window.localStorage.getItem(KEY)).data.chart).toBe('sec');
    });
});

describe('opening on the stream last charted', () => {
    const charted = () => document.querySelector('.listing-table-selected th').textContent;

    it('opens on it, rather than on the first', () => {
        saved('sec');
        setup();

        expect(charted()).toBe('SEC Filings');
    });

    it('opens a saved bls two months back, as selecting it does', () => {
        saved('bls');
        setup();

        expect(charted()).toBe('Bureau of Labor Statistics');
        expect(selectedMonth()).toBe(monthsBack(null, 2));
    });

    it('goes back to the latest month from a saved bls when another stream is charted (#198)', () => {
        saved('bls');
        setup();
        selectStream('SEC Filings');

        expect(selectedMonth()).toBe(monthsBack(null, 0));
    });

    it('does not step again when the saved bls is selected', () => {
        saved('bls');
        setup();
        selectStream('Bureau of Labor');

        expect(selectedMonth()).toBe(monthsBack(null, 2));
    });

    it('opens any other saved stream on the current month', () => {
        saved('sec');
        setup();

        expect(selectedMonth()).toBe(monthsBack(null, 0));
    });

    it('opens on the first when the saved stream is not one it lists', () => {
        saved('retired-stream');
        setup();

        expect(charted()).toBe('S&P 500');
        expect(selectedMonth()).toBe(monthsBack(null, 0));
    });
});
