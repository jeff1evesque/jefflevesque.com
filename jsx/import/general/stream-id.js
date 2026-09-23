/**
 * stream-id.js: the one id each stream goes by on this site.
 *
 * A stream used to go by several names, and each page converted between them
 * itself: 'StockMarket' in the urls the site linked, 'stockmarket' in requests
 * to the performance api, 'stock-market' in the alarm page's own state and in
 * file names. Two of those conversions were wrong. The /stream page linked
 * '/stream/StockMarketStockSplit/trigger', which the trigger page matched
 * against 'stocksplit' and so drew nothing; and two alarm pages were labelled
 * with an id, 'stock-market' and 'us-national-weather', that the label lookup
 * did not know.
 *
 * So each stream has one id, and this module owns the list. The urls, the
 * requests, the per-stream state keys and the tables keyed by a stream all use
 * it, and nothing else has to convert anything.
 *
 * Note: every name a stream has gone by still leads to it -- see
 *       canonicalStream. A bookmark or a shared link keeps working, and is
 *       replaced with the url that uses the id; see route/canonical-stream.jsx.
 */

export const STOCK_MARKET = 'stock-market';
export const STOCK_SPLIT = 'stock-split';
export const BLS = 'bls';
export const SEC = 'sec';
export const US_NATIONAL_WEATHER = 'us-national-weather';

//
// in the order the /stream and /data listings draw them
//
export const STREAMS = [STOCK_MARKET, STOCK_SPLIT, BLS, SEC, US_NATIONAL_WEATHER];

//
// every name a stream has gone by, with its case and its hyphens taken off, and
// the id it names. Taking the hyphens off is what lets one entry answer for an
// id and for the name it replaced -- 'stock-market' and 'stockmarket' are one
// key here.
//
// Note: 'stocksplit' is here as well as 'stockmarketstocksplit'. The trigger
//       page matched on it, and a url carrying it is a url someone could hold.
//
// Note: a Map rather than an object, so that a name such as 'constructor' finds
//       nothing rather than something on Object.prototype.
//
const NAMES = new Map([
    ['stockmarket', STOCK_MARKET],
    ['stockmarketstocksplit', STOCK_SPLIT],
    ['stocksplit', STOCK_SPLIT],
    ['bls', BLS],
    ['sec', SEC],
    ['usnationalweather', US_NATIONAL_WEATHER],
]);

/**
 * the id a name refers to, or null when it refers to no stream.
 *
 * Takes the id itself, or any name the stream has gone by, in any casing:
 * 'StockMarket', 'stockmarket', 'StockMarketStockSplit', 'StockSplit',
 * 'USNationalWeather', 'BLS'.
 */
export function canonicalStream(name) {
    if (typeof name !== 'string') {
        return null;
    }

    return NAMES.get(name.toLowerCase().replace(/-/g, '')) || null;
}
