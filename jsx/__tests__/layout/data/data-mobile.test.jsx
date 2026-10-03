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

const { render, fireEvent, screen, act } = require('@testing-library/react');
const { MemoryRouter } = require('react-router-dom');
const DataLayout = require('../../../import/layout/data/data.jsx').default;
const { KEY, VERSION } = require('../../../import/general/listing-preference.js');

//
// a click keeps the stream it charts for the next visit, in localStorage, and
// opens it in the address, as '?item=' -- both of which last the whole of this
// file. Each case starts from an empty store and a bare address.
//
beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
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


//
// a computed style whose scroll-margin-top is the one the phone's pinned header
// gives the element carrying `css_class` (#177) -- see '_navigation_anonymous.scss'.
// jsdom computes no stylesheet. Every other element, and every other property,
// is computed as jsdom would.
//
function pinnedMargin(css_class, margin = '78.4px') {
    const real = window.getComputedStyle;

    return jest.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
        const style = real.call(window, element, pseudo);

        if (!element.classList || !element.classList.contains(css_class)) {
            return style;
        }

        return new Proxy(style, {
            get: (target, key) => {
                if (key === 'scrollMarginTop') {
                    return margin;
                }

                const value = Reflect.get(target, key, target);

                return typeof value === 'function' ? value.bind(target) : value;
            },
        });
    });
}

describe('the listing on mobile', () => {
    it('renders without the desktop-only assumptions', () => {
        setup();

        expect(document.querySelector('.listing-table-title h5').textContent).toBe('Data');
    });

    it('draws the bars of cubes on their side, a row each, once a dataset is opened (#188)', () => {
        //
        // a row of bars standing up does not fit a phone's width, so a phone
        // lays them on their side
        //
        setup();
        fireEvent.click(chartButton('S&P 500'));

        expect(document.querySelector('.cube-rows')).toHaveAttribute('aria-label', expect.stringMatching(/^Records by sector, /));
        expect(document.querySelector('.cube-chart')).toBeNull();
        expect(document.querySelector('.sunburst')).toBeNull();
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

    it('opens on the listing with the stream charted last marked, not opened', () => {
        //
        // the stream charted last time is still the one the page charts, and
        // its row is marked, but a phone opens on the listing (#165)
        //
        window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, data: { chart: 'sec' } }));
        setup();

        expect(document.querySelector('.listing-graphic-title')).toBeNull();
        expect(document.querySelector('.listing-table-selected').textContent).toContain('SEC Filings');

        fireEvent.click(chartButton('SEC Filings'));
        expect(chartHeader()).toBe('SEC Filings');
    });
});

//
// #165: a phone opens on the listing, and a dataset's graph icon opens it on its
// own, with a way back -- as /stream does since #161
//
function backBar() {
    return document.querySelector('button.data-back');
}

function listingShown() {
    return document.querySelector('.listing-table') !== null;
}

function chartShown() {
    return document.querySelector('.cube-rows') !== null;
}

//
// the back or forward button landing on `address`
//
function travel(address) {
    act(() => {
        window.history.pushState(null, '', address);
        window.dispatchEvent(new window.PopStateEvent('popstate'));
    });
}

describe('a phone\'s listing first (#165)', () => {
    it('opens on the listing alone, with the month in its title row', () => {
        setup();

        expect(listingShown()).toBe(true);
        expect(chartShown()).toBe(false);
        expect(backBar()).toBeNull();
        expect(document.querySelector('.listing-graphic-title')).toBeNull();
        expect(document.querySelector('.listing-table-title.has-actions .listing-table-actions .data-month'))
            .not.toBeNull();
    });

    it('opens a dataset on its own from its graph icon, in place of the listing', () => {
        setup();

        fireEvent.click(chartButton('SEC Filings'));

        expect(backBar().textContent).toBe('All data');
        expect(chartHeader()).toBe('SEC Filings');
        expect(document.querySelector('.filter-month .data-month')).not.toBeNull();
        expect(chartShown()).toBe(true);
        expect(listingShown()).toBe(false);
        expect(window.location.search).toBe('?item=sec');
    });

    it('scrolls a dataset opened from far down the listing back to its top', () => {
        const scrolled = jest.fn();
        Element.prototype.scrollIntoView = scrolled;
        const top = jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: -400 });

        setup();
        fireEvent.click(chartButton('US Weather'));

        expect(scrolled).toHaveBeenCalledWith({ block: 'start' });

        top.mockRestore();
        delete Element.prototype.scrollIntoView;
    });

    it('leaves a dataset opened at the top of the page where it is', () => {
        const scrolled = jest.fn();
        Element.prototype.scrollIntoView = scrolled;

        setup();
        fireEvent.click(chartButton('US Weather'));

        expect(scrolled).not.toHaveBeenCalled();

        delete Element.prototype.scrollIntoView;
    });

    it('scrolls a dataset opened under a phone\'s pinned header down from under it (#177)', () => {
        const scrolled = jest.fn();
        Element.prototype.scrollIntoView = scrolled;
        const top = jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 40 });
        const style = pinnedMargin('data-listing');

        setup();
        fireEvent.click(chartButton('US Weather'));

        expect(scrolled).toHaveBeenCalledWith({ block: 'start' });

        style.mockRestore();
        top.mockRestore();
        delete Element.prototype.scrollIntoView;
    });

    it('leaves a dataset opened in sight below a pinned header where it is', () => {
        const scrolled = jest.fn();
        Element.prototype.scrollIntoView = scrolled;
        const top = jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 120 });
        const style = pinnedMargin('data-listing');

        setup();
        fireEvent.click(chartButton('US Weather'));

        expect(scrolled).not.toHaveBeenCalled();

        style.mockRestore();
        top.mockRestore();
        delete Element.prototype.scrollIntoView;
    });

    it('goes back to the listing from All data, with the dataset still marked', () => {
        setup();

        fireEvent.click(chartButton('SEC Filings'));
        fireEvent.click(backBar());

        expect(listingShown()).toBe(true);
        expect(chartShown()).toBe(false);
        expect(document.querySelector('.listing-table-selected').textContent).toContain('SEC Filings');
        expect(window.location.search).toBe('');
    });

    it('keeps everything else the address carries', () => {
        window.history.replaceState(null, '', '/?from=alarm');
        setup();

        fireEvent.click(chartButton('SEC Filings'));
        expect(window.location.search).toBe('?from=alarm&item=sec');

        fireEvent.click(backBar());
        expect(window.location.search).toBe('?from=alarm');
    });

    it('opens the dataset the address names', () => {
        window.history.replaceState(null, '', '/?item=us-national-weather');
        setup();

        expect(chartHeader()).toBe('US Weather Alerts');
        expect(chartShown()).toBe(true);
        expect(listingShown()).toBe(false);
    });

    it('opens on the listing where the address names no dataset', () => {
        window.history.replaceState(null, '', '/?item=not-a-dataset');
        setup();

        expect(listingShown()).toBe(true);
        expect(backBar()).toBeNull();
    });

    it('follows the back and forward buttons', () => {
        setup();

        fireEvent.click(chartButton('SEC Filings'));
        travel('/');
        expect(listingShown()).toBe(true);

        //
        // forward to a dataset the page is not charting: it is charted, as its
        // graph icon would chart it
        //
        travel('/?item=bls');
        expect(chartHeader()).toBe('Bureau of Labor Statistics');
        expect(chartShown()).toBe(true);

        travel('/?item=bls');
        expect(chartHeader()).toBe('Bureau of Labor Statistics');
    });

    it('leaves another page\'s address to that page', () => {
        const { unmount } = setup();

        travel('/stream?item=sec');

        expect(listingShown()).toBe(true);
        unmount();
    });

    it('stops following the address once it is gone', () => {
        const removed = jest.spyOn(window, 'removeEventListener');
        const { unmount } = setup();

        unmount();

        expect(removed).toHaveBeenCalledWith('popstate', expect.any(Function));
        removed.mockRestore();
    });
});

//
// the phone's month menu, and the month it shows
//
function monthMenu() {
    return document.querySelector('.data-month select');
}

function monthShown() {
    const menu = monthMenu();

    return menu.options[menu.selectedIndex].textContent;
}

//
// the month the date picker shows -- hidden on a phone, but drawn -- which is
// the month on screen
//
function pickerMonth() {
    return [...document.querySelectorAll('input[type="text"]')].find((e) => /\w+\s+\d{4}/.test(e.value)).value;
}

//
// pick the month the menu offers at `index`, newest first
//
function chooseMonth(index) {
    const menu = monthMenu();

    fireEvent.change(menu, { target: { value: menu.options[index].value } });
}

describe('a phone\'s month', () => {
    it('offers no Filter, on the listing or over a dataset', () => {
        setup();
        expect(screen.queryByRole('button', { name: 'Filter' })).toBeNull();

        fireEvent.click(chartButton('SEC Filings'));
        expect(screen.queryByRole('button', { name: 'Filter' })).toBeNull();
    });

    it('has no Data Distribution switch', () => {
        setup();

        expect(bodyText()).not.toContain('Data Distribution');
    });

    it('shows the month on screen, and offers every month from the first to this one, newest first', () => {
        setup();

        const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const options = [...monthMenu().options].map((option) => option.textContent);

        expect(monthShown()).toBe(pickerMonth());
        expect(options[0]).toBe(`${today.toLocaleString('en-US', { month: 'long' })} ${today.getFullYear()}`);
        expect(options[options.length - 1]).toMatch(/^January \d{4}$/);
        expect(new Set(options).size).toBe(options.length);
    });

    it('steps a month back from its earlier arrow, and downloads every stream for it', () => {
        const spy = jest.spyOn(DataLayout.prototype, 'downloadData');
        setup();
        chooseMonth(3);
        spy.mockClear();

        fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }));

        expect(monthMenu().selectedIndex).toBe(4);
        expect(pickerMonth()).toBe(monthShown());
        expect(spy).toHaveBeenCalledTimes(5);
        spy.mockRestore();
    });

    it('steps a month forward from its later arrow', () => {
        setup();
        chooseMonth(3);

        fireEvent.click(screen.getByRole('button', { name: /^Later month/ }));

        expect(monthMenu().selectedIndex).toBe(2);
    });

    it('shows and downloads the month chosen from its menu', () => {
        const spy = jest.spyOn(DataLayout.prototype, 'downloadData');
        setup();
        spy.mockClear();
        const chosen = monthMenu().options[5].textContent;

        chooseMonth(5);

        expect(monthShown()).toBe(chosen);
        expect(pickerMonth()).toBe(chosen);
        expect(spy).toHaveBeenCalledTimes(5);
        spy.mockRestore();
    });

    it('names the month each arrow goes to', () => {
        setup();
        chooseMonth(3);
        const options = monthMenu().options;

        expect(screen.getByRole('button', { name: `Earlier month, ${options[4].textContent}` })).toBeEnabled();
        expect(screen.getByRole('button', { name: `Later month, ${options[2].textContent}` })).toBeEnabled();
    });

    it('dims the later arrow on this month, and the earlier on the first', () => {
        setup();

        chooseMonth(0);
        expect(screen.getByRole('button', { name: 'Later month' })).toBeDisabled();

        chooseMonth(monthMenu().options.length - 1);
        expect(screen.getByRole('button', { name: 'Earlier month' })).toBeDisabled();
    });

    it('ends its row over a dataset with the api icons, the chart\'s own kept for a tablet (#185)', () => {
        setup();
        fireEvent.click(chartButton('SEC Filings'));

        const monthRow = document.querySelector('.filter-month .data-month-row');
        const hrefs = (root) => [...root.querySelectorAll('a')].map((link) => link.getAttribute('href'));

        expect(monthRow.firstElementChild).toHaveClass('data-month');
        expect(monthRow.lastElementChild).toHaveClass('api-links');
        expect(hrefs(monthRow.lastElementChild)).toEqual(hrefs(document.querySelector('.cube-rows-actions .api-links')));
        expect(hrefs(monthRow.lastElementChild).join(' ')).toContain('sec');
    });

    it('sits beside a dataset\'s name over its chart, and steps the month there too', () => {
        setup();
        fireEvent.click(chartButton('SEC Filings'));
        chooseMonth(3);

        expect(document.querySelector('.filter-month .listing-graphic-title h5').textContent).toBe('SEC Filings');

        fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }));

        expect(monthMenu().selectedIndex).toBe(4);
        expect(backBar()).not.toBeNull();
        expect(chartShown()).toBe(true);
    });
});
