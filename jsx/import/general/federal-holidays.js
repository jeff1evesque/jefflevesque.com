/**
 * federal-holidays.js: which US federal holiday a day is, if it is one.
 *
 * EDGAR takes no filings on a federal holiday, so the sec stream brings nothing
 * that day, and that is the schedule working rather than a miss (#241). The
 * market can still be open, as on Columbus Day and Veterans Day, so the day is
 * not a weekday-only stream's weekend either: it needs a calendar of its own.
 *
 * Note: the same calendar the graph builder reads, in its
 *       'bin/federal_holidays.py' (pyg-knowledge-graph-builder #448). It is a
 *       copy, so a rule changed there has to be changed here too, and the two
 *       are tested against the same days.
 *
 * Note: the holidays are the eleven of 5 U.S.C. 6103(a), Juneteenth from 2021,
 *       the year it became one. One that falls on a Saturday is observed on the
 *       Friday before, and one on a Sunday on the Monday after, which is when
 *       federal offices close. The observed day is the holiday here, and the
 *       weekend day itself is not: offices are closed on it anyway. So a
 *       Saturday New Year's Day makes Friday Dec 31 of the year before a
 *       holiday, and the market trades that day.
 *
 * Note: not here: Inauguration Day, a holiday only around Washington (6103(c)).
 *       A one-off closing by executive order goes in 'EXTRA_CLOSED_DAYS' by hand,
 *       as the builder's 'PYG_EXTRA_CLOSED_DAYS' does.
 *
 */

const MONDAY = 1;
const THURSDAY = 4;
const SATURDAY = 6;
const SUNDAY = 0;

//
// month (1-12), day and name of the holidays on a fixed date
//
const FIXED = [
    [1, 1, 'New Year\'s Day'],
    [6, 19, 'Juneteenth National Independence Day'],
    [7, 4, 'Independence Day'],
    [11, 11, 'Veterans Day'],
    [12, 25, 'Christmas Day'],
];
const JUNETEENTH_FROM = 2021;

//
// month (1-12), weekday, which one (1 the first, -1 the last) and name of the
// holidays on a weekday of a month
//
const FLOATING = [
    [1, MONDAY, 3, 'Birthday of Martin Luther King, Jr.'],
    [2, MONDAY, 3, 'Washington\'s Birthday'],
    [5, MONDAY, -1, 'Memorial Day'],
    [9, MONDAY, 1, 'Labor Day'],
    [10, MONDAY, 2, 'Columbus Day'],
    [11, THURSDAY, 4, 'Thanksgiving Day'],
];

//
// one-off closings by executive order, 'YYYY-MM-DD': name. Added by hand when
// one is ordered
//
export const EXTRA_CLOSED_DAYS = {};

//
// a calendar day, kept in UTC so that no zone can move it
//
const utcDay = (year, month, day) => new Date(Date.UTC(year, month - 1, day));

const isoDay = (date) => date.toISOString().slice(0, 10);

const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

function nthWeekday(year, month, weekday, n) {
    if (n < 0) {
        const last = utcDay(year, month + 1, 0);
        return addDays(last, -((last.getUTCDay() - weekday + 7) % 7));
    }

    const first = utcDay(year, month, 1);
    return addDays(first, (weekday - first.getUTCDay() + 7) % 7 + 7 * (n - 1));
}

function observed(date) {
    if (date.getUTCDay() === SATURDAY) {
        return addDays(date, -1);
    }

    return date.getUTCDay() === SUNDAY ? addDays(date, 1) : date;
}

//
// { 'YYYY-MM-DD' offices close: name } for the year's holidays. A Saturday New
// Year's Day is closed for on Dec 31, so that day is among the next year's
//
export function holidays(year) {
    const out = {};

    FIXED.forEach(([month, day, name]) => {
        if (month === 6 && year < JUNETEENTH_FROM) {
            return;
        }

        const actual = utcDay(year, month, day);
        const closed = observed(actual);

        out[isoDay(closed)] = closed.getTime() === actual.getTime() ? name : `${name} (observed)`;
    });

    FLOATING.forEach(([month, weekday, n, name]) => {
        out[isoDay(nthWeekday(year, month, weekday, n))] = name;
    });

    return out;
}

//
// the federal holiday or closing a day is, written 'YYYY-MM-DD', or null
//
export function federalHoliday(day, extra = EXTRA_CLOSED_DAYS) {
    const year = parseInt(day.slice(0, 4), 10);

    return holidays(year)[day] || holidays(year + 1)[day] || extra[day] || null;
}
