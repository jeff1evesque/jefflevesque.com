/**
 * data-internals.test.jsx: the small helpers behind the data layout.
 *
 * data.test.jsx covers the rendered listing and data-callback.test.jsx covers the
 * worker payloads. This covers the rest: the count formatter, the per-stream reset,
 * the resize handler, and the weekend rule in the constructor. All of them are
 * reachable only through the component -- none is exported -- so this drives the
 * instance through a ref, the same boundary data-callback.test.jsx documents.
 *
 * Note: the weekend rule runs in the CONSTRUCTOR, so the clock has to be set before
 *       render rather than inside the assertion. Those tests own their fake timers
 *       and restore real ones afterwards, because a fake clock left installed makes
 *       every later suite in the file hang on react's scheduler.
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

describe('the count formatter', () => {
    //
    // format_count runs against whatever the api last returned, which is not always
    // a number: the counts sit at the string 'n/a' until a query resolves, and a
    // failed query can leave them empty. Coercing those would render 'NaN' or '0' in
    // a column a visitor reads as a fact about the stream.
    //
    it('separates thousands once a real count arrives', () => {
        const page = setup();

        act(() => {
            page.setState({ records_bls: 345467 });
        });
        act(() => {
            page.updateStreamListing();
        });

        const bls = page.state.list_article.find((row) => row.name === 'BLS');
        expect(bls.detail.Records).toBe('345,467');
    });

    it('passes n/a through untouched rather than coercing it', () => {
        //
        // Number('n/a') is NaN, so without the isFinite guard the pre-data listing
        // would read 'NaN' in every count.
        //
        const page = setup();

        const bls = page.state.list_article.find((row) => row.name === 'BLS');
        expect(bls.detail.Records).toBe('n/a');
    });

    it('leaves an empty count empty instead of rendering it as zero', () => {
        //
        // Number('') and Number(null) are both 0, which is why the guard tests for
        // these explicitly ahead of the numeric path. A stream that reported nothing
        // must not claim it measured nothing.
        //
        const page = setup();

        act(() => {
            page.setState({ records_bls: '', partitions_bls: null });
        });
        act(() => {
            page.updateStreamListing();
        });

        const bls = page.state.list_article.find((row) => row.name === 'BLS');
        expect(bls.detail.Records).toBe('');
        expect(bls.detail.Partitions).toBe(null);
    });
});

describe('resetting a stream', () => {
    it('clears the named stream back to its pre-data state', () => {
        const page = setup();

        act(() => {
            page.setState({ records_sec: 42, partitions_sec: 7, chart_data_sec: [{ a: 1 }] });
        });

        act(() => {
            page.reset_stream('SEC');
        });

        expect(page.state.records_sec).toBe('n/a');
        expect(page.state.partitions_sec).toBe('n/a');
        expect(page.state.chart_data_sec).toEqual([]);
    });

    it('falls back to the selected stream when called with no argument', () => {
        //
        // the default path: the control tray calls reset_stream(stream) explicitly,
        // but the filter calls it bare and expects whatever is currently selected.
        //
        const page = setup();

        act(() => {
            page.setState({
                selected_stream: 'usnationalweather',
                records_usnationalweather: 99,
            });
        });

        act(() => {
            page.reset_stream();
        });

        expect(page.state.records_usnationalweather).toBe('n/a');
    });

    it('leaves the other streams alone', () => {
        const page = setup();

        act(() => {
            page.setState({ records_sec: 42, records_bls: 17 });
        });

        act(() => {
            page.reset_stream('SEC');
        });

        expect(page.state.records_sec).toBe('n/a');
        expect(page.state.records_bls).toBe(17);
    });
});

describe('the resize handler', () => {
    const width = window.innerWidth;

    afterEach(() => {
        window.innerWidth = width;
    });

    it('takes a new chart height when the viewport changes', () => {
        const page = setup();
        const before = page.state.chart_height;

        window.innerWidth = 1600;
        act(() => {
            page.updateChartHeight();
        });

        expect(page.state.chart_height).not.toBe(before);
    });

    it('holds the height when the viewport has not moved', () => {
        //
        // the guard exists because the handler is bound to every resize event, and
        // a setState per event would rerender the whole listing while a window is
        // being dragged.
        //
        const page = setup();
        const before = page.state.chart_height;

        act(() => {
            page.updateChartHeight();
        });

        expect(page.state.chart_height).toBe(before);
    });
});

describe('the weekday rule in the constructor', () => {
    //
    // the default date is the last day the market traded, because the stock streams
    // produce no file on a weekend and landing there would show an empty chart on
    // the page's own default. Saturday steps back one day and Sunday two, both to
    // the Friday.
    //
    afterEach(() => {
        jest.useRealTimers();
    });

    it('steps back to Friday when the page is opened on a Saturday', () => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15, 12));

        const page = setup();

        expect(page.state.date).toBe('08/14/2026');
    });

    it('steps back to Friday when the page is opened on a Sunday', () => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 7, 16, 12));

        const page = setup();

        expect(page.state.date).toBe('08/14/2026');
    });

    it('stays put on a weekday', () => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 7, 17, 12));

        const page = setup();

        expect(page.state.date).toBe('08/17/2026');
    });
});
