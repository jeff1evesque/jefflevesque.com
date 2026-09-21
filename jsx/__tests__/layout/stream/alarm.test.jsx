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
    // These used to CRASH. The archive column read a `download_prefix` that no
    // branch assigned for a capitalised id, `.split()` threw inside the same
    // render() that would have created this page's ErrorBoundary -- so the
    // boundary never mounted, the error escaped to the one in layout/page.jsx,
    // and the whole site went down, navigation included. Every link from
    // /stream to an alarm page did this.
    //
    // The column no longer reads a prefix at all: it lower-cases the id, asks
    // what that stream publishes, and offers nothing when the answer is
    // nothing. A stream it does not recognise is the same case as one that
    // publishes nothing, which is why an unknown id renders too.
    //
    const LINKED = [
        'StockMarket',
        'StockMarketStockSplit',
        'USNationalWeather',
        'BLS',
        'SEC',
    ];

    it.each(LINKED)('/stream/%s/alarm renders', (stream) => {
        expect(crashFrom(stream)).toBeNull();
    });

    it('renders the same page whatever the casing', () => {
        //
        // the crux of the old defect: same page, same route, same stream, and
        // the only difference was the case of the url segment.
        //
        expect(crashFrom('StockMarket')).toBeNull();
        expect(crashFrom('stockmarket')).toBeNull();
    });

    it('renders for a stream that does not exist', () => {
        //
        // indistinguishable from a mis-cased known one, and it should be: a
        // stream with no archive is a stream with no archive.
        //
        expect(crashFrom('no-such-stream')).toBeNull();
    });

    it('shows the archive heading rather than taking the page down', () => {
        //
        // the old failure replaced the ENTIRE page. This asserts the opposite
        // of what it used to: the page is here.
        //
        renderAlarm('StockMarket');

        expect(screen.getByText('Latest Archive')).toBeInTheDocument();
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

    it('asks for the same dataset and scale the /data page asks for', () => {
        //
        // both pages report a partition count for one month, so a disagreement
        // between them is a bug in one of the two. Sharing the endpoint, the
        // loader, the worker and the url builder is what makes that impossible.
        //
        // FIXED. This pinned 'Data=stockmarket' while claiming the two pages
        // agreed. They did not: /data sends the dataset name, 'stock-market', and
        // the api answers the stream id 'stockmarket' with a 400 -- so the ticker
        // count this page waits for could never arrive.
        //
        renderAlarm('stockmarket');

        const url = new URL(String(getData.mock.calls[0][1]));

        expect(url.searchParams.get('Data')).toBe('stock-market');
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
    //
    // the list is no longer invented from a date loop. The page asks which
    // files a stream really published -- HEAD per candidate, on expansion --
    // and offers the ones that answered as a file.
    //
    // A missing object does NOT 404 here: the site answers an unmatched path
    // with the app's shell, 200 and text/html, and the anchors carry
    // `download`, so a dead link used to save half a kilobyte of markup under
    // the name `2026.csv`. That is why these answer with a content type and why
    // the judgement is on the type rather than the status.
    //
    const CSV = 'binary/octet-stream';
    const SHELL = 'text/html';

    function answering(typeFor) {
        global.fetch = jest.fn((url) => Promise.resolve({
            headers: { get: () => typeFor(String(url)) },
        }));

        return global.fetch;
    }

    function archiveToggle() {
        //
        // the collapsed row is the only ListItemButton rendered before expansion
        //
        return document.querySelector('.left-column .MuiListItemButton-root');
    }

    const offered = () => [...document.querySelectorAll('.left-column a[download]')]
        .map((a) => a.textContent);

    afterEach(() => {
        delete global.fetch;
    });

    it('is collapsed until it is clicked', () => {
        answering(() => CSV);
        renderAlarm('bls');

        expect(screen.queryByText(`${THIS_YEAR}.csv`)).not.toBeInTheDocument();
    });

    it('asks nothing until a reader expands it', () => {
        //
        // the whole reason asking is affordable: it costs a click, not a page
        // view.
        //
        const fetcher = answering(() => CSV);
        renderAlarm('bls');

        expect(fetcher).not.toHaveBeenCalled();
    });

    it('asks with HEAD, so nothing is downloaded to find out', async () => {
        const fetcher = answering(() => CSV);
        renderAlarm('bls');

        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});

        expect(fetcher.mock.calls.every(([, init]) => init.method === 'HEAD')).toBe(true);
    });

    it('offers a file that is published', async () => {
        answering(() => CSV);
        renderAlarm('bls');

        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});

        expect(offered()).toContain(`${THIS_YEAR}.csv`);
    });

    it('does not offer one that answers with the app shell', async () => {
        //
        // the case the old list got wrong thirty-one times over
        //
        answering((url) => (url.includes('2024') ? CSV : SHELL));
        renderAlarm('bls');

        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});

        expect(offered()).toEqual(['2024.csv']);
    });

    it('judges the content type rather than the status', async () => {
        //
        // every dead path answers 200, so a status check would pass all of them
        // and change nothing at all.
        //
        answering(() => SHELL);
        renderAlarm('bls');

        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});

        expect(offered()).toEqual([]);
        expect(screen.getByText('Nothing published yet')).toBeInTheDocument();
    });

    it('drops a candidate whose request fails outright', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
        renderAlarm('bls');

        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});

        expect(offered()).toEqual([]);
    });

    it('breaks the year down by month for sec', async () => {
        answering(() => CSV);
        renderAlarm('sec');

        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});

        expect(offered()).toContain(`01/${THIS_YEAR}.csv`);
    });

    it('offers a past year in full, not truncated at this month', async () => {
        //
        // the month bound is the CURRENT month and used to cap every year, so
        // in September the archive hid October to December of 2024 and 2025 --
        // real files, withheld because of the date on the reader's clock.
        //
        answering(() => CSV);
        renderAlarm('sec');

        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});

        expect(offered()).toContain(`12/${THIS_YEAR - 1}.csv`);
        expect(offered()).not.toContain(`12/${THIS_YEAR}.csv`);
    });

    it.each([
        ['stockmarket', 'stock-market'],
        ['stockmarketstocksplit', 'stock-split'],
    ])('offers %s a file a year from 2023, filed under %s', async (stream, dataset) => {
        //
        // both stock market streams said 'Nothing published yet', and this
        // case said that was right. The files were there all along, under the
        // dataset's name rather than the stream's -- the page had only ever
        // asked for them under the stream's.
        //
        answering(() => CSV);
        renderAlarm(stream);

        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});

        const years = [];
        for (let year = THIS_YEAR; year >= 2023; year -= 1) {
            years.push(`${year}.csv`);
        }

        expect(offered()).toEqual(years);
        expect(screen.queryByText('Nothing published yet')).not.toBeInTheDocument();
        [...document.querySelectorAll('.left-column a[download]')].forEach((anchor) => {
            expect(anchor.getAttribute('href')).toContain(`/ingest/${dataset}/`);
        });
    });

    it('offers nothing for a stream the archive does not know', async () => {
        //
        // the branch the stock market streams used to reach, and a real one
        // still: a stream with no entry has nothing to ask about, so nothing
        // is asked and the page says so rather than guessing at a path.
        //
        const fetcher = answering(() => CSV);
        renderAlarm('no-such-stream');

        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});

        expect(fetcher).not.toHaveBeenCalled();
        expect(screen.getByText('Nothing published yet')).toBeInTheDocument();
    });

    it('collapses again on a second click', async () => {
        answering(() => CSV);
        renderAlarm('bls');

        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});
        expect(offered().length).toBeGreaterThan(0);

        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});

        expect(offered()).toEqual([]);
    });

    it('asks once, not again on every expansion', async () => {
        const fetcher = answering(() => CSV);
        renderAlarm('bls');

        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});
        const first = fetcher.mock.calls.length;

        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});
        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});

        expect(fetcher.mock.calls.length).toBe(first);
    });

    it.each([
        ['bls', 'Bureau of Labor Statistics'],
        ['sec', 'SEC Filings'],
        ['stockmarket', 'S&P 500'],
        ['stockmarketstocksplit', 'Stock Splits'],
        ['usnationalweather', 'US Weather Alerts'],
    ])('labels the %s row with its name, not its id', (stream, label) => {
        //
        // stream-name.js exists to keep identifiers out of the page and carries
        // the reasoning for each of these. This column printed the raw id.
        //
        answering(() => CSV);
        renderAlarm(stream);

        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('puts the react key on the anchor it repeats', async () => {
        answering(() => CSV);
        renderAlarm('bls');

        await userEvent.click(archiveToggle());
        // the HEAD answers land after the click, so let them settle
        await act(async () => {});

        const anchors = [...document.querySelectorAll('.left-column a[download]')];
        expect(anchors.length).toBeGreaterThan(0);
        anchors.forEach((anchor) => {
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
