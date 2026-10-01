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

const { render, fireEvent, screen } = require('@testing-library/react');
const { MemoryRouter } = require('react-router-dom');
const DataLayout = require('../../../import/layout/data/data.jsx').default;
const { KEY, VERSION } = require('../../../import/general/listing-preference.js');

//
// a click keeps the stream it charts for the next visit, in localStorage, which
// lasts the whole of this file. Each case starts from an empty one.
//
beforeEach(() => {
    window.localStorage.clear();
});

//
// the chart button of the stream whose name starts `label`
//
function chartButton(label) {
    return screen.getByRole('button', { name: new RegExp(`^Chart ${label}`) });
}

//
// the stream the chart's own header names, over the chart on a phone
//
function chartHeader() {
    return document.querySelector('.listing-graphic-title h5').textContent;
}

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

    it('draws the sunburst rather than the bars of cubes', () => {
        //
        // a row of bars does not fit a phone's width, so a phone keeps the ring
        //
        setup();

        expect(document.querySelector('.sunburst.sunburst-phone')).not.toBeNull();
        expect(document.querySelector('.cube-chart')).toBeNull();
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
        setup();

        const before = [...document.querySelectorAll('input[type="text"]')].find(
            (e) => /\w+\s+\d{4}/.test(e.value)
        ).value;

        fireEvent.click(chartButton('Bureau of Labor'));

        const after = [...document.querySelectorAll('input[type="text"]')].find(
            (e) => /\w+\s+\d{4}/.test(e.value)
        ).value;

        expect(after).not.toBe(before);
    });

    it('keeps the chart header in sync with the selected stream', () => {
        /*
         * the mobile header was stuck on the default, the S&P 500, until the
         * click handler started setting listing_graphic_title.
         */
        setup();

        fireEvent.click(chartButton('SEC Filings'));

        expect(chartHeader()).toBe('SEC Filings');
    });

    it('names the stream the page opens on in the chart header', () => {
        //
        // a page opening on the stream charted last time says so over the chart,
        // rather than the S&P 500 it used to open on
        //
        window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, data: { chart: 'sec' } }));
        setup();

        expect(chartHeader()).toBe('SEC Filings');
    });
});
