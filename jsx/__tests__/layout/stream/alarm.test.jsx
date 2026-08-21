/**
 * alarm.test.jsx: the per-stream ingest alarm page ('/stream/:stream/alarm').
 *
 * THE HEADLINE FINDING IS IN THE FIRST DESCRIBE BLOCK. This page throws for
 * every stream id the application actually links to. render() derives the
 * archive download prefix from a chain of comparisons against LOWER-CASE
 * literals:
 *
 *     if (stream === 'usnationalweather') { ... }
 *     else if (['stockmarket', 'stockmarketstocksplit'].includes(stream)) { ... }
 *     else if (stream === 'bls') { ... }
 *     else if (stream === 'sec') { ... }
 *     // no else
 *
 * but 'stream' at that point is the RAW url segment. The line above it,
 * 'stream.toLowerCase() === ...', shows the intent; these four do not lower-case
 * anything. layout/stream/stream.jsx builds every bell link from the stream id
 * verbatim -- 'StockMarket', 'StockMarketStockSplit', 'USNationalWeather', 'BLS',
 * 'SEC' -- so none of them match, download_prefix stays undefined, and
 * 'download_prefix.split('/')' throws a TypeError during render.
 *
 * The tests are therefore split in two: the ids the app produces (all of which
 * crash) and their lower-cased equivalents (which render, and are the only way
 * to exercise the rest of the file). If the comparisons are ever lower-cased,
 * the first block fails and should be deleted -- that is the point of it.
 *
 * Note: 'general/get-data.js' is mocked. It is the network boundary, and mocking
 *       it also makes 'which streams download anything' directly observable.
 *
 * Note: 'worker/web-worker.js' is mocked so the data-distribution reply can be
 *       delivered on demand. setup.js's Worker shim never posts a message back,
 *       so without this the ticker count is permanently zero.
 */

import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockWorkers = [];

jest.mock('../../../import/general/get-data/distribution/stock-market.js', () => ({
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

import getData from '../../../import/general/get-data/distribution/stock-market.js';
import StreamAlarm from '../../../import/layout/stream/alarm.jsx';

//
// alarm.jsx builds the archive list as an array of <a> elements carrying no key
// -- the key sits on the ListItemButton INSIDE each anchor, which is not the
// array element -- so every successful render emits React's missing-key warning.
// setup.js turns a stray console.error into a failure, so it is captured here
// and checked against that one known message: a NEW console error still fails
// the test rather than being swallowed with it. The warning itself is pinned in
// 'the archive list' below.
//
const MISSING_KEY = 'Each child in a list should have a unique "key" prop';

function renderAlarm(stream) {
    //
    // the page renders BreadCrumbs, which reads window.location.pathname rather
    // than router context, so the browser url has to be moved along with the
    // MemoryRouter entry or the trail comes out empty.
    //
    window.history.pushState({}, '', `/stream/${stream}/alarm`);

    const trap = console.error;
    const seen = [];
    console.error = (...args) => seen.push(String(args[0]));

    let result;
    try {
        result = render(
            <MemoryRouter initialEntries={[`/stream/${stream}/alarm`]}>
                <Routes>
                    <Route path='/stream/:stream/alarm' element={<StreamAlarm />} />
                </Routes>
            </MemoryRouter>
        );
    } finally {
        console.error = trap;
    }

    const unexpected = seen.filter(message => !message.includes(MISSING_KEY));
    if (unexpected.length) {
        throw new Error(`unexpected console.error:\n  ${unexpected.join('\n  ')}`);
    }

    return { ...result, warnings: seen };
}

//
// the crashing cases unmount the tree, and React reports the failure through
// console.error before rethrowing. Nothing is asserted about that output, so it
// is dropped wholesale here and the thrown error is what gets examined.
//
function crashFrom(stream) {
    const trap = console.error;
    console.error = () => {};

    try {
        render(
            <MemoryRouter initialEntries={[`/stream/${stream}/alarm`]}>
                <Routes>
                    <Route path='/stream/:stream/alarm' element={<StreamAlarm />} />
                </Routes>
            </MemoryRouter>
        );
        return null;
    } catch (error) {
        return error;
    } finally {
        console.error = trap;
    }
}

const THIS_YEAR = new Date().getFullYear();

beforeEach(() => {
    jest.clearAllMocks();
    mockWorkers.length = 0;
});

afterEach(() => {
    window.history.pushState({}, '', '/');
});

describe('every stream id the application links to', () => {
    //
    // exactly the ids layout/stream/stream.jsx puts in the url. There is no
    // sixth stream; this is the complete set of links to this page.
    //
    const LINKED = [
        'StockMarket',
        'StockMarketStockSplit',
        'USNationalWeather',
        'BLS',
        'SEC',
    ];

    it.each(LINKED)('/stream/%s/alarm throws during render', (stream) => {
        const error = crashFrom(stream);

        expect(error).toBeInstanceOf(TypeError);
        expect(error.message).toMatch(/split/);
    });

    it('fails on the download prefix, which no branch assigned', () => {
        //
        // the specific failure, so a change to the surrounding code that moves
        // the crash somewhere else does not quietly keep this test passing.
        //
        expect(crashFrom('StockMarket').message)
            .toMatch(/Cannot read propert.* of undefined \(reading 'split'\)/);
    });

    it('is a casing problem and nothing else', () => {
        //
        // the crux. Same page, same route, same stream -- the only difference is
        // the case of the url segment.
        //
        expect(crashFrom('StockMarket')).toBeInstanceOf(TypeError);
        expect(crashFrom('stockmarket')).toBeNull();
    });

    it('takes the page down rather than showing the error fallback', () => {
        //
        // alarm.jsx wraps its output in an ErrorBoundary, but the throw happens
        // in the same render() that would have created it, so the boundary is
        // never mounted and cannot catch its own parent. The error escapes to
        // whatever boundary is above -- in the running app that is the one in
        // layout/page.jsx, which replaces the ENTIRE page, navigation included.
        //
        crashFrom('StockMarket');

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByText('Something went wrong:')).not.toBeInTheDocument();
    });

    it('also throws for a stream that does not exist', () => {
        //
        // same root cause: no else branch. An unknown stream is indistinguishable
        // from a mis-cased known one.
        //
        expect(crashFrom('no-such-stream')).toBeInstanceOf(TypeError);
    });
});

describe('the page body, reached with a lower-cased id', () => {
    it.each([
        ['stockmarket'],
        ['stockmarketstocksplit'],
        ['usnationalweather'],
        ['bls'],
        ['sec'],
    ])('%s renders the alarm header', (stream) => {
        renderAlarm(stream);

        expect(screen.getByRole('heading', { name: 'Ingest Alarms' })).toBeInTheDocument();
    });

    it('shows the archive column and the terms notice', () => {
        renderAlarm('bls');

        expect(screen.getByRole('heading', { name: /Latest Archive/ })).toBeInTheDocument();
        expect(screen.getByText(/you must accept the terms and conditions/)).toBeInTheDocument();
    });

    it('renders the breadcrumb trail from the url', () => {
        renderAlarm('bls');

        const crumbs = within(screen.getByRole('navigation', { name: 'breadcrumb' }))
            .getAllByRole('listitem');

        expect(crumbs.map(c => c.textContent)).toEqual(['stream', 'bls', 'alarm']);
    });

    it('describes the ingest schedule for the stream', () => {
        renderAlarm('bls');

        expect(screen.getByText(/runs every 1 hour \(everyday\)/)).toBeInTheDocument();
        expect(screen.getByText(/U.S. Bureau of Labor Statistics/)).toBeInTheDocument();
    });

    it.each([
        ['stockmarket', /between 9:30am through 4:30pm EDT/],
        ['stockmarketstocksplit', /daily at 12am EDT/],
        ['usnationalweather', /every 5 minutes \(everyday\)/],
        ['bls', /every 1 hour \(everyday\)/],
        ['sec', /every 1 hour \(everyday\)/],
    ])('%s states its own ingest interval', (stream, interval) => {
        renderAlarm(stream);

        expect(screen.getByText(interval)).toBeInTheDocument();
    });

    it('offers both workflow explanations', () => {
        renderAlarm('bls');

        expect(screen.getByText('Basic Workflow')).toBeInTheDocument();
        expect(screen.getByText('Aggregate Workflow')).toBeInTheDocument();
    });
});

describe('the alarm count', () => {
    function count() {
        return document.querySelector('.title-count').textContent;
    }

    it('is one per source before any ticker count has arrived', () => {
        renderAlarm('stockmarket');

        expect(count()).toBe('1');
    });

    it('is hard-coded to three for the stock-split stream', () => {
        //
        // WORTH KNOWING: every other stream derives its count, this one is the
        // literal 3. Nothing recomputes it if the split stream gains a modality.
        //
        renderAlarm('stockmarketstocksplit');

        expect(count()).toBe('3');
    });

    it.each([['usnationalweather'], ['bls'], ['sec']])(
        '%s counts its single source',
        (stream) => {
            renderAlarm(stream);

            expect(count()).toBe('1');
        }
    );
});

describe('downloading the distribution', () => {
    it('is requested for the stock-market stream only', () => {
        //
        // the loader was called as 'stock-market-distribution', a type
        // 'get-data.js' does not dispatch. It fell out of the type chain, logged
        // 'not a valid choice', and returned undefined -- so no request was ever
        // made and the alarm count sat at its initial 0. It now goes through the
        // same distribution loader the /data page uses, whose type IS handled.
        //
        renderAlarm('stockmarket');

        expect(getData).toHaveBeenCalledTimes(1);
        expect(getData.mock.calls[0][0]).toBe('data-distribution');
    });

    it.each([['stockmarketstocksplit'], ['usnationalweather'], ['bls'], ['sec']])(
        '%s never downloads anything, so its ticker count can never change',
        (stream) => {
            //
            // downloadData() returns without doing anything unless the stream is
            // 'stockmarket'. For the other four the alarm count is therefore
            // fixed at render time.
            //
            renderAlarm(stream);

            expect(getData).not.toHaveBeenCalled();
        }
    );

    it('asks for the month it is actually in', () => {
        //
        // the month was 'mm - 1', naming the month BEFORE the one state.mm holds
        // and underflowing to '00' every january -- a partition that cannot
        // exist. api-datalake takes a 1-indexed month, the same value the /data
        // page sends, so there is no arithmetic left to get wrong.
        //
        renderAlarm('stockmarket');

        const scale = JSON.parse(
            new URL(String(getData.mock.calls[0][1])).searchParams.get('Scale')
        );

        expect(scale.month).toBe(String(new Date().getMonth() + 1).padStart(2, '0'));
    });

    it('never names a month outside 01-12', () => {
        //
        // the regression guard for the january underflow specifically.
        //
        renderAlarm('stockmarket');

        const scale = JSON.parse(
            new URL(String(getData.mock.calls[0][1])).searchParams.get('Scale')
        );

        expect(parseInt(scale.month)).toBeGreaterThanOrEqual(1);
        expect(parseInt(scale.month)).toBeLessThanOrEqual(12);
    });

    it('asks api-datalake rather than a static artifact', () => {
        //
        // 'artifact/stock-market/data-distribution/YYYY/MM.csv' is written by
        // nothing -- the distribution moved to api-datalake, which computes it
        // from the glue table. The old url could only ever have 404'd.
        //
        renderAlarm('stockmarket');

        const url = String(getData.mock.calls[0][1]);

        expect(url).toContain('/v1/public/datalake');
        expect(url).not.toContain('/artifact/stock-market/data-distribution/');
    });

    it('asks for the same scale the /data page asks for', () => {
        //
        // both pages report a partition count for one month, so a disagreement
        // between them is a bug in one of the two. Sharing the endpoint, the
        // loader and the worker is what makes that impossible.
        //
        renderAlarm('stockmarket');

        const url = new URL(String(getData.mock.calls[0][1]));

        expect(url.searchParams.get('Data')).toBe('stockmarket');
        expect(JSON.parse(url.searchParams.get('Scale'))).toEqual({
            year: new Date().getFullYear(),
            month: String(new Date().getMonth() + 1).padStart(2, '0'),
        });
    });
});

describe('the ticker count arriving from the worker', () => {
    it('raises the alarm count when the worker reports partitions', async () => {
        //
        // the only asynchronous state change on this page. callbackGetData spins
        // up a worker and adds whatever it reports to the source count, so the
        // header goes from '1' to '1 + partitions'.
        //
        renderAlarm('stockmarket');

        const callback = getData.mock.calls[0][2];
        //
        // both wrapped in act(): each delivers data straight into setState from outside
        // React's event system, which React reports as an update not wrapped in act().
        //
        act(() => {
            callback({ data: [{ ticker: 'crwd' }] });
        });

        expect(mockWorkers).toHaveLength(1);

        await userEvent.click(document.body);
        act(() => {
            mockWorkers[0].onmessage({ data: { count: 41, selected_stream: 'stockmarket' } });
        });

        expect(await screen.findByText('42')).toBeInTheDocument();
    });

    it('ignores the distribution half of the response', () => {
        //
        // the worker posts two shapes down one channel: the distribution as a
        // 'detail' object, and the partition count as { count, selected_stream }.
        // This read 'event.data.partitions', which NEITHER carries, so the count
        // resolved to undefined -- the fault that would have survived fixing the
        // loader type and the month.
        //
        renderAlarm('stockmarket');
        getData.mock.calls[0][2]({ data: [] });

        act(() => {
            mockWorkers[0].onmessage({ data: { aggregate_key: 'sector', records: 7 } });
        });

        expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('hands the worker the validators as source text', () => {
        //
        // a worker cannot receive functions over postMessage, so the helpers are
        // stringified and re-evaluated on the other side. Pinned because a
        // rename or a change of shape here fails silently inside the worker.
        //
        renderAlarm('stockmarket');

        getData.mock.calls[0][2]({ data: [] });

        const [message] = mockWorkers[0].posted;
        expect(Object.keys(message).sort()).toEqual([
            'item',
            'stringifiedCheckValidArray',
            'stringifiedCheckValidInt',
            'stringifiedCheckValidObject',
            'stringifiedCheckValidString',
            'stringifiedTrim',
        ]);
        expect(message.stringifiedTrim).toContain('function');
    });

    it('survives a worker that fails', () => {
        renderAlarm('stockmarket');

        getData.mock.calls[0][2]({ data: [] });

        expect(() => mockWorkers[0].onerror(new Error('worker died'))).not.toThrow();
        expect(screen.getByRole('heading', { name: 'Ingest Alarms' })).toBeInTheDocument();
    });
});

describe('the archive list', () => {
    function archiveToggle() {
        //
        // the collapsed row is the only ListItemButton rendered before expansion.
        //
        return document.querySelector('.left-column .MuiListItemButton-root');
    }

    it('is collapsed until it is clicked', () => {
        renderAlarm('bls');

        expect(screen.queryByText(`${THIS_YEAR}.csv`)).not.toBeInTheDocument();
    });

    it('expands to a csv per year when clicked', async () => {
        renderAlarm('bls');

        await userEvent.click(archiveToggle());

        expect(screen.getByText(`${THIS_YEAR}.csv`)).toBeInTheDocument();
        expect(screen.getByText('2024.csv')).toBeInTheDocument();
    });

    it('collapses again on a second click', async () => {
        renderAlarm('bls');

        await userEvent.click(archiveToggle());
        expect(screen.getByText('2024.csv')).toBeInTheDocument();

        await userEvent.click(archiveToggle());

        expect(screen.queryByText('2024.csv')).not.toBeInTheDocument();
    });

    it('counts back to the stream\'s own first year', async () => {
        //
        // bls and sec start in 2024, the stock streams in 2023. The list is
        // built from the current year down, so it grows by one row every January.
        //
        renderAlarm('bls');

        await userEvent.click(archiveToggle());

        const years = [];
        for (let year = THIS_YEAR; year >= 2024; year--) {
            years.push(`${year}.csv`);
        }

        years.forEach(label => expect(screen.getByText(label)).toBeInTheDocument());
        expect(screen.queryByText('2023.csv')).not.toBeInTheDocument();
    });

    it('goes back to 2023 for the stock-market stream', async () => {
        renderAlarm('stockmarket');

        await userEvent.click(archiveToggle());

        expect(screen.getByText('2023.csv')).toBeInTheDocument();
        expect(screen.queryByText('2022.csv')).not.toBeInTheDocument();
    });

    it('breaks the year down by month for sec', async () => {
        //
        // sec and weather publish monthly rather than yearly, so their rows are
        // 'MM/YYYY.csv' and run to the CURRENT month only.
        //
        renderAlarm('sec');

        await userEvent.click(archiveToggle());

        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        expect(screen.getByText(`01/${THIS_YEAR}.csv`)).toBeInTheDocument();
        expect(screen.getByText(`${month}/${THIS_YEAR}.csv`)).toBeInTheDocument();
    });

    it.each([
        ['bls', 'bls'],
        ['sec', 'sec'],
        ['stockmarket', 'stockmarket'],
        ['stockmarketstocksplit', 'stocksplit'],
        ['usnationalweather', 'weather'],
    ])('%s labels its archive row "%s"', (stream, label) => {
        //
        // the label is the last path segment of the artifact prefix, not the
        // stream id -- which is why usnationalweather reads 'weather' and the
        // split stream is shortened back to 'stocksplit'.
        //
        renderAlarm(stream);

        expect(within(document.querySelector('.left-column')).getByText(label))
            .toBeInTheDocument();
    });

    it('toggles a state key the constructor never declared', async () => {
        //
        // WORTH KNOWING: the constructor seeds expand_archive_usnationalweather,
        // but the key actually toggled is built from the archive LABEL, so this
        // stream uses expand_archive_weather and the declared field is dead. It
        // works only because toggling an undefined field with ! yields true.
        //
        renderAlarm('usnationalweather');

        await userEvent.click(archiveToggle());

        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        expect(screen.getByText(`${month}/${THIS_YEAR}.csv`)).toBeInTheDocument();
    });

    it('puts the react key on the wrong element', async () => {
        //
        // DEFECT, and the reason renderAlarm() has to filter console output: the
        // repeated element is the <a> wrapper, but the key is set on the
        // ListItemButton nested INSIDE it, so React sees an array of unkeyed
        // anchors and warns.
        //
        // The warning itself is not asserted here. React deduplicates it per
        // owner component, so it appears exactly once per module registry --
        // whichever test renders this page first absorbs it, which would make an
        // assertion on it depend on test order. The structure that causes it is
        // stable, so that is what gets pinned.
        //
        renderAlarm('bls');

        await userEvent.click(archiveToggle());

        const anchors = document.querySelectorAll('.left-column .MuiCollapse-root a');

        expect(anchors.length).toBeGreaterThan(0);
        anchors.forEach(anchor => {
            expect(anchor.querySelector('.MuiListItemButton-root')).toBeInTheDocument();
        });
    });
});

describe('the archive help tooltip', () => {
    it('is offered on a desktop viewport', () => {
        renderAlarm('bls');

        expect(document.querySelector('.help-icon')).toBeInTheDocument();
    });

    it('darkens while the pointer is over it', async () => {
        //
        // the only hover-driven state on the page: tool_tip_color moves between
        // #777 and #333.
        //
        renderAlarm('bls');

        expect(document.querySelector('.help-icon')).toHaveStyle({ color: '#777' });

        await userEvent.hover(document.querySelector('.help-icon'));

        expect(document.querySelector('.help-icon')).toHaveStyle({ color: '#333' });
    });

    it('returns to its resting colour when the pointer leaves', async () => {
        renderAlarm('bls');

        await userEvent.hover(document.querySelector('.help-icon'));
        await userEvent.unhover(document.querySelector('.help-icon'));

        expect(document.querySelector('.help-icon')).toHaveStyle({ color: '#777' });
    });
});
