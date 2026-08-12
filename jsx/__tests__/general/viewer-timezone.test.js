/**
 * viewer-timezone.test.js: the timezone the page renders in.
 *
 * This single value reaches two places that must agree -- the api request, which
 * buckets and labels the report, and the axis, which renders the result. If they
 * disagree the chart is silently shifted rather than broken, so the fallback path
 * matters as much as the happy one.
 *
 * Note: this is NOT the market's zone. The 09:30-16:00 window that picks the
 *       intraday rate is a fact about the exchange and stays pinned at its call
 *       sites; that separation is asserted here so the two are not conflated.
 */

import viewerTimeZone, { FALLBACK_TIMEZONE } from '../../import/general/viewer-timezone.js';

const realDateTimeFormat = Intl.DateTimeFormat;

afterEach(() => {
    Intl.DateTimeFormat = realDateTimeFormat;
});

describe('viewerTimeZone', () => {
    it('returns the zone the browser reports', () => {
        Intl.DateTimeFormat = () => ({
            resolvedOptions: () => ({ timeZone: 'America/Los_Angeles' }),
        });

        expect(viewerTimeZone()).toBe('America/Los_Angeles');
    });

    it('returns an iana name, which the api can also resolve', () => {
        //
        // the same string serves both ends: pytz on the api resolves iana names,
        // so a zone abbreviation or an offset would break the request.
        //
        expect(viewerTimeZone()).toMatch(/^[A-Za-z]+\/[A-Za-z_+-]+/);
    });

    it('falls back when the zone reads as empty', () => {
        Intl.DateTimeFormat = () => ({
            resolvedOptions: () => ({ timeZone: '' }),
        });

        expect(viewerTimeZone()).toBe(FALLBACK_TIMEZONE);
    });

    it('falls back when the zone is missing entirely', () => {
        Intl.DateTimeFormat = () => ({
            resolvedOptions: () => ({}),
        });

        expect(viewerTimeZone()).toBe(FALLBACK_TIMEZONE);
    });

    it('falls back when reading the zone throws', () => {
        Intl.DateTimeFormat = () => {
            throw new Error('Intl unavailable');
        };

        expect(viewerTimeZone()).toBe(FALLBACK_TIMEZONE);
    });

    it('never returns a falsy value', () => {
        //
        // the return value is interpolated into a request param; an empty string
        // would produce a request the api reads as "no timezone" rather than an
        // error anyone notices.
        //
        Intl.DateTimeFormat = () => ({ resolvedOptions: () => ({ timeZone: null }) });

        expect(viewerTimeZone()).toBeTruthy();
    });
});

describe('FALLBACK_TIMEZONE', () => {
    it('is eastern, not utc', () => {
        //
        // deliberate: when the zone cannot be read, the exchange's own clock is
        // the more useful default for this data, and it is what the page rendered
        // before it localized at all.
        //
        expect(FALLBACK_TIMEZONE).toBe('America/New_York');
    });
});
