/**
 * bls.js: web-worker for data-distribution
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

            if (selected_stream === 'bls') {
                // Result intentionally discarded: the callback below populates
                // data_reformat by side effect, so the call must still run.
                item['data-distribution'].map(v => {
                    if (
                        'total_records' in v
                        && checkValidInt(v.total_records)
                    ) {
                        total_records += parseInt(v.total_records);
                    }

                    {/*

                        aggregate on 'series' (x-axis) and stack/color by 'category'; a single
                        month often returns just one category, so keying the x-axis on category
                        collapsed the whole chart into one fat rainbow-striped bar. placing the
                        varying 'series' on the x-axis yields one readable bar per series instead

                    */}

                    if (
                        'series' in v
                        && trim(v.series) in data_reformat
                        && checkValidString(v.series)
                        && 'category' in v
                        && checkValidString(v.category)
                        && 'total_records' in v
                        && checkValidInt(v.total_records)
                    ) {
                        {/*

                            merge objects from array of objects having common 'series' field

                              - https://stackoverflow.com/a/33850667
                              - https://stackoverflow.com/a/73835290

                        */}

                        let record = {'series': trim(v.series)};
                        record[trim(v.category)] = parseInt(v.total_records);
                        data_reformat[trim(v.series)] = Object.assign(
                            data_reformat[trim(v.series)],
                            record
                        );
                    } else if (
                        'series' in v
                        && checkValidString(v.series)
                        && 'category' in v
                        && checkValidString(v.category)
                        && 'total_records' in v
                        && checkValidInt(v.total_records)
                    ) {
                        let record = {'series': trim(v.series)};
                        record[trim(v.category)] = parseInt(v.total_records);
                        data_reformat[trim(v.series)] = record;
                    } else {
                        console.log(`Error: bls-distribution ${JSON.stringify(v)} not correct format`);
                    }
                });

                const data_distribution = Object.assign(
                    [],
                    Object.keys(data_reformat).map(function(k) { return data_reformat[k]})
                );

                var detail = {
                    'aggregate_key': 'series',
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
