/**
 * data-download.test.jsx: what the /data page actually asks the api for.
 *
 * downloadData is the page's real work: it picks one of five per-stream loaders, builds
 * the datalake url with the selected scale, and wires the response back to
 * callbackGetData. data-callback.test.jsx covers what happens to the answer; this
 * covers the request -- which loader, which url, and what happens for a stream it does
 * not recognize.
 *
 * Note: the five loaders are mocked. They are the network boundary, and each is a
 *       module with its own suite (get-data-distribution.test.js).
 */

import React from 'react';
import { render, act, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../../../import/general/get-data/distribution/stock-market.js', () => ({
    __esModule: true, default: jest.fn(),
}));
jest.mock('../../../import/general/get-data/distribution/us-weather-alert.js', () => ({
    __esModule: true, default: jest.fn(),
}));
jest.mock('../../../import/general/get-data/distribution/bls.js', () => ({
    __esModule: true, default: jest.fn(),
}));
jest.mock('../../../import/general/get-data/distribution/sec.js', () => ({
    __esModule: true, default: jest.fn(),
}));
jest.mock('../../../import/general/get-data/distribution/sec-companyfacts.js', () => ({
    __esModule: true, default: jest.fn(),
}));

import getStockMarket from '../../../import/general/get-data/distribution/stock-market.js';
import getUsWeatherAlert from '../../../import/general/get-data/distribution/us-weather-alert.js';
import getBls from '../../../import/general/get-data/distribution/bls.js';
import getSec from '../../../import/general/get-data/distribution/sec.js';
import getSecCompanyFacts from '../../../import/general/get-data/distribution/sec-companyfacts.js';

import DataLayout from '../../../import/layout/data/data.jsx';
import { API_DOCS, DATASETS } from '../../../import/general/api-url.js';

function setup() {
    const held = React.createRef();

    render(
        <MemoryRouter>
            <DataLayout ref={held} />
        </MemoryRouter>
    );

    return held.current;
}

const LOADERS = [getStockMarket, getUsWeatherAlert, getBls, getSec, getSecCompanyFacts];

//
// downloadData calls setState, so every call is wrapped. React reports an update made
// outside act() through console.error, and setup.js turns that into a failure -- these
// warnings were being swallowed until the trap's ignore list was narrowed to the
// message, so the suite passed while emitting eighteen of them.
//
function download(page, type) {
    act(() => {
        page.downloadData(type);
    });
}

function urlOf(loader) {
    return String(loader.mock.calls[0][1]);
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('choosing a loader per stream', () => {
    it.each([
        ['stock-market', () => getStockMarket],
        ['stock-split', () => getStockMarket],
        ['us-national-weather', () => getUsWeatherAlert],
        ['bls', () => getBls],
        ['sec', () => getSec],
        ['sec-companyfacts', () => getSecCompanyFacts],
    ])('%s downloads through its own loader', (stream, expected) => {
        //
        // the two stock streams share one loader; the other four each have their own.
        // Getting this wrong would query the wrong table and quietly chart another
        // stream's rows.
        //
        const page = setup();
        LOADERS.forEach(l => l.mockClear());

        download(page, stream);

        expect(expected()).toHaveBeenCalledTimes(1);
        LOADERS.filter(l => l !== expected()).forEach(l => {
            expect(l).not.toHaveBeenCalled();
        });
    });

    it('asks for the data-distribution report', () => {
        const page = setup();
        getBls.mockClear();

        download(page, 'bls');

        expect(getBls.mock.calls[0][0]).toBe('data-distribution');
    });

    it('runs the parse in a worker', () => {
        //
        // the fourth argument. These reports are large enough that parsing them on the
        // main thread stalls the page, which is the whole reason the workers exist.
        //
        const page = setup();
        getBls.mockClear();

        download(page, 'bls');

        expect(getBls.mock.calls[0][3]).toBe(true);
    });

    it('tags the request with its source and stream', () => {
        //
        // every stream is requested at once, and they answer out of order, so the tags
        // are the only way callbackGetData can tell the responses apart.
        //
        const page = setup();
        getBls.mockClear();

        download(page, 'bls');

        const [, , , , source, stream] = getBls.mock.calls[0];
        expect(source).toBe('bls');
        expect(stream).toBe('bls');
    });

    it('routes the answer back into callbackGetData', () => {
        //
        // the callback is an arrow closing over 'this', so it survives being handed to a
        // module that knows nothing about the component.
        //
        const page = setup();
        getBls.mockClear();
        const spy = jest.spyOn(page, 'callbackGetData').mockImplementation(() => {});

        download(page, 'bls');
        getBls.mock.calls[0][2]({ stream: 'bls' });

        expect(spy).toHaveBeenCalledWith({ stream: 'bls' }, expect.any(Function));

        spy.mockRestore();
    });

    it('hands each answer a check that its request is still the stream\'s latest', () => {
        //
        // a month stepped through quickly asks for each month in turn, and an
        // answer to one stepped off must not land over the month on screen
        //
        const page = setup();
        getBls.mockClear();
        const spy = jest.spyOn(page, 'callbackGetData').mockImplementation(() => {});

        download(page, 'bls');
        download(page, 'bls');
        getBls.mock.calls[0][2]({ stream: 'bls' });
        getBls.mock.calls[1][2]({ stream: 'bls' });

        const [older, newer] = spy.mock.calls.map((call) => call[1]);
        expect(older()).toBe(false);
        expect(newer()).toBe(true);

        spy.mockRestore();
    });

    it('keeps each stream\'s latest request apart from another stream\'s', () => {
        const page = setup();
        getBls.mockClear();
        getSec.mockClear();
        const spy = jest.spyOn(page, 'callbackGetData').mockImplementation(() => {});

        download(page, 'bls');
        download(page, 'sec');
        getBls.mock.calls[0][2]({ stream: 'bls' });

        expect(spy.mock.calls[0][1]()).toBe(true);

        spy.mockRestore();
    });

    it('marks the stream as pending before requesting', () => {
        //
        // the flag the listing reads to show a loader instead of a stale figure.
        //
        const page = setup();

        download(page, 'bls');

        expect(page.state.promise_get_data_bls).toBe(false);
    });

});

describe('the url it builds', () => {
    it('points at the public datalake endpoint', () => {
        const page = setup();
        getBls.mockClear();

        download(page, 'bls');

        expect(urlOf(getBls)).toContain('api.jefflevesque.com/v1/public/datalake');
    });

    it('names the stream being queried', () => {
        const page = setup();
        getBls.mockClear();

        download(page, 'bls');

        expect(urlOf(getBls)).toContain('Data=bls');
    });

    it('carries the selected month and year as the scale', () => {
        //
        // the scale is a json parameter rather than two, because the api reads it as a
        // push-down predicate over the partition columns.
        //
        const page = setup();
        getBls.mockClear();

        download(page, 'bls');

        const scale = JSON.parse(
            new URL(urlOf(getBls)).searchParams.get('Scale')
        );
        expect(scale).toEqual({ year: page.state.yyyy, month: String(page.state.mm).padStart(2, '0') });
    });

    it('zero-pads a single-digit month', () => {
        //
        // the s3 prefix is zero-padded, so '7' would miss the partition entirely.
        //
        const page = setup();
        getBls.mockClear();
        //
        // wrapped in act(): setState is asynchronous, so reading it back in the same tick
        // would still see the mounted value and the assertion would pass or fail on the
        // real current month rather than on 7.
        //
        act(() => {
            page.setState({ mm: 7 });
        });

        download(page, 'bls');

        expect(JSON.parse(new URL(urlOf(getBls)).searchParams.get('Scale')).month).toBe('07');
    });

    it('sends no url at all when running locally', () => {
        //
        // the loaders serve their built-in sample csv when handed no url, which is what
        // makes the page work from localhost -- a request to the real api fails CORS.
        //
        const page = setup();
        getBls.mockClear();
        act(() => {
            page.setState({ local: true });
        });

        download(page, 'bls');

        expect(getBls.mock.calls[0][1]).toBeNull();
    });
});

describe('an unrecognised stream', () => {
    it('requests nothing and says so', () => {
        //
        // downloadData filters on the known streams before looking anything up, so
        // an unknown type reaches no loader.
        //
        const page = setup();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        LOADERS.forEach(l => l.mockClear());

        expect(() => download(page, 'not-a-stream')).toThrow();
        LOADERS.forEach(l => expect(l).not.toHaveBeenCalled());

        quiet.mockRestore();
    });

    it('throws rather than warning, because data_map has no entry', () => {
        //
        // WORTH KNOWING: the guard tests 'type' against the known streams, but the
        // forEach that precedes it reads this.state.data_map[type] -- so an unknown type
        // dereferences undefined and raises a TypeError before the guard is ever
        // reached. The 'NOT valid for get-data' log below it is therefore unreachable
        // from here: nothing can get past data_map to reach it.
        //
        // It matters only if a caller ever passes an unvalidated string; every current
        // call site passes one of the six.
        //
        const page = setup();

        expect(() => download(page, 'not-a-stream')).toThrow(TypeError);
    });
});

describe('the api icons over the chart', () => {
    //
    // asserted against the url the page handed its loader, so the icon cannot open a
    // request the chart was not drawn from.
    //
    it('links the datalake api\'s documentation', () => {
        setup();

        expect(screen.getByRole('link', { name: 'API docs' })).toHaveAttribute('href', API_DOCS.datalake);
    });

    it('links the request made for the dataset and month on screen', () => {
        const page = setup();
        LOADERS.forEach(l => l.mockClear());

        download(page, page.state.selected_stream);

        expect(screen.getByRole('link', { name: 'This request' }))
            .toHaveAttribute('href', urlOf(getStockMarket));
    });

    it('follows the month when another is chosen', () => {
        const page = setup();
        LOADERS.forEach(l => l.mockClear());
        act(() => {
            page.setState({ mm: 3 });
        });

        download(page, page.state.selected_stream);

        const link = screen.getByRole('link', { name: 'This request' });
        expect(link).toHaveAttribute('href', urlOf(getStockMarket));
        expect(JSON.parse(new URL(link.getAttribute('href')).searchParams.get('Scale')).month).toBe('03');
    });
});

describe('the dataset it names', () => {
    it.each(Object.entries(DATASETS))('asks for %s as the dataset %s', (stream, dataset) => {
        //
        // the dataset is not always the stream id -- it is not for the weather stream --
        // and the datalake answers a stream id with a 400.
        //
        const page = setup();
        LOADERS.forEach(l => l.mockClear());

        download(page, stream);

        const call = LOADERS.map(l => l.mock.calls[0]).find(Boolean);
        expect(new URL(String(call[1])).searchParams.get('Data')).toBe(dataset);
    });
});

describe('every loader\'s answer', () => {
    //
    // each dataset has its own loader, and each is handed its own callback. An answer
    // that reached no callback would leave that stream's chart empty with nothing logged.
    //
    it.each([
        ['stock-market', () => getStockMarket],
        ['stock-split', () => getStockMarket],
        ['us-national-weather', () => getUsWeatherAlert],
        ['bls', () => getBls],
        ['sec', () => getSec],
        ['sec-companyfacts', () => getSecCompanyFacts],
    ])('%s is handed back to callbackGetData', (stream, loaderOf) => {
        const page = setup();
        const loader = loaderOf();
        LOADERS.forEach(l => l.mockClear());
        const handled = jest.spyOn(page, 'callbackGetData').mockImplementation(() => {});

        download(page, stream);
        const item = { stream: stream };
        act(() => {
            loader.mock.calls[0][2](item);
        });

        expect(handled).toHaveBeenCalledWith(item, expect.any(Function));
        handled.mockRestore();
    });
});

describe('the chart a wide screen draws', () => {
    //
    // the stacked bars of cubes, with the api icons over them; a phone lays
    // them on their side instead (#188) -- see data-mobile.test.jsx
    //
    it('draws the bars of cubes standing up, rather than a phone\'s rows', () => {
        setup();

        expect(document.querySelector('.cube-chart')).not.toBeNull();
        expect(document.querySelector('.cube-chart .cube-chart-actions .api-links')).not.toBeNull();
        expect(document.querySelector('.cube-rows')).toBeNull();
    });
});

describe('a wide screen\'s page, without its switch, its Filter or its calendar (#192)', () => {
    it('always draws the chart, with no Data Distribution switch to hide it', () => {
        setup();

        expect(document.querySelector('.cube-chart')).not.toBeNull();
        expect(screen.queryByRole('checkbox', { name: 'Data Distribution' })).toBeNull();
    });

    it('gives the listing the page\'s full width, with no column beside it', () => {
        setup();

        expect(document.querySelector('.checkbox-vertical-default')).toBeNull();
        expect(document.querySelector('.listing-general').children).toHaveLength(1);
    });

    it('has no Filter page to open, and no calendar, only the month control in the listing\'s title row', () => {
        setup();

        expect(screen.queryByRole('button', { name: 'Filter' })).toBeNull();
        expect(screen.queryByRole('button', { name: /Choose date/ })).toBeNull();
        expect(document.querySelectorAll('.data-month')).toHaveLength(1);
        expect(document.querySelector('.listing-table-actions .data-month')).not.toBeNull();
    });
});
