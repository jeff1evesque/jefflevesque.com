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

//
// the workers, captured so a case can answer for one, with what the real ones
// post -- see data-callback.test.jsx. Under jsdom no worker ever answers
//
global.__workers = [];

jest.mock('../../../import/worker/web-worker.js', () => ({
    __esModule: true,
    default: function WorkerBuilderMock(script) {
        this.script = script;
        this.postMessage = jest.fn();
        this.terminate = jest.fn();
        global.__workers.push(this);
    },
}));

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

        const before = monthShown();

        fireEvent.click(chartButton('Bureau of Labor'));

        const after = monthShown();

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

        expect(monthShown()).toBe(options[0]);
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
        expect(spy).toHaveBeenCalledTimes(6);
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
        expect(spy).toHaveBeenCalledTimes(6);
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

    it('ends its row over a dataset with the api icons, a tablet\'s too, and the rows draw none of their own (#192)', () => {
        setup();
        fireEvent.click(chartButton('SEC Filings'));

        const monthRow = document.querySelector('.filter-month .data-month-row');
        const hrefs = (root) => [...root.querySelectorAll('a')].map((link) => link.getAttribute('href'));

        expect(monthRow.firstElementChild).toHaveClass('data-month');
        expect(monthRow.lastElementChild).toHaveClass('api-links');
        expect(hrefs(monthRow.lastElementChild).join(' ')).toContain('sec');
        expect(document.querySelector('.filter-month')).not.toHaveClass('d-md-none');
        expect(document.querySelector('.cube-rows-actions')).toBeNull();
        expect(document.querySelectorAll('.data-month')).toHaveLength(1);
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

//
// #230: a dataset opened on its own, on a phone, sums its month up in three
// boxes under the month row, as /stream's stream on its own does
//

//
// the page, held so a case can answer for its workers
//
function setupPage() {
    const held = React.createRef();

    render(
        <MemoryRouter>
            <DataLayout ref={held} />
        </MemoryRouter>
    );

    return held.current;
}

//
// what a worker for `stream` posts, delivered as the real one does
//
function deliver(page, stream, data) {
    page.callbackGetData({ stream: stream });

    act(() => {
        global.__workers[global.__workers.length - 1].onmessage({ data: data });
    });
}

//
// the boxes, each its name and its value as a phone reads them: the shorter
// form, where there is one
//
function figures() {
    return [...document.querySelectorAll('.filter-month .stream-focus-figure')].map((box) => {
        const phone = (part) => (box.querySelector(`${part} .stream-focus-short`) || box.querySelector(part)).textContent;

        return [phone('.stream-focus-figure-label'), phone('.stream-focus-figure-value')];
    });
}

//
// a month of SEC filings, three forms of them
//
const FILINGS = {
    selected_stream: 'sec',
    aggregate_key: 'form',
    records: 83246,
    data_distribution: [
        { form: 'Form 4', Filings: 60513 },
        { form: 'Form 424B2', Filings: 17321 },
        { form: 'Form 144', Filings: 5412 },
    ],
};

describe('a dataset\'s month in three boxes on a phone (#230)', () => {
    beforeEach(() => {
        global.__workers.length = 0;
    });

    it('sits under the month row, over the rows', () => {
        setup();
        fireEvent.click(chartButton('SEC Filings'));

        expect(document.querySelector('.filter-month .data-month-row').nextElementSibling)
            .toHaveClass('stream-focus-figures');
        expect(document.querySelectorAll('.stream-focus-figure')).toHaveLength(3);
    });

    it.each([
        ['S&P 500', 'Records', 'Sectors', 'records', 'sector'],
        ['Stock Splits', 'Splits', 'Days', 'splits', 'day'],
        ['Bureau of Labor Statistics', 'Records', 'Series', 'records', 'series'],
        ['SEC Filings', 'Filings', 'Forms', 'filings', 'form'],
        ['SEC Company Facts', 'Facts', 'Forms', 'facts', 'form'],
        ['US Weather Alerts', 'Events', 'Severities', 'events', 'severity'],
    ])('names %s\'s for what its rows count: %s, %s and Partitions', (label, unit, rows, units, row) => {
        setup();
        fireEvent.click(chartButton(label));

        const names = [...document.querySelectorAll('.filter-month .stream-focus-figure-label')];

        expect(figures().map(([name]) => name)).toEqual([unit, rows, 'Partitions']);
        expect(names[0].querySelector('.stream-focus-long')).toHaveTextContent(`Total ${unit}`);
        expect(names[0]).toHaveAccessibleDescription(`All the ${units} below, added up`);
        expect(names[1]).toHaveAccessibleDescription(`One row per ${row}, below`);
        expect(names[2]).toHaveAccessibleDescription('Partitions the month is stored in');
    });

    it('reads n/a while the month is on its way, then the month\'s total, rows and partitions', () => {
        const page = setupPage();
        fireEvent.click(chartButton('SEC Filings'));

        expect(figures()).toEqual([['Filings', 'n/a'], ['Forms', 'n/a'], ['Partitions', 'n/a']]);

        deliver(page, 'sec', FILINGS);
        expect(figures()).toEqual([['Filings', '83.2K'], ['Forms', '3'], ['Partitions', 'n/a']]);

        deliver(page, 'sec', { count: 1, selected_stream: 'sec' });
        expect(figures()).toEqual([['Filings', '83.2K'], ['Forms', '3'], ['Partitions', '1']]);
        expect(document.querySelector('.filter-month .stream-focus-figure-value .stream-focus-long'))
            .toHaveTextContent('83,246');
    });

    it('waits for the rows before showing partitions that came first', () => {
        const page = setupPage();
        fireEvent.click(chartButton('SEC Filings'));

        deliver(page, 'sec', { count: 1, selected_stream: 'sec' });
        expect(figures().map(([, value]) => value)).toEqual(['n/a', 'n/a', 'n/a']);

        deliver(page, 'sec', FILINGS);
        expect(figures().map(([, value]) => value)).toEqual(['83.2K', '3', '1']);
    });

    it('shows a month\'s own partitions, never the month before\'s', () => {
        const page = setupPage();
        fireEvent.click(chartButton('SEC Filings'));
        deliver(page, 'sec', FILINGS);
        deliver(page, 'sec', { count: 1, selected_stream: 'sec' });

        fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }));
        expect(figures().map(([, value]) => value)).toEqual(['n/a', 'n/a', 'n/a']);

        deliver(page, 'sec', { ...FILINGS, records: 120248 });
        expect(figures().map(([, value]) => value)).toEqual(['120.2K', '3', 'n/a']);

        deliver(page, 'sec', { count: 2, selected_stream: 'sec' });
        expect(figures().map(([, value]) => value)).toEqual(['120.2K', '3', '2']);
    });

    it('draws the total in /stream\'s Total Records blue once it lands, and nothing else in color', () => {
        const page = setupPage();
        fireEvent.click(chartButton('SEC Filings'));

        expect(document.querySelector('.stream-focus-figure-total')).toBeNull();

        deliver(page, 'sec', FILINGS);
        deliver(page, 'sec', { count: 1, selected_stream: 'sec' });

        expect([...document.querySelectorAll('.filter-month .stream-focus-figure-value')].map((value) => value.className))
            .toEqual([
                'stream-focus-figure-value stream-focus-figure-total',
                'stream-focus-figure-value',
                'stream-focus-figure-value',
            ]);
    });

    it('draws none over the listing', () => {
        setup();

        expect(document.querySelector('.stream-focus-figures')).toBeNull();
    });

    it('names the company facts\' statuses with a capital, in a legend that folds as Statuses', () => {
        const page = setupPage();
        fireEvent.click(chartButton('SEC Company Facts'));

        deliver(page, 'sec-companyfacts', {
            selected_stream: 'sec-companyfacts',
            aggregate_key: 'form',
            records: 10135,
            data_distribution: [
                { form: 'Form 10-Q', repeated: 3300, new: 3691, changed: 98 },
                { form: 'Form 424B2', new: 3046 },
            ],
        });

        expect(screen.getByRole('button', { name: 'Statuses' })).toHaveAttribute('aria-expanded', 'true');
        expect([...document.querySelectorAll('.cube-rows-legend li')].map((item) => item.textContent))
            .toEqual(['New', 'Repeated', 'Changed']);
        expect(figures()).toEqual([['Facts', '10.1K'], ['Forms', '2'], ['Partitions', 'n/a']]);
    });
});

//
// #232: on a phone, the green bar goes back one step from a group open on its
// own, as Back does, and the group is a step in the address
//

//
// a month of stock splits: three days, each opening to its tickers
//
const SPLIT_DAYS = {
    selected_stream: 'stock-split',
    aggregate_key: 'sector',
    records: 7,
    data_distribution: [
        { sector: 'Day 1', splits: 3, tickers: 'reto 1:20, zcmd 1:2, mmsmy 2:1' },
        { sector: 'Day 2', splits: 2, tickers: 'ngksy 3:1, nipmy 1:1' },
        { sector: 'Day 5', splits: 2, tickers: 'npngy 1:1, stkxf 1:10' },
    ],
};

//
// a group's row tapped open, by its name
//
function openRow(name) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name},`) }));
}

function openTitle() {
    const title = document.querySelector('.cube-rows-title');

    return title ? title.textContent : null;
}

const where = () => `${window.location.pathname}${window.location.search}`;

describe('the green bar, one step back from a group open on its own (#232)', () => {
    beforeEach(() => {
        global.__workers.length = 0;
    });

    function splits() {
        const page = setupPage();
        fireEvent.click(chartButton('Stock Splits'));
        deliver(page, 'stock-split', SPLIT_DAYS);

        return page;
    }

    it('reads All days while a day is open, and goes back to the days, then to the listing', () => {
        splits();
        expect(backBar()).toHaveTextContent(/^All data$/);

        openRow('Day 2');
        expect(openTitle()).toBe('Day 2');
        expect(backBar()).toHaveTextContent(/^All days$/);

        fireEvent.click(backBar());
        expect(openTitle()).toBeNull();
        expect(backBar()).toHaveTextContent(/^All data$/);
        expect(chartShown()).toBe(true);

        fireEvent.click(backBar());
        expect(listingShown()).toBe(true);
    });

    it('puts the open day in the address, opening and closing it each a step', () => {
        splits();
        const before = window.history.length;

        openRow('Day 2');
        expect(where()).toBe('/?item=stock-split&group=Day+2');
        expect(window.history.length).toBe(before + 1);

        fireEvent.click(backBar());
        expect(where()).toBe('/?item=stock-split');
        expect(window.history.length).toBe(before + 2);
    });

    it('closes the day on Back, and opens it again on Forward', () => {
        splits();
        openRow('Day 2');

        travel('/?item=stock-split');
        expect(openTitle()).toBeNull();
        expect(backBar()).toHaveTextContent(/^All data$/);

        travel('/?item=stock-split&group=Day+2');
        expect(openTitle()).toBe('Day 2');
        expect(backBar()).toHaveTextContent(/^All days$/);
    });

    it('closes the day from its × as well, out of the address', () => {
        splits();
        openRow('Day 2');

        fireEvent.click(screen.getByRole('button', { name: 'Back to all days' }));

        expect(openTitle()).toBeNull();
        expect(where()).toBe('/?item=stock-split');
    });

    it('opens the day an address names, once its month comes', () => {
        window.history.replaceState(null, '', '/?item=stock-split&group=Day+5');
        const page = setupPage();

        expect(backBar()).toHaveTextContent(/^All data$/);

        deliver(page, 'stock-split', SPLIT_DAYS);

        expect(openTitle()).toBe('Day 5');
        expect(backBar()).toHaveTextContent(/^All days$/);
    });

    it('shows the days where the address names one the month does not hold', () => {
        window.history.replaceState(null, '', '/?item=stock-split&group=Day+9');
        const page = setupPage();

        deliver(page, 'stock-split', SPLIT_DAYS);

        expect(openTitle()).toBeNull();
        expect(backBar()).toHaveTextContent(/^All data$/);
    });

    it('closes the day on a new month, which takes its place in the address without a step (#235)', () => {
        splits();
        openRow('Day 2');
        const before = window.history.length;

        fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }));

        expect(openTitle()).toBeNull();
        expect(where()).toBe(`/?item=stock-split&month=${monthMenu().value}`);
        expect(window.history.length).toBe(before);
    });

    it('opens another dataset with none of its groups open', () => {
        splits();
        openRow('Day 2');

        fireEvent.click(backBar());
        fireEvent.click(backBar());
        fireEvent.click(chartButton('S&P 500'));

        expect(openTitle()).toBeNull();
        expect(where()).toBe('/?item=stock-market');
    });

    it.each([
        ['S&P 500', 'stock-market', 'sector', [
            { sector: 'Energy', Refining: 3, 'Oil & Gas Storage': 2 },
            { sector: 'Utilities', Water: 4, Electric: 1 },
        ], 'Energy', 'All sectors'],
        ['SEC Company Facts', 'sec-companyfacts', 'form', [
            { form: 'Form 10-Q', new: 5, repeated: 3 },
        ], 'Form 10-Q', 'All forms'],
        ['US Weather Alerts', 'us-national-weather', 'severity', [
            { severity: 'Severe', 'Flood Warning': 3, 'Storm Warning': 2 },
        ], 'Severe', 'All severities'],
    ])('names the bar for %s\'s groups while one is open', (label, stream, key, rows, name, words) => {
        const page = setupPage();
        fireEvent.click(chartButton(label));
        deliver(page, stream, { selected_stream: stream, aggregate_key: key, records: 10, data_distribution: rows });

        openRow(name);

        expect(backBar()).toHaveTextContent(new RegExp(`^${words}$`));
    });

    it('stays All data on a dataset whose groups open nothing', () => {
        const page = setupPage();
        fireEvent.click(chartButton('SEC Filings'));
        deliver(page, 'sec', FILINGS);

        expect(screen.queryByRole('button', { name: /^Form 4,/ })).toBeNull();
        expect(backBar()).toHaveTextContent(/^All data$/);
    });

    it('draws a group open on its own in a panel', () => {
        splits();
        expect(document.querySelector('.cube-rows')).not.toHaveClass('is-open');

        openRow('Day 1');
        expect(document.querySelector('.cube-rows')).toHaveClass('is-open');
    });
});

//
// #235: on a phone, the month joins the address in place of it, as /stream's
// window does, and the back and forward buttons keep the month on screen
//

//
// the month the menu offers at `index`, newest first, as the page keys it
//
function monthAt(index) {
    return monthMenu().options[index].value;
}

describe('a phone\'s month in the address (#235)', () => {
    beforeEach(() => {
        global.__workers.length = 0;
    });

    it('names a month stepped to on the listing, in place of the address', () => {
        setup();
        const before = window.history.length;

        fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }));

        expect(where()).toBe(`/?month=${monthMenu().value}`);
        expect(window.history.length).toBe(before);
    });

    it('names none again on the month the page opens on', () => {
        setup();

        fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }));
        fireEvent.click(screen.getByRole('button', { name: /^Later month/ }));

        expect(where()).toBe('/');
    });

    it('keeps the month when a dataset opens, a step of its own, and when the green bar goes back', () => {
        setup();
        fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }));
        const month = monthMenu().value;
        const before = window.history.length;

        fireEvent.click(chartButton('SEC Filings'));
        expect(where()).toBe(`/?item=sec&month=${month}`);
        expect(window.history.length).toBe(before + 1);

        fireEvent.click(backBar());
        expect(where()).toBe(`/?month=${month}`);
        expect(window.history.length).toBe(before + 2);
    });

    it('keeps the month on screen on Back, and names it in the address Back lands on', () => {
        setup();
        fireEvent.click(chartButton('SEC Filings'));
        fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }));
        const month = monthMenu().value;

        travel('/');

        expect(listingShown()).toBe(true);
        expect(monthMenu().value).toBe(month);
        expect(where()).toBe(`/?month=${month}`);
    });

    it('keeps it on Forward too', () => {
        setup();
        fireEvent.click(chartButton('SEC Filings'));
        fireEvent.click(backBar());
        fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }));
        const month = monthMenu().value;

        travel('/?item=sec');

        expect(chartHeader()).toBe('SEC Filings');
        expect(monthMenu().value).toBe(month);
        expect(where()).toBe(`/?item=sec&month=${month}`);
    });

    it('keeps it on Back to a group a new month has closed', () => {
        const page = setupPage();
        fireEvent.click(chartButton('Stock Splits'));
        deliver(page, 'stock-split', SPLIT_DAYS);
        openRow('Day 2');
        fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }));
        const month = monthMenu().value;

        travel('/?item=stock-split');

        expect(monthMenu().value).toBe(month);
        expect(where()).toBe(`/?item=stock-split&month=${month}`);
    });

    it('names the month while bls is charted, the latest too, since a link naming none opens bls a step back', () => {
        setup();
        fireEvent.click(chartButton('Bureau of Labor'));
        expect(where()).toBe(`/?item=bls&month=${monthMenu().value}`);

        fireEvent.click(backBar());
        chooseMonth(0);

        expect(where()).toBe(`/?month=${monthAt(0)}`);
    });

    it('opens on the month a link names, with the dataset and the day it names', () => {
        const { unmount } = setup();
        const month = monthAt(3);

        unmount();
        window.history.replaceState(null, '', `/?item=stock-split&month=${month}&group=Day+5`);

        const page = setupPage();
        deliver(page, 'stock-split', SPLIT_DAYS);

        expect(chartHeader()).toBe('Stock Splits');
        expect(monthMenu().value).toBe(month);
        expect(openTitle()).toBe('Day 5');
        expect(where()).toBe(`/?item=stock-split&month=${month}&group=Day+5`);
    });
});
