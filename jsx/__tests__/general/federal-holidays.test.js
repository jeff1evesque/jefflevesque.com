/**
 * federal-holidays.test.js: which US federal holiday a day is, if it is one.
 *
 * The sec stream is due on no federal holiday (#241), so a wrong "yes" hides a
 * day its filings really went missing, and a wrong "no" draws a holiday as a
 * miss, the way Columbus Day 2026 was drawn.
 *
 * Note: the same days the graph builder's calendar is pinned against, in its
 *       'tests/test_federal_holidays.py', so the two copies cannot drift apart
 *       unnoticed. Each rule is pinned where it can go wrong: a month with five
 *       of the weekday, a holiday on a weekend, and a Saturday New Year's Day
 *       observed in the year before.
 */

import { federalHoliday, holidays } from '../../import/general/federal-holidays.js';

describe('federalHoliday', () => {
    it('names the days the market trades and the SEC is closed', () => {
        expect(federalHoliday('2026-10-12')).toBe('Columbus Day');
        expect(federalHoliday('2026-11-11')).toBe('Veterans Day');
    });

    it('observes a Saturday New Year\'s Day on the Friday before, in the year before', () => {
        expect(federalHoliday('2027-12-31')).toBe('New Year\'s Day (observed)');
        expect(federalHoliday('2028-01-01')).toBeNull();
    });

    it('is not the day after, a Saturday, or a Saturday holiday', () => {
        expect(federalHoliday('2026-10-13')).toBeNull();
        expect(federalHoliday('2026-10-10')).toBeNull();
        expect(federalHoliday('2026-07-04')).toBeNull();
    });

    it('moves a Saturday holiday to the Friday before', () => {
        expect(federalHoliday('2026-07-03')).toBe('Independence Day (observed)');
    });

    it('moves a Sunday holiday to the Monday after', () => {
        expect(federalHoliday('2027-07-04')).toBeNull();
        expect(federalHoliday('2027-07-05')).toBe('Independence Day (observed)');
    });

    it('keeps Thanksgiving on the fourth Thursday, not the last', () => {
        expect(federalHoliday('2029-11-22')).toBe('Thanksgiving Day');
        expect(federalHoliday('2029-11-29')).toBeNull();
    });

    it('keeps Memorial Day on the last Monday of May', () => {
        expect(federalHoliday('2028-05-29')).toBe('Memorial Day');
        expect(federalHoliday('2028-05-22')).toBeNull();
    });

    it('counts Juneteenth from 2021', () => {
        expect(federalHoliday('2021-06-18')).toBe('Juneteenth National Independence Day (observed)');
        expect(federalHoliday('2020-06-19')).toBeNull();
    });

    it('counts a one-off closing by executive order as a holiday', () => {
        const extra = { '2026-12-24': 'Closed by executive order' };

        expect(federalHoliday('2026-12-24', extra)).toBe('Closed by executive order');
        expect(federalHoliday('2026-12-24')).toBeNull();
    });
});

describe('holidays', () => {
    it('puts each of a year\'s eleven holidays on a day of its own', () => {
        for (let year = 2021; year < 2041; year++) {
            expect(Object.keys(holidays(year))).toHaveLength(11);
        }
    });
});
