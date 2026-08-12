/**
 * viewer-timezone.js: the timezone the page renders in.
 *
 * the charts read in the viewer's own clock rather than the exchange's: a
 * reader in california sees 06:35, one in london 14:35, for the moment new
 * york calls 09:35. this is the single place that decision is made, since the
 * zone has to reach two places that must agree -- the api request (which
 * buckets and labels the report) and the axis (which renders the result).
 *
 * Note: this is NOT the zone of the market. the 09:30-16:00 window that picks
 *       the intraday rate is a fact about the exchange, not about the reader,
 *       and stays pinned to 'America/New_York' at its call sites
 *
 */


{/*

    the iana zone the browser is set to, e.g. 'America/Los_Angeles'. the api
    resolves the same names (pytz), so the one string serves both ends.

    Note: falls back to eastern rather than to utc -- when the zone cannot be
          read, the exchange's own clock is the more useful default for this
          data, and it is what the page rendered before it localized at all

*/}
export const FALLBACK_TIMEZONE = 'America/New_York';

export default function viewerTimeZone() {
    try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return zone ? zone : FALLBACK_TIMEZONE;

    } catch (e) {
        return FALLBACK_TIMEZONE;
    }
}
