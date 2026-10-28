/**
 * market-calendar.test.js: the days the market is closed, and the days it closes
 * early -- the minute stock poll's calendar, restated (#314).
 *
 * The lists are a copy of lambda-api-scraper's 'lambda/shared/market_hours.py',
 * so what is held here is that they say what that calendar says for 2026 and
 * 2027, and that the market's days are not the federal ones.
 */

import { EARLY_CLOSE, earlyClose, marketHoliday } from '../../import/general/market-calendar.js';
import { federalHoliday } from '../../import/general/federal-holidays.js';

describe('marketHoliday', () => {
    it.each([
        ['2026-01-01', 'New Year\'s Day'],
        ['2026-04-03', 'Good Friday'],
        ['2026-07-03', 'Independence Day'],
        ['2026-11-26', 'Thanksgiving Day'],
        ['2026-12-25', 'Christmas Day'],
        ['2027-03-26', 'Good Friday'],
        ['2027-06-18', 'Juneteenth'],
        ['2027-07-05', 'Independence Day'],
        ['2027-12-24', 'Christmas Day'],
    ])('names %s %s', (day, name) => {
        expect(marketHoliday(day)).toBe(name);
    });

    it('holds the ten closings of each year, as the calendar answers them', () => {
        const days = (year) => Array.from({ length: 366 }, (unused, i) => new Date(Date.UTC(year, 0, 1 + i)))
            .filter((date) => date.getUTCFullYear() === year)
            .map((date) => date.toISOString().slice(0, 10))
            .filter((day) => marketHoliday(day));

        expect(days(2026)).toHaveLength(10);
        expect(days(2027)).toHaveLength(10);
    });

    it('trades on the federal holidays the market keeps open', () => {
        //
        // Columbus Day and Veterans Day close EDGAR, not the market
        //
        expect(federalHoliday('2026-10-12')).not.toBeNull();
        expect(marketHoliday('2026-10-12')).toBeNull();
        expect(marketHoliday('2026-11-11')).toBeNull();
    });

    it('names no day that is not a holiday, nor anything on an object', () => {
        expect(marketHoliday('2026-11-27')).toBeNull();
        expect(marketHoliday('constructor')).toBeNull();
        expect(marketHoliday('')).toBeNull();
    });
});

describe('earlyClose', () => {
    it.each(['2026-07-02', '2026-11-27', '2026-12-24', '2027-07-02', '2027-11-26', '2027-12-23'])(
        'closes early on %s',
        (day) => {
            expect(earlyClose(day)).toBe(true);
        }
    );

    it('closes at 13:00 eastern', () => {
        expect(EARLY_CLOSE).toEqual([13, 0]);
    });

    it('closes on time any other day, a holiday included', () => {
        expect(earlyClose('2026-11-26')).toBe(false);
        expect(earlyClose('2026-11-30')).toBe(false);
    });
});
