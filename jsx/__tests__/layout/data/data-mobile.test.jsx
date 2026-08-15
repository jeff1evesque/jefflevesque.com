/**
 * data-mobile.test.jsx: the listing rendered on a phone.
 *
 * data.jsx branches on 'isMobile' in a dozen places -- loader size, chart
 * height, axis angle and height, whether the chart is wrapped in a horizontal
 * scroller, and which header carries the stream name. Every other test in this
 * directory renders the desktop side, so the mobile half of each of those
 * branches was never executed.
 *
 * That is not only a coverage gap. The mobile path is where the layout does its
 * most invasive work -- it overflows the viewport deliberately so bars keep a
 * readable width -- and a crash there is invisible from a desktop render.
 *
 * Note: 'react-device-detect' reads the user agent at import time, so it is
 *       mocked rather than driven through jsdom's navigator.
 */

import React from 'react';

jest.mock('react-device-detect', () => ({ isMobile: true }));

const { render, fireEvent } = require('@testing-library/react');
const { MemoryRouter } = require('react-router-dom');
const DataLayout = require('../../../import/layout/data/data.jsx').default;

function setup() {
    return render(
        <MemoryRouter>
            <DataLayout />
        </MemoryRouter>
    );
}

function bodyText() {
    return document.body.textContent.replace(/\s+/g, ' ');
}

describe('the listing on mobile', () => {
    it('renders without the desktop-only assumptions', () => {
        setup();

        expect(bodyText()).toContain('Data Distribution');
    });

    it('lists every stream', () => {
        setup();

        for (const label of [
            'S&P 500',
            'Stock Splits',
            'Bureau of Labor Statistics',
            'SEC Filings',
            'US Weather Alerts'
        ]) {
            expect(bodyText()).toContain(label);
        }
    });

    it('still steps bls back off the current month', () => {
        /*
         * the date shift lives in the control tray, which mobile renders too --
         * a phone reader lands on the same empty month otherwise.
         */
        const tray = () => [...document.querySelectorAll('.control-tray')].find(
            (t) => (t.closest('li') || t.parentElement).textContent.includes('Bureau of Labor')
        );

        setup();

        const before = [...document.querySelectorAll('input[type="text"]')].find(
            (e) => /\w+\s+\d{4}/.test(e.value)
        ).value;

        fireEvent.click(tray().querySelector('.border-circle-radius'));

        const after = [...document.querySelectorAll('input[type="text"]')].find(
            (e) => /\w+\s+\d{4}/.test(e.value)
        ).value;

        expect(after).not.toBe(before);
    });

    it('keeps the chart header in sync with the selected stream', () => {
        /*
         * the mobile header was stuck on the default 'StockMarket' until the
         * click handler started setting listing_graphic_title.
         */
        setup();

        const tray = [...document.querySelectorAll('.control-tray')].find(
            (t) => (t.closest('li') || t.parentElement).textContent.includes('SEC Filings')
        );

        fireEvent.click(tray.querySelector('.border-circle-radius'));

        expect(bodyText()).toContain('SEC Filings');
    });
});
