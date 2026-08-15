/**
 * data-bls-landing.test.jsx: where the date lands when bls is selected.
 *
 * The listing defaults the date to today, which is right for stock-market --
 * that data exists today. BLS is the opposite: a reading is published the
 * period AFTER the one it measures, so no bls row is ever labelled with the
 * current month. The 12 Aug 2026 CPI release carries JULY numbers; the 4 Aug
 * JOLTS release carries JUNE. Landing on today therefore lands on the one
 * month guaranteed to be empty, and /data read 'Records 0' against a table
 * holding 345,467 rows.
 *
 * The offset is 2 rather than 1 because the lag is not uniform. Measured
 * against the stored 2026 objects:
 *
 *     july   4 of 10 feeds,  3,619 rows   cpi empsit ppi realer
 *     june   8 of 10 feeds, 11,882 rows   + jolts laus metro ximpim
 *
 * All of those are MONTHLY series -- the difference is how long after the month
 * ends bls publishes. cpi and ppi take about two weeks; jolts, laus, metro and
 * ximpim take about five. eci and wkyeng are quarterly and only land in
 * jan/apr/jul/oct, so no single month carries all ten outside a quarter start.
 */

import { blsLandingDate, BLS_PUBLICATION_LAG_MONTHS } from '../../../import/layout/data/data.jsx';

const AUGUST_2026 = new Date(2026, 7, 15);   // month is 0-based: 7 = august

describe('the bls landing date', () => {
    it('steps back off the current month', () => {
        const landed = blsLandingDate(AUGUST_2026, AUGUST_2026);

        expect(landed.getFullYear()).toBe(2026);
        expect(landed.getMonth()).toBe(5);   // june
    });

    it('lands two months back, not one', () => {
        /*
         * one month back is july, which only four of the ten feeds have
         * reached -- jolts, laus, metro and ximpim publish a further month in
         * arrears. two covers eight.
         */
        expect(BLS_PUBLICATION_LAG_MONTHS).toBe(2);
    });

    it('leaves a month the reader chose alone', () => {
        /*
         * the shift moves the landing point; it does not override the filter.
         * picking a month by hand has to survive selecting bls, or the date
         * picker would fight the stream buttons.
         */
        const march = new Date(2026, 2, 10);

        expect(blsLandingDate(march, AUGUST_2026)).toBeNull();
    });

    it('is idempotent', () => {
        /*
         * clicking bls twice must not walk four months back. the second call
         * is no longer on the current month, so it declines.
         */
        const first = blsLandingDate(AUGUST_2026, AUGUST_2026);

        expect(blsLandingDate(first, AUGUST_2026)).toBeNull();
    });

    it('carries the year back across january', () => {
        /*
         * the arithmetic goes through a Date rather than subtracting from the
         * month number, which would underflow to month -1 of the same year.
         * january 2026 minus two is november 2025.
         */
        const january = new Date(2026, 0, 20);
        const landed = blsLandingDate(january, january);

        expect(landed.getFullYear()).toBe(2025);
        expect(landed.getMonth()).toBe(10);   // november
    });

    it('declines anything that is not a pair of dates', () => {
        expect(blsLandingDate(null, AUGUST_2026)).toBeNull();
        expect(blsLandingDate(AUGUST_2026, null)).toBeNull();
        expect(blsLandingDate('2026-08-15', AUGUST_2026)).toBeNull();
    });
});
