/**
 * data-records-label.test.jsx: the 'unpublished' qualifier on a zero count.
 *
 * BLS publishes a reading the period AFTER the one it measures, so its current
 * month holds no rows at all and the listing reads 'Records 0' against a table
 * holding 345,467. The 'Lag' row states the reason, but it sits beside the
 * number rather than on it, and 'RDF Available' further along the same row reads
 * as a live capability -- which invites taking the 0 as the stream being empty.
 *
 * The qualifier is gated twice, and the gates are what keep it honest:
 *
 *     the stream declares a lag     only bls does, so only bls has an excuse to
 *                                   offer for a zero
 *
 *     the month is inside it        a zero for 2024 is not 'unpublished', it is
 *                                   ABSENT -- a real hole in the datalake, which
 *                                   the qualifier would excuse
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import DataLayout, { recordsLabel, BLS_PUBLICATION_LAG_MONTHS } from '../../../import/layout/data/data.jsx';

const AUGUST_2026 = new Date(2026, 7, 15);   // month is 0-based: 7 = august

describe('the records label', () => {
    it('qualifies a zero on the current bls month', () => {
        //
        // the month the landing rule exists to step off. every one of the ten
        // feeds is unpublished here, so the count is 0 no matter how full the
        // table is.
        //
        expect(recordsLabel('BLS', 0, AUGUST_2026, AUGUST_2026)).toBe('0 (unpublished)');
    });

    it('qualifies a zero inside the lag window', () => {
        const july = new Date(2026, 6, 15);

        expect(recordsLabel('BLS', 0, july, AUGUST_2026)).toBe('0 (unpublished)');
    });

    it('leaves a zero outside the lag window unqualified', () => {
        //
        // march 2024 is not waiting on a release. a zero there means the rows
        // are not in the datalake, and calling that 'unpublished' would explain
        // away a genuine gap.
        //
        const march_2024 = new Date(2024, 2, 15);

        expect(recordsLabel('BLS', 0, march_2024, AUGUST_2026)).toBe('0');
    });

    it('measures the window across a year boundary', () => {
        //
        // the arithmetic carries the year rather than subtracting month numbers,
        // which underflows: january 2027 against november 2026 is 1 - 11 = -10
        // by month number alone, and 2 by the year term.
        //
        const november_2026 = new Date(2026, 10, 15);
        const january_2027 = new Date(2027, 0, 15);

        expect(BLS_PUBLICATION_LAG_MONTHS).toBe(2);
        expect(recordsLabel('BLS', 0, november_2026, january_2027)).toBe('0 (unpublished)');

        //
        // one month further back is outside the window, and would read as inside
        // it if the year term were dropped.
        //
        const october_2026 = new Date(2026, 9, 15);
        expect(recordsLabel('BLS', 0, october_2026, january_2027)).toBe('0');
    });

    it('leaves a stream that declares no lag alone', () => {
        //
        // stock-market produces a file every trading day, so a zero there is a
        // fact about the stream and not about a release calendar.
        //
        expect(recordsLabel('StockMarket', 0, AUGUST_2026, AUGUST_2026)).toBe('0');
        expect(recordsLabel('SEC', 0, AUGUST_2026, AUGUST_2026)).toBe('0');
    });

    it('formats a real count the way it always has', () => {
        expect(recordsLabel('BLS', 345467, AUGUST_2026, AUGUST_2026)).toBe('345,467');
    });

    it('passes n/a through rather than qualifying it', () => {
        //
        // the counts sit at 'n/a' until a query resolves. that is not zero, and a
        // pending query must not be reported as an unpublished month.
        //
        expect(recordsLabel('BLS', 'n/a', AUGUST_2026, AUGUST_2026)).toBe('n/a');
    });

    it('passes an empty count through rather than qualifying it', () => {
        //
        // Number('') and Number(null) are both 0, which is why these are tested
        // ahead of the numeric path. A stream that reported nothing must not
        // claim it measured an unpublished month.
        //
        expect(recordsLabel('BLS', '', AUGUST_2026, AUGUST_2026)).toBe('');
        expect(recordsLabel('BLS', null, AUGUST_2026, AUGUST_2026)).toBe(null);
        expect(recordsLabel('BLS', undefined, AUGUST_2026, AUGUST_2026)).toBe(undefined);
    });

    it('declines anything that is not a pair of dates', () => {
        expect(recordsLabel('BLS', 0, null, AUGUST_2026)).toBe('0');
        expect(recordsLabel('BLS', 0, AUGUST_2026, null)).toBe('0');
        expect(recordsLabel('BLS', 0, '2026-08-15', AUGUST_2026)).toBe('0');
    });
});

describe('the listing that renders it', () => {
    //
    // the wiring, not the rule: updateStreamListing has to reach the label with
    // the SELECTED date rather than formatting the count on its own. the
    // constructor seeds selected_date and now to the same day, so the row under
    // test is the current month whatever day the suite runs on.
    //
    function setup() {
        const held = React.createRef();

        render(
            <MemoryRouter>
                <DataLayout ref={held} />
            </MemoryRouter>
        );

        return held.current;
    }

    it('qualifies the bls row and leaves the others bare', () => {
        const page = setup();

        act(() => {
            page.setState({ records_bls: 0, records_sec: 0 });
        });
        act(() => {
            page.updateStreamListing();
        });

        const rows = page.state.list_article;
        expect(rows.find((row) => row.name === 'BLS').detail.Records).toBe('0 (unpublished)');
        expect(rows.find((row) => row.name === 'SEC').detail.Records).toBe('0');
    });

    it('leaves Partitions unqualified, so the row states it once', () => {
        //
        // partitions is zero for the same reason at the same time. saying it in
        // both fields reads as two findings rather than one.
        //
        const page = setup();

        act(() => {
            page.setState({ records_bls: 0, partitions_bls: 0 });
        });
        act(() => {
            page.updateStreamListing();
        });

        const bls = page.state.list_article.find((row) => row.name === 'BLS');
        expect(bls.detail.Records).toBe('0 (unpublished)');
        expect(bls.detail.Partitions).toBe('0');
    });
});
