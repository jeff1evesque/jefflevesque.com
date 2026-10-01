/**
 * stream-callback.test.jsx: what the /stream page does with a performance reply, and with
 * its own controls.
 *
 * stream-download.test.jsx covers the request. This covers the answer -- a web worker
 * reduces the response to rows, and callbackGetData merges them into the stream's own
 * -- and the control that asks again: the Rate buttons over the rows.
 *
 * Note: web-worker.js is mocked with a builder that records each worker, so a reply can
 *       be delivered on demand. setup.js's Worker shim never posts a message back.
 *
 * Note: get-data.js is mocked, so mounting requests nothing, and toggleChartScale is
 *       stubbed to hand back what it is given. The real one scales rows against the
 *       rolling window, which is measured from now -- what is asserted here is what the
 *       page merged and handed on, not what a date-dependent window kept of it.
 */

//
// signed out: the page asks the account api for the reader's subscriptions on
// mount, for the bells, and the api's session reader imports Amplify, which jest
// cannot load unmocked. The bells themselves are held in stream.test.jsx.
//
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
        constructor(fn) {
            this.fn = fn;
            this.posted = [];
            mockWorkers.push(this);
        }
        postMessage(message) {
            this.posted.push(message);
        }
        terminate() {}
    },
}));

import getData from '../../../import/general/get-data.js';
import StreamLayout, { SLOW_AFTER_MS } from '../../../import/layout/stream/stream.jsx';
import THROUGHPUT_KEY from '../../../import/general/throughput-key.js';
import { STREAMS } from '../../../import/general/stream-id.js';

const DAY = 24 * 60 * 60 * 1000;

function setup() {
    const held = React.createRef();

    const { unmount } = render(
        <MemoryRouter>
            <StreamLayout ref={held} />
        </MemoryRouter>
    );

    const page = held.current;
    const scaled = jest.spyOn(page, 'toggleChartScale').mockImplementation((stream, rate, data) => data);

    return { page, scaled, unmount };
}

//
// what `stream`'s row says over its bars, or null when it says nothing
//
function rowStatus(stream) {
    const line = document.querySelector(`.stream-row[data-stream="${stream}"] .stream-row-status`);

    return line ? line.textContent : null;
}

//
// fail the request the page last made for `stream`, as get-data.js reports it
//
function failRequest(stream) {
    const calls = getData.mock.calls.filter((call) => call[5] === stream);
    const failed = calls[calls.length - 1][6];

    act(() => {
        failed(new Error('offline'));
    });

    return failed;
}

//
// `days` rows for `source`, dated that many days back from now, so they sit inside any
// trailing window whatever day the suite runs on.
//
function rows(source, days) {
    return days.map(back => ({
        window_start: new Date(Date.now() - back * DAY),
        [source]: 10 * back,
        [`${source}${THROUGHPUT_KEY}`]: 12 * back,
    }));
}

function answer(stream, source, days) {
    const data = rows(source, days);

    return {
        chart_data_original: data,
        stream_throughput: 100,
        [`chart_data_${source}`]: data,
        [`stream_throughput_${source}`]: 100,
        selected_source: source,
        selected_stream: stream,
    };
}

//
// hand `item` to the page, as the reply to what `asked` names -- a stream and the
// request it answers, or nothing -- and deliver `data` as its worker's reply
//
function reply(page, item, data, asked = []) {
    act(() => {
        page.callbackGetData(item, ...asked);
    });

    const worker = mockWorkers[mockWorkers.length - 1];

    act(() => {
        worker.onmessage({ data: data });
    });

    return worker;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockWorkers.length = 0;

    window.history.replaceState({}, '', '/');
});

describe('handing a response to the worker', () => {
    it('posts the response, and the validators as source text, which a worker cannot be sent as functions', () => {
        const { page } = setup();
        const item = { data: [], source: 'bls', stream: 'bls' };

        act(() => {
            page.callbackGetData(item);
        });

        const [posted] = mockWorkers[0].posted;
        expect(posted.item).toBe(item);
        // boxed by the Object.assign it is copied with, which a property lookup reads
        // through unchanged
        expect(String(posted.field_datetime)).toBe('window_start');
        expect(posted.throughput_key).toBe(THROUGHPUT_KEY);
        ['stringifiedTrim', 'stringifiedCheckValidInt', 'stringifiedCheckValidObject',
            'stringifiedCheckValidArray', 'stringifiedCheckValidString'].forEach(key => {
            expect(typeof posted[key]).toBe('string');
        });
    });

    it('logs a worker that fails, rather than throwing', () => {
        const { page } = setup();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        act(() => {
            page.callbackGetData({});
        });
        mockWorkers[0].onerror(new Error('worker failed'));

        expect(quiet.mock.calls.flat().join(' ')).toContain('could not process ingest performance data');
        quiet.mockRestore();
    });
});

describe('a reply for a stream', () => {
    it('hands the stream\'s rows on to be scaled, oldest first', () => {
        const { page, scaled } = setup();

        reply(page, {}, answer('bls', 'bls', [1, 3, 2]));

        const [stream, , data] = scaled.mock.calls[scaled.mock.calls.length - 1];
        const times = data.map(row => row.window_start.valueOf());
        expect(stream).toBe('bls');
        expect(times).toEqual([...times].sort((a, b) => a - b));
        expect(data).toHaveLength(3);
    });

    it('keeps the source\'s own rows and throughput alongside the merged chart', () => {
        const { page } = setup();
        const data = answer('bls', 'bls', [1, 2]);

        reply(page, {}, data);

        expect(page.state.chart_data_bls_bls).toBe(data.chart_data_bls);
        expect(page.state.stream_throughput_bls_bls).toBe(100);
        expect(page.state.stream_throughput).toBe(100);
    });

    it('marks the stream loaded, so its loader stops', () => {
        const { page } = setup();

        reply(page, {}, answer('bls', 'bls', [1]));

        expect(page.state.promise_get_data_bls).toBe(true);
    });

    it('recomputes the listing from what the chart kept', () => {
        const { page } = setup();
        const metrics = jest.spyOn(page, 'updateMetrics');

        reply(page, {}, answer('bls', 'bls', [1, 2]));

        expect(metrics).toHaveBeenCalledWith(expect.any(Array), 'bls');
        metrics.mockRestore();
    });

    it('keeps every batch when several replies for one stream land in the same tick', () => {
        //
        // the monthly rate asks in batches of day partitions, so replies for one stream
        // can be handled together. Each used to read the same state and write back only
        // its own batch, which dropped every batch but the last.
        //
        const { page } = setup();
        act(() => {
            page.callbackGetData({});
            page.callbackGetData({});
        });
        const [first, second] = mockWorkers;

        act(() => {
            first.onmessage({ data: answer('bls', 'bls', [1, 2]) });
            second.onmessage({ data: answer('bls', 'bls', [5, 6, 7]) });
        });

        expect(page.state.chart_data_bls).toHaveLength(5);
    });
});

describe('a report with nothing in it', () => {
    const EMPTY = { chart_data_original: [], stream_throughput: 0, selected_source: null, selected_stream: null };

    it('still stops the row it was asked for loading', () => {
        //
        // the worker cannot name a stream for a report that carried none, so the
        // stream the request was made for travels with the reply. It used to fall
        // back on the charted stream, and the stream actually asked for loaded forever.
        //
        const { page } = setup();

        reply(page, {}, EMPTY, ['bls', page.asked.bls]);

        expect(page.state.promise_get_data_bls).toBe(true);
        expect(page.state.chart_data_bls).toEqual([]);
    });
});

describe('a reply to a request since replaced', () => {
    //
    // a rate change, or a retry, clears the row and asks again. A reply to the
    // request it replaced, arriving after that, would otherwise land on the rows
    // of the new one.
    //
    it('is dropped before it reaches a worker', () => {
        const { page } = setup();
        const replaced = page.asked.bls;

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Hour' }));
        });
        const before = mockWorkers.length;

        act(() => {
            page.callbackGetData({}, 'bls', replaced);
        });

        expect(mockWorkers).toHaveLength(before);
    });

    it('is dropped even at the same rate, after the rate was changed and changed back', () => {
        //
        // the rate alone cannot tell the first Day request from the second
        //
        const { page } = setup();
        const first = page.asked.bls;

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Hour' }));
        });
        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Day' }));
        });
        const before = mockWorkers.length;

        act(() => {
            page.callbackGetData({}, 'bls', first);
        });

        expect(page.state.stream_rate_bls).toBe('day');
        expect(mockWorkers).toHaveLength(before);
    });

    it('is dropped when the request is replaced while its worker runs', () => {
        const { page } = setup();

        act(() => {
            page.callbackGetData({}, 'bls', page.asked.bls);
        });
        const worker = mockWorkers[mockWorkers.length - 1];

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Hour' }));
        });
        act(() => {
            worker.onmessage({ data: answer('bls', 'bls', [1, 2]) });
        });

        expect(page.state.chart_data_bls).toEqual([]);
        expect(page.state.promise_get_data_bls).toBe(false);
    });

    it('is kept when it answers the request the row is waiting on', () => {
        const { page } = setup();

        reply(page, {}, answer('bls', 'bls', [1, 2]), ['bls', page.asked.bls]);

        expect(page.state.promise_get_data_bls).toBe(true);
    });

    it('is dropped once the page has gone', () => {
        const { page, unmount } = setup();
        const asked = page.asked.bls;

        unmount();
        const before = mockWorkers.length;

        page.callbackGetData({}, 'bls', asked);

        expect(mockWorkers).toHaveLength(before);
    });
});

describe('a stream slow to answer', () => {
    //
    // the S&P 500's report can take a while when the api has not cached it. A
    // slow stream is not a failed one: its row says it is still loading, and
    // keeps waiting.
    //
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('says it is still loading once it has taken ten seconds, and keeps waiting', () => {
        const { page } = setup();

        act(() => {
            jest.advanceTimersByTime(SLOW_AFTER_MS - 1);
        });

        expect(rowStatus('stock-market')).toBe('Loading');

        act(() => {
            jest.advanceTimersByTime(1);
        });

        expect(rowStatus('stock-market')).toBe('Still loading. This stream can take a while.');
        expect(page.state['failed_stock-market']).toBe(false);
    });

    it('says nothing once its report lands, however late', () => {
        const { page } = setup();

        act(() => {
            jest.advanceTimersByTime(SLOW_AFTER_MS);
        });
        reply(page, {}, answer('stock-market', 'options', [1]), ['stock-market', page.asked['stock-market']]);

        expect(rowStatus('stock-market')).toBeNull();
        expect(page.state['slow_stock-market']).toBe(false);
    });

    it('is never called slow when its report lands in time', () => {
        const { page } = setup();

        reply(page, {}, answer('bls', 'bls', [1]), ['bls', page.asked.bls]);
        act(() => {
            jest.advanceTimersByTime(SLOW_AFTER_MS);
        });

        expect(page.state.slow_bls).toBe(false);
        expect(rowStatus('bls')).toBeNull();
    });

    it('counts again from a new request', () => {
        setup();

        act(() => {
            jest.advanceTimersByTime(SLOW_AFTER_MS - 1000);
        });
        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Hour' }));
        });
        act(() => {
            jest.advanceTimersByTime(SLOW_AFTER_MS - 1000);
        });

        expect(rowStatus('bls')).toBe('Loading');

        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(rowStatus('bls')).toBe('Still loading. This stream can take a while.');
    });
});

describe('a stream whose request fails', () => {
    it('says it could not load, and stops its spinner', () => {
        const { page } = setup();

        failRequest('bls');

        expect(page.state.failed_bls).toBe(true);
        expect(rowStatus('bls')).toBe('Could not load this stream.Retry');
        expect(document.querySelector('.stream-row[data-stream="bls"] .stream-row-spinner')).toBeNull();
    });

    it('leaves every other row loading', () => {
        setup();

        failRequest('bls');

        expect(rowStatus('sec')).toBe('Loading');
        expect(rowStatus('stock-market')).toBe('Loading');
    });

    it('asks again from its Retry button, and loads as before', () => {
        const { page } = setup();

        failRequest('bls');
        getData.mockClear();

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Retry Bureau of Labor Statistics' }));
        });

        expect(getData).toHaveBeenCalledTimes(1);
        expect(getData.mock.calls[0][5]).toBe('bls');
        expect(new URL(String(getData.mock.calls[0][1])).searchParams.get('Interval')).toBe('day');
        expect(page.state.failed_bls).toBe(false);
        expect(rowStatus('bls')).toBe('Loading');
    });

    it('is not said for a request since replaced', () => {
        const { page } = setup();
        const calls = getData.mock.calls.filter((call) => call[5] === 'bls');
        const replaced = calls[calls.length - 1][6];

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Hour' }));
        });
        act(() => {
            replaced(new Error('offline'));
        });

        expect(page.state.failed_bls).toBe(false);
        expect(rowStatus('bls')).toBe('Loading');
    });

    it('stops the row being called slow', () => {
        jest.useFakeTimers();

        try {
            const { page } = setup();

            failRequest('bls');
            act(() => {
                jest.advanceTimersByTime(SLOW_AFTER_MS);
            });

            expect(page.state.slow_bls).toBe(false);
            expect(rowStatus('bls')).toBe('Could not load this stream.Retry');
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('the stream an address names', () => {
    it('is shown on its own (#161)', () => {
        window.history.replaceState({}, '', '/stream?item=bls&rate=day');

        const { page } = setup();

        expect(page.state.focus).toBe('bls');
    });

    it('stays on its own whatever stream a reply is for', () => {
        window.history.replaceState({}, '', '/stream?item=bls&rate=day');

        const { page } = setup();

        reply(page, {}, answer('sec', 'sec', [1]), ['sec', page.asked.sec]);

        expect(page.state.focus).toBe('bls');
    });

    it('leaves every stream showing when the address names no stream the page lists', () => {
        //
        // a name a stream used to go by never reaches the page -- the route
        // replaces it with the id first -- so anything else names nothing.
        //
        window.history.replaceState({}, '', '/stream?item=no-such-stream&rate=day');

        const { page } = setup();

        expect(page.state.focus).toBeNull();
    });
});

describe('the Rate buttons', () => {
    it('ask for every stream again at the rate chosen', () => {
        const { page } = setup();
        getData.mockClear();

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Hour' }));
        });

        const asked = getData.mock.calls.map((call) => new URL(String(call[1])));

        expect(page.state.rate).toBe('Hour');
        expect(asked.map((url) => url.searchParams.get('Stream'))).toEqual(STREAMS);
        expect(asked.every((url) => url.searchParams.get('Interval') === 'hour')).toBe(true);
        STREAMS.forEach((stream) => {
            expect(page.state[`stream_rate_${stream}`]).toBe('hour');
            expect(page.state[`promise_get_data_${stream}`]).toBe(false);
        });
    });

    it('clear every row before its new report arrives', () => {
        const { page } = setup();

        reply(page, {}, answer('bls', 'bls', [1, 2]), ['bls', page.asked.bls]);
        expect(page.state.chart_data_bls.length).toBeGreaterThan(0);

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Month' }));
        });

        expect(page.state.chart_data_bls).toEqual([]);
    });

    it('put every row\'s figures back to n/a until its new report is in', () => {
        const { page } = setup();

        act(() => {
            page.setState({ stream_bls_health: '99.50', stream_bls_coverage: '80.00', stream_bls_total: 1234 });
        });
        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Hour' }));
        });

        const cells = [...document.querySelectorAll('.stream-row[data-stream="bls"] .stream-row-figure')]
            .map((cell) => cell.textContent);

        expect(cells).toEqual(['n/a', 'n/a', 'n/a']);
    });

    it('ask nothing again for the rate already on screen', () => {
        setup();
        getData.mockClear();

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Day' }));
        });

        expect(getData).not.toHaveBeenCalled();
    });
});
