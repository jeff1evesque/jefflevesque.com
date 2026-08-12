/**
 * stream-name.js: map a stream identifier to the label shown to a visitor.
 *
 * The stream id is load-bearing well beyond the label: it is the 'Data' param
 * sent to api-datalake ('stock-market'), the suffix of every per-stream state
 * key ('records_stockmarket', 'data_distribution_stockmarket_bar', ...), the
 * '?item=' deep link, and the css class on the active listing row. So the id
 * stays as it is and only the rendered label is swapped here.
 *
 * 'StockMarket' names the whole market but carries only the S&P 500, which the
 * label now says.
 *
 * 'StockMarketStockSplit' is renamed rather than given the index name: split
 * detection runs against the entire market, not the index (a July sample is 27
 * tickers -- abtc, snal, srxh, hkit -- with no index member among them). Left
 * as-is it would read as 'the split feed for the stream next to it', which is
 * now labelled SP500, and imply a scope the data does not have. The listing
 * carries a 'Coverage' detail so the two streams state their universe side by
 * side rather than leaving it to the title.
 */

const STREAM_LABELS = {
    'stockmarket': 'S&P 500',
    'stockmarketstocksplit': 'Stock Splits',
    'usnationalweather': 'US Weather Alerts',
    'bls': 'Bureau of Labor Statistics',
    'sec': 'SEC Filings'
};

{/*

    the lookup is case-insensitive because the id reaches a label in both
    casings: the listing rows carry 'StockMarket' while the stream chart title
    is handed the lower-cased 'selected_stream'. matching is on the WHOLE id
    rather than a prefix, so the two stock streams stay independently named --
    'stockmarketstocksplit' is not a 'stockmarket' that picked up a suffix

*/}
export default function streamName(name) {
    if (typeof name !== 'string') {
        return name;
    }

    return STREAM_LABELS[name.toLowerCase()] || name;
}

{/*

    the universe a stream covers, for streams where the title alone would leave
    it ambiguous. only the two stock streams qualify: they sit adjacent in the
    listing and differ precisely in scope. a stream absent from this map renders
    no 'Coverage' row rather than an empty one

*/}
const STREAM_COVERAGE = {
    'stockmarket': 'S&P 500',
    'stockmarketstocksplit': 'Market-wide'
};

export function streamCoverage(name) {
    if (typeof name !== 'string') {
        return null;
    }

    return STREAM_COVERAGE[name.toLowerCase()] || null;
}
