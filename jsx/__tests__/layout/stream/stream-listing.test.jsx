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
        // 'usnationalweather' is scheduled 'rate(5 minutes)', which eventbridge counts
        // from whenever the rule was created rather than from the top of the hour, so
        // which MINUTE a run was due in is unknowable. A guessed alignment that happened
        // to be wrong would match no interval at all and report 0% for a stream behaving
        // exactly as scheduled, so the rate goes ungraded instead.
        //
        const page = setup();
        const rows = [row('usnationalweather', new Date(), 190)];

        expect(coverageOf(page, 'usnationalweather', 'minute', rows)).toBe('n/a');
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
