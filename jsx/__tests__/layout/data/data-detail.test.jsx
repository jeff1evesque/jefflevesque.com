/**
 * data-detail.test.jsx: the bottom sheet behind a clicked distribution bar.
 *
 * The hover tooltip is pinned to the cursor, so it cannot hold controls and it
 * truncates: it shows the top few series and a count of the rest. openDistributionDetail
 * is where the truncated part is meant to come back -- clicking a bar opens a sheet
 * carrying the FULL breakdown for that x-axis entry.
 *
 * That makes it the only route to data the chart deliberately hides, and it has to
 * reconstruct it from three different places depending on which bar was clicked: the
 * folded 'Other' lump, the pre-fold series detail, or the clicked payload itself.
 * None of it is reachable through the rendered page -- recharts does not lay out
 * under jsdom, so no bar exists to click -- so the method is driven directly.
 *
 * Note: recharts hands the click a payload that is the chart ROW, not the segment,
 *       so every case here starts from a row object keyed by the x-axis field.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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
// put the page in the state a delivered distribution would have left it in:
// a selected stream, the x-axis key its rows are keyed by, and the bar
// definitions carrying the palette.
//
function primed(page, extra = {}) {
    act(() => {
        page.setState({
            selected_stream: 'stockmarket',
            aggregate_key_stockmarket: 'sector',
            data_distribution_stockmarket_bar: [
                { data_key: 'biotechnology', color: '#111' },
                { data_key: 'semiconductors', color: '#222' },
            ],
            ...extra,
        });
    });

    return page;
}

function open(page, payload) {
    act(() => {
        page.openDistributionDetail(payload);
    });
}

describe('the guards', () => {
    it('ignores a click before any distribution has arrived', () => {
        //
        // aggregate_key is set per stream when the worker answers. Until then there
        // is no x-axis field to read a title from, so the sheet must not open with
        // an empty heading.
        //
        const page = setup();

        open(page, { sector: 'healthcare' });

        expect(page.state.distribution_detail_open).toBe(false);
    });

    it('ignores a payload that is not an object', () => {
        const page = primed(setup());

        open(page, null);

        expect(page.state.distribution_detail_open).toBe(false);
    });

    it('ignores a row that does not carry the x-axis key', () => {
        //
        // a row from a DIFFERENT stream reaching this handler would otherwise open a
        // sheet titled 'undefined'.
        //
        const page = primed(setup());

        open(page, { category: 'Filings', total: 4 });

        expect(page.state.distribution_detail_open).toBe(false);
    });
});

describe('opening and toggling', () => {
    it('opens with the clicked row as its title', () => {
        const page = primed(setup());

        open(page, { sector: 'healthcare', biotechnology: 12 });

        expect(page.state.distribution_detail_open).toBe(true);
        expect(page.state.distribution_detail_title).toBe('healthcare');
    });

    it('closes when the same bar is clicked again', () => {
        const page = primed(setup());

        open(page, { sector: 'healthcare', biotechnology: 12 });
        open(page, { sector: 'healthcare', biotechnology: 12 });

        expect(page.state.distribution_detail_open).toBe(false);
    });

    it('swaps the breakdown when a different bar is clicked while open', () => {
        //
        // the alternative -- closing on any second click -- would make moving between
        // bars a two-click operation.
        //
        const page = primed(setup());

        open(page, { sector: 'healthcare', biotechnology: 12 });
        open(page, { sector: 'technology', semiconductors: 30 });

        expect(page.state.distribution_detail_open).toBe(true);
        expect(page.state.distribution_detail_title).toBe('technology');
    });
});

describe('the rows it builds', () => {
    it('lists the stacked series, largest first', () => {
        const page = primed(setup());

        open(page, { sector: 'technology', biotechnology: 12, semiconductors: 30 });

        expect(page.state.distribution_detail_rows).toEqual([
            { name: 'semiconductors', value: 30, color: '#222' },
            { name: 'biotechnology', value: 12, color: '#111' },
        ]);
    });

    it('drops the x-axis key, zeroes, nulls and non-numeric fields', () => {
        //
        // a row carries more than its plottable series -- the x-axis value itself, and
        // for some streams a string field the tooltip reads. Listing those would put
        // 'NaN' in the sheet.
        //
        const page = primed(setup());

        open(page, {
            sector: 'technology',
            semiconductors: 30,
            biotechnology: 0,
            software: null,
            industry: 'semiconductor equipment',
        });

        expect(page.state.distribution_detail_rows).toEqual([
            { name: 'semiconductors', value: 30, color: '#222' },
        ]);
    });

    it('DEFECT: a ranked slot lists its key rather than its name, and loses its swatch', () => {
        //
        // DOCUMENTS A DEFECT, in data.jsx openDistributionDetail. A per-bar ranked
        // series is keyed 'slot_n' and means a different category on every bar, so
        // the row carries 'slot_n_name' beside it -- the tooltip resolves it that way
        // at line 264.
        //
        // The sheet only half does. color_map is keyed by the RESOLVED name:
        //
        //     const series_name = payload[`${bar.data_key}_name`] || bar.data_key;
        //     color_map[series_name] = bar.color;
        //
        // but the rows are built straight off the row's own keys:
        //
        //     .map((key) => ({ name: key, value: ..., color: color_map[key] }))
        //
        // so the lookup is color_map['slot_1'] against a map keyed 'semiconductors'.
        // The swatch comes back undefined -- the exact grey-sheet failure the comment
        // above color_map says it is there to prevent -- and the row is labelled
        // 'slot_1' rather than the category.
        //
        // The intended fix is to resolve the name for the ROW too, reusing the same
        // `${key}_name` lookup, and to key the colour off that one value.
        //
        const page = primed(setup(), {
            data_distribution_stockmarket_bar: [
                { data_key: 'slot_1', color: '#abc' },
            ],
        });

        open(page, { sector: 'technology', slot_1: 5, slot_1_name: 'semiconductors' });

        expect(page.state.distribution_detail_rows[0]).toEqual({
            name: 'slot_1',
            value: 5,
            color: undefined,
        });
    });
});

describe('the folded long tail', () => {
    it('lists what the Other bar rolled up', () => {
        //
        // the chart caps its bars, bucketing the remainder into 'Other'. Clicking that
        // bucket is the only way to see what went into it.
        //
        const rolled = [
            { name: 'utilities', value: 9, color: '#333' },
            { name: 'materials', value: 4, color: '#444' },
        ];
        const page = primed(setup(), { data_distribution_stockmarket_other: rolled });

        open(page, { sector: 'Other', biotechnology: 13 });

        expect(page.state.distribution_detail_rows).toBe(rolled);
    });

    it('treats a genuine bar named Other as an ordinary bar', () => {
        //
        // 'other' is also what api-datalake fills in for a ticker missing from the
        // sp500 listing, so the name can arrive as real data rather than as the
        // bucket. With nothing rolled up, it has to fall through to the normal path
        // instead of opening an empty sheet.
        //
        const page = primed(setup());

        open(page, { sector: 'Other', biotechnology: 13 });

        expect(page.state.distribution_detail_rows).toEqual([
            { name: 'biotechnology', value: 13, color: '#111' },
        ]);
    });

    it('prefers the pre-fold row over the clicked payload', () => {
        //
        // the payload recharts hands back only carries what survived the series cap,
        // plus an 'Other' lump. The sheet exists to show the folded detail, so it
        // reads the row as it was BEFORE folding when one was kept.
        //
        const page = primed(setup(), {
            data_distribution_stockmarket_series: {
                technology: { sector: 'technology', semiconductors: 30, software: 25 },
            },
        });

        open(page, { sector: 'technology', semiconductors: 30, Other: 25 });

        expect(page.state.distribution_detail_rows.map((row) => row.name))
            .toEqual(['semiconductors', 'software']);
    });
});

describe('the stock-split breakdown', () => {
    it('lists each ticker against its ratio instead of restating the bar', () => {
        //
        // stock-split has a single 'splits' series, so a stacked breakdown would say
        // only what the bar already says. The tickers ride along on the row for
        // exactly this.
        //
        const page = primed(setup(), {
            selected_stream: 'stockmarketstocksplit',
            aggregate_key_stockmarketstocksplit: 'sector',
            data_distribution_stockmarketstocksplit_bar: [
                { data_key: 'splits', color: '#0f0' },
            ],
        });

        open(page, {
            sector: 'Day 14',
            splits: 3,
            tickers: 'dlll 8:1, mvll 3:1, nvdl 3:1',
        });

        expect(page.state.distribution_detail_rows).toEqual([
            { name: 'dlll', value: '8:1', color: '#0f0' },
            { name: 'mvll', value: '3:1', color: '#0f0' },
            { name: 'nvdl', value: '3:1', color: '#0f0' },
        ]);
    });

    it('DEFECT: the ticker path is not gated on the stream', () => {
        //
        // DOCUMENTS A DEFECT, in data.jsx openDistributionDetail. The branch reads
        //
        //     const ticker_pairs = splitTickerPairs(payload.tickers);
        //     if (ticker_pairs.length) { ... }
        //
        // with no check on the selected stream, so ANY row carrying a 'tickers'
        // string takes the split path and its numeric series are dropped entirely.
        //
        // Latent rather than live: only the stock-split worker writes a 'tickers'
        // column today, so no other stream can reach it. It is pinned because the
        // guard is a property of the DATA rather than of the stream, and the comment
        // above it describes the branch as stock-split's -- the next stream to carry
        // a ticker list for its tooltip would silently lose its chart values.
        //
        const page = primed(setup());

        open(page, { sector: 'technology', semiconductors: 30, tickers: 'aapl 2:1' });

        expect(page.state.distribution_detail_rows)
            .toEqual([{ name: 'aapl', value: '2:1', color: undefined }]);
    });

    it('falls back to the stacked breakdown when no tickers are carried', () => {
        const page = primed(setup(), {
            selected_stream: 'stockmarketstocksplit',
            aggregate_key_stockmarketstocksplit: 'sector',
            data_distribution_stockmarketstocksplit_bar: [
                { data_key: 'splits', color: '#0f0' },
            ],
        });

        open(page, { sector: 'Day 14', splits: 3 });

        expect(page.state.distribution_detail_rows).toEqual([
            { name: 'splits', value: 3, color: '#0f0' },
        ]);
    });
});
