/**
 * us-weather-alert.js: web-worker for data-distribution
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

            if (selected_stream === 'usnationalweather') {
                // Result intentionally discarded: the callback below populates
                // data_reformat by side effect, so the call must still run.
                item['data-distribution'].map(v => {
                    if (
                        'total_events' in v
                        && checkValidInt(v.total_events)
                    ) {
                        total_records += parseInt(v.total_events);
                    }

                    if (
                        'severity' in v
                        && trim(v.severity) in data_reformat
                        && checkValidString(v.severity)
                        && 'event' in v
                        && checkValidString(v.event)
                        && 'total_events' in v
                        && checkValidInt(v.total_events)
                    ) {
                        {/*

                            merge objects from array of objects having common 'severity' field

                              - https://stackoverflow.com/a/33850667
                              - https://stackoverflow.com/a/73835290

                        */}

                        let record = {'severity': trim(v.severity)};
                        record[trim(v.event)] = parseInt(v.total_events);
                        data_reformat[trim(v.severity)] = Object.assign(
                            data_reformat[trim(v.severity)],
                            record
                        );
                    } else if (
                        'severity' in v
                        && checkValidString(v.severity)
                        && 'event' in v
                        && checkValidString(v.event)
                        && 'total_events' in v
                        && checkValidInt(v.total_events)
                    ) {
                        let record = {'severity': trim(v.severity)};
                        record[trim(v.event)] = parseInt(v.total_events);
                        data_reformat[trim(v.severity)] = record;
                    } else {
                        console.log(`Error: stock-market-distribution ${JSON.stringify(v)} not correct format`);
                    }
                });

                const data_distribution = Object.assign(
                    [],
                    Object.keys(data_reformat).map(function(k) { return data_reformat[k]})
                );

                var detail = {
                    'aggregate_key': 'severity',
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
