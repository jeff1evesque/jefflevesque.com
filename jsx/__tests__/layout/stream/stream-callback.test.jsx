/**
 * stream-callback.test.jsx: what the /stream page does with a performance reply, and with
 * its own controls.
 *
 * stream-download.test.jsx covers the request. This covers the answer -- a web worker
 * reduces the response to chart rows, and callbackGetData merges them into the stream's
 * chart -- and the controls that ask again: the rate, the refresh icon, the Ingest Rate
 * switch, a listing row, and the mobile Filter button.
 *
 * Note: web-worker.js is mocked with a builder that records each worker, so a reply can
 *       be delivered on demand. setup.js's Worker shim never posts a message back.
 *
 * Note: get-data.js is mocked, so mounting requests nothing, and toggleChartScale is
 *       stubbed to hand back what it is given. The real one scales rows against the
 *       rolling window, which is measured from now -- what is asserted here is what the
 *       page merged and handed on, not what a date-dependent window kept of it.
 */

import React from 'react';
import { render, act, screen, fireEvent, within } from '@testing-library/react';
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
// hand `item` to the page, and deliver `data` as its worker's reply
//
function reply(page, item, data) {
    act(() => {
        page.callbackGetData(item);
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

describe('a reply that names no source', () => {
    it('adds its rows to the stream on screen', () => {
        const { page } = setup();
        const selected = page.state.selected_stream;
        const before = (page.state[`chart_data_${selected}`] || []).length;

        reply(page, {}, { chart_data_original: rows(selected, [1, 2]), stream_throughput: 7 });

        expect(page.state[`chart_data_${selected}`]).toHaveLength(before + 2);
        expect(page.state.stream_throughput).toBe(7);
    });
});

describe('a reply while the address names a stream', () => {
    afterEach(() => {
        window.history.pushState({}, '', '/');
    });

    it('selects the stream the address names', () => {
        const { page } = setup();
        window.history.pushState({}, '', '/stream?item=bls&rate=day');

        reply(page, {}, answer('bls', 'bls', [1]));

        expect(page.state.selected_stream).toBe('bls');
    });

    it('leaves the selection alone when the address names no stream', () => {
        //
        // a name a stream used to go by never reaches the page -- the route
        // replaces it with the id first -- so anything else names nothing. It
        // used to be selected anyway, and the page threw reading the per-stream
        // state that did not exist for it.
        //
        const { page } = setup();
        const before = page.state.selected_stream;
        window.history.pushState({}, '', '/stream?item=no-such-stream&rate=day');

        reply(page, {}, answer('bls', 'bls', [1]));

        expect(page.state.selected_stream).toBe(before);
    });
});

describe('the controls that ask again', () => {
    const lastUrl = () => new URL(String(getData.mock.calls[getData.mock.calls.length - 1][1]));

    it('asks for the stream at a rate chosen beside the chart', () => {
        const { page } = setup();
        getData.mockClear();

        act(() => {
            fireEvent.click(screen.getAllByText('Hourly')[0]);
        });

        expect(page.state.selected_stream_rate).toBe('Hour');
        expect(lastUrl().searchParams.get('Interval')).toBe('hour');
        expect(lastUrl().searchParams.get('Stream')).toBe(page.state.selected_stream);
    });

    it('asks again from the refresh icon', () => {
        const { page } = setup();
        getData.mockClear();

        act(() => {
            fireEvent.click(document.querySelector('.area-chart-parent .refresh, .area-chart-parent .refresh-disabled'));
        });

        expect(getData).toHaveBeenCalledTimes(1);
        expect(lastUrl().searchParams.get('Stream')).toBe(page.state.selected_stream);
    });

    it('asks for a stream whose chart icon is chosen in the listing', () => {
        const { page } = setup();
        getData.mockClear();
        const row = screen.getByText('Bureau of Labor Statistics').closest('.article-link');

        act(() => {
            fireEvent.click(row.querySelector('.control-icon.chart').closest('.border-circle-radius'));
        });

        expect(page.state.selected_stream).toBe('bls');
        expect(lastUrl().searchParams.get('Stream')).toBe('bls');
    });

    it('hides the chart, and its api icons with it, from the Ingest Rate switch', () => {
        setup();
        const switched = within(document.querySelector('.checkbox-vertical-default')).getByRole('checkbox', { name: 'Ingest Rate' });

        act(() => {
            fireEvent.click(switched);
        });

        expect(document.querySelector('.area-chart-parent')).toBeNull();
        expect(document.querySelector('.api-links')).toBeNull();

        act(() => {
            fireEvent.click(switched);
        });

        expect(document.querySelector('.api-links')).not.toBeNull();
    });
});

describe('the mobile filter', () => {
    it('hides the page while the filter is edited, and restores it when applied', () => {
        const { page } = setup();

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
        });

        expect(page.state.hide_all).toBe(true);
        expect(screen.getByText('Edit Content Filter')).toBeInTheDocument();

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Apply Filter' }));
        });

        expect(page.state.hide_all).toBe(false);
    });

    it('restores the page when the filter is dismissed', () => {
        const { page } = setup();

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
        });
        act(() => {
            fireEvent.click(document.querySelector('.exit'));
        });

        expect(page.state.hide_all).toBe(false);
        expect(page.state.display_filter_button).toBe(true);
    });
});

describe('resizing', () => {
    const width = window.innerWidth;

    afterEach(() => {
        window.innerWidth = width;
    });

    it('sizes the chart from the viewport\'s width', () => {
        //
        // chart-height.js takes the height as a share of the width, clamped, so a wider
        // window draws a taller chart: 1400px wide is 392px tall.
        //
        const { page } = setup();
        window.innerWidth = 1400;

        act(() => {
            window.dispatchEvent(new Event('resize'));
        });

        expect(page.state.chart_height).toBe(392);
    });

    it('leaves the height alone when the width does not move it', () => {
        const { page } = setup();
        const before = page.state.chart_height;
        const render = jest.spyOn(page, 'setState');

        act(() => {
            window.dispatchEvent(new Event('resize'));
        });

        expect(page.state.chart_height).toBe(before);
        expect(render).not.toHaveBeenCalled();
        render.mockRestore();
    });
});
