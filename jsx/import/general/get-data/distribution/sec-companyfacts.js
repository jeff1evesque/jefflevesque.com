/**
 * sec-companyfacts.js: the company facts' distribution for a month (#211), or
 * sample data in its place on localhost.
 *
 * The XBRL numbers the S&P 500 companies filed, counted by status and form. The
 * rows are the filings' shape, 'category,form,total_records', with each fact's
 * status as its category -- 'new', 'repeated' or 'changed' -- so they are fetched
 * and read by the filings' own loader. See readSecDistribution in sec.js.
 */

import { readSecDistribution } from './sec.js';

function get(type, url, callback, worker, source, stream) {
    if (type === 'data-distribution') {
        if (url) {
            return readSecDistribution(url, callback, source, stream);
        }

        {/*

            a real month, August 2026, as the datalake answered it: 97,343 facts
            filed on 21 days, each form a row per status it holds

        */}
        const csv_data_distribution = `category,form,total_records
            changed,10-Q,1286
            new,424B2,391
            new,S-4,20
            repeated,DEF 14A,44
            changed,DEF 14A,15
            repeated,PRE 14A,4
            repeated,424B8,6
            new,424B7,6
            repeated,10-Q,37190
            new,424B5,119
            repeated,10-K,6949
            changed,424B2,1876
            new,S-8,44
            changed,PRE 14A,6
            new,DEF 14A,131
            new,8-K,2
            changed,424B3,8
            new,PREM14A,5
            repeated,424B2,372
            changed,10-K,170
            new,2.01 SD,9
            new,10-Q,41970
            new,S-3ASR,65
            new,10-K,6563
            new,PRE 14A,70
            new,424B3,6
            changed,424B8,12
            repeated,424B3,4
        `;

        const csv_count = `count\n21`;

        return readSecDistribution({
            'data-distribution': csv_data_distribution,
            'count': csv_count
        }, callback, source, stream);
    }

    console.log(`Error: ${type} not a valid choice.`);
}

export default function getDataDistribution(type, url=null, callback=()=>{}, worker=false, source=null, stream=null) {
    return get(type, url, callback, worker, source, stream);
}
