/**
 * data-internals.test.jsx: the small helpers behind the data layout.
 *
 * data.test.jsx covers the rendered listing and data-callback.test.jsx covers the
 * worker payloads. This covers the rest: the count formatter, the per-stream reset,
 * the resize handler, and the weekend rule in the constructor. All of them are
 * reachable only through the component -- none is exported -- so this drives the
 * instance through a ref, the same boundary data-callback.test.jsx documents.
 *
 * And the two month helpers behind the address (#235), linkedMonth and
 * addressMonth, which are exported and pure, so they are called directly.
 *
 * Note: the weekend rule runs in the CONSTRUCTOR, so the clock has to be set before
 *       render rather than inside the assertion. Those tests own their fake timers
 *       and restore real ones afterwards, because a fake clock left installed makes
 *       every later suite in the file hang on react's scheduler.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import DataLayout, { linkedMonth, addressMonth } from '../../../import/layout/data/data.jsx';

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

        const bls = page.state.list_article.find((row) => row.name === 'bls');
        expect(bls.detail.Records).toBe('345,467');
    });

    it('passes n/a through untouched rather than coercing it', () => {
        //
        // Number('n/a') is NaN, so without the isFinite guard the pre-data listing
        // would read 'NaN' in every count.
        //
        const page = setup();

        const bls = page.state.list_article.find((row) => row.name === 'bls');
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

        const bls = page.state.list_article.find((row) => row.name === 'bls');
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
            page.reset_stream('sec');
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
                selected_stream: 'us-national-weather',
                'records_us-national-weather': 99,
            });
        });

        act(() => {
            page.reset_stream();
        });

        expect(page.state['records_us-national-weather']).toBe('n/a');
    });

    it('leaves the other streams alone', () => {
        const page = setup();

        act(() => {
            page.setState({ records_sec: 42, records_bls: 17 });
        });

        act(() => {
            page.reset_stream('sec');
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

describe('the month an address names (#235)', () => {
    //
    // the menu's months, January 2023 to October 2026, and what an address
    // naming one opens on: its first day, as [year, month, day]
    //
    const first = new Date(2023, 0, 1);
    const last = new Date(2026, 9, 10);

    function named(search) {
        const month = linkedMonth(search, first, last);

        return month ? [month.getFullYear(), month.getMonth() + 1, month.getDate()] : null;
    }

    it('reads a month the menu offers, as its first day', () => {
        expect(named('?month=2026-09')).toEqual([2026, 9, 1]);
        expect(named('?item=sec&month=2025-12')).toEqual([2025, 12, 1]);
    });

    it('reads the menu\'s first month and its last', () => {
        expect(named('?month=2023-01')).toEqual([2023, 1, 1]);
        expect(named('?month=2026-10')).toEqual([2026, 10, 1]);
    });

    it.each([
        ['no month', ''],
        ['an empty month', '?month='],
        ['a month before the first', '?month=2022-12'],
        ['a month after this one', '?month=2026-11'],
        ['a thirteenth month', '?month=2026-13'],
        ['a month 00', '?month=2026-00'],
        ['an unpadded month', '?month=2026-9'],
        ['a day', '?month=2026-09-01'],
        ['a word', '?month=september'],
    ])('reads nothing from %s', (name, search) => {
        expect(named(search)).toBeNull();
    });
});

describe('the month the address names for the month on screen (#235)', () => {
    it('names none on the month the page opens on', () => {
        expect(addressMonth(2026, 10, '2026-10', 'sec')).toBeNull();
        expect(addressMonth('2026', '10', '2026-10', 'stock-market')).toBeNull();
    });

    it('names any other month, as the menu keys it', () => {
        expect(addressMonth(2026, 9, '2026-10', 'sec')).toBe('2026-09');
        expect(addressMonth(2026, '09', '2026-10', 'sec')).toBe('2026-09');
        expect(addressMonth(2027, 1, '2026-12', 'sec')).toBe('2027-01');
    });

    it('names bls\'s month on the month the page opens on too, since a link naming none opens bls a step back', () => {
        expect(addressMonth(2026, 10, '2026-10', 'bls')).toBe('2026-10');
    });
});

describe('a weekend that starts a month, in the address (#235)', () => {
    //
    // a Saturday the 1st opens on the month before, by the weekday rule above,
    // and that is the month a link leaves out of the address: the one the page
    // opens on by itself
    //
    beforeEach(() => {
        window.localStorage.clear();
        window.history.replaceState(null, '', '/');
    });

    afterEach(() => {
        jest.useRealTimers();
        window.history.replaceState(null, '', '/');
    });

    it('leaves out the month before, which it opens on, and names this one', () => {
        // Saturday, 1 August 2026
        jest.useFakeTimers().setSystemTime(new Date(2026, 7, 1, 12));

        const page = setup();

        expect(page.state.own_month).toBe('2026-07');
        expect(page.address()).toEqual({ item: 'stock-market', month: null, group: null });

        act(() => {
            page.pickMonth(new Date(2026, 7, 1));
        });

        expect(page.address().month).toBe('2026-08');
        expect(window.location.search).toBe('?item=stock-market&month=2026-08');
    });
});
