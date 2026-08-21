/**
 * stream-listing.test.jsx: the figures the stream listing reports.
 *
 * stream.test.jsx asserts that a Health, Coverage, Rate and Total Records label
 * exists on every row. What it cannot assert is the VALUE beside each label, because
 * no report loads under jsdom and every one of them sits at 'n/a'. Those values are
 * computed by three module-private functions in stream.jsx:
 *
 *   - streamCoverage, which counts the intervals that carried data against the
 *     intervals the scraper was due to run in
 *   - format_percent, which appends a '%' to a figure that is one
 *   - format_count, which separates thousands in an eight digit ingest total
 *
 * None are exported, and none need to be: 'updateMetrics' and 'updateStreamListing'
 * are the component's own entry points to them, and are reachable through a ref the
 * same way stream-scale.test.jsx reaches the aggregator.
 *
 * Coverage is the figure worth pinning hardest. It is the only number on the page
 * that can see a scraper which never ran -- health divides successes by throughput,
 * and an interval carrying no rows at all moves neither side of that ratio. The
 * whole of ingest-schedule.js exists to supply its denominator.
 *
 * Note: the buckets are built from LOCAL date getters and the schedules are declared
 *       in eastern, so every assertion here depends on the TZ pin in jest.config.js.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import THROUGHPUT_KEY from '../../../import/general/throughput-key.js';
import { expectedIntervals } from '../../../import/general/ingest-schedule.js';
import StreamLayout from '../../../import/layout/stream/stream.jsx';

const FIELD = 'window_start';

function setup() {
    const held = React.createRef();

    render(
        <MemoryRouter>
            <StreamLayout ref={held} />
        </MemoryRouter>
    );

    return held.current;
}

//
// an aggregated row for one stream's own series, as toggleChartScale emits them.
//
function row(stream, date, success, throughput = success) {
    const source = {
        bls: 'bls',
        sec: 'sec',
        usnationalweather: 'weather',
    }[stream];

    return {
        [FIELD]: date,
        [source]: success,
        [`${source}${THROUGHPUT_KEY}`]: throughput,
    };
}

//
// the intervals the schedule says the stream owed, read from the same module the
// component reads. Written this way rather than as fixed dates because coverage is a
// RATIO against a rolling window -- hard-coding a denominator would pin today's
// window and start failing tomorrow.
//
function owed(stream, rate) {
    return expectedIntervals(stream, rate);
}

//
// everything jest can fake EXCEPT Date, matching stream.test.jsx. Faking the timers
// as well stalls react-spinners and MUI's transitions, which is a different test.
//
const TIMERS_LEFT_REAL = [
    'hrtime',
    'nextTick',
    'performance',
    'queueMicrotask',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback',
    'cancelIdleCallback',
    'setImmediate',
    'clearImmediate',
    'setInterval',
    'clearInterval',
    'setTimeout',
    'clearTimeout',
];

//
// the daily and monthly rates are owed the same intervals whatever the clock says, so
// most of the cases below read it live. The MINUTE rate is not: 'sec' runs on weekdays
// between 6 and 22 eastern, so a suite starting at 03:00 or on a Saturday is owed
// nothing at all and would divide by an empty denominator. Those cases pin the clock
// to a Wednesday inside the window instead.
//
// Note: the clock has to stay faked across the assertion, not just the render --
//       'streamCoverage' reads it again through 'expectedIntervals' when
//       'updateMetrics' runs.
//
const MIDMORNING_WEDNESDAY = '2026-03-18T15:00:00Z';   // 11:00 EDT

function at(iso, fn) {
    jest.useFakeTimers({ doNotFake: TIMERS_LEFT_REAL, now: new Date(iso) });

    try {
        return fn();
    } finally {
        jest.useRealTimers();
    }
}

function coverageOf(page, stream, rate, rows) {
    act(() => {
        page.setState({ [`stream_rate_${stream}`]: rate });
    });

    act(() => {
        page.updateMetrics(rows, stream);
    });

    return page.state[`stream_${stream}_coverage`];
}

describe('the listing coverage figure', () => {
    it('reports n/a for a rate the schedule cannot grade', () => {
        //
        // 'bls' runs once a day, at 15 eastern. All but one of a trailing hour's
        // minute intervals are legitimately empty for it, so a ratio over them would
        // report an outage that never happened -- the rate goes ungraded instead.
        //
        const page = setup();
        const rows = [row('bls', new Date(), 190)];

        expect(coverageOf(page, 'bls', 'minute', rows)).toBe('n/a');
    });

    it('grades the minute rate for a stream on a five minute spacing', () => {
        //
        // 'usnationalweather' and 'sec' are both 'rate(5 minutes)'. The expression
        // does not fix which minute a run lands on -- eventbridge counts from
        // whenever the rule was created -- so the alignment was measured against the
        // live report rather than assumed, and every bucket of a trailing hour sits
        // on a multiple of five. Ungraded, these rows reported 'n/a' whatever they
        // carried.
        //
        at(MIDMORNING_WEDNESDAY, () => {
            const page = setup();

            ['usnationalweather', 'sec'].forEach((stream) => {
                const rows = owed(stream, 'minute').map(d => row(stream, d, 190));

                expect(rows).toHaveLength(12);
                expect(coverageOf(page, stream, 'minute', rows)).toBe('100.00');
            });
        });
    });

    it('grades a five minute stream whatever minute its rule fires on', () => {
        //
        // THE case the windows exist for. 'rate(5 minutes)' fixes the spacing and not
        // the offset -- eventbridge counts from whenever the rule was created -- so a
        // rule made at 09:02 fires at :02, :07, :12 and one made at 09:00 fires at
        // :00, :05, :10. Both are the schedule working.
        //
        // Measured against the exact instants, the second offset matched every
        // interval and the first matched none, so an identical stream read 100% or 0%
        // depending on a fact about its rule nobody can see from here. Each run is
        // filed under the window it falls in instead, so all five offsets agree.
        //
        at(MIDMORNING_WEDNESDAY, () => {
            const page = setup();

            [0, 1, 2, 3, 4].forEach((offset) => {
                const rows = owed('usnationalweather', 'minute').map(
                    d => row('usnationalweather', new Date(d.getTime() + offset * 60000), 190)
                );

                expect(coverageOf(page, 'usnationalweather', 'minute', rows)).toBe('100.00');
            });
        });
    });

    it('holds a named-minute stream to the minutes its cron names', () => {
        //
        // the other half, and why stockmarket is left exact: its cron lists
        // '0,20,40', so :02 is not a run that drifted, it is a run that
        // should not have happened there. Windowing it would report a clean 100% over
        // a stream firing on the wrong minutes.
        //
        // Note: the rows are built here rather than through 'row' above, which keys a
        //       row by the one series its stream reports. This stream reports two.
        //
        at(MIDMORNING_WEDNESDAY, () => {
            const page = setup();
            const drifted = owed('stockmarket', 'minute').map(d => ({
                [FIELD]: new Date(d.getTime() + 2 * 60000),
                options: 190,
                [`options${THROUGHPUT_KEY}`]: 190,
            }));

            expect(coverageOf(page, 'stockmarket', 'minute', drifted)).toBe('n/a');
        });
    });

    it('states the ratio when a five minute stream missed slots', () => {
        //
        // the case that pushed the rate from ungraded to graded: 'sec' filled all
        // twelve slots of an hour on one day and four of them the next. Ungraded,
        // both hours read 'n/a' and the drop was invisible in the listing.
        //
        at(MIDMORNING_WEDNESDAY, () => {
            const page = setup();
            const expected = owed('sec', 'minute');
            const rows = expected.slice(0, 4).map(d => row('sec', d, 190));

            expect(expected).toHaveLength(12);
            expect(coverageOf(page, 'sec', 'minute', rows)).toBe('33.33');
        });
    });

    it('reports 100 when every interval the scraper owed carried data', () => {
        const page = setup();
        const rows = owed('bls', 'day').map(d => row('bls', d, 5));

        expect(coverageOf(page, 'bls', 'day', rows)).toBe('100.00');
    });

    it('reports the ratio when some intervals carried nothing', () => {
        //
        // half the expected days, so the figure is arithmetic rather than a boundary.
        //
        const page = setup();
        const expected = owed('bls', 'day');
        const rows = expected
            .filter((v, i) => i % 2 === 0)
            .map(d => row('bls', d, 5));
        const ratio = 100 * rows.length / expected.length;

        expect(coverageOf(page, 'bls', 'day', rows)).toBe(ratio.toFixed(2));
    });

    it('counts an interval the scraper ran and failed in as covered', () => {
        //
        // coverage asks whether the scraper RAN; health asks how it did. An interval
        // where every request failed carries throughput and no successes -- counting it
        // as uncovered would state the same fault twice, once in each figure.
        //
        const page = setup();
        const rows = owed('bls', 'day').map(d => row('bls', d, 0, 7));

        expect(coverageOf(page, 'bls', 'day', rows)).toBe('100.00');
    });

    it('does not count an interval that reported nothing at all', () => {
        //
        // the zero rows ingest-gaps.js inserts for a missing day carry no throughput, so
        // they cannot lift the figure they exist to explain -- the chart's gap and the
        // percentage under it have to describe the same intervals.
        //
        const page = setup();
        const rows = owed('bls', 'day').map(d => row('bls', d, 0, 0));

        expect(coverageOf(page, 'bls', 'day', rows)).toBe('n/a');
    });

    it('ignores a row whose bucket never parsed', () => {
        //
        // a row that failed to parse cannot claim an interval. It reaches here because
        // the aggregator keys buckets off a constructed date string, and an unparsed one
        // is a Date that simply reads NaN rather than throwing.
        //
        const page = setup();
        const rows = [
            ...owed('bls', 'day').map(d => row('bls', d, 5)),
            row('bls', new Date('nonsense'), 5),
        ];

        expect(coverageOf(page, 'bls', 'day', rows)).toBe('100.00');
    });

    it('reports n/a before any rows have arrived', () => {
        //
        // the state every figure starts in, and the one it has to return to when a
        // refresh clears the stream -- a stale percentage beside an empty chart is worse
        // than no percentage at all.
        //
        const page = setup();

        expect(coverageOf(page, 'bls', 'day', [])).toBe('n/a');
    });

    it('grades an hourly window against the hours the scraper runs in', () => {
        //
        // the hours narrow an hourly chart where they do not narrow a daily one. 'sec'
        // runs 6-22 eastern, so the small hours are silence by design and must not count
        // against it -- graded against all 24 the figure would sit near 70% forever.
        //
        // Note: 'sec' is weekday-only, so the expected set is empty over a weekend and
        //       the figure is n/a rather than a ratio. Both are correct; which one this
        //       run sees depends on the day.
        //
        const page = setup();
        const expected = owed('sec', 'hour');
        const rows = expected.map(d => row('sec', d, 4));

        expect(expected.every(d => d.getHours() >= 6 && d.getHours() <= 22)).toBe(true);
        expect(coverageOf(page, 'sec', 'hour', rows)).toBe(expected.length ? '100.00' : 'n/a');
    });
});

describe('the listing figures as they are rendered', () => {
    //
    // 'updateStreamListing' is what puts each figure into the row the listing draws,
    // and it is the only caller of the two formatters.
    //
    function detailFor(page, stream) {
        act(() => {
            page.updateStreamListing();
        });

        const name = page.state[`stream_${stream}`];

        return page.state.list_article.find(v => v.name === name).detail;
    }

    it('appends a percent sign to a figure that is one', () => {
        const page = setup();

        act(() => {
            page.setState({ stream_bls_health: '92.50', stream_bls_coverage: '80.00' });
        });

        const detail = detailFor(page, 'bls');

        expect(detail.Health).toBe('92.50%');
        expect(detail.Coverage).toBe('80.00%');
    });

    it('leaves n/a alone rather than rendering n/a%', () => {
        //
        // every figure sits at 'n/a' until the query resolves, and a stream that cannot
        // state one keeps it there.
        //
        const page = setup();

        act(() => {
            page.setState({ stream_bls_health: 'n/a', stream_bls_coverage: 'n/a' });
        });

        const detail = detailFor(page, 'bls');

        expect(detail.Health).toBe('n/a');
        expect(detail.Coverage).toBe('n/a');
    });

    it('separates thousands in the ingest total', () => {
        //
        // a total ingest count runs to eight digits, and a bare run of numerals is read
        // digit by digit rather than at a glance.
        //
        const page = setup();

        act(() => {
            page.setState({ stream_bls_total: 48909600 });
        });

        expect(detailFor(page, 'bls')['Total Records']).toBe('48,909,600');
    });

    it('passes a non-numeric total through untouched', () => {
        //
        // 'n/a' would render as 'NaN' if it were coerced, and Number() turns both the
        // empty string and null into 0 -- which is why neither reaches the coercion.
        //
        const page = setup();

        act(() => {
            page.setState({ stream_bls_total: 'n/a' });
        });

        expect(detailFor(page, 'bls')['Total Records']).toBe('n/a');

        act(() => {
            page.setState({ stream_bls_total: '' });
        });

        expect(detailFor(page, 'bls')['Total Records']).toBe('');

        act(() => {
            page.setState({ stream_bls_total: null });
        });

        expect(detailFor(page, 'bls')['Total Records']).toBeNull();
    });

    it('capitalises the rate the row reports', () => {
        const page = setup();

        act(() => {
            page.setState({ stream_rate_bls: 'minute' });
        });

        expect(detailFor(page, 'bls').Rate).toBe('Minute');
    });

    it('lists only the streams it was handed', () => {
        //
        // the listing is rebuilt from a stream list rather than mutated in place, so a
        // caller naming a subset gets exactly that subset.
        //
        const page = setup();

        act(() => {
            page.updateStreamListing(['BLS', 'SEC']);
        });

        expect(page.state.list_article.map(v => v.name)).toEqual(['BLS', 'SEC']);
    });
});

describe('clearing a stream before it is refetched', () => {
    //
    // 'reset_stream' runs on every rate change and on every click of the refresh
    // control, immediately before the new request goes out. If it missed a key the old
    // rows would still be in state when the response landed and the aggregator would
    // merge two rates into one chart -- a daily series with an hour of minutes grafted
    // onto the end of it.
    //
    it('clears the chart rows for the stream it names', () => {
        const page = setup();

        act(() => {
            page.setState({ chart_data_bls: [row('bls', new Date(), 5)] });
        });

        act(() => {
            page.reset_stream('BLS');
        });

        expect(page.state.chart_data_bls).toEqual([]);
        expect(page.state.stream_throughput).toBe('n/a');
    });

    it('falls back to the selected stream when it is named none', () => {
        //
        // the refresh control calls it with no argument, on whichever stream the chart is
        // currently showing.
        //
        const page = setup();

        act(() => {
            page.setState({
                selected_stream: 'bls',
                chart_data_bls: [row('bls', new Date(), 5)],
            });
        });

        act(() => {
            page.reset_stream();
        });

        expect(page.state.chart_data_bls).toEqual([]);
    });

    it('clears the per-source series alongside the merged one', () => {
        //
        // the merged rows and the per-source rows are separate state, and the callback
        // reads the latter back when it merges. A stale per-source series would be
        // re-merged into the next response.
        //
        const page = setup();

        act(() => {
            page.setState({
                chart_data_bls_bls: [row('bls', new Date(), 5)],
                stream_throughput_bls_bls: 42,
            });
        });

        act(() => {
            page.reset_stream('bls');
        });

        expect(page.state.chart_data_bls_bls).toEqual([]);
        expect(page.state.stream_throughput_bls_bls).toBe(0);
    });

    it('zeroes the throughput for a stream whose partitions are its sources', () => {
        //
        // stockmarket and stocksplit reports are not partitioned by source -- their
        // 'group_by' values ARE the series names -- so there is no per-source series to
        // clear, only the one throughput figure.
        //
        const page = setup();

        act(() => {
            page.setState({ stream_throughput_stockmarket_stockmarket: 77 });
        });

        act(() => {
            page.reset_stream('stockmarket');
        });

        expect(page.state.chart_data_stockmarket).toEqual([]);
        expect(page.state.stream_throughput_stockmarket_stockmarket).toBe(0);
    });
});

describe('the per-row control tray', () => {
    function tray(page, stream, url_trigger = false) {
        const { container } = render(
            <MemoryRouter>{page.getControlTray(stream, url_trigger)}</MemoryRouter>
        );

        return container;
    }

    it('offers the query stats control only for the stockmarket stream', () => {
        //
        // the bottom sheet it opens shows candlestick triggers, which only that stream
        // produces. Every other row renders the tray without it rather than rendering a
        // control that opens an empty sheet.
        //
        const page = setup();

        expect(tray(page, 'StockMarket').querySelector('[data-testid="QueryStatsIcon"]')).toBeTruthy();
        expect(tray(page, 'BLS').querySelector('[data-testid="QueryStatsIcon"]')).toBeNull();
    });

    it('gives every stream a chart control and an alarm link', () => {
        const page = setup();
        const container = tray(page, 'BLS');

        expect(container.querySelector('[data-testid="BarChartIcon"]')).toBeTruthy();
        expect(container.querySelector('a[href="/stream/bls/alarm"]')).toBeTruthy();
    });

    it('routes the query stats control when asked for a url trigger', () => {
        //
        // the same control is a link on the trigger page and a sheet opener on the
        // listing, which is what 'url_trigger' selects between.
        //
        const page = setup();

        expect(tray(page, 'StockMarket', true).querySelector('a[href="/stream/stockmarket/trigger"]'))
            .toBeTruthy();
        expect(tray(page, 'StockMarket', false).querySelector('a[href="/stream/stockmarket/trigger"]'))
            .toBeNull();
    });

    it('opens the sheet when the listing variant is clicked', () => {
        const page = setup();
        const container = tray(page, 'StockMarket');

        expect(page.state.bottom_sheet_open).toBe(false);

        act(() => {
            container.querySelector('[data-testid="QueryStatsIcon"]').parentElement.click();
        });

        expect(page.state.bottom_sheet_open).toBe(true);
    });
});
