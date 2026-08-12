/**
 * stream-download.test.jsx: what the /stream page actually asks the api for.
 *
 * downloadData used to be the largest method in the file: a five-way branch on the
 * stream, each assembling its own s3 keys out of a list of day partitions. It is now
 * one request builder, because api-stream-performance resolves the artifacts from the
 * stream name it is given. stream-scale.test.jsx covers how the answer is aggregated;
 * this covers the request.
 *
 * What is worth guarding after that move is mostly what is ABSENT. The page must not
 * send storage details it no longer owns -- no key list, no bucket alias, and none of
 * the per-stream report settings that used to sit beside the path each branch built.
 * Sending a stale one would silently override the api's own.
 *
 * Note: get-data.js is mocked. It is the network boundary, and it has its own suite.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../../../import/general/get-data.js', () => ({
    __esModule: true,
    default: jest.fn(),
}));

import getData from '../../../import/general/get-data.js';
import StreamLayout from '../../../import/layout/stream/stream.jsx';

function setup() {
    const held = React.createRef();

    render(
        <MemoryRouter>
            <StreamLayout ref={held} />
        </MemoryRouter>
    );

    return held.current;
}

//
// the last request made, as { type, url, source, stream }.
//
function lastRequest() {
    const calls = getData.mock.calls;
    const [type, url, , , source, stream] = calls[calls.length - 1];
    return { type, url, source, stream };
}

function paramsOf(url) {
    return new URL(String(url)).searchParams;
}


//
// downloadData calls setState, so every call is wrapped -- see the same note in
// data-download.test.jsx.
//
function download(page, type, rate) {
    act(() => {
        page.downloadData(type, rate);
    });
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('downloadData, per stream', () => {
    it.each([
        ['stockmarket', 'stock-market-ingest'],
        ['stockmarketstocksplit', 'stock-split-ingest'],
        ['bls', 'bls-ingest'],
        ['sec', 'sec-ingest'],
        ['usnationalweather', 'us-national-weather-ingest'],
    ])('%s requests the %s report', (type, expected) => {
        //
        // five branches, each naming its own report type. A wrong name here would query
        // another stream's ingest table and chart it under this stream's label.
        //
        const page = setup();
        getData.mockClear();

        download(page, type, 'hour');

        expect(getData).toHaveBeenCalled();
        expect(getData.mock.calls.some(c => c[0] === expected)).toBe(true);
    });

    it('records the chosen rate against the stream', () => {
        const page = setup();

        download(page, 'bls', 'day');

        expect(page.state.stream_rate_bls).toBe('day');
    });

    it('marks the stream pending so the listing shows a loader', () => {
        const page = setup();

        download(page, 'bls', 'hour');

        expect(page.state.promise_get_data_bls).toBe(false);
    });

    it('lower-cases both arguments', () => {
        const page = setup();

        act(() => {
            page.downloadData('BLS', 'HOUR');
        });

        expect(page.state.stream_rate_bls).toBe('hour');
    });

    it('routes every answer back into callbackGetData', () => {
        const page = setup();
        getData.mockClear();
        const spy = jest.spyOn(page, 'callbackGetData').mockImplementation(() => {});

        download(page, 'bls', 'hour');
        const callback = getData.mock.calls[0][2];
        callback({ data: [], source: 'bls' });

        expect(spy).toHaveBeenCalled();

        spy.mockRestore();
    });

    it('parses in a worker', () => {
        const page = setup();
        getData.mockClear();

        download(page, 'bls', 'hour');

        expect(getData.mock.calls[0][3]).toBe(true);
    });
});

describe('the performance query', () => {
    it('points at the public performance endpoint', () => {
        const page = setup();
        getData.mockClear();

        download(page, 'stockmarket', 'hour');

        expect(String(lastRequest().url)).toContain('api.jefflevesque.com/v1/public/performance');
    });

    it.each([
        ['stockmarket'],
        ['stockmarketstocksplit'],
        ['bls'],
        ['sec'],
        ['usnationalweather'],
    ])('names %s as the stream, and nothing about where it is stored', (type) => {
        //
        // the whole point of the change: a stream id rather than an artifact path. The
        // id is already the '?item=' deep link and the per-stream state key suffix, so
        // it is a name this page legitimately owns.
        //
        const page = setup();
        getData.mockClear();

        download(page, type, 'hour');

        expect(paramsOf(lastRequest().url).get('Stream')).toBe(type);
    });

    it('names the interval it wants the rows bucketed by', () => {
        const page = setup();
        getData.mockClear();

        download(page, 'stockmarket', 'minute');

        expect(paramsOf(lastRequest().url).get('Interval')).toBe('minute');
    });

    it('sends the viewer\'s timezone, because the window is measured on their calendar', () => {
        //
        // a trailing 20 days ending at 22:00 in Tokyo is not the same 20 dates as one
        // ending at 09:00 in New York, so the zone has to travel WITH the request rather
        // than be applied to the answer.
        //
        const page = setup();
        getData.mockClear();

        download(page, 'stockmarket', 'hour');

        expect(paramsOf(lastRequest().url).get('Timezone')).toBeTruthy();
    });

    it('sends no artifact keys at all', () => {
        //
        // 'Data' accepted a caller-supplied s3 key guarded by nothing but a bucket
        // alias. This page no longer names one, which is what lets that parameter be
        // retired.
        //
        const page = setup();
        getData.mockClear();

        download(page, 'stockmarket', 'hour');

        const params = paramsOf(lastRequest().url);
        expect(params.get('Data')).toBeNull();
        expect(String(lastRequest().url)).not.toContain('bucket');
    });

    it.each([
        ['LocalizeTimezone'],
        ['LocalizeTimezoneConvert'],
        ['GroupByDelimiter'],
        ['FillEmptyBuckets'],
    ])('leaves %s to the api, since it describes the storage', (param) => {
        //
        // each of these was hardcoded beside the path its branch built: one feed writes
        // utc and groups per instrument, one runs continuously and wants empty buckets
        // filled, the rest want none of it. A page that no longer knows the layout has
        // no basis for choosing them, and sending a stale value would override the
        // stream's own default.
        //
        const page = setup();
        getData.mockClear();

        download(page, 'stockmarket', 'hour');

        expect(paramsOf(lastRequest().url).get(param)).toBeNull();
    });

    it('sends these three parameters and nothing else', () => {
        //
        // the reason this repo could not be public: the upstream provider appeared
        // in an s3 prefix this page assembled. It is resolved server-side now.
        //
        // asserted as an ALLOW LIST rather than as a search for the provider's
        // name. A test that greps for the string would have to spell it, putting
        // the very thing back into the repo it exists to keep out -- and it would
        // only ever catch the one provider someone remembered to name.
        //
        const page = setup();

        ['stockmarket', 'stockmarketstocksplit', 'bls', 'sec', 'usnationalweather']
            .forEach((type) => {
                getData.mockClear();
                download(page, type, 'hour');

                expect([...paramsOf(lastRequest().url).keys()].sort())
                    .toEqual(['Interval', 'Stream', 'Timezone']);
            });
    });

    it('puts nothing but the stream id in the path or query', () => {
        //
        // the companion to the allow list above: every VALUE is either the stream
        // id the page already owns (it is the '?item=' deep link and the state key
        // suffix), the rate, or the viewer's zone. None of them describes storage.
        //
        const page = setup();
        getData.mockClear();

        download(page, 'stockmarket', 'hour');

        const url = new URL(String(lastRequest().url));

        expect(url.pathname).toBe('/v1/public/performance');
        expect(url.searchParams.get('Stream')).toBe('stockmarket');
        expect(String(url)).not.toContain('/year=');
        expect(String(url)).not.toContain('.csv');
    });

    it('sends one request per stream rather than one per feed', () => {
        //
        // bls fanned out over ten feeds and sec over its sources, spending a tenth of a
        // hundred-per-five-minutes budget on one chart. The fan-out is the api's now.
        //
        const page = setup();
        getData.mockClear();

        download(page, 'bls', 'hour');

        expect(getData).toHaveBeenCalledTimes(1);
    });

    it('asks for the same window shape at every rate', () => {
        //
        // the request no longer grows with the window, which is what removes the monthly
        // limitation: ~365 day partitions could not fit in a query string, so the page
        // quietly clamped the 12 month window to the current month and drew one bar.
        //
        const page = setup();

        ['minute', 'hour', 'day', 'month'].forEach((rate) => {
            getData.mockClear();
            download(page, 'stockmarket', rate);

            expect(paramsOf(lastRequest().url).get('Interval')).toBe(rate);
            expect(String(lastRequest().url).length).toBeLessThan(300);
        });
    });
});
describe('running locally', () => {
    it.each([
        ['stockmarket', 'stock-market-ingest'],
        ['stockmarketstocksplit', 'stock-split-ingest'],
        ['bls', 'bls-ingest'],
        ['sec', 'sec-ingest'],
        ['usnationalweather', 'us-national-weather-ingest'],
    ])('%s answers from the sample rather than the api', (type, report) => {
        //
        // every branch has its own local arm, and each has to send NO url -- a request
        // to the real api fails CORS from localhost. The weather branch used to pick
        // its url inline ('local ? null : url'); it is a normal arm now that the remote
        // side sends several batched requests rather than one.
        //
        const page = setup();
        act(() => {
            page.setState({ local: true });
        });
        getData.mockClear();

        download(page, type, 'month');

        const calls = getData.mock.calls.filter(c => c[0] === report);
        expect(calls.length).toBeGreaterThan(0);
        calls.forEach(c => expect(c[1]).toBeNull());
    });

    it('sends one sample request at the monthly rate', () => {
        //
        // one request per stream at every rate, the monthly one included. this used to
        // be worth stating because the monthly window was split into ~12 batched
        // requests; the window is resolved by the api now, so there is nothing to batch
        // and the local arm replays its embedded csv exactly once.
        //
        const page = setup();
        act(() => {
            page.setState({ local: true });
        });
        getData.mockClear();

        download(page, 'usnationalweather', 'month');

        expect(getData.mock.calls).toHaveLength(1);
    });

    it('sends no url, so the loader serves its built-in sample', () => {
        //
        // a request to the real api fails CORS from localhost, so the local branch passes
        // no url at all and getData answers from its embedded csv.
        //
        const page = setup();
        act(() => {
            page.setState({ local: true });
        });
        getData.mockClear();

        download(page, 'stockmarket', 'hour');

        expect(lastRequest().url).toBeNull();
    });

    it('still asks for the same report type', () => {
        const page = setup();
        act(() => {
            page.setState({ local: true });
        });
        getData.mockClear();

        download(page, 'stockmarket', 'hour');

        expect(lastRequest().type).toBe('stock-market-ingest');
    });
});
