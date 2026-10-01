/**
 * stream-refresh.test.jsx: /stream asking for every stream again on its own.
 *
 * Every five minutes, while the page is showing and the reader has left it on,
 * the page asks for each stream again -- quietly, so a row keeps what it shows
 * until the new answer lands. A hidden tab asks for nothing and catches up when
 * it is shown again, and the button beside the api icons switches it off and on.
 *
 * Note: run on jest's clock, which Date.now() follows, so the five minutes and
 *       the time since the page last asked both pass when the clock is moved.
 *
 * Note: get-data.js is mocked, so a request is a call that answers only when a
 *       test answers it, and web-worker.js is mocked so a reply can be delivered
 *       -- as stream-callback.test.jsx does. toggleChartScale is stubbed to hand
 *       back what it is given, since the real one windows against the clock.
 */

jest.mock('../../../import/general/account-api.js', () => ({
    __esModule: true,
    listSubscriptions: jest.fn(() => Promise.resolve(null)),
}));

import React from 'react';
import { render, act, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockWorkers = [];

jest.mock('../../../import/general/get-data.js', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../import/worker/web-worker.js', () => ({
    __esModule: true,
    default: class FakeWorkerBuilder {
        constructor() {
            mockWorkers.push(this);
        }
        postMessage() {}
        terminate() {}
    },
}));

import getData from '../../../import/general/get-data.js';
import StreamLayout, { REFRESH_MS } from '../../../import/layout/stream/stream.jsx';
import THROUGHPUT_KEY from '../../../import/general/throughput-key.js';
import { STREAMS } from '../../../import/general/stream-id.js';
import { KEY } from '../../../import/general/refresh-preference.js';

const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

let hidden = false;

beforeAll(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
});

afterAll(() => {
    delete document.hidden;
});

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockWorkers.length = 0;
    hidden = false;
    window.localStorage.clear();
});

afterEach(() => {
    jest.useRealTimers();
});

function setup() {
    const held = React.createRef();
    const view = render(
        <MemoryRouter>
            <StreamLayout ref={held} />
        </MemoryRouter>
    );
    const page = held.current;

    jest.spyOn(page, 'toggleChartScale').mockImplementation((stream, rate, data) => data);

    return { page, unmount: view.unmount };
}

function wait(ms) {
    act(() => {
        jest.advanceTimersByTime(ms);
    });
}

//
// the streams asked for since the last clearing of the mock, by id
//
function asked() {
    return getData.mock.calls.map((call) => call[5]);
}

function lastCall(stream) {
    const calls = getData.mock.calls.filter((call) => call[5] === stream);
    return calls[calls.length - 1];
}

//
// `days` rows of bls, dated that many days back from now
//
function answer(days) {
    const data = days.map((back) => ({
        window_start: new Date(Date.now() - (back * DAY)),
        bls: 10 * back,
        [`bls${THROUGHPUT_KEY}`]: 12 * back,
    }));

    return {
        chart_data_original: data,
        stream_throughput: 100,
        chart_data_bls: data,
        stream_throughput_bls: 100,
        selected_source: 'bls',
        selected_stream: 'bls',
    };
}

//
// answer bls's latest request with `days` of rows, through its worker
//
function reply(days) {
    act(() => {
        lastCall('bls')[2]({ stream: 'bls' });
    });
    act(() => {
        mockWorkers[mockWorkers.length - 1].onmessage({ data: answer(days) });
    });
}

//
// every stream marked as answered, so a refresh asks for each of them again
//
function settle(page) {
    act(() => {
        page.setState(Object.fromEntries(STREAMS.map((stream) => [`promise_get_data_${stream}`, true])));
    });
}

function show(now) {
    hidden = !now;
    act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
    });
}

const toggle = () => screen.getByRole('button', { name: 'Refresh every 5 minutes' });

function rowStatus(stream) {
    const line = document.querySelector(`.stream-row[data-stream="${stream}"] .stream-row-status`);

    return line ? line.textContent : null;
}

describe('every five minutes', () => {
    it('asks for every stream again, at the rate on screen', () => {
        const { page } = setup();
        settle(page);
        getData.mockClear();

        wait(REFRESH_MS - 1);
        expect(asked()).toEqual([]);

        wait(1);
        expect(asked().sort()).toEqual([...STREAMS].sort());
        getData.mock.calls.forEach((call) => {
            expect(new URL(String(call[1])).searchParams.get('Interval')).toBe('day');
        });
    });

    it('asks again five minutes after that', () => {
        const { page } = setup();
        settle(page);
        wait(REFRESH_MS);
        getData.mockClear();

        wait(REFRESH_MS);

        expect(asked()).toHaveLength(STREAMS.length);
    });

    it('leaves a stream still waiting on its first answer to it', () => {
        const { page } = setup();
        settle(page);
        act(() => {
            page.setState({ promise_get_data_sec: false });
        });
        getData.mockClear();

        wait(REFRESH_MS);

        expect(asked()).not.toContain('sec');
        expect(asked()).toContain('bls');
    });
});

describe('quietly', () => {
    it('keeps a row\'s bars and figures while the new answer is on its way', () => {
        const { page } = setup();
        reply([1, 2]);
        const rows = page.state.chart_data_bls;
        const total = page.state.stream_bls_total;

        wait(REFRESH_MS);

        expect(page.state.chart_data_bls).toBe(rows);
        expect(page.state.stream_bls_total).toBe(total);
        expect(page.state.promise_get_data_bls).toBe(true);
        expect(rowStatus('bls')).toBeNull();
    });

    it('says nothing of a slow refresh', () => {
        const { page } = setup();
        reply([1, 2]);

        wait(REFRESH_MS + (30 * 1000));

        expect(page.state.slow_bls).toBeFalsy();
        expect(rowStatus('bls')).toBeNull();
    });

    it('puts the new answer in place of the rows, rather than beside them', () => {
        const { page } = setup();
        reply([1, 2]);

        wait(REFRESH_MS);
        reply([1, 2, 3]);

        expect(page.state.chart_data_bls).toHaveLength(3);
    });

    it('joins a later batch of the same answer to the first', () => {
        const { page } = setup();
        reply([1, 2]);

        wait(REFRESH_MS);
        reply([1, 2, 3]);
        act(() => {
            lastCall('bls')[2]({ stream: 'bls' });
        });
        act(() => {
            mockWorkers[mockWorkers.length - 1].onmessage({ data: answer([4]) });
        });

        expect(page.state.chart_data_bls).toHaveLength(4);
    });

    it('leaves the row as it was when the refresh fails', () => {
        const { page } = setup();
        reply([1, 2]);
        const rows = page.state.chart_data_bls;

        wait(REFRESH_MS);
        act(() => {
            lastCall('bls')[6](new Error('offline'));
        });

        expect(page.state.failed_bls).toBeFalsy();
        expect(page.state.chart_data_bls).toBe(rows);
        expect(rowStatus('bls')).toBeNull();
    });

    it('clears a failure its row was showing once a refresh lands', () => {
        const { page } = setup();
        act(() => {
            lastCall('bls')[6](new Error('offline'));
        });
        expect(page.state.failed_bls).toBe(true);

        wait(REFRESH_MS);
        reply([1]);

        expect(page.state.failed_bls).toBe(false);
        expect(page.state.promise_get_data_bls).toBe(true);
    });

    it('still lets a first load that fails say so', () => {
        const { page } = setup();

        act(() => {
            lastCall('sec')[6](new Error('offline'));
        });

        expect(page.state.failed_sec).toBe(true);
    });
});

describe('a hidden tab', () => {
    it('asks for nothing, and catches up at once when shown after five minutes', () => {
        const { page } = setup();
        settle(page);
        getData.mockClear();

        show(false);
        wait(2 * REFRESH_MS);
        expect(asked()).toEqual([]);

        show(true);
        expect(asked()).toHaveLength(STREAMS.length);
    });

    it('waits out the rest of the five minutes when shown before they are up', () => {
        const { page } = setup();
        settle(page);
        getData.mockClear();

        wait(MINUTE);
        show(false);
        wait(MINUTE);
        show(true);
        expect(asked()).toEqual([]);

        wait(REFRESH_MS - (2 * MINUTE) - 1);
        expect(asked()).toEqual([]);

        wait(1);
        expect(asked()).toHaveLength(STREAMS.length);
    });

    it('asks for nothing when the clock runs out while the tab is hidden', () => {
        //
        // a browser may hide the tab without the page hearing of it before the
        // timer runs, and the timer itself checks
        //
        const { page } = setup();
        settle(page);
        getData.mockClear();

        hidden = true;
        wait(REFRESH_MS);
        expect(asked()).toEqual([]);

        show(true);
        expect(asked()).toHaveLength(STREAMS.length);
    });
});

describe('the button', () => {
    it('shows it on, with the clock icon, and keeps nothing for a reader who never chose', () => {
        setup();

        expect(toggle()).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('UpdateIcon')).toBeInTheDocument();
        expect(window.localStorage.getItem(KEY)).toBeNull();
    });

    it('switches it off, keeps that, and asks for nothing after', () => {
        const { page } = setup();
        settle(page);
        getData.mockClear();

        fireEvent.click(toggle());

        expect(toggle()).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByTestId('UpdateDisabledIcon')).toBeInTheDocument();
        expect(window.localStorage.getItem(KEY)).toBe('off');

        wait(2 * REFRESH_MS);
        expect(asked()).toEqual([]);

        show(false);
        show(true);
        expect(asked()).toEqual([]);
    });

    it('switched on again after five minutes, asks at once', () => {
        const { page } = setup();
        settle(page);
        fireEvent.click(toggle());
        wait(REFRESH_MS);
        getData.mockClear();

        fireEvent.click(toggle());

        expect(asked()).toHaveLength(STREAMS.length);
        expect(window.localStorage.getItem(KEY)).toBeNull();
    });

    it('switched on again before five minutes are up, waits out the rest', () => {
        const { page } = setup();
        settle(page);
        fireEvent.click(toggle());
        wait(MINUTE);
        fireEvent.click(toggle());
        getData.mockClear();

        wait(REFRESH_MS - MINUTE - 1);
        expect(asked()).toEqual([]);

        wait(1);
        expect(asked()).toHaveLength(STREAMS.length);
    });

    it('opens off for a reader who switched it off before', () => {
        window.localStorage.setItem(KEY, 'off');
        const { page } = setup();
        settle(page);
        getData.mockClear();

        expect(toggle()).toHaveAttribute('aria-pressed', 'false');

        wait(2 * REFRESH_MS);
        expect(asked()).toEqual([]);
    });

    it('says in its tooltip when the page last asked, or that it is off', () => {
        setup();
        const at = new Date(Date.now()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        fireEvent.mouseOver(toggle());
        wait(1000);
        expect(screen.getByRole('tooltip')).toHaveTextContent(`Refreshes every 5 minutes, last at ${at}`);

        fireEvent.click(toggle());
        wait(1000);
        expect(screen.getByRole('tooltip')).toHaveTextContent('Auto-refresh is off');
    });
});

describe('the rate', () => {
    it('starts the five minutes over when another is chosen', () => {
        const { page } = setup();
        settle(page);

        wait(4 * MINUTE);
        fireEvent.click(screen.getByRole('button', { name: 'Hour' }));
        settle(page);
        getData.mockClear();

        wait(4 * MINUTE);
        expect(asked()).toEqual([]);

        wait(MINUTE);
        expect(asked()).toHaveLength(STREAMS.length);
        getData.mock.calls.forEach((call) => {
            expect(new URL(String(call[1])).searchParams.get('Interval')).toBe('hour');
        });
    });

    it('starts no clock when the reader has it off', () => {
        window.localStorage.setItem(KEY, 'off');
        const { page } = setup();

        fireEvent.click(screen.getByRole('button', { name: 'Hour' }));
        settle(page);
        getData.mockClear();

        wait(2 * REFRESH_MS);
        expect(asked()).toEqual([]);
    });
});

describe('leaving the page', () => {
    it('takes its clock and its listener with it', () => {
        const { page, unmount } = setup();
        settle(page);
        unmount();
        getData.mockClear();

        wait(2 * REFRESH_MS);
        show(false);
        show(true);

        expect(asked()).toEqual([]);
    });
});
