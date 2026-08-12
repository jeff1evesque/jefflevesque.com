/**
 * performance.js: web-worker for ingest performance stream data
 *
 */

export default () => {
    self.onmessage = (event) => {
        const {
            item,
            field_datetime,
            throughput_key,
            stringifiedTrim,
            stringifiedCheckValidInt,
            stringifiedCheckValidObject,
            stringifiedCheckValidArray,
            stringifiedCheckValidString
        } = event.data;

        // Declared here because both arms of the if/else below assign to it,
        // and self.postMessage() reads it afterwards. It previously had no
        // declaration anywhere: this module is bundled as an ES module, so the
        // bare `result = {...}` was an assignment to an undeclared binding,
        // which throws a ReferenceError under strict mode rather than
        // implicitly creating a global.
        let result;

        {/*

            web-worker cannot accept functions as postMessage arguments:

              - https://stackoverflow.com/a/47804656

        */}

        {/*

            'group_by' arrives already named: api-stream-performance maps the
            upstream host a scraper hit to the stream's name before it reports.
            this used to hold that table itself, one repo away from the thing
            that changes it -- when SEC moved to the generic scraper its
            group_by went from 'sec' to 'efts.sec.gov', nothing here knew the
            new value, and the legend printed the hostname while a window
            spanning the change split into two series

        */}

        const trim = new Function(`return ${stringifiedTrim}`)();
        const checkValidInt = new Function(`return ${stringifiedCheckValidInt}`)();
        const checkValidObject = new Function(`return ${stringifiedCheckValidObject}`)();
        const checkValidArray = new Function(`return ${stringifiedCheckValidArray}`)();
        const checkValidString = new Function(`return ${stringifiedCheckValidString}`)();

        if (
            checkValidObject('data', item)
            && checkValidArray(item.data)
        ) {
            var stream_throughput = [];

            const data = item.data.map(v => {
                const row_success = checkValidObject('total_success', v) && checkValidInt(v.total_success)
                    ? parseInt(v.total_success) : 0;

                const row_fail = checkValidObject('total_fail', v) && checkValidInt(v.total_fail)
                    ? parseInt(v.total_fail) : 0;

                if (
                    checkValidObject('total_success', v)
                    && checkValidInt(v.total_success)
                    && checkValidObject('total_fail', v)
                    && checkValidInt(v.total_fail)
                ) {
                    stream_throughput.push(row_success + row_fail);
                }

                {/*

                    the report stamps every row with its utc offset, so the
                    string parses straight to the instant it names and needs no
                    correction. it used to be re-read through a new york
                    'toLocaleString', which produced a Date holding eastern
                    wall-clock in the LOCAL zone's slot -- not the instant, and
                    three hours off it in california. the axis then rendered
                    eastern everywhere, because that shift and d3's local
                    formatting cancelled out

                */}

                v[field_datetime] = new Date(v[field_datetime]);
                const group_by = trim(v.group_by.toLowerCase());
                const source = group_by;
                v[source] = checkValidString(v.total_success) ? parseInt(v.total_success) : 0;

                {/*

                    the row's own throughput, kept beside its series rather than
                    returned as one figure for the whole report: the listing's
                    health has to describe the same rows the chart is showing,
                    and a scalar cannot be narrowed to a date window after the
                    fact

                */}

                v[`${source}${throughput_key}`] = row_success + row_fail;
                delete v.group_by;
                delete v.total_success;
                delete v.total_fail;
                delete v.window_every;
                return v;
            }).filter(i => {
                if (checkValidObject(field_datetime, i) && !isNaN(i[field_datetime])) { return i; }
            });

            {/*

                merge objects from array of objects having common 'window_start' field

                  - https://stackoverflow.com/a/33850667
                  - https://stackoverflow.com/a/73835290

            */}

            const data_filtered_success = [];
            data.forEach((item) => {
                const existing = data_filtered_success.filter((v, i) => {
                    return v[field_datetime].valueOf() == item[field_datetime].valueOf();
                });

                if (existing.length > 0) {
                    const index = data_filtered_success.indexOf(existing[0]);
                    data_filtered_success[index] = Object.assign(data_filtered_success[index], item);
                } else {
                    data_filtered_success.push(item);
                }
            });

            data_filtered_success.forEach((item, i) => {
                // `const` added: the loop variable was undeclared, which is a
                // ReferenceError under strict mode.
                for (const source in item.source) {
                    item[source] = item[source] || 0
                }
            });

            let chart_data = Object.values(data_filtered_success);

            // Seeded with 0. 'stream_throughput' only gains an entry for a row
            // carrying BOTH total_success and total_fail, so a report whose rows
            // are all missing a figure leaves it empty -- and reduce with no
            // initial value throws TypeError on an empty array rather than
            // returning 0. Inside a real Worker that surfaced as a chart that
            // never populated, with no error the page could see.
            const stream_throughput_reduced = stream_throughput.reduce((a, b) => a + b, 0);
            result = {
                chart_data_original: chart_data,
                stream_throughput: stream_throughput_reduced
            };
            if ('source' in item && item.source) {
                result[`chart_data_${item.source}`] = chart_data;
                result[`stream_throughput_${item.source}`] = stream_throughput_reduced;
                result['selected_source'] = item.source;
            }
            if ('stream' in item && item.stream) {
                result['selected_stream'] = item.stream;
            }
        } else {
            result = {
                chart_data_original: [],
                stream_throughput: 0,
                selected_source: null,
                selected_stream: null
            };
        }
        self.postMessage(result);
    };
}
