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
import StreamLayout from '../../../import/layout/stream/stream.jsx';
import THROUGHPUT_KEY from '../../../import/general/throughput-key.js';
import { STREAMS } from '../../../import/general/stream-id.js';

const DAY = 24 * 60 * 60 * 1000;

function setup() {
    const held = React.createRef();

    render(
        <MemoryRouter>
            <StreamLayout ref={held} />
        </MemoryRouter>
    );

    const page = held.current;
    const scaled = jest.spyOn(page, 'toggleChartScale').mockImplementation((stream, rate, data) => data);

    return { page, scaled };
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
// hand `item` to the page, as the reply to what `asked` names -- a stream and a
// rate, or nothing -- and deliver `data` as its worker's reply
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

        reply(page, {}, EMPTY, ['bls', 'day']);

        expect(page.state.promise_get_data_bls).toBe(true);
        expect(page.state.chart_data_bls).toEqual([]);
    });
});

describe('a reply to a rate the reader has moved on from', () => {
    it('is dropped before it reaches a worker', () => {
        //
        // a rate change clears every row and asks again. A reply to the old rate
        // arriving after that would otherwise land on the new rate's rows.
        //
        const { page } = setup();
        const before = mockWorkers.length;

        act(() => {
            page.callbackGetData({}, 'bls', 'hour');
        });

        expect(page.state.stream_rate_bls).toBe('day');
        expect(mockWorkers).toHaveLength(before);
    });

    it('is kept when it answers the rate on screen', () => {
        const { page } = setup();

        reply(page, {}, answer('bls', 'bls', [1, 2]), ['bls', 'day']);

        expect(page.state.promise_get_data_bls).toBe(true);
    });
});

describe('the stream an address names', () => {
    it('has its row marked', () => {
        window.history.replaceState({}, '', '/stream?item=bls&rate=day');

        const { page } = setup();

        expect(page.state.current_stream).toBe('bls');
    });

    it('stays marked whatever stream a reply is for', () => {
        window.history.replaceState({}, '', '/stream?item=bls&rate=day');

        const { page } = setup();

        reply(page, {}, answer('sec', 'sec', [1]), ['sec', 'day']);

        expect(page.state.current_stream).toBe('bls');
    });

    it('marks no row when the address names no stream the page lists', () => {
        //
        // a name a stream used to go by never reaches the page -- the route
        // replaces it with the id first -- so anything else names nothing.
        //
        window.history.replaceState({}, '', '/stream?item=no-such-stream&rate=day');

        const { page } = setup();

        expect(page.state.current_stream).toBeNull();
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

        reply(page, {}, answer('bls', 'bls', [1, 2]), ['bls', 'day']);
        expect(page.state.chart_data_bls.length).toBeGreaterThan(0);

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Month' }));
        });

        expect(page.state.chart_data_bls).toEqual([]);
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
