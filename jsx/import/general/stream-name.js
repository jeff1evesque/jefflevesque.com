/**
 * stream-name.js: map a stream id to the label shown to a visitor.
 *
 * The id is load-bearing well beyond the label: it is the path of the alarm and
 * trigger pages, the '?item=' deep link, the 'Stream' sent to the performance
 * api, the suffix of every per-stream state key ('records_stock-market',
 * 'data_distribution_stock-market_bar', ...), and the name of the active listing
 * row. So the id stays as it is and only the rendered label is swapped here. The
 * ids themselves are stream-id.js's.
 *
 * Two streams carry the S&P 500, so each label says which one it is (#314).
 * 'stock-market' is the 20-minute run, and is labeled for the option chains that
 * are its main product, though it quotes the stocks too. 'stock-tickers' is the
 * poll that quotes the stocks every minute of the trading day. Both cover the
 * S&P 500, and their 'Coverage' says so.
 *
 * 'stock-split' is labeled for what it is rather than given the index name:
 * split detection runs against the entire market, not the index (a July sample
 * is 27 tickers -- abtc, snal, srxh, hkit -- with no index member among them).
 * Labeled after the stream next to it, it would read as 'the split feed for the
 * S&P 500', and imply a scope the data does not have. The listing carries a
 * 'Coverage' detail so the two streams state their universe side by side rather
 * than leaving it to the title.
 */

import {
    STOCK_MARKET,
    STOCK_TICKERS,
    STOCK_SPLIT,
    BLS,
    SEC,
    SEC_COMPANYFACTS,
    US_NATIONAL_WEATHER,
    canonicalStream,
} from './stream-id.js';

const STREAM_LABELS = {
    [STOCK_MARKET]: 'S&P 500 Options',
    [STOCK_TICKERS]: 'S&P 500 Tickers',
    [STOCK_SPLIT]: 'Stock Splits',
    [US_NATIONAL_WEATHER]: 'US Weather Alerts',
    [BLS]: 'Bureau of Labor Statistics',
    [SEC]: 'SEC Filings',
    [SEC_COMPANYFACTS]: 'SEC Company Facts'
};

{/*

    looked up by the stream's id, so any name the stream has gone by finds its
    label -- a bookmark's 'StockMarket' as well as 'stock-market'. matching is
    on the WHOLE name rather than a prefix, so the two stock streams stay
    independently named: 'stock-split' used to be 'stockmarketstocksplit', which
    is not a 'stockmarket' that picked up a suffix

*/}
export default function streamName(name) {
    if (typeof name !== 'string') {
        return name;
    }

    return STREAM_LABELS[canonicalStream(name)] || name;
}

{/*

    the universe a stream covers, for streams where the title alone would leave
    it ambiguous. only the stock streams qualify: they sit adjacent in the
    listing, and the split feed differs from the two S&P 500 streams precisely
    in scope. a stream absent from this map renders no 'Coverage' row rather
    than an empty one

*/}
const STREAM_COVERAGE = {
    [STOCK_MARKET]: 'S&P 500',
    [STOCK_TICKERS]: 'S&P 500',
    [STOCK_SPLIT]: 'Market-wide'
};

export function streamCoverage(name) {
    if (typeof name !== 'string') {
        return null;
    }

    return STREAM_COVERAGE[canonicalStream(name)] || null;
}
