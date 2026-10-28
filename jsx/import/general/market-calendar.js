/**
 * market-calendar.js: the days the stock market is closed, and the days it
 * closes early.
 *
 * The minute stock poll checks each minute against the NYSE's calendar before
 * it quotes anything (#314): a holiday has no polls, and an early-close day
 * none from 13:00 Eastern, its 16:00 closing poll included. So the stock
 * tickers stream's schedule needs the same days to say which minutes were due.
 *
 * Note: a COPY of the poll's calendar, lambda-api-scraper's
 *       'lambda/shared/market_hours.py'. Its holidays come from
 *       pandas_market_calendars' NYSE calendar and are listed here as that
 *       calendar answers them; its early closes are its own list, restated
 *       as it is. Both run from 2026, the year the poll began, to 2027, the
 *       last year the poll's early closes reach. The poll extends its list a
 *       year at a time, and a year added there has to be added here too: a
 *       year missing from both reads as a year with every weekday due.
 *
 * Note: not federal-holidays.js. The market trades on Columbus Day and
 *       Veterans Day, and closes on Good Friday, which is no federal holiday.
 *
 */

//
// the weekdays the NYSE is closed, 'YYYY-MM-DD': name. The observed day, where
// a holiday falls on a weekend
//
const HOLIDAYS = {
    '2026-01-01': 'New Year\'s Day',
    '2026-01-19': 'Martin Luther King, Jr. Day',
    '2026-02-16': 'Washington\'s Birthday',
    '2026-04-03': 'Good Friday',
    '2026-05-25': 'Memorial Day',
    '2026-06-19': 'Juneteenth',
    '2026-07-03': 'Independence Day',
    '2026-09-07': 'Labor Day',
    '2026-11-26': 'Thanksgiving Day',
    '2026-12-25': 'Christmas Day',
    '2027-01-01': 'New Year\'s Day',
    '2027-01-18': 'Martin Luther King, Jr. Day',
    '2027-02-15': 'Washington\'s Birthday',
    '2027-03-26': 'Good Friday',
    '2027-05-31': 'Memorial Day',
    '2027-06-18': 'Juneteenth',
    '2027-07-05': 'Independence Day',
    '2027-09-06': 'Labor Day',
    '2027-11-25': 'Thanksgiving Day',
    '2027-12-24': 'Christmas Day',
};

//
// the days the session ends at 13:00 Eastern rather than 16:00
//
const EARLY_CLOSES = new Set([
    '2026-07-02',
    '2026-11-27',
    '2026-12-24',
    '2027-07-02',
    '2027-11-26',
    '2027-12-23',
]);

//
// when an early-close day's session ends, as [hour, minute] Eastern
//
export const EARLY_CLOSE = [13, 0];

/**
 * the market holiday a day is, by name, or null when the market opens: for a
 * 'YYYY-MM-DD' day on the Eastern calendar.
 */
export function marketHoliday(day) {
    return Object.prototype.hasOwnProperty.call(HOLIDAYS, day) ? HOLIDAYS[day] : null;
}

/**
 * whether the market closes early on a 'YYYY-MM-DD' day, at EARLY_CLOSE.
 */
export function earlyClose(day) {
    return EARLY_CLOSES.has(day);
}
