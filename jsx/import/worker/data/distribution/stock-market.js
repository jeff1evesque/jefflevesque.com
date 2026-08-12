/**
 * stock-market.js: web-worker for data-distribution
 *
 */

export default () => {
    self.onmessage = (event) => {
        const {
            item,
            stringifiedTrim,
            stringifiedCheckValidInt,
            stringifiedCheckValidObject,
            stringifiedCheckValidArray,
            stringifiedCheckValidString
        } = event.data;

        {/*

            web-worker cannot accept functions as postMessage arguments:

              - https://stackoverflow.com/a/47804656

        */}

        const trim = new Function(`return ${stringifiedTrim}`)();
        const checkValidInt = new Function(`return ${stringifiedCheckValidInt}`)();
        const checkValidObject = new Function(`return ${stringifiedCheckValidObject}`)();
        const checkValidArray = new Function(`return ${stringifiedCheckValidArray}`)();
        const checkValidString = new Function(`return ${stringifiedCheckValidString}`)();

        if (
            checkValidObject('data-distribution', item)
            && Array.isArray(item['data-distribution'])
        ) {
            var total_records = 0;
            var data_reformat = {};
            const selected_stream = 'stream' in item && item.stream ? item.stream : null;
            const selected_source = 'source' in item && item.source ? item.source : null;

            if (['stockmarket', 'stockmarketstocksplit'].includes(selected_stream)) {
                // Result intentionally discarded: the callback below populates
                // data_reformat by side effect, so the call must still run.
                item['data-distribution'].map(v => {

                    {/*

                        the bars and the 'Records' figure in the listing come from
                        this one response for one month, so they have to be the same
                        measure: stacking 'total_tickers' put a handful of tickers per
                        industry under a header reporting tens of millions of rows.
                        both sides count total_records now, so the stack sums to the
                        listing. 'total_tickers' stays summed only for stock-split,
                        where a split IS a ticker and the two columns coincide

                    */}
                    if (
                        selected_stream === 'stockmarket'
                        && 'total_records' in v
                        && checkValidInt(v.total_records)
                    ) {
                        total_records += parseInt(v.total_records);
                    } else if (
                        selected_stream === 'stockmarketstocksplit'
                        && 'total_tickers' in v
                        && checkValidInt(v.total_tickers)
                    ) {
                        total_records += parseInt(v.total_tickers)
                    }

                    {/*

                        stock-split carries no sector or industry: the listings
                        they were merged against are large-cap while splits are
                        overwhelmingly micro-cap, so api-datalake stopped
                        returning both columns and now returns one row per
                        split_date with the tickers that split on it. the day is
                        already the x-axis value, so a single fixed series name
                        keeps one colour per chart, and the tickers ride along on
                        the record for the tooltip to read

                    */}
                    if (
                        selected_stream === 'stockmarketstocksplit'
                        && 'split_date' in v
                        && checkValidString(v.split_date)
                        && 'total_tickers' in v
                        && checkValidInt(v.total_tickers)
                    ) {
                        const split_key = `Day ${trim(v.split_date)}`;
                        let record = {'sector': split_key};
                        record['splits'] = parseInt(v.total_tickers);

                        if ('tickers' in v && checkValidString(v.tickers)) {
                            record['tickers'] = trim(v.tickers);
                        }

                        data_reformat[split_key] = record;
                    } else if (
                        selected_stream === 'stockmarket'
                        && 'sector' in v
                        && trim(v.sector) in data_reformat
                        && checkValidString(v.sector)
                        && 'industry' in v
                        && checkValidString(v.industry)
                        && 'total_records' in v
                        && checkValidInt(v.total_records)
                    ) {
                        {/*

                            merge objects from array of objects having common 'sector' field

                              - https://stackoverflow.com/a/33850667
                              - https://stackoverflow.com/a/73835290

                        */}

                        let record = {'sector': trim(v.sector)};
                        record[trim(v.industry)] = parseInt(v.total_records);
                        data_reformat[trim(v.sector)] = Object.assign(
                            data_reformat[trim(v.sector)],
                            record
                        );
                    } else if (
                        selected_stream === 'stockmarket'
                        && 'sector' in v
                        && checkValidString(v.sector)
                        && 'industry' in v
                        && checkValidString(v.industry)
                        && 'total_records' in v
                        && checkValidInt(v.total_records)
                    ) {
                        let record = {'sector': trim(v.sector)};
                        record[trim(v.industry)] = parseInt(v.total_records);
                        data_reformat[trim(v.sector)] = record;
                    } else {
                        console.log(`Error: stock-market-distribution ${JSON.stringify(v)} not correct format`);
                    }
                });

                {/*

                    order is not established here: data.jsx sorts the bars by label
                    with numeric collation before rendering, so any ordering applied
                    to these keys is discarded

                */}
                const data_distribution = Object.assign(
                    [],
                    Object.keys(data_reformat).map(function(k) { return data_reformat[k]})
                );

                var detail = {
                    'aggregate_key': 'sector',
                    'records': total_records,
                    'data_distribution': data_distribution,
                    'selected_source': selected_source,
                    'selected_stream': selected_stream
                };
            } else {
                console.log(`Error (postMessage): selected_stream=${selected_stream} NOT valid`);
                var detail = null;
            }

            self.postMessage(detail);
        }

        if (
            checkValidObject('partition', item)
            && checkValidArray(item.partition)
            && item.partition.length > 0
        ) {
            const count = item.partition.reduce(function(previous, current) {
                return previous + (Number(current.count) || 0);
            }, 0);

            const selected_stream = 'stream' in item && item.stream ? item.stream : null;
            self.postMessage({'count': count, 'selected_stream': selected_stream});
        }
    };
}
