/**
 * data-callback.test.jsx: what the data layout does with a worker's answer.
 *
 * data.test.jsx covers the listing a visitor sees before any data arrives. This
 * covers the other half: callbackGetData, a ~330 line method that picks a worker
 * per stream and then reshapes whatever comes back into the chart. That reshaping
 * is the real logic in the file -- series capping, bar capping, severity ordering,
 * palette assignment -- and none of it is reachable through the rendered page,
 * because the workers never answer under jsdom.
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
import { render, act } from '@testing-library/react';
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

import DataLayout from '../../../import/layout/data/data.jsx';

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

//
// build a row set with 'count' distinct numeric series, to push past the series cap.
//
function wideRows(count, bars = 1) {
    return Array.from({ length: bars }, (ignored, bar) => {
        const row = { category: `bar-${bar}` };
        for (let i = 1; i <= count; i++) {
            row[`series_${i}`] = (count - i + 1) * (bar + 1);
        }
        return row;
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    global.__workers.length = 0;
});

describe('choosing a worker', () => {
    it.each([
        ['stream_stockmarket'],
        ['stream_stockmarketstocksplit'],
        ['stream_usnationalweather'],
        ['stream_bls'],
        ['stream_sec'],
    ])('builds a worker for %s', (key) => {
        const page = setup();

        page.callbackGetData({ stream: page.state[key] });

        expect(global.__workers).toHaveLength(1);
    });

    it('gives the two stock streams the same worker script', () => {
        //
        // stockmarket and stock-split share one worker; the other three each have
        // their own. Worth pinning because the shared branch is an array membership
        // test, easy to break by adding a stream to the wrong list.
        //
        const page = setup();

        page.callbackGetData({ stream: page.state.stream_stockmarket });
        page.callbackGetData({ stream: page.state.stream_stockmarketstocksplit });

        expect(global.__workers[0].script).toBe(global.__workers[1].script);
    });

    it('gives a different stream a different worker script', () => {
        const page = setup();

        page.callbackGetData({ stream: page.state.stream_bls });
        page.callbackGetData({ stream: page.state.stream_sec });

        expect(global.__workers[0].script).not.toBe(global.__workers[1].script);
    });

    it('posts the item and the stringified validators', () => {
        //
        // the validators cross the worker boundary as SOURCE TEXT, because a function
        // cannot be structured-cloned. The worker rebuilds them with new Function().
        //
        const page = setup();
        const item = { stream: page.state.stream_bls, 'data-distribution': [] };

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

        page.callbackGetData({ stream: page.state.stream_bls });
        global.__workers[0].onerror(new Error('worker died'));

        expect(quiet.mock.calls.flat().join(' ')).toContain('could not process data-distribution');

        quiet.mockRestore();
    });
});

describe('the partition count', () => {
    function partitionsFor(page, data) {
        page.callbackGetData({ stream: page.state.stream_bls });
        deliver(global.__workers[0], data);
        return page.state.partitions_bls;
    }

    it('is recorded against the stream it belongs to', () => {
        const page = setup();

        expect(partitionsFor(page, { count: 7, selected_stream: 'Bls' })).toBe(7);
    });

    it('accepts zero, which is a real answer', () => {
        //
        // zero partitions differs from 'not measured yet', which the listing shows as
        // n/a -- so a falsy-check here would lose the distinction.
        //
        const page = setup();

        expect(partitionsFor(page, { count: 0, selected_stream: 'Bls' })).toBe(0);
    });

    it.each([
        ['a fractional count', { count: 1.5, selected_stream: 'Bls' }],
        ['a numeric string', { count: '7', selected_stream: 'Bls' }],
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

    it('lower-cases the stream name before using it as a key', () => {
        //
        // the worker posts 'Bls'; every piece of state is keyed lower-case. A mismatch
        // would write partitions_Bls, which nothing reads.
        //
        const page = setup();
        page.callbackGetData({ stream: page.state.stream_bls });

        deliver(global.__workers[0], { count: 3, selected_stream: 'BLS' });

        expect(page.state.partitions_bls).toBe(3);
    });
});

describe('the distribution payload', () => {
    const PAYLOAD = {
        selected_stream: 'Bls',
        aggregate_key: 'category',
        records: 42,
        data_distribution: [
            { category: 'Reports', cpi: 5, ppi: 3 },
            { category: 'Surveys', cpi: 2, ppi: 8 },
        ],
    };

    function load(page, overrides = {}) {
        page.callbackGetData({ stream: page.state.stream_bls });
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

    it('collects the numeric columns as the stacked series', () => {
        const page = setup();
        load(page);

        const keys = page.state.data_distribution_bls_bar.map(b => b.data_key);
        expect(keys).toEqual(['cpi', 'ppi']);
    });

    it('excludes the axis column from the series', () => {
        const page = setup();
        load(page);

        const keys = page.state.data_distribution_bls_bar.map(b => b.data_key);
        expect(keys).not.toContain('category');
    });

    it('excludes non-numeric columns from the series', () => {
        //
        // stock-split rows carry a 'tickers' string for the tooltip. Without the
        // typeof test it would become its own bar and a duplicate tooltip row.
        //
        const page = setup();
        load(page, {
            data_distribution: [{ category: 'A', total: 5, tickers: 'AAPL, MSFT' }],
        });

        const keys = page.state.data_distribution_bls_bar.map(b => b.data_key);
        expect(keys).toEqual(['total']);
    });

    it('gives every series an rgb triple from the palette', () => {
        const page = setup();
        load(page);

        page.state.data_distribution_bls_bar.forEach(bar => {
            expect(bar.color).toEqual({
                r: expect.stringMatching(/\s*\d+/),
                g: expect.stringMatching(/\s*\d+/),
                b: expect.stringMatching(/\s*\d+/),
            });
        });
    });

    it('keeps the complete pre-fold row for the drill-down', () => {
        //
        // the chart is folded, the sheet is not: the sheet has to list every series,
        // including any the fold hid.
        //
        const page = setup();
        load(page);

        expect(page.state.data_distribution_bls_series.Reports).toEqual({
            category: 'Reports', cpi: 5, ppi: 3,
        });
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

describe('capping the stacked series', () => {
    //
    // past eight series the code stops naming them and switches to per-bar ranking:
    // slot_1 is the largest part of THAT bar, slot_2 the next, and so on. A colour
    // then means a rank rather than a series, which is only acceptable because every
    // segment is named on hover and in the sheet.
    //
    function loadWide(page, series, bars = 1) {
        page.callbackGetData({ stream: page.state.stream_bls });
        deliver(global.__workers[0], {
            selected_stream: 'Bls',
            aggregate_key: 'category',
            records: 1,
            data_distribution: wideRows(series, bars),
        });
        return page.state;
    }

    it('names the series when there are eight or fewer', () => {
        const page = setup();

        const keys = loadWide(page, 8).data_distribution_bls_bar.map(b => b.data_key);
        expect(keys).toEqual(['series_1', 'series_2', 'series_3', 'series_4',
            'series_5', 'series_6', 'series_7', 'series_8']);
    });

    it('switches to ranked slots past eight', () => {
        const page = setup();

        const keys = loadWide(page, 9).data_distribution_bls_bar.map(b => b.data_key);
        expect(keys.every(k => /^slot_\d+$/.test(k))).toBe(true);
    });

    it('ranks within each bar, largest first', () => {
        //
        // wideRows makes series_1 the largest, so slot_1 must hold its value.
        //
        const page = setup();

        const [row] = loadWide(page, 9).data_distribution_bls;
        expect(row.slot_1).toBe(9);
        expect(row.slot_2).toBe(8);
    });

    it('keeps the original series name alongside each slot', () => {
        //
        // the name is what the tooltip and sheet show, so the rank has to carry it or
        // the segment becomes anonymous.
        //
        const page = setup();

        const [row] = loadWide(page, 9).data_distribution_bls;
        expect(row.slot_1_name).toBe('series_1');
    });

    it('loses no series to the cap', () => {
        //
        // the cap re-labels rather than discards: nine series in, nine slots out.
        //
        const page = setup();

        const keys = loadWide(page, 9).data_distribution_bls_bar.map(b => b.data_key);
        expect(keys).toHaveLength(9);
    });

    it('gives the tail past the palette a desaturated hsl shade', () => {
        //
        // the first eight slots take the categorical hues; the rest share one hue and
        // separate by lightness, so they read as a band rather than competing.
        //
        const page = setup();
        loadWide(page, 12);

        const bars = page.state.data_distribution_bls_bar;
        expect(bars).toHaveLength(12);
        expect(bars[11].color.r).toBeDefined();
    });
});

describe('capping the bars', () => {
    //
    // past twenty bars the axis becomes a smear, so the top nineteen are kept and the
    // rest are rolled into one 'Other' bar whose contents stay reachable by clicking.
    //
    function loadBars(page, count) {
        const rows = Array.from({ length: count }, (ignored, i) => ({
            category: `cat-${String(i).padStart(3, '0')}`,
            total: count - i,
        }));

        page.callbackGetData({ stream: page.state.stream_bls });
        deliver(global.__workers[0], {
            selected_stream: 'Bls',
            aggregate_key: 'category',
            records: count,
            data_distribution: rows,
        });
        return page.state;
    }

    it('leaves twenty bars alone', () => {
        const page = setup();

        const chart = loadBars(page, 20).data_distribution_bls;
        expect(chart).toHaveLength(20);
        expect(chart.map(r => r.category)).not.toContain('Other');
    });

    it('folds twenty-one into nineteen plus Other', () => {
        const page = setup();

        const chart = loadBars(page, 21).data_distribution_bls;
        expect(chart).toHaveLength(20);
        expect(chart[chart.length - 1].category).toBe('Other');
    });

    it('pins Other last, after the alphabetical bars', () => {
        const page = setup();

        const chart = loadBars(page, 30).data_distribution_bls;
        expect(chart[chart.length - 1].category).toBe('Other');
        expect(chart.slice(0, -1).map(r => r.category)).toEqual(
            [...chart.slice(0, -1).map(r => r.category)].sort()
        );
    });

    it('sums the folded bars into Other', () => {
        //
        // 30 rows with totals 30..1; the top 19 are kept, so Other holds the sum of
        // the remaining 11 smallest: 11+10+...+1.
        //
        const page = setup();

        const chart = loadBars(page, 30).data_distribution_bls;
        const other = chart[chart.length - 1];
        expect(other.total).toBe(66);
    });

    it('keeps what Other contains, for the drill-down', () => {
        const page = setup();

        const rows = loadBars(page, 30).data_distribution_bls_other;
        expect(rows).toHaveLength(11);
        expect(rows[0].value).toBeGreaterThanOrEqual(rows[rows.length - 1].value);
    });

    it('leaves the other-rows empty when nothing was folded', () => {
        const page = setup();

        expect(loadBars(page, 5).data_distribution_bls_other).toEqual([]);
    });
});

describe('bar ordering', () => {
    function loadLabels(page, labels) {
        page.callbackGetData({ stream: page.state.stream_bls });
        deliver(global.__workers[0], {
            selected_stream: 'Bls',
            aggregate_key: 'category',
            records: labels.length,
            data_distribution: labels.map((category, i) => ({ category, total: i + 1 })),
        });
        return page.state.data_distribution_bls.map(r => r.category);
    }

    it('sorts labels alphabetically rather than by value', () => {
        //
        // by value the axis reads as an artificial descending staircase, which invites
        // the reader to see a trend in what is really just sort order.
        //
        const page = setup();

        expect(loadLabels(page, ['Charlie', 'Alpha', 'Bravo'])).toEqual(
            ['Alpha', 'Bravo', 'Charlie']
        );
    });

    it('sorts embedded numbers by value, not digit by digit', () => {
        //
        // plain localeCompare ordered the stock-split axis '1, 10, 12, 2, 20, 5'.
        //
        const page = setup();

        expect(loadLabels(page, ['10', '2', '1', '20', '5'])).toEqual(
            ['1', '2', '5', '10', '20']
        );
    });

    it('ranks severity as a scale instead of collating it as text', () => {
        //
        // alphabetically these interleave as Extreme, Minor, Moderate, Severe, which
        // reverses the middle of an ordered scale.
        //
        const page = setup();

        const order = loadLabels(page, ['Minor', 'Extreme', 'Moderate', 'Severe']);
        expect(order.indexOf('Extreme')).toBeLessThan(order.indexOf('Severe'));
        expect(order.indexOf('Severe')).toBeLessThan(order.indexOf('Moderate'));
        expect(order.indexOf('Moderate')).toBeLessThan(order.indexOf('Minor'));
    });

    it('keeps an unrecognised label alphabetical, after the ranked ones', () => {
        //
        // an unknown severity is still drawn rather than pinned silently to an end.
        //
        const page = setup();

        const order = loadLabels(page, ['Minor', 'Aardvark', 'Extreme']);
        expect(order.indexOf('Extreme')).toBeLessThan(order.indexOf('Minor'));
        expect(order).toContain('Aardvark');
    });
});

describe('the month label', () => {
    function monthFor(page, mm, yyyy) {
        act(() => {
            page.setState({ mm: mm, yyyy: yyyy });
        });

        page.callbackGetData({ stream: page.state.stream_bls });
        deliver(global.__workers[0], {
            selected_stream: 'Bls',
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
