/**
 * stream.test.jsx: /stream, every stream as a row of bars.
 *
 * This does not attempt line coverage. What it covers is the contract a visitor
 * actually sees: which streams have rows, under which labels, what each row shows
 * before any data has arrived, which rates are offered, and the icons over the
 * rows. The bars themselves are stream-bars.test.js's and stream-rows.test.jsx's.
 *
 * The labels are the valuable part. They come from stream-name.js, which is unit
 * tested separately -- this is what proves the component actually routes its ids
 * through it rather than rendering raw ids like 'stock-split'. The two
 * are otherwise free to drift.
 *
 * Note: get-data.js is mocked, and by default never answers, which is the
 *       genuine "before any data arrives" state. The cases about failure put the
 *       real one back, and meet setup.js's fetch, which answers not-ok.
 *
 * Note: the component is not redux-connected -- redux/container/stream/stream.jsx
 *       wraps it -- so it renders standalone with no Provider.
 */

//
// the reader's subscriptions, for the bells. Signed out unless a case says
// otherwise -- and the api's session reader imports Amplify, which jest cannot load
// unmocked.
//
jest.mock('../../../import/general/account-api.js', () => ({
    __esModule: true,
    listSubscriptions: jest.fn(),
}));

jest.mock('../../../import/general/get-data.js', () => ({
    __esModule: true,
    default: jest.fn(),
}));

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { listSubscriptions } from '../../../import/general/account-api.js';
import getData from '../../../import/general/get-data.js';
import { KEY, VERSION } from '../../../import/general/listing-preference.js';
import { STREAMS, SEC_COMPANYFACTS } from '../../../import/general/stream-id.js';
import { performanceStream } from '../../../import/general/api-url.js';
import StreamLayout from '../../../import/layout/stream/stream.jsx';

function setup(props = {}) {
    return render(
        <MemoryRouter>
            <StreamLayout {...props} />
        </MemoryRouter>
    );
}

function bodyText() {
    return document.body.textContent.replace(/\s+/g, ' ');
}

//
// the rows' names, top to bottom
//
function rowNames() {
    return [...document.querySelectorAll('.stream-row .stream-row-title')]
        .map((title) => title.firstChild.textContent);
}

//
// the rate button pressed
//
function pressedRate() {
    return document.querySelector('.stream-rate[aria-pressed="true"]').textContent;
}

const { default: realGetData } = jest.requireActual('../../../import/general/get-data.js');

beforeEach(() => {
    window.history.replaceState({}, '', '/');
    getData.mockReset();
});

afterAll(() => {
    window.history.replaceState({}, '', '/');
});

describe('the stream rows', () => {
    it('gives every stream a row, in the order stream-id.js lists them', () => {
        setup();

        expect(bodyText()).toContain('Streams');
        expect(rowNames()).toEqual([
            'S&P 500', 'Stock Splits', 'Bureau of Labor Statistics', 'SEC Filings', 'SEC Company Facts', 'US Weather Alerts',
        ]);
    });

    it('says how often each stream runs, from its schedule', () => {
        setup();

        const schedules = [...document.querySelectorAll('.stream-row-schedule')].map((cell) => cell.textContent);

        expect(schedules).toEqual([
            'weekdays, every 20 min',
            'weekdays, once a day',
            'once a day',
            'weekdays, every 5 min',
            'Mon-Sat, once a day',
            'daily, every 5 min',
        ]);
    });

    it('renders each stream under its display label, not its id', () => {
        //
        // the ids are 'stock-market', 'stock-split', 'bls', 'sec',
        // 'sec-companyfacts' and 'us-national-weather'. Every one has to reach
        // stream-name.js on the way to the screen, or the listing shows raw
        // identifiers.
        //
        setup();

        expect(screen.getByText('S&P 500')).toBeInTheDocument();
        expect(screen.getByText('Stock Splits')).toBeInTheDocument();
        expect(screen.getByText('Bureau of Labor Statistics')).toBeInTheDocument();
        expect(screen.getByText('SEC Filings')).toBeInTheDocument();
        expect(screen.getByText('SEC Company Facts')).toBeInTheDocument();
        expect(screen.getByText('US Weather Alerts')).toBeInTheDocument();
    });

    it('never leaks a raw stream id to the screen', () => {
        setup();

        const text = bodyText();
        expect(text).not.toContain('stock-market');
        expect(text).not.toContain('stock-split');
        expect(text).not.toContain('sec-companyfacts');
        expect(text).not.toContain('us-national-weather');
    });

    it('distinguishes the two stock streams', () => {
        //
        // they sit adjacent in the listing and differ only in scope, which is the
        // whole reason stream-name.js matches on the WHOLE id rather than a prefix.
        // A prefix match would label the split feed 'S&P 500'.
        //
        setup();

        expect(screen.getByText('S&P 500')).toBeInTheDocument();
        expect(screen.getByText('Stock Splits')).toBeInTheDocument();
    });
});

describe('each row before data arrives', () => {
    it('heads the rows with the stream, health, coverage and total records, once each', () => {
        setup();

        const headings = [...document.querySelectorAll('.stream-rows-sort')].map((button) => button.firstChild.textContent);

        expect(headings).toEqual(['Stream', 'Health', 'Coverage', 'Total Records']);
    });

    it('shows n/a rather than a zero or a blank', () => {
        //
        // 'n/a' and 0 mean different things here: one is "not measured yet", the
        // other is "measured, and nothing arrived". Rendering 0 before the first
        // response would read as an outage.
        //
        setup();

        const figures = [...document.querySelectorAll('.stream-row-figure')].map((cell) => cell.textContent);

        expect(figures).toHaveLength(18);
        expect(figures.every((figure) => figure === 'n/a')).toBe(true);
        document.querySelectorAll('.stream-row').forEach((row) => {
            expect(row.textContent).not.toContain('0%');
        });
    });

    it('marks every row loading until its report arrives', () => {
        setup();

        const lines = [...document.querySelectorAll('.stream-row-status')].map((line) => line.textContent);

        expect(lines).toEqual(['Loading', 'Loading', 'Loading', 'Loading', 'Loading', 'Loading']);
        expect(document.querySelectorAll('.stream-row-spinner')).toHaveLength(6);
    });
});

describe('the rate', () => {
    it('offers exactly the rates the window has sizes for, coarsest first', () => {
        //
        // these mirror ROLLING_WINDOW in rolling-window.js, which carries minute,
        // hour, day and month -- and deliberately no per-second rate, since ingest
        // is not frequent enough for one to carry signal.
        //
        setup();

        const rates = [...document.querySelectorAll('.stream-rate')].map((button) => button.textContent);

        expect(rates).toEqual(['Month', 'Day', 'Hour', 'Minute']);
    });

    it('opens by the day', () => {
        setup();

        expect(pressedRate()).toBe('Day');
        expect(bodyText()).toContain('Last 20 Days, one bar per day');
    });

    it('opens at the rate an address names', () => {
        window.history.replaceState({}, '', '/?rate=hour');
        setup();

        expect(pressedRate()).toBe('Hour');
    });

    it('opens by the day when the address names no rate it offers', () => {
        window.history.replaceState({}, '', '/?rate=second');
        setup();

        expect(pressedRate()).toBe('Day');
    });

    it('redraws every row at a rate chosen', () => {
        setup();

        fireEvent.click(screen.getByRole('button', { name: 'Hour' }));

        expect(pressedRate()).toBe('Hour');
        expect(bodyText()).toContain('Last 24 Hours, one bar per hour');
        expect(document.querySelectorAll('.stream-row')[0].querySelectorAll('.stream-bar-slot')).toHaveLength(24);
    });

    it('draws a bar per interval of the window at each rate', () => {
        [['Month', 12], ['Day', 20], ['Hour', 24], ['Minute', 60]].forEach(([rate, bars]) => {
            window.history.replaceState({}, '', `/?rate=${rate.toLowerCase()}`);
            const { unmount } = setup();

            document.querySelectorAll('.stream-row').forEach((row) => {
                expect(row.querySelectorAll('.stream-bar-slot')).toHaveLength(bars);
            });

            unmount();
        });
    });
});

beforeEach(() => {
    listSubscriptions.mockReset();
    listSubscriptions.mockResolvedValue(null);
});

describe('each row\'s bell', () => {
    //
    // it leads to the stream's alarm page either way, and says whether the reader
    // is subscribed to any of the stream's alarms: ringing, and green, when they
    // are -- see '.control-icon.subscribed' in _article.scss
    //
    const bell = (stream) => document.querySelector(`a[href="/stream/${stream}/alarm"] svg`);
    const HELD = { alarm: 'ingest', since: '2026-09-26T12:00:00Z', terms: '2026-09' };

    it('is the plain bell for a reader who is signed out', async () => {
        setup();

        await waitFor(() => expect(listSubscriptions).toHaveBeenCalled());

        STREAMS.forEach((stream) => {
            expect(bell(stream)).toHaveAttribute('data-testid', 'NotificationsIcon');
            expect(bell(stream)).not.toHaveClass('subscribed');
        });
    });

    it('is drawn for the company facts too, now their alarm exists (#214)', async () => {
        //
        // #211 left it off while the alarms api answered their id 'no such stream'
        //
        setup();

        await waitFor(() => expect(listSubscriptions).toHaveBeenCalled());

        expect(screen.getByRole('link', { name: 'Alarms for SEC Company Facts' }))
            .toHaveAttribute('href', `/stream/${SEC_COMPANYFACTS}/alarm`);
        expect(document.querySelectorAll('.stream-row a[href$="/alarm"]')).toHaveLength(STREAMS.length);
    });

    it('rings for the company facts, for a reader subscribed to their alarm', async () => {
        listSubscriptions.mockResolvedValue([{ ...HELD, stream: SEC_COMPANYFACTS }]);

        setup();

        expect(await screen.findByLabelText('Subscribed to 1 alarm')).toBe(bell(SEC_COMPANYFACTS));
    });

    it('rings for a stream the reader is subscribed to, saying how many', async () => {
        listSubscriptions.mockResolvedValue([{ ...HELD, stream: 'bls' }]);

        setup();

        expect(await screen.findByLabelText('Subscribed to 1 alarm')).toBe(bell('bls'));
        expect(bell('bls')).toHaveAttribute('data-testid', 'NotificationsActiveIcon');
        expect(bell('bls')).toHaveClass('control-icon', 'notification', 'subscribed');
    });

    it('counts every alarm the reader holds on the stream', async () => {
        listSubscriptions.mockResolvedValue([
            { ...HELD, stream: 'sec' },
            { ...HELD, stream: 'sec', alarm: 'another' },
        ]);

        setup();

        expect(await screen.findByLabelText('Subscribed to 2 alarms')).toBe(bell('sec'));
    });

    it('leaves the bell of every other stream as it was', async () => {
        listSubscriptions.mockResolvedValue([{ ...HELD, stream: 'bls' }]);

        setup();

        await screen.findByLabelText('Subscribed to 1 alarm');

        STREAMS.filter((stream) => stream !== 'bls').forEach((stream) => {
            expect(bell(stream)).toHaveAttribute('data-testid', 'NotificationsIcon');
        });
    });

    it('still leads to the stream\'s alarm page when it rings', async () => {
        listSubscriptions.mockResolvedValue([{ ...HELD, stream: 'bls' }]);

        setup();

        expect((await screen.findByLabelText('Subscribed to 1 alarm')).closest('a'))
            .toHaveAttribute('href', '/stream/bls/alarm');
    });

    it('stays plain when the subscriptions could not be listed', async () => {
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        listSubscriptions.mockRejectedValue(new Error('busy, try again'));

        setup();

        await waitFor(() => expect(quiet).toHaveBeenCalledWith(expect.stringContaining('busy, try again')));
        expect(bell('bls')).toHaveAttribute('data-testid', 'NotificationsIcon');

        quiet.mockRestore();
    });
});

describe('the sort, kept for the next visit', () => {
    //
    // kept in localStorage, which lasts the whole of this file, so each case
    // starts from an empty one -- see listing-preference.js
    //
    beforeEach(() => {
        window.localStorage.clear();
    });

    afterAll(() => {
        window.localStorage.clear();
    });

    const keep = (sort) => window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, stream: { sort: sort } }));
    const kept = () => (JSON.parse(window.localStorage.getItem(KEY) || '{}').stream || {}).sort;
    const pressed = () => [...document.querySelectorAll('.stream-rows-sort[aria-pressed="true"]')]
        .map((button) => button.firstChild.textContent);

    it('opens in the page\'s own order when nothing is kept', () => {
        setup();

        expect(pressed()).toEqual([]);
        expect(screen.getByRole('button', { name: /^Sort: / })).toHaveAccessibleName('Sort: Default order');
    });

    it('opens sorted as the reader left it', () => {
        keep({ key: 'total', dir: 'asc' });

        setup();

        expect(pressed()).toEqual(['Total Records']);
        expect(screen.getByRole('button', { name: /^Sort: / }))
            .toHaveAccessibleName('Sort: Total Records, fewest first');
    });

    it('opens sorted by name as the reader left it, A to Z (#216)', () => {
        keep({ key: 'name', dir: 'asc' });

        setup();

        expect(pressed()).toEqual(['Stream']);
        expect(rowNames()).toEqual([
            'Bureau of Labor Statistics', 'S&P 500', 'SEC Company Facts', 'SEC Filings', 'Stock Splits', 'US Weather Alerts',
        ]);
    });

    it('keeps a sort by name the reader chooses', () => {
        setup();

        fireEvent.click(screen.getByRole('button', { name: 'Sort by Stream' }));

        expect(kept()).toEqual({ key: 'name', dir: 'asc' });
    });

    it('keeps a sort the reader chooses, and lets it go on the third click', () => {
        setup();

        fireEvent.click(screen.getByRole('button', { name: 'Sort by Health' }));
        expect(kept()).toEqual({ key: 'health', dir: 'desc' });

        fireEvent.click(screen.getByRole('button', { name: 'Sort by Health' }));
        expect(kept()).toEqual({ key: 'health', dir: 'asc' });

        fireEvent.click(screen.getByRole('button', { name: 'Sort by Health' }));
        expect(kept()).toBeUndefined();
    });

    it('keeps a sort chosen from the phone\'s button', () => {
        setup();

        fireEvent.click(screen.getByRole('button', { name: /^Sort: / }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Coverage, highest first' }));

        expect(kept()).toEqual({ key: 'coverage', dir: 'desc' });
    });

    it('ignores a kept sort naming a figure it no longer offers', () => {
        keep({ key: 'lag', dir: 'desc' });

        setup();

        expect(pressed()).toEqual([]);
    });
});

describe('the controls on each row', () => {
    it('names every row\'s controls for the stream they act on', () => {
        setup();

        expect(screen.getByRole('link', { name: 'Triggers for S&P 500' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Alarms for SEC Filings' }))
            .toHaveAttribute('href', '/stream/sec/alarm');
    });

    it('has no chart button, since every stream is drawn at once', () => {
        setup();

        expect(screen.queryByRole('button', { name: /^Chart / })).toBeNull();
    });

    it('shows the stream an address names on its own (#161)', () => {
        window.history.replaceState({}, '', '/?item=bls');
        setup();

        expect(document.querySelector('.stream-focus').dataset.stream).toBe('bls');
        expect(document.querySelectorAll('.stream-row')).toHaveLength(0);
    });
});

describe('the icons over the rows', () => {
    it('link the performance docs', () => {
        setup();

        expect(screen.getByRole('link', { name: 'API docs' }).getAttribute('href')).toMatch(/performance/);
    });

    it('open a list of the requests, one per stream, at the rate on screen', async () => {
        setup();

        fireEvent.click(screen.getByRole('button', { name: 'This request' }));

        const items = await screen.findAllByRole('menuitem');

        expect(items.map((item) => item.textContent)).toEqual([
            'S&P 500', 'Stock Splits', 'Bureau of Labor Statistics', 'SEC Filings', 'SEC Company Facts', 'US Weather Alerts',
        ]);
        items.forEach((item, index) => {
            const url = new URL(item.getAttribute('href'));

            expect(url.searchParams.get('Stream')).toBe(performanceStream(STREAMS[index]));
            expect(url.searchParams.get('Interval')).toBe('day');
            expect(item).toHaveAttribute('target', '_blank');
        });
    });

    it('link the company facts to the request the filings were drawn from (#211)', async () => {
        //
        // one report holds both: the filings are its series 'sec', and the
        // company facts its series 'companyfacts'
        //
        setup();

        fireEvent.click(screen.getByRole('button', { name: 'This request' }));

        const items = await screen.findAllByRole('menuitem');
        const href = (name) => items.find((item) => item.textContent === name).getAttribute('href');

        expect(href('SEC Company Facts')).toBe(href('SEC Filings'));
        expect(new URL(href('SEC Company Facts')).searchParams.get('Stream')).toBe('sec');
    });

    it('have no refresh button', () => {
        setup();

        expect(document.querySelector('.refresh, .refresh-disabled')).toBeNull();
    });

    it('draw no area chart and no listing table', () => {
        setup();

        expect(document.querySelector('.area-chart-parent')).toBeNull();
        expect(document.querySelector('.listing-table')).toBeNull();
    });
});

describe('resilience', () => {
    it('mounts with no props at all', () => {
        //
        // the redux container supplies its props; a missing one must not stop the
        // rows rendering, since the shell is useful before any data loads.
        //
        expect(() => setup()).not.toThrow();
    });

    it('says every row could not load when every request fails, and keeps the page', async () => {
        //
        // the real loader, against setup.js's fetch, which answers not-ok: the state
        // after a total api outage. Each row says so, and offers to ask again.
        //
        getData.mockImplementation(realGetData);
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        setup();

        expect(await screen.findAllByText('Could not load this stream.')).toHaveLength(6);
        expect(screen.getAllByRole('button', { name: /^Retry / })).toHaveLength(6);
        expect(screen.getByText('S&P 500')).toBeInTheDocument();

        quiet.mockRestore();
    });

    it('says the same when the network rejects outright', async () => {
        const original = global.fetch;
        global.fetch = () => Promise.reject(new Error('offline'));
        getData.mockImplementation(realGetData);
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        try {
            setup();

            expect(await screen.findAllByText('Could not load this stream.')).toHaveLength(6);
        } finally {
            global.fetch = original;
            quiet.mockRestore();
        }
    });
});
