/**
 * data-callback.test.jsx: what the data layout does with a worker's answer.
 *
 * data.test.jsx covers the listing a visitor sees before any data arrives. This
 * covers the other half: callbackGetData, which picks a worker per stream and
 * keeps what comes back for the ring -- the rows, the key they group by, the
 * count and the month -- none of which is reachable through the rendered page,
 * because the workers never answer under jsdom. How the rows become the ring's
 * groups is distribution-tree.test.js's to pin; this pins that the page hands
 * them over.
 *
 * So the worker is mocked to capture the instance, and its onmessage is called
 * directly with the payloads the real workers post. The component is driven through
 * a ref, which is not how a component should usually be tested -- but callbackGetData
 * is a public method invoked by the loaders, and this is the boundary it presents.
 *
 * Note: setState from onmessage happens outside React's event system, so every
 *       delivery is wrapped in act() or the update is not flushed before assertions.
 */

import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

global.__workers = [];

jest.mock('../../../import/worker/web-worker.js', () => ({
    __esModule: true,
    default: function WorkerBuilderMock(script) {
        this.script = script;
        this.postMessage = jest.fn();
        this.terminate = jest.fn();
        global.__workers.push(this);
    },
}));

import DataLayout, { distributionNames } from '../../../import/layout/data/data.jsx';
import { KEY, VERSION } from '../../../import/general/layout-preference.js';

function setup() {
    const held = React.createRef();

    render(
        <MemoryRouter>
            <DataLayout ref={held} />
        </MemoryRouter>
    );

    return held.current;
}

//
// deliver a payload the way the real worker does, and flush the resulting setState.
//
function deliver(worker, data) {
    act(() => {
        worker.onmessage({ data });
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    global.__workers.length = 0;
});

describe('choosing a worker', () => {
    it.each([
        ['stock-market'],
        ['stock-split'],
        ['us-national-weather'],
        ['bls'],
        ['sec'],
    ])('builds a worker for %s', (stream) => {
        const page = setup();

        page.callbackGetData({ stream: stream });

        expect(global.__workers).toHaveLength(1);
    });

    it('gives the two stock streams the same worker script', () => {
        //
        // stock-market and stock-split share one worker; the other three each have
        // their own. Worth pinning because the shared branch is an array membership
        // test, easy to break by adding a stream to the wrong list.
        //
        const page = setup();

        page.callbackGetData({ stream: 'stock-market' });
        page.callbackGetData({ stream: 'stock-split' });

        expect(global.__workers[0].script).toBe(global.__workers[1].script);
    });

    it('gives a different stream a different worker script', () => {
        const page = setup();

        page.callbackGetData({ stream: 'bls' });
        page.callbackGetData({ stream: 'sec' });

        expect(global.__workers[0].script).not.toBe(global.__workers[1].script);
    });

    it('posts the item and the stringified validators', () => {
        //
        // the validators cross the worker boundary as SOURCE TEXT, because a function
        // cannot be structured-cloned. The worker rebuilds them with new Function().
        //
        const page = setup();
        const item = { stream: 'bls', 'data-distribution': [] };

        page.callbackGetData(item);

        const [posted] = global.__workers[0].postMessage.mock.calls[0];
        expect(posted.item).toBe(item);
        ['stringifiedTrim', 'stringifiedCheckValidInt', 'stringifiedCheckValidObject',
            'stringifiedCheckValidArray', 'stringifiedCheckValidString'].forEach(key => {
            expect(typeof posted[key]).toBe('string');
        });
    });

    it('builds nothing for an unrecognised stream, and says so', () => {
        const page = setup();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        page.callbackGetData({ stream: 'not-a-stream' });

        expect(global.__workers).toHaveLength(0);
        expect(quiet.mock.calls.flat().join(' ')).toContain('worker=null');

        quiet.mockRestore();
    });

    it.each([
        ['an item with no stream key', {}],
        ['undefined', undefined],
        ['null', null],
    ])('builds nothing for %s', (name, item) => {
        const page = setup();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        page.callbackGetData(item);

        expect(global.__workers).toHaveLength(0);

        quiet.mockRestore();
    });

    it('logs when the worker itself errors', () => {
        const page = setup();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        page.callbackGetData({ stream: 'bls' });
        global.__workers[0].onerror(new Error('worker died'));

        expect(quiet.mock.calls.flat().join(' ')).toContain('could not process data-distribution');

        quiet.mockRestore();
    });
});

describe('the partition count', () => {
    function partitionsFor(page, data) {
        page.callbackGetData({ stream: 'bls' });
        deliver(global.__workers[0], data);
        return page.state.partitions_bls;
    }

    it('is recorded against the stream it belongs to', () => {
        const page = setup();

        expect(partitionsFor(page, { count: 7, selected_stream: 'bls' })).toBe(7);
    });

    it('accepts zero, which is a real answer', () => {
        //
        // zero partitions differs from 'not measured yet', which the listing shows as
        // n/a -- so a falsy-check here would lose the distinction.
        //
        const page = setup();

        expect(partitionsFor(page, { count: 0, selected_stream: 'bls' })).toBe(0);
    });

    it.each([
        ['a fractional count', { count: 1.5, selected_stream: 'bls' }],
        ['a numeric string', { count: '7', selected_stream: 'bls' }],
        ['no selected_stream', { count: 7 }],
        ['an empty selected_stream', { count: 7, selected_stream: '' }],
    ])('ignores %s', (name, data) => {
        //
        // the guard demands a whole number AND a stream to file it under. Anything
        // else is dropped silently, and the value is left at its initial 'n/a' -- so
        // the listing keeps saying "not measured" rather than showing a wrong figure.
        //
        const page = setup();

        expect(partitionsFor(page, data)).toBe('n/a');
    });

    it('keys the count by the stream the worker names, which is the id it was handed', () => {
        //
        // the worker echoes the stream the page asked about, and the page asks by
        // id, so the id is what comes back. It used to be lower-cased on the way
        // in, against a capitalized name the page no longer holds.
        //
        const page = setup();
        page.callbackGetData({ stream: 'bls' });

        deliver(global.__workers[0], { count: 3, selected_stream: 'bls' });

        expect(page.state.partitions_bls).toBe(3);
    });
});

describe('the distribution payload', () => {
    const PAYLOAD = {
        selected_stream: 'bls',
        aggregate_key: 'category',
        records: 42,
        data_distribution: [
            { category: 'Reports', cpi: 5, ppi: 3 },
            { category: 'Surveys', cpi: 2, ppi: 8 },
        ],
    };

    function load(page, overrides = {}) {
        page.callbackGetData({ stream: 'bls' });
        deliver(global.__workers[0], { ...PAYLOAD, ...overrides });
        return page.state;
    }

    it('records the row count for the stream', () => {
        const page = setup();

        expect(load(page).records_bls).toBe(42);
    });

    it('marks the stream as loaded', () => {
        //
        // the flag the listing reads to stop showing n/a.
        //
        const page = setup();

        expect(load(page).promise_get_data_bls).toBe(true);
    });

    it('stores the aggregate key PER STREAM', () => {
        //
        // all five streams load in parallel, so a single shared aggregate_key would
        // end up holding whichever answered last and the x-axis would point at a
        // column the selected stream does not have.
        //
        const page = setup();

        expect(load(page).aggregate_key_bls).toBe('category');
    });

    it('keeps the rows as the worker answered them', () => {
        const page = setup();

        expect(load(page).data_distribution_bls).toEqual(PAYLOAD.data_distribution);
    });

    it('draws the ring from them, grouped by the key it was handed', () => {
        const page = setup();
        load(page);

        const tree = page.treeFor('bls', 'light');
        expect(tree.groups.map((group) => group.name)).toEqual(['Surveys', 'Reports']);
        expect(tree.total).toBe(18);
    });

    it('builds the tree once for the same rows and theme, and again for another theme', () => {
        //
        // pointing at the ring renders the page on every move, and rebuilding
        // the tree each time would hand the ring a new one it has to lay out
        //
        const page = setup();
        load(page);

        const light = page.treeFor('bls', 'light');
        expect(page.treeFor('bls', 'light')).toBe(light);
        expect(page.treeFor('bls', 'dark')).not.toBe(light);
    });

    it('ignores a payload with no aggregate_key', () => {
        const page = setup();

        expect(load(page, { aggregate_key: null }).promise_get_data_bls).toBe(false);
    });

    it('ignores a payload with no data_distribution', () => {
        const page = setup();

        expect(load(page, { data_distribution: null }).promise_get_data_bls).toBe(false);
    });
});

describe('the chart on the page', () => {
    //
    // the S&P 500's month, landed: Energy holds two industries, Utilities one
    //
    function landed() {
        const page = setup();
        page.callbackGetData({ stream: 'stock-market' });

        deliver(global.__workers[0], {
            selected_stream: 'stock-market',
            aggregate_key: 'sector',
            records: 9,
            data_distribution: [
                { sector: 'Energy', Refining: 3, 'Oil & Gas Storage': 2 },
                { sector: 'Utilities', 'Water Utilities': 4 },
            ],
        });

        return page;
    }

    const kept = () => (JSON.parse(window.localStorage.getItem(KEY) || '{}').data || {}).wide;
    const names = () => [...document.querySelectorAll('text.cube-chart-name')].map((name) => name.textContent);

    beforeEach(() => {
        window.localStorage.clear();
    });

    afterAll(() => {
        window.localStorage.clear();
    });

    it('draws a bar for each group of the stream on screen once its answer lands', () => {
        landed();

        //
        // a wide screen's bars of cubes: Energy holds two industries, so its bar
        // lists them, where Utilities holds one and has nothing under it to list
        //
        expect([...document.querySelectorAll('rect.cube-chart-bar')].map((bar) => bar.getAttribute('data-name')))
            .toEqual(['Energy', 'Utilities']);
        expect(document.querySelector('rect.cube-chart-bar[data-name="Energy"]'))
            .toHaveAttribute('aria-label', 'Energy, 5 records, 56% of all. Lists its 2 industries');
        expect(document.querySelector('rect.cube-chart-bar[data-name="Utilities"]')).not.toHaveAttribute('role');
    });

    it('folds the chart\'s names until they are asked for, and keeps them shown once they are (#167)', () => {
        const page = landed();

        expect(names()).toEqual([]);
        expect(kept()).toBeUndefined();

        fireEvent.click(screen.getByRole('button', { name: 'Show the sector names' }));

        expect(names()).toEqual(['Energy', 'Utilities']);
        expect(page.state.names_shown).toBe(true);
        expect(kept()).toEqual({ fold: { names: false }, size: {} });

        fireEvent.click(screen.getByRole('button', { name: 'Hide the sector names' }));

        expect(kept()).toEqual({ fold: { names: true }, size: {} });
    });

    it('opens with the names shown where this browser kept them shown (#167)', () => {
        window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, data: { wide: { fold: { names: false } } } }));

        const page = landed();

        expect(page.state.names_shown).toBe(true);
        expect(names()).toEqual(['Energy', 'Utilities']);
    });
});

describe('the names the ring uses', () => {
    it.each([
        ['stock-market', 'sectors', 'industries', 'records'],
        ['stock-split', 'days', 'tickers', 'splits'],
        ['bls', 'series', 'categories', 'records'],
        ['sec', 'forms', 'categories', 'filings'],
        ['us-national-weather', 'severities', 'event types', 'events'],
    ])('names %s\'s groups, members and counts', (stream, groups, members, unit) => {
        const named = distributionNames(stream, 'ignored');

        expect([named.group[1], named.member[1], named.unit[1]]).toEqual([groups, members, unit]);
    });

    it('names a stream it does not know by the key its rows are grouped by', () => {
        expect(distributionNames('new-stream', 'region')).toEqual({
            group: ['region', 'regions'],
            member: ['member', 'members'],
            unit: ['record', 'records'],
        });
    });

    it('falls back to groups when there is no key either', () => {
        expect(distributionNames('new-stream', undefined).group).toEqual(['group', 'groups']);
    });
});

describe('the month label', () => {
    function monthFor(page, mm, yyyy) {
        act(() => {
            page.setState({ mm: mm, yyyy: yyyy });
        });

        page.callbackGetData({ stream: 'bls' });
        deliver(global.__workers[0], {
            selected_stream: 'bls',
            aggregate_key: 'category',
            records: 1,
            data_distribution: [{ category: 'A', total: 1 }],
        });

        return { month: page.state.Month, year: page.state.Year };
    }

    it('labels the month the request actually asked athena for', () => {
        //
        // The label used to index 'list-months' at 'mm - 2', so mm=4 (April) rendered
        // 'March' -- one month behind the partition downloadData asks for, which is
        // 'month: mm' and therefore April itself.
        //
        // It was pinned rather than judged on the reading that the distribution lags a
        // month. It does not: lambda-api-scraper writes 'month={now.month:02d}', the
        // glue projection declares 'range: 1,12', and api-datalake seals a scale only
        // once '(year, month) < (reference.year, reference.month)'. Every one of those
        // is a 1-indexed month, so 'getMonth() + 1' names the month being fetched and
        // the index is 'mm - 1'.
        //
        const page = setup();

        expect(monthFor(page, 4, 2026).month).toBe('April');
    });

    it('stays in the same year in January', () => {
        //
        // January used to roll back to 2025 to accompany a December label. With
        // 'mm - 1' the index is 0 rather than -1, so the year it belongs to is the one
        // state.yyyy already holds.
        //
        const page = setup();

        expect(monthFor(page, 1, 2026).year).toBe(2026);
    });

    it('labels January as January', () => {
        //
        // Corrected twice over. The January branch first set the month to the string
        // '12', read as:
        //
        //     getData('list-months')[parseInt('12')]
        //
        // 'list-months' holds twelve names at indices 0-11, so index 12 was undefined
        // and the page showed no month at all for the whole of January. That was
        // corrected to index 11, which rendered 'December' -- still wrong, just wrong
        // in the same direction as every other month.
        //
        // 'mm - 1' removes the special case outright: mm is 1..12, so the index is
        // 0..11 and cannot leave the array.
        //
        const page = setup();

        expect(monthFor(page, 1, 2026)).toEqual({ month: 'January', year: 2026 });
    });

    it('resolves a month name for every other starting month', () => {
        const page = setup();

        for (let mm = 2; mm <= 12; mm++) {
            expect(monthFor(page, mm, 2026).month).toEqual(expect.any(String));
        }
    });
});

describe('the listing rebuild', () => {
    //
    // updateStreamListing rebuilds list_article from scratch every time counts
    // arrive, so the per-stream detail bullets exist in two places: the constructor's
    // map and this one. data.test.jsx only ever sees the constructor's, because it
    // asserts against the pre-data render.
    //
    // That gap is the whole failure mode. A bullet added to the constructor alone
    // renders correctly on load and then vanishes the instant the first count lands,
    // which is both the common case and the one a mount-time test cannot see.
    //
    it('keeps the bls lag bullet when counts replace n/a', () => {
        const page = setup();

        act(() => {
            page.setState({ records_bls: 345467, partitions_bls: 10 });
        });

        act(() => {
            page.updateStreamListing();
        });

        // the counts really did replace 'n/a', so the rebuild under test ran
        expect(screen.getByText('345,467')).toBeInTheDocument();

        expect(screen.getAllByText('Lag')).toHaveLength(1);
        expect(screen.getByText('1-2 months')).toBeInTheDocument();
    });

    it('leaves the other four streams without a lag bullet after a rebuild', () => {
        //
        // the asymmetry has to survive the rebuild too: stream_lag() returning null
        // must still prune the row rather than render an empty one.
        //
        const page = setup();

        act(() => {
            page.updateStreamListing();
        });

        expect(screen.getAllByText('Lag')).toHaveLength(1);
    });
});
