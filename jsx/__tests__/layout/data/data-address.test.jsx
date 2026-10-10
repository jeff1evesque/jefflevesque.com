/**
 * data-address.test.jsx: /data's address on a wide screen (#235).
 *
 * /stream writes what is on screen into the address as the reader clicks --
 * '?rate=', '?end=' and '?item=' -- so the address bar is a link to share. /data
 * writes its own: the dataset charted, the month where a link has to name it,
 * and the bar whose list is open. These cases click as a reader would and read
 * the address back, and open the page on an address, as a link does. A phone's
 * are in data-mobile.test.jsx.
 *
 * Note: 'react-device-detect' reads the user agent at import time, so it is
 *       mocked rather than driven through jsdom's navigator.
 *
 * Note: the address, and the stream a click charts, last the whole of this
 *       file. Each case starts from a bare address and an empty store.
 */

import React from 'react';

jest.mock('react-device-detect', () => ({ isMobile: false }));

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
const { monthKey } = require('../../../import/layout/data/data.jsx');
const { KEY, VERSION } = require('../../../import/general/listing-preference.js');

beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
    global.__workers.length = 0;
});

//
// the page, held so a case can answer for its workers, and how to take it away
//
function setup() {
    const held = React.createRef();
    const view = render(
        <MemoryRouter>
            <DataLayout ref={held} />
        </MemoryRouter>
    );

    return { page: held.current, unmount: view.unmount };
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

const where = () => `${window.location.pathname}${window.location.search}`;

//
// the chart button of the stream whose name starts `label`
//
function chartButton(label) {
    return screen.getByRole('button', { name: new RegExp(`^Chart ${label}`) });
}

//
// the month menu, and the month it shows
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

//
// the month `back` months before this one, as the page keys it
//
function monthBack(back) {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const then = new Date(now.getFullYear(), now.getMonth() - back, 1);

    return monthKey(then.getFullYear(), then.getMonth() + 1);
}

//
// the listing's row for the dataset charted
//
function charted() {
    return document.querySelector('.listing-table-selected').textContent;
}

//
// a bar of the chart, by the name under it, and the title of the list open
// under the chart, or null
//
function barOf(name) {
    return document.querySelector(`rect.cube-chart-bar[data-name="${name}"]`);
}

function listTitle() {
    const title = document.querySelector('.cube-list-title');

    return title ? title.textContent : null;
}

//
// a month of stock splits: three days, each listing its tickers
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
// a month of SEC filings in 25 forms: more than the chart draws a bar each, so
// the 6 smallest, Form 20 to Form 25, share an Other bar
//
const MANY_FORMS = {
    selected_stream: 'sec',
    aggregate_key: 'form',
    records: 32500,
    data_distribution: Array.from({ length: 25 }, (ignored, index) => ({
        form: `Form ${index + 1}`,
        Filings: (25 - index) * 100,
    })),
};

//
// the stock splits charted, with their month come in
//
function splits() {
    const { page } = setup();

    fireEvent.click(chartButton('Stock Splits'));
    deliver(page, 'stock-split', SPLIT_DAYS);

    return page;
}

//
// what the page shows on `address`, as a link opens it: the dataset charted
// and the month
//
function landing(address) {
    window.history.replaceState(null, '', address);

    const { unmount } = setup();
    const shown = { charted: charted(), month: monthShown() };

    unmount();

    return shown;
}

describe('the address on a wide screen (#235)', () => {
    it('is left as it is until the reader changes something', () => {
        const { page } = setup();

        deliver(page, 'stock-market', {
            selected_stream: 'stock-market',
            aggregate_key: 'sector',
            records: 10,
            data_distribution: [{ sector: 'Energy', Refining: 6, Pipelines: 4 }],
        });

        expect(where()).toBe('/');
    });

    it('names the dataset charted, in place of the address, so Back leaves the page', () => {
        setup();
        const before = window.history.length;

        fireEvent.click(chartButton('SEC Filings'));

        expect(where()).toBe('/?item=sec');
        expect(window.history.length).toBe(before);
    });

    it('names a month stepped to, and none again on the month the page opens on', () => {
        setup();
        const before = window.history.length;

        fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }));
        expect(where()).toBe(`/?item=stock-market&month=${monthMenu().value}`);

        fireEvent.click(screen.getByRole('button', { name: /^Later month/ }));
        expect(where()).toBe('/?item=stock-market');
        expect(window.history.length).toBe(before);
    });

    it('names a month picked from the menu', () => {
        setup();

        chooseMonth(5);

        expect(where()).toBe(`/?item=stock-market&month=${monthMenu().options[5].value}`);
    });

    it('names the bar whose list is open, in place of the address', () => {
        splits();
        const before = window.history.length;

        fireEvent.click(barOf('Day 2'));

        expect(listTitle()).toBe('Day 2');
        expect(where()).toBe('/?item=stock-split&group=Day+2');
        expect(window.history.length).toBe(before);
    });

    it.each([
        ['a second click on its bar', () => fireEvent.click(barOf('Day 2'))],
        ['its ×', () => fireEvent.click(screen.getByRole('button', { name: 'Clear the list' }))],
        ['Escape', () => fireEvent.keyDown(barOf('Day 2'), { key: 'Escape' })],
    ])('takes the list out of the address once %s clears it', (way, clear) => {
        splits();
        fireEvent.click(barOf('Day 2'));

        clear();

        expect(listTitle()).toBeNull();
        expect(where()).toBe('/?item=stock-split');
    });

    it('names another bar clicked in place of the last', () => {
        splits();

        fireEvent.click(barOf('Day 2'));
        fireEvent.click(barOf('Day 5'));

        expect(where()).toBe('/?item=stock-split&group=Day+5');
    });

    it('names Other\'s list Other', () => {
        const { page } = setup();
        fireEvent.click(chartButton('SEC Filings'));
        deliver(page, 'sec', MANY_FORMS);

        fireEvent.click(barOf('Other'));

        expect(listTitle()).toBe('Other');
        expect(where()).toBe('/?item=sec&group=Other');
    });

    it('closes the list on a new month, which takes its place in the address', () => {
        splits();
        fireEvent.click(barOf('Day 2'));

        fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }));

        expect(where()).toBe(`/?item=stock-split&month=${monthMenu().value}`);
    });

    it('closes the list when another dataset is charted', () => {
        splits();
        fireEvent.click(barOf('Day 2'));

        fireEvent.click(chartButton('S&P 500'));

        expect(where()).toBe('/?item=stock-market');
    });

    it('keeps everything else the address carries, and writes its own names after it, in one order', () => {
        window.history.replaceState(null, '', '/?group=Day+9&from=alarm&month=junk');
        setup();

        fireEvent.click(chartButton('SEC Filings'));
        expect(where()).toBe('/?from=alarm&item=sec');

        fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }));
        expect(where()).toBe(`/?from=alarm&item=sec&month=${monthMenu().value}`);
    });
});

describe('a link to /data on a wide screen (#235)', () => {
    it('charts the dataset it names, on the month it names', () => {
        window.history.replaceState(null, '', `/?item=sec&month=${monthBack(3)}`);
        setup();

        expect(charted()).toContain('SEC Filings');
        expect(monthMenu().value).toBe(monthBack(3));
    });

    it('charts the dataset it names ahead of the one this browser charted last', () => {
        window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, data: { chart: 'sec' } }));
        window.history.replaceState(null, '', '/?item=us-national-weather');
        setup();

        expect(charted()).toContain('US Weather Alerts');
    });

    it('opens the list of the bar it names once the month comes', () => {
        window.history.replaceState(null, '', '/?item=stock-split&group=Day+5');
        const { page } = setup();

        expect(listTitle()).toBeNull();

        deliver(page, 'stock-split', SPLIT_DAYS);

        expect(listTitle()).toBe('Day 5');
        expect(barOf('Day 5')).toHaveAttribute('aria-expanded', 'true');
        expect(where()).toBe('/?item=stock-split&group=Day+5');
    });

    it.each([
        ['Other', 'Other'],
        ['a form Other rolled up', 'Form+25'],
    ])('opens Other\'s list from %s', (name, group) => {
        window.history.replaceState(null, '', `/?item=sec&group=${group}`);
        const { page } = setup();

        deliver(page, 'sec', MANY_FORMS);

        expect(listTitle()).toBe('Other');
    });

    it('opens no list where the month does not hold the group it names', () => {
        window.history.replaceState(null, '', '/?item=stock-split&group=Day+9');
        const { page } = setup();

        deliver(page, 'stock-split', SPLIT_DAYS);

        expect(listTitle()).toBeNull();
    });

    it.each([
        '/?month=2020-01',
        '/?month=2099-01',
        '/?month=2026-9',
        '/?month=2026-13',
        '/?month=junk',
        '/?month=',
        '/?item=nope',
    ])('opens %s as /data opens', (address) => {
        expect(landing(address)).toEqual(landing('/'));
    });
});

describe('bls in the address (#235)', () => {
    it('names its month, its step back off this one included', () => {
        setup();

        fireEvent.click(chartButton('Bureau of Labor'));

        expect(where()).toBe(`/?item=bls&month=${monthMenu().value}`);
        expect(monthMenu().value).not.toBe(monthBack(0));
    });

    it('names its month on this one as well, since a link naming none opens bls a step back', () => {
        setup();
        fireEvent.click(chartButton('Bureau of Labor'));

        chooseMonth(0);

        expect(monthMenu().value).toBe(monthBack(0));
        expect(where()).toBe(`/?item=bls&month=${monthBack(0)}`);
    });

    it('opens a link on the month it names, with no step back', () => {
        window.history.replaceState(null, '', `/?item=bls&month=${monthBack(0)}`);
        setup();

        expect(charted()).toContain('Bureau of Labor Statistics');
        expect(monthMenu().value).toBe(monthBack(0));
    });

    it('opens a link naming no month a step back, as choosing bls does', () => {
        setup();
        fireEvent.click(chartButton('Bureau of Labor'));
        const stepped = monthShown();

        expect(landing('/?item=bls').month).toBe(stepped);
    });
});

describe('a link copied from a wide screen (#235)', () => {
    //
    // the page a reader clicked into, and the page their address opens: the
    // same dataset, month and list -- and the next click on each lands in the
    // same place, so a link to bls's step goes on as that step (#198)
    //
    function copied(clicks, rows) {
        const first = setup();

        clicks.forEach((click) => click(first.page));

        const address = where();
        const shown = { charted: charted(), month: monthShown(), list: listTitle() };

        first.unmount();
        window.history.replaceState(null, '', address);

        const second = setup();

        if (rows) {
            deliver(second.page, rows.selected_stream, rows);
        }

        return { shown: shown, opened: { charted: charted(), month: monthShown(), list: listTitle() } };
    }

    it.each([
        ['SEC Filings charted', [() => fireEvent.click(chartButton('SEC Filings'))], null],
        ['a month back', [() => fireEvent.click(screen.getByRole('button', { name: /^Earlier month/ }))], null],
        ['bls charted', [() => fireEvent.click(chartButton('Bureau of Labor'))], null],
        ['bls on this month', [() => fireEvent.click(chartButton('Bureau of Labor')), () => chooseMonth(0)], null],
        ['a day\'s list open', [
            () => fireEvent.click(chartButton('Stock Splits')),
            (page) => deliver(page, 'stock-split', SPLIT_DAYS),
            () => fireEvent.click(barOf('Day 2')),
        ], SPLIT_DAYS],
    ])('opens what the page showed: %s', (name, clicks, rows) => {
        const { shown, opened } = copied(clicks, rows);

        expect(opened).toEqual(shown);
    });

    it('goes on from bls\'s step as the page it was copied from does, back to the latest month', () => {
        const { unmount } = setup();
        fireEvent.click(chartButton('Bureau of Labor'));
        const address = where();

        fireEvent.click(chartButton('S&P 500'));
        const after = { month: monthShown(), address: where() };

        unmount();
        window.history.replaceState(null, '', address);
        setup();
        fireEvent.click(chartButton('S&P 500'));

        expect({ month: monthShown(), address: where() }).toEqual(after);
        expect(monthMenu().value).toBe(monthBack(0));
    });
});
