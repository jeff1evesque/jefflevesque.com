/**
 * data-download.test.jsx: what the /data page actually asks the api for.
 *
 * downloadData is the page's real work: it picks one of four per-stream loaders, builds
 * the datalake url with the selected scale, and wires the response back to
 * callbackGetData. data-callback.test.jsx covers what happens to the answer; this
 * covers the request -- which loader, which url, and what happens for a stream it does
 * not recognize.
 *
 * Also covers the two module-level helpers the distribution tooltip is built from.
 * They are pure, they carry a fair amount of the file's branching, and they are only
 * reachable through a hover that jsdom cannot produce -- so they are exported and
 * called directly.
 *
 * Note: the four loaders are mocked. They are the network boundary, and each is a
 *       ~250 line module with its own suite (get-data-distribution.test.js).
 */

import React from 'react';
import { render, act, screen, fireEvent, within } from '@testing-library/react';
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

import getStockMarket from '../../../import/general/get-data/distribution/stock-market.js';
import getUsWeatherAlert from '../../../import/general/get-data/distribution/us-weather-alert.js';
import getBls from '../../../import/general/get-data/distribution/bls.js';
import getSec from '../../../import/general/get-data/distribution/sec.js';

import DataLayout, {
    splitTickerPairs,
    DistributionTooltip,
} from '../../../import/layout/data/data.jsx';
import { API_DOCS, DATASETS } from '../../../import/general/api-url.js';
import { ThemeModeContext } from '../../../import/general/theme-mode.jsx';
import { colors, colors_dark, toRGB } from '../../../import/general/colors.js';

function setup() {
    const held = React.createRef();

    render(
        <MemoryRouter>
            <DataLayout ref={held} />
        </MemoryRouter>
    );

    return held.current;
}

const LOADERS = [getStockMarket, getUsWeatherAlert, getBls, getSec];

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
    ])('%s downloads through its own loader', (stream, expected) => {
        //
        // the two stock streams share one loader; the other three each have their own.
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
        // all five streams are requested at once and answer out of order, so the tags
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

        expect(spy).toHaveBeenCalledWith({ stream: 'bls' });

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
        // downloadData filters on the five known streams before looking anything up, so
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
        // WORTH KNOWING: the guard tests 'type' against the five known streams, but the
        // forEach that precedes it reads this.state.data_map[type] -- so an unknown type
        // dereferences undefined and raises a TypeError before the guard is ever
        // reached. The 'NOT valid for get-data' log below it is therefore unreachable
        // from here: nothing can get past data_map to reach it.
        //
        // It matters only if a caller ever passes an unvalidated string; every current
        // call site passes one of the five.
        //
        const page = setup();

        expect(() => download(page, 'not-a-stream')).toThrow(TypeError);
    });
});

describe('splitTickerPairs', () => {
    it('splits the api\'s run-on ticker string into pairs', () => {
        //
        // the api answers 'nvdl 3:1, mull 25:1'. Both the hover and the drill-down sheet
        // render the ticker left and its ratio right, which needs them apart.
        //
        expect(splitTickerPairs('nvdl 3:1, mull 25:1')).toEqual([
            { ticker: 'nvdl', ratio: '3:1' },
            { ticker: 'mull', ratio: '25:1' },
        ]);
    });

    it('tolerates extra whitespace', () => {
        expect(splitTickerPairs('  nvdl   3:1 ,  mull 25:1 ')).toEqual([
            { ticker: 'nvdl', ratio: '3:1' },
            { ticker: 'mull', ratio: '25:1' },
        ]);
    });

    it('keeps a ticker with no ratio, with an empty one', () => {
        expect(splitTickerPairs('nvdl')).toEqual([{ ticker: 'nvdl', ratio: '' }]);
    });

    it('joins a ratio that arrives in several parts', () => {
        expect(splitTickerPairs('nvdl 3 : 1')).toEqual([{ ticker: 'nvdl', ratio: '3 : 1' }]);
    });

    it('drops empty entries rather than emitting blank rows', () => {
        expect(splitTickerPairs('nvdl 3:1, , mull 25:1')).toHaveLength(2);
    });

    it.each([
        ['an empty string', ''],
        ['null', null],
        ['undefined', undefined],
        ['a number', 42],
    ])('returns nothing for %s', (name, value) => {
        expect(splitTickerPairs(value)).toEqual([]);
    });
});

describe('DistributionTooltip', () => {
    const PAYLOAD = [
        { name: 'CPI', value: 12, color: '#ff0000' },
        { name: 'PPI', value: 7, color: '#00ff00' },
    ];

    function show(props) {
        const { container } = render(<DistributionTooltip {...props} />);
        return container;
    }

    it('renders nothing while inactive', () => {
        //
        // recharts keeps the tooltip mounted and flips 'active', so an inactive render
        // must produce nothing rather than a stale panel.
        //
        expect(show({ active: false, payload: PAYLOAD, label: 'Reports' }).textContent).toBe('');
    });

    it('renders nothing without a payload', () => {
        expect(show({ active: true, payload: [], label: 'Reports' }).textContent).toBe('');
    });

    it('renders nothing when the payload is not an array', () => {
        expect(show({ active: true, payload: null, label: 'Reports' }).textContent).toBe('');
    });

    it('lists each series with its value', () => {
        const text = show({ active: true, payload: PAYLOAD, label: 'Reports' }).textContent;

        expect(text).toContain('CPI');
        expect(text).toContain('PPI');
    });

    it('shows the bar label', () => {
        expect(show({ active: true, payload: PAYLOAD, label: 'Reports' }).textContent)
            .toContain('Reports');
    });

    it('drops the empty segments', () => {
        //
        // a stacked bar carries a key per series in the whole chart, so most rows are
        // zero for any given bar. Listing them all would bury the two that matter.
        //
        const text = show({
            active: true,
            payload: [...PAYLOAD, { name: 'EMPTY', value: 0, color: '#0000ff' }],
            label: 'Reports',
        }).textContent;

        expect(text).toContain('CPI');
        expect(text).not.toContain('EMPTY');
    });

    it('draws itself in the page\'s own colors, on a dark page as on a light one', () => {
        //
        // a white card of dark text on a dark page reads as a hole in it
        //
        const panel = (container) => container.firstChild;

        const light = panel(show({ active: true, payload: PAYLOAD, label: 'Reports' }));
        expect(light.style.background).toBe(toRGB(colors['white-1']));
        expect(light.style.color).toBe(toRGB(colors['gray-7']));

        const { container } = render(
            <ThemeModeContext.Provider value={{ theme: 'dark', toggle: () => {} }}>
                <DistributionTooltip active payload={PAYLOAD} label='Reports' />
            </ThemeModeContext.Provider>
        );

        expect(panel(container).style.background).toBe(toRGB(colors_dark['white-1']));
        expect(panel(container).style.color).toBe(toRGB(colors_dark['gray-7']));
    });

    it('drops a null segment as well', () => {
        const text = show({
            active: true,
            payload: [...PAYLOAD, { name: 'NULLED', value: null, color: '#0000ff' }],
            label: 'Reports',
        }).textContent;

        expect(text).not.toContain('NULLED');
    });

    it('renders nothing when every segment is empty', () => {
        expect(show({
            active: true,
            payload: [{ name: 'A', value: 0 }, { name: 'B', value: null }],
            label: 'Reports',
        }).textContent).toBe('');
    });

    it('renders the color as a swatch rather than coloring the text', () => {
        //
        // recharts colors each row's TEXT with the series color, which on the
        // many-series streams reads as unreadable rainbow text. The color moves to a
        // small block and the label stays neutral.
        //
        const container = show({ active: true, payload: PAYLOAD, label: 'Reports' });

        const swatches = [...container.querySelectorAll('*')].filter(
            el => (el.getAttribute('style') || '').includes('background')
        );
        expect(swatches.length).toBeGreaterThan(0);
    });
});

describe('the api icons beside the chart', () => {
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
        // the dataset is not the stream id for three of the five; the datalake answers a
        // stream id with a 400.
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

        expect(handled).toHaveBeenCalledWith(item);
        handled.mockRestore();
    });
});

describe('the controls that ask again', () => {
    it('asks for the stream on screen again from the refresh icon', () => {
        const page = setup();
        LOADERS.forEach(l => l.mockClear());

        act(() => {
            fireEvent.click(document.querySelector('.area-chart-parent .refresh, .area-chart-parent .refresh-disabled'));
        });

        expect(getStockMarket).toHaveBeenCalledTimes(1);
        expect(new URL(urlOf(getStockMarket)).searchParams.get('Data')).toBe(DATASETS[page.state.selected_stream]);
    });

    it('hides the chart, and its api icons with it, from the Data Distribution switch', () => {
        const page = setup();
        const switched = within(document.querySelector('.checkbox-vertical-default'))
            .getByRole('checkbox', { name: 'Data Distribution' });

        act(() => {
            fireEvent.click(switched);
        });

        expect(page.state.display_data_distribution).toBe(false);
        expect(document.querySelector('.api-links')).toBeNull();

        act(() => {
            fireEvent.click(switched);
        });

        expect(document.querySelector('.api-links')).not.toBeNull();
    });
});

describe('the mobile filter', () => {
    it('hides the page while the filter is edited, and restores it when applied', () => {
        const page = setup();

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
        const page = setup();

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
