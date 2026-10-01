/**
 * stream-zoom.test.jsx: /stream over a window that has ended (#159).
 *
 * A bar opens the interval it covers, one rate finer; the arrows page back and
 * forward by the window's own length; Now, or a rate, comes back to the window
 * ending now. Whatever is on screen is named in the heading, in the address, and
 * in every request, as the api's End.
 *
 * Note: get-data.js is mocked, so a request is only recorded: what is asserted
 *       is what the page asked for. The window helpers are rolling-window.test.js's,
 *       and the expectations below are built from them, against the clock the test
 *       runs at.
 *
 * Note: jest.config.js pins New York, which every local time below is read in.
 */

//
// signed out: the page asks the account api for the reader's subscriptions on
// mount, for the bells, and the api's session reader imports Amplify, which jest
// cannot load unmocked.
//
jest.mock('../../../import/general/account-api.js', () => ({
    __esModule: true,
    listSubscriptions: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../../../import/general/get-data.js', () => ({
    __esModule: true,
    default: jest.fn(),
}));

import React from 'react';
import { render, act, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import getData from '../../../import/general/get-data.js';
import StreamLayout, { REFRESH_MS } from '../../../import/layout/stream/stream.jsx';
import { STREAMS } from '../../../import/general/stream-id.js';
import {
    localInstant,
    pageWindow,
    windowHeading,
    windowStart,
} from '../../../import/general/rolling-window.js';

function setup(address = '/stream') {
    window.history.replaceState({}, '', address);

    const held = React.createRef();

    render(
        <MemoryRouter>
            <StreamLayout ref={held} />
        </MemoryRouter>
    );

    return held.current;
}

//
// the requests the page made for every stream since `from`, as their search
// parameters
//
function asked(from = 0) {
    return getData.mock.calls.slice(from).map((call) => new URL(String(call[1])).searchParams);
}

//
// the newest request made for each stream
//
function latest() {
    return asked().slice(-STREAMS.length);
}

function slot(row, index) {
    return document.querySelectorAll('.stream-row')[row].querySelectorAll('.stream-bar-slot')[index];
}

function heading() {
    return document.querySelector('.stream-rows-intro span').textContent.replace(/ /g, ' ');
}

function address() {
    return new URLSearchParams(window.location.search);
}

const plain = (text) => text.replace(/ /g, ' ');

beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
});

afterAll(() => {
    window.history.replaceState({}, '', '/');
});

describe('opening a bar', () => {
    it('opens a day into its 24 hours, for every stream at once', () => {
        const page = setup();
        const day = windowStart('day');
        const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23);

        getData.mockClear();
        fireEvent.click(slot(0, 0));

        expect(page.state.rate).toBe('Hour');
        expect(page.state.end).toEqual(end);
        expect(asked().map((params) => params.get('Stream'))).toEqual(STREAMS);
        asked().forEach((params) => {
            expect(params.get('Interval')).toBe('hour');
            expect(params.get('End')).toBe(localInstant(end));
        });
    });

    it('opens an hour into its 60 minutes', () => {
        const page = setup('/stream?rate=hour&end=2026-09-17T23:00:00-04:00');

        fireEvent.click(slot(0, 0));

        expect(page.state.rate).toBe('Minute');
        expect(page.state.end).toEqual(new Date(2026, 8, 17, 0, 59));
        expect(latest()[0].get('End')).toBe('2026-09-17T00:59:00-04:00');
    });

    it('opens a month into the days ending on its last', () => {
        const page = setup('/stream?rate=month');
        const month = windowStart('month');

        fireEvent.click(slot(0, 0));

        expect(page.state.rate).toBe('Day');
        expect(page.state.end).toEqual(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    });

    it('opens nothing from a minute', () => {
        const page = setup('/stream?rate=minute');

        getData.mockClear();
        fireEvent.click(slot(0, 0));

        expect(page.state.rate).toBe('Minute');
        expect(page.state.end).toBeNull();
        expect(getData).not.toHaveBeenCalled();
        expect(document.querySelector('.stream-row-bars')).not.toHaveClass('stream-row-bars-open');
    });

    it('opens a bar still running into the window ending now', () => {
        //
        // today's day, by the hour, has not finished: the window ending now is the
        // nearest whole one
        //
        const page = setup();
        const bars = document.querySelectorAll('.stream-row')[0].querySelectorAll('.stream-bar-slot');

        fireEvent.click(bars[bars.length - 1]);

        expect(page.state.rate).toBe('Hour');
        expect(page.state.end).toBeNull();
        expect(latest()[0].has('End')).toBe(false);
    });

    it('drops a reply to the window it replaced', () => {
        const page = setup();
        const before = page.asked.bls;

        fireEvent.click(slot(0, 0));

        expect(page.answersLatest('bls', before)).toBe(false);
        expect(page.answersLatest('bls', page.asked.bls)).toBe(true);
    });
});

describe('paging', () => {
    function earlier() {
        return screen.getByRole('button', { name: 'Earlier 20 days' });
    }

    function later() {
        return screen.getByRole('button', { name: 'Later 20 days' });
    }

    it('cannot page forward from the window ending now', () => {
        setup();

        expect(later()).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Now' })).toBeNull();
    });

    it('pages back a whole window', () => {
        const page = setup();
        const end = pageWindow('day', null, -1);

        fireEvent.click(earlier());

        expect(page.state.end).toEqual(end);
        latest().forEach((params) => expect(params.get('End')).toBe(localInstant(end)));
        expect(later()).not.toBeDisabled();
    });

    it('pages forward again, back to the window ending now', () => {
        const page = setup();

        fireEvent.click(earlier());
        fireEvent.click(later());

        expect(page.state.end).toBeNull();
        latest().forEach((params) => expect(params.has('End')).toBe(false));
        expect(later()).toBeDisabled();
    });

    it('comes back to now from Now, wherever it has gone', () => {
        const page = setup();

        fireEvent.click(earlier());
        fireEvent.click(earlier());
        fireEvent.click(screen.getByRole('button', { name: 'Now' }));

        expect(page.state.end).toBeNull();
        expect(screen.queryByRole('button', { name: 'Now' })).toBeNull();
    });

    it('comes back to now at another rate from a rate button', () => {
        const page = setup();

        fireEvent.click(earlier());
        fireEvent.click(screen.getByRole('button', { name: 'Hour' }));

        expect(page.state.rate).toBe('Hour');
        expect(page.state.end).toBeNull();
        expect(address().has('end')).toBe(false);
    });

    it('names its arrows for the rate on screen', () => {
        setup('/stream?rate=minute');

        expect(screen.getByRole('button', { name: 'Earlier 60 minutes' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Later 60 minutes' })).toBeInTheDocument();
    });
});

describe('what the page says about the window', () => {
    it('names the window ending now as before', () => {
        setup();

        expect(heading()).toBe('Last 20 Days, one bar per day');
    });

    it('names a window that has ended by its dates', () => {
        setup('/stream?rate=hour&end=2026-09-17T23:00:00-04:00');

        expect(heading()).toBe('Sep 17, 2026, by the hour');
        expect(plain(windowHeading('hour', new Date(2026, 8, 17, 23)))).toBe('Sep 17, 2026');
    });

    it('names its first and last buckets over the bars, rather than Now', () => {
        setup('/stream?rate=day&end=2026-09-10T00:00:00-04:00');

        expect(document.querySelector('.stream-rows-axis').textContent).toBe('Aug 22Sep 10');
    });

    it('links the requests for the window on screen', async () => {
        setup('/stream?rate=hour&end=2026-09-17T23:00:00-04:00');

        fireEvent.click(screen.getByRole('button', { name: 'This request' }));

        const items = await screen.findAllByRole('menuitem');

        items.forEach((item) => {
            expect(new URL(item.getAttribute('href')).searchParams.get('End')).toBe('2026-09-17T23:00:00-04:00');
        });
    });
});

describe('the address', () => {
    it('opens the window it names', () => {
        const page = setup('/stream?rate=hour&end=2026-09-17T23:00:00-04:00');

        expect(page.state.rate).toBe('Hour');
        expect(page.state.end).toEqual(new Date(2026, 8, 17, 23));
        latest().forEach((params) => expect(params.get('End')).toBe('2026-09-17T23:00:00-04:00'));
    });

    it('takes an end anywhere in its last bucket, and in utc', () => {
        const page = setup('/stream?rate=day&end=2026-09-10T16:30:00Z');

        expect(page.state.end).toEqual(new Date(2026, 8, 10));
    });

    it.each([
        ['no time', '2026-09-17'],
        ['no offset', '2026-09-17T23:00:00'],
        ['words', 'yesterday'],
        ['a window not yet ended', '2999-01-01T00:00:00Z'],
    ])('opens the window ending now for an end with %s', (_, end) => {
        const page = setup(`/stream?rate=hour&end=${encodeURIComponent(end)}`);

        expect(page.state.end).toBeNull();
    });

    it('carries the window on screen, replacing itself rather than piling up history', () => {
        setup();
        const depth = window.history.length;

        fireEvent.click(slot(0, 0));

        expect(address().get('rate')).toBe('hour');
        expect(address().get('end')).toBe(localInstant(new Date(
            windowStart('day').getFullYear(),
            windowStart('day').getMonth(),
            windowStart('day').getDate(),
            23
        )));
        expect(window.history.length).toBe(depth);
    });

    it('keeps the stream shown on its own, opened from its own graph (#161)', () => {
        setup('/stream?item=bls');

        fireEvent.click(document.querySelector('.stream-focus .stream-bar-slot'));

        expect(address().get('item')).toBe('bls');
        expect(address().get('rate')).toBe('hour');
        expect(document.querySelector('.stream-focus').dataset.stream).toBe('bls');
    });
});

describe('the refresh', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('asks for the window ending now again every 5 minutes', () => {
        const page = setup();

        act(() => {
            page.setState({ promise_get_data_bls: true });
        });
        getData.mockClear();

        act(() => {
            jest.advanceTimersByTime(REFRESH_MS);
        });

        expect(getData.mock.calls.map((call) => call[5])).toContain('bls');
    });

    it('does not ask again for a window that has ended, which no longer moves', () => {
        const page = setup('/stream?rate=hour&end=2026-09-17T23:00:00-04:00');

        act(() => {
            page.setState({ promise_get_data_bls: true });
        });
        getData.mockClear();

        act(() => {
            jest.advanceTimersByTime(REFRESH_MS);
        });

        expect(getData).not.toHaveBeenCalled();
    });

    it('asks again once the reader is back on now', () => {
        const page = setup('/stream?rate=hour&end=2026-09-17T23:00:00-04:00');

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Now' }));
        });
        act(() => {
            page.setState({ promise_get_data_bls: true });
        });
        getData.mockClear();

        act(() => {
            jest.advanceTimersByTime(REFRESH_MS);
        });

        expect(getData.mock.calls.map((call) => call[5])).toContain('bls');
    });
});
