/**
 * sec.js: web-worker for data-distribution, for the filings and for the company
 *         facts, whose rows are the filings' shape (#211)
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

            {/*

                the filings, and the company facts, whose categories are each
                fact's status: 'new', 'repeated' or 'changed' (#211)

            */}

            if (['sec', 'sec-companyfacts'].includes(selected_stream)) {
                item['data-distribution'].forEach(v => {
                    if (
                        'total_records' in v
                        && checkValidInt(v.total_records)
                    ) {
                        total_records += parseInt(v.total_records);
                    }

                    {/*

                        aggregate on 'form' (x-axis) and stack/color by 'category'; a single
                        month often returns just one category, so keying the x-axis on category
                        collapsed every filing type into one tall stacked bar whose tooltip ran
                        off the bottom of the page. placing the varying 'form' on the x-axis
                        yields one readable bar per filing type with a compact tooltip

                    */}

                    if (
                        'form' in v
                        && checkValidString(v.form)
                        && 'category' in v
                        && checkValidString(v.category)
                        && 'total_records' in v
                        && checkValidInt(v.total_records)
                    ) {
                        {/*

                            prefix the bare edgar form type ('4', '8-K', '13F-HR') so
                            the axis reads as a form rather than a loose number

                        */}
                        const form_key = `Form ${trim(v.form)}`;
                        const category = trim(v.category);

                        {/*

                            a form's every category stacks onto its one row. It was
                            looked up by the form WITHOUT its prefix, which is never a
                            key, so a second category took the place of the first --
                            unseen while the filings had one category, 'Filings', and
                            not once the company facts gave a form a row per status

                        */}
                        const record = data_reformat[form_key] || {'form': form_key};
                        record[category] = (record[category] || 0) + parseInt(v.total_records);
                        data_reformat[form_key] = record;
                    } else {
                        console.log(`Error: sec-distribution ${JSON.stringify(v)} not correct format`);
                    }
                });

                const data_distribution = Object.assign(
                    [],
                    Object.keys(data_reformat).map(function(k) { return data_reformat[k]})
                );

                var detail = {
                    'aggregate_key': 'form',
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
