/**
 * data-bls-click.test.jsx: selecting bls moves the date picker.
 *
 * data-bls-landing.test.jsx covers the rule as a pure function. This covers the
 * wiring -- that selecting bls in the control tray actually applies it, and that
 * selecting another stream does not.
 *
 * The two halves fail differently. A broken rule reports the wrong month; a
 * broken wiring reports the right month from a function nothing calls, and the
 * page still lands on today showing 'Records 0'. Only the click proves the
 * date picker moved.
 *
 * Note: no network is mocked. setup.js provides a fetch resolving not-ok, so
 *       the downloadData() the click also triggers is a no-op here -- the date
 *       is what this asserts on.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import DataLayout from '../../../import/layout/data/data.jsx';

function setup() {
    return render(
        <MemoryRouter>
            <DataLayout />
        </MemoryRouter>
    );
}

{/* the date picker is the only text input carrying a month/year value */}
function selectedMonth() {
    const field = [...document.querySelectorAll('input[type="text"]')].find(
        (e) => /\w+\s+\d{4}/.test(e.value)
    );

    return field ? field.value : null;
}

function selectStream(label) {
    const tray = [...document.querySelectorAll('.control-tray')].find(
        (t) => (t.closest('li') || t.parentElement).textContent.includes(label)
    );

    expect(tray).toBeTruthy();
    fireEvent.click(tray.querySelector('.border-circle-radius'));
}

function monthsBack(value, back) {
    const now = new Date();
    const then = new Date(now.getFullYear(), now.getMonth() - back, 1);

    return then.toLocaleString('en-US', { month: 'long', year: 'numeric' });
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

    it('keeps the date once the reader has moved off the current month', () => {
        /*
         * selecting bls, then another stream, must not drag the date forward
         * again -- the reader is now on a month they can see data for.
         */
        setup();
        selectStream('Bureau of Labor');
        selectStream('SEC Filings');

        expect(selectedMonth()).toBe(monthsBack(null, 2));
    });
});
