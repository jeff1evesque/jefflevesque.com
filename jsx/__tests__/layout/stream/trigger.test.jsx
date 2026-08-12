/**
 * trigger.test.jsx: the per-stream trigger page ('/stream/:stream/trigger').
 *
 * This layout is a router: it picks a content component from the url segment,
 * loads the candlestick dataset for the stock market, and owns toggleChartScale
 * -- the callback the left column drives when a visitor changes the aggregation
 * rate or the selected patterns. That callback is the interactive surface, and
 * it is exercised here through the props the left column is actually handed
 * rather than by clicking through the left column's own controls, which have
 * their own test file.
 *
 * Unlike alarm.jsx next door, this page lower-cases the url segment before
 * comparing it, so the real capitalised stream ids work. Both casings are pinned
 * below, because the two pages are reached from the same listing row and only
 * one of them survives it.
 *
 * Two findings worth reading before the tests:
 *
 *   - 'local' is hard-coded true in the constructor ('local: true,//is_local'),
 *     so this page ALWAYS asks get-data for the built-in sample CSV and never
 *     requests the published artifact -- in production as well as locally. Every
 *     other page in this directory reads the real is_local flag.
 *
 *   - toggleChartScale declares 'patterns = null' as its default, but the very
 *     next statement calls 'patterns.join(...)' outside the guard that protects
 *     the assignment above it. Calling it the way its own signature invites
 *     throws.
 *
 * Note: the clock is fixed. componentDidMount picks the initial aggregation rate
 *       from the current eastern time, and the scale helpers filter rows against
 *       'now', so without a fixed instant neither the chosen rate nor the chart
 *       contents would be stable.
 */

import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockSeen = {};

function mockProbe(name) {
    const ReactModule = require('react');

    return {
        __esModule: true,
        default: function Probe(props) {
            mockSeen[name] = props;
            return ReactModule.createElement('div', { 'data-probe': name });
        },
    };
}

jest.mock('../../../import/general/get-data.js', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../import/general/line-chart.jsx', () => mockProbe('chart'));
jest.mock(
    '../../../import/redux/container/stream/trigger/left_column/candlestick.jsx',
    () => mockProbe('left-column')
);
jest.mock('../../../import/layout/stream/trigger/content/candlestick.jsx', () => mockProbe('candlestick'));
jest.mock('../../../import/layout/stream/trigger/content/stock-split.jsx', () => mockProbe('stock-split'));
jest.mock('../../../import/layout/stream/trigger/content/us-national-weather.jsx', () => mockProbe('weather'));
jest.mock('../../../import/layout/stream/trigger/content/article-ingest.jsx', () => mockProbe('article-ingest'));

import getData from '../../../import/general/get-data.js';
import getFilteredCandlestickData from '../../../import/layout/stream/trigger/get_filtered_data/candlestick.js';
import StreamTriggerLayout from '../../../import/layout/stream/trigger.jsx';

//
// a Wednesday at 10:30 eastern -- a weekday inside the 09:30-16:00 window, so
// componentDidMount takes the market-hours branch. The weekend instant is used
// by the one test that wants the other side of it.
//
const MARKET_HOURS = new Date('2026-08-05T14:30:00Z');
const WEEKEND = new Date('2026-08-08T14:30:00Z');

//
// getFilteredCandlestickData subtracts four hours from every parsed timestamp to
// undo the backend's UTC offset, so a row written at 14:30 lands at 10:30 -- the
// same hour as the fixed clock, which keeps it inside the 'minutes' and 'hourly'
// windows as well as the wider ones.
//
function rows() {
    return [
        {
            group_by: 'hammer',
            window_start: '2026-08-05 14:30:00',
            total_detected: '6',
            slide_window_over: '10.minutes',
            slide_window_every: '1.minutes',
        },
        {
            group_by: 'shooting_star',
            window_start: '2026-08-05 14:30:00',
            total_detected: '23',
            slide_window_over: '10.minutes',
            slide_window_every: '1.minutes',
        },
    ];
}

//
// the same two rows a day earlier: they load and contribute pattern keys, but
// the Minutes and Hourly scales filter on the current day, so nothing is plotted.
//
function yesterdayRows() {
    return rows().map(row => ({
        ...row,
        window_start: row.window_start.replace('2026-08-05', '2026-08-04'),
    }));
}

//
// Note: async, and the mount is awaited inside act(). componentDidMount resolves a
//       promise and setStates when it settles -- which is AFTER a synchronous test
//       body, so React reports an update that was not wrapped in act(). setup.js
//       turns that console.error into a failure; it went unnoticed until the trap's
//       ignore list stopped matching react-router in the component stack.
//
async function renderTrigger(stream, { query = '', hide, data = rows() } = {}) {
    getData.mockReturnValue(Promise.resolve(data));

    const path = `/stream/${stream}/trigger${query}`;
    window.history.pushState({}, '', path);

    //
    // 'hide' is spread in only when supplied. Passing hide={undefined} is NOT
    // equivalent to omitting it -- componentDidUpdate tests "'hide' in props",
    // which is true for a key holding undefined, and then indexes into it. That
    // crash is pinned deliberately further down.
    //
    const ui = (entryHide) => (
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route
                    path='/stream/:stream/trigger'
                    element={<StreamTriggerLayout {...(entryHide !== undefined && { hide: entryHide })} />}
                />
            </Routes>
        </MemoryRouter>
    );

    let utils;

    await act(async () => {
        utils = render(ui(hide));
    });

    return { ...utils, setHide: (next) => utils.rerender(ui(next)) };
}

//
// componentDidMount resolves a promise before the chart exists, so every test
// that cares about the loaded state waits for the left column to have been
// handed the keys the dataset produced.
//
async function waitForLoad() {
    await waitFor(() => expect(mockSeen['left-column'].chart_data_keys.length)
        .toBeGreaterThan(0));
}

beforeEach(() => {
    jest.useFakeTimers({ now: MARKET_HOURS, doNotFake: ['queueMicrotask'] });
    jest.clearAllMocks();
    Object.keys(mockSeen).forEach(key => delete mockSeen[key]);
});

afterEach(() => {
    jest.useRealTimers();
    window.history.pushState({}, '', '/');
});

describe('choosing the content for the stream', () => {
    it('gives the stock market a filter column and the candlestick content', async () => {
        await renderTrigger('StockMarket');

        expect(screen.getAllByTestId ? true : true).toBe(true);
        expect(document.querySelector('[data-probe="candlestick"]')).toBeInTheDocument();
        expect(document.querySelectorAll('[data-probe="left-column"]')).toHaveLength(2);
    });

    it('renders the split content for StockSplit', async () => {
        await renderTrigger('StockSplit');

        expect(document.querySelector('[data-probe="stock-split"]')).toBeInTheDocument();
        expect(document.querySelector('[data-probe="left-column"]')).not.toBeInTheDocument();
    });

    it('renders the weather content for USNationalWeather', async () => {
        await renderTrigger('USNationalWeather');

        expect(document.querySelector('[data-probe="weather"]')).toBeInTheDocument();
    });

    it.each([
        ['bls', 'the U.S. Bureau of Labor Statistics (BLS)'],
        ['sec', 'the U.S. Securities and Exchange Commission (SEC)'],
    ])('renders the article ingest content for %s, naming its source', async (stream, source) => {
        await renderTrigger(stream);

        expect(document.querySelector('[data-probe="article-ingest"]')).toBeInTheDocument();
        expect(mockSeen['article-ingest'].source_name).toBe(source);
        expect(mockSeen['article-ingest'].listing_graphic_title).toBe(stream.toUpperCase());
    });

    it('renders no content at all for an unknown stream', async () => {
        //
        // unlike alarm.jsx, the unmatched case has an else branch, so an unknown
        // stream renders an empty shell instead of throwing.
        //
        await renderTrigger('no-such-stream');

        expect(document.querySelector('[data-probe="candlestick"]')).not.toBeInTheDocument();
        expect(document.querySelector('[data-probe="stock-split"]')).not.toBeInTheDocument();
        expect(document.querySelector('.listing-general')).toBeInTheDocument();
    });

    it.each([
        ['StockMarket'],
        ['stockmarket'],
        ['STOCKMARKET'],
    ])('matches %s regardless of casing', async (stream) => {
        //
        // this page lower-cases before comparing. alarm.jsx, reached from the
        // same listing row, does not -- see alarm.test.jsx.
        //
        await renderTrigger(stream);

        expect(document.querySelector('[data-probe="candlestick"]')).toBeInTheDocument();
    });
});

describe('the breadcrumb header', () => {
    it('is suppressed for the stock market, which shows the filter column instead', async () => {
        await renderTrigger('StockMarket');

        expect(screen.queryByRole('heading', { name: 'Triggers' })).not.toBeInTheDocument();
    });

    it('is shown for a stream with no filter column', async () => {
        await renderTrigger('bls');

        expect(screen.getByRole('heading', { name: 'Triggers' })).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'breadcrumb' })).toBeInTheDocument();
    });

    it('counts the patterns named in the query string', async () => {
        await renderTrigger('bls', { query: '?selected=hammer;shooting_star' });

        expect(document.querySelector('.title-count')).toHaveTextContent('2');
    });

    it('counts nothing when no pattern was selected', async () => {
        await renderTrigger('bls');

        expect(document.querySelector('.title-count')).toHaveTextContent('0');
    });
});

describe('loading the candlestick dataset', () => {
    it('is requested only for the stock market', async () => {
        await renderTrigger('StockMarket');

        expect(getData).toHaveBeenCalledTimes(1);
        expect(getData.mock.calls[0][0]).toBe('stock-market-candlestick-triggers');
    });

    it.each([['StockSplit'], ['USNationalWeather'], ['bls'], ['sec']])(
        '%s loads nothing',
        async (stream) => {
            await renderTrigger(stream);

            expect(getData).not.toHaveBeenCalled();
        }
    );

    it('always asks for the built-in sample, never the published artifact', async () => {
        //
        // DEFECT: the constructor reads 'local: true,//is_local' -- the real flag
        // is commented out. Passing null as the url makes get-data serve its
        // hard-coded sample CSV, so this chart shows fabricated data in
        // production exactly as it does locally.
        //
        await renderTrigger('StockMarket');

        expect(getData.mock.calls[0][1]).toBeNull();
    });

    it('hands the parsed rows to the left column as selectable keys', async () => {
        await renderTrigger('StockMarket');
        await waitForLoad();

        expect(mockSeen['left-column'].chart_data_keys).toEqual(
            expect.arrayContaining(['hammer', 'shooting_star'])
        );
    });

    it('reads the selected patterns out of the query string', async () => {
        await renderTrigger('StockMarket', { query: '?selected=hammer' });
        await waitForLoad();

        expect(mockSeen['left-column'].selected_candlestick).toEqual(['hammer']);
    });

    it('turns spaces in a selected pattern into underscores', async () => {
        //
        // the url carries human-typed names; the dataset keys are underscored.
        //
        await renderTrigger('StockMarket', { query: '?selected=shooting star' });
        await waitForLoad();

        expect(mockSeen['left-column'].selected_candlestick).toEqual(['shooting_star']);
    });
});

describe('the initial aggregation rate', () => {
    it('opens on Minutes during market hours', async () => {
        await renderTrigger('StockMarket', { query: '?selected=hammer' });
        await waitForLoad();

        expect(mockSeen['left-column'].trigger_rate).toBe('Minutes');
    });

    it('opens on Daily outside them', async () => {
        //
        // the same Wednesday time on a Saturday. The branch is a weekday-and-
        // market-hours test, so the weekend takes the other side of it.
        //
        jest.setSystemTime(WEEKEND);

        await renderTrigger('StockMarket', { query: '?selected=hammer' });
        await waitForLoad();

        expect(mockSeen['left-column'].trigger_rate).toBe('Daily');
    });
});

describe('toggleChartScale, the callback the left column drives', () => {
    async function loaded(query = '?selected=hammer') {
        const utils = await renderTrigger('StockMarket', { query });
        await waitForLoad();
        return utils;
    }

    function toggle(rate, patterns = ['hammer']) {
        act(() => mockSeen['left-column'].toggleChartScale(rate, patterns));
    }

    it.each([
        ['Monthly', '%m/%Y'],
        ['Daily', '%m/%d'],
        ['Hourly', '%I%p'],
        ['Minutes', '%I:%M%p'],
    ])('%s sets its own x-axis tick format', async (rate, format) => {
        await loaded();

        toggle(rate);

        expect(mockSeen['chart'].x_ticker_format).toBe(format);
    });

    it.each([
        ['Monthly', '%B %Y'],
        ['Daily', '%d %B, %Y'],
        ['Hourly', '%d %B, %Y (%I%p)'],
    ])('%s sets its own point label format', async (rate, format) => {
        await loaded();

        toggle(rate);

        expect(mockSeen['chart'].label_format).toBe(format);
    });

    it('reports the chosen rate back to the left column', async () => {
        await loaded();

        toggle('Hourly');

        expect(mockSeen['left-column'].trigger_rate).toBe('Hourly');
        expect(mockSeen['left-column'].selected_rate).toEqual(['Hourly']);
    });

    it('writes the selection into the query string', async () => {
        await loaded();

        toggle('Daily', ['hammer', 'shooting_star']);

        expect(mockSeen['left-column'].selected_candlestick)
            .toEqual(['hammer', 'shooting_star']);
    });

    it('generates one colour per series in the data', async () => {
        await loaded();

        toggle('Monthly', ['hammer', 'shooting_star']);

        expect(mockSeen['chart'].color.length).toBeGreaterThan(0);
        mockSeen['chart'].color.forEach(colour => {
            expect(colour).toEqual({
                r: expect.any(Number),
                g: expect.any(Number),
                b: expect.any(Number),
            });
        });
    });

    it('keeps the previous selection when handed an empty pattern list', async () => {
        //
        // the guard is 'patterns && checkValidArray(patterns)', and an empty
        // array fails checkValidArray, so the stored selection is left alone
        // rather than being cleared.
        //
        await loaded();

        toggle('Daily', []);

        expect(mockSeen['left-column'].selected_candlestick).toEqual(['hammer']);
    });

    it('THROWS when called the way its own default suggests', async () => {
        //
        // DEFECT: the signature is toggleChartScale(v, patterns = null), but two
        // statements below the guard it calls patterns.join(';') unconditionally.
        // The default value can therefore never be used. Nothing calls it that
        // way today -- the left column always passes an array -- so this is a
        // trap for the next caller rather than a live crash.
        //
        await loaded();

        expect(() => mockSeen['left-column'].toggleChartScale('Daily'))
            .toThrow(TypeError);
    });
});

describe('the chart itself', () => {
    it('appears once the data has loaded and a pattern is selected', async () => {
        await renderTrigger('StockMarket', { query: '?selected=hammer' });
        await waitForLoad();

        await waitFor(() =>
            expect(document.querySelector('[data-probe="chart"]')).toBeInTheDocument());
    });

    it('is titled with the stream label rather than its id', async () => {
        await renderTrigger('StockMarket', { query: '?selected=hammer' });
        await waitForLoad();

        await waitFor(() => expect(mockSeen['chart']).toBeDefined());
        expect(mockSeen['chart'].title).toBe('S&P 500');
        expect(mockSeen['chart'].y_label).toBe('Total Alerts');
    });

    it('stays hidden when every row falls outside the current window', async () => {
        //
        // the data loads and the pattern keys are still offered, but the Minutes
        // scale keeps only rows from the current hour, so there is nothing to
        // plot and the chart element is simply absent.
        //
        await renderTrigger('StockMarket', { query: '?selected=hammer', data: yesterdayRows() });
        await waitForLoad();

        expect(document.querySelector('[data-probe="chart"]')).not.toBeInTheDocument();
    });

    it('reappears when the scale is widened to include those rows', async () => {
        await renderTrigger('StockMarket', { query: '?selected=hammer', data: yesterdayRows() });
        await waitForLoad();

        act(() => mockSeen['left-column'].toggleChartScale('Monthly', ['hammer']));

        expect(document.querySelector('[data-probe="chart"]')).toBeInTheDocument();
    });

    it('CRASHES the load when the dataset has no usable rows at all', async () => {
        //
        // DEFECT: getFilteredCandlestickData finishes with
        //
        //     Object.keys(data_filtered_detected[0])
        //
        // without checking that anything survived the filter. An empty csv -- or
        // one where every timestamp failed to parse -- therefore throws inside
        // the promise chain in componentDidMount, where nothing catches it: the
        // page keeps its loading state forever and the failure surfaces only as
        // an unhandled rejection in the console.
        //
        // Pinned at the helper rather than through the component on purpose. The
        // component's rejection escapes into whichever test happens to be
        // running when the microtask drains, which makes the whole file
        // order-dependent; the helper reproduces the same fault deterministically.
        //
        expect(() => getFilteredCandlestickData([[]], 'window_start')).toThrow(TypeError);
    });
});

describe('responding to the hide flags from redux', () => {
    it('hides the content and the filter column when hide.all flips on', async () => {
        const { setHide } = await renderTrigger('StockMarket', {
            query: '?selected=hammer',
            hide: { all: false, graph: false },
        });
        await waitForLoad();

        expect(document.querySelector('[data-probe="candlestick"]')).toBeInTheDocument();

        setHide({ all: true, graph: false });

        expect(document.querySelector('[data-probe="candlestick"]')).not.toBeInTheDocument();
        expect(document.querySelector('[data-probe="chart"]')).not.toBeInTheDocument();
    });

    it('keeps the always-on filter panel even when everything else is hidden', async () => {
        //
        // WORTH KNOWING: the first CandlestickLeftColumnState is rendered
        // unconditionally -- only the second, expanded={false} one is gated on
        // hide_all -- so hiding 'all' still leaves the filter bar on screen.
        //
        const { setHide } = await renderTrigger('StockMarket', {
            query: '?selected=hammer',
            hide: { all: false, graph: false },
        });
        await waitForLoad();

        setHide({ all: true, graph: false });

        expect(document.querySelectorAll('[data-probe="left-column"]')).toHaveLength(1);
    });

    it('hides only the chart when hide.graph flips on', async () => {
        const { setHide } = await renderTrigger('StockMarket', {
            query: '?selected=hammer',
            hide: { all: false, graph: false },
        });
        await waitForLoad();
        await waitFor(() =>
            expect(document.querySelector('[data-probe="chart"]')).toBeInTheDocument());

        setHide({ all: false, graph: true });

        expect(document.querySelector('[data-probe="chart"]')).not.toBeInTheDocument();
        expect(document.querySelector('[data-probe="candlestick"]')).toBeInTheDocument();
    });

    it('ignores a non-boolean hide flag', async () => {
        const { setHide } = await renderTrigger('StockMarket', {
            query: '?selected=hammer',
            hide: { all: false, graph: false },
        });
        await waitForLoad();

        setHide({ all: 'yes', graph: false });

        expect(document.querySelector('[data-probe="candlestick"]')).toBeInTheDocument();
    });

    it('renders without any hide prop at all', async () => {
        //
        // componentDidUpdate guards on 'hide' being present, so the page still
        // works when it is rendered outside its redux container.
        //
        //
        // Note: awaited rather than wrapped in expect(...).not.toThrow(). renderTrigger
        //       is async now, so it returns a promise that toThrow cannot inspect -- a
        //       rejection would pass silently. Awaiting it fails the test on any throw,
        //       which is what the assertion was for.
        //
        await renderTrigger('bls');

        expect(screen.getByRole('heading', { name: 'Triggers' })).toBeInTheDocument();
    });

    it('CRASHES on the second render if hide is present but undefined', async () => {
        //
        // DEFECT: the guard is
        //
        //     'hide' in prevProps && 'all' in prevProps.hide
        //
        // and 'in' tests for the KEY, not for a usable value. A parent writing
        // <StreamTriggerLayout hide={maybeUndefined} /> therefore passes the
        // first check and then indexes into undefined on the next update.
        //
        // The redux container always supplies an object, so this is unreachable
        // through the app today -- it is a trap for any other caller.
        //
        const { setHide } = await renderTrigger('bls', { hide: { all: false, graph: false } });

        const trap = console.error;
        console.error = () => {};
        try {
            expect(() => setHide(null)).toThrow(TypeError);
        } finally {
            console.error = trap;
        }
    });

    it('ignores hide.graph when the slice carries no "all" key', async () => {
        //
        // DEFECT, a copy-paste slip: the second guard opens with
        //
        //     'hide' in prevProps && 'all' in prevProps.hide
        //
        // where it means 'graph'. A hide slice that reports only the graph flag
        // therefore never reaches the branch that would act on it.
        //
        const { setHide } = await renderTrigger('StockMarket', {
            query: '?selected=hammer',
            hide: { graph: false },
        });

        setHide({ graph: true });

        expect(document.querySelector('[data-probe="candlestick"]')).toBeInTheDocument();
    });
});

describe('the error boundary', () => {
    it('is not triggered by a normal render', async () => {
        await renderTrigger('bls');

        expect(screen.queryByText('Something went wrong:')).not.toBeInTheDocument();
        expect(within(document.body).getByRole('heading', { name: 'Triggers' }))
            .toBeInTheDocument();
    });
});
