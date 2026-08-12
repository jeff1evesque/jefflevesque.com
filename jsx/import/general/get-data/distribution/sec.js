/**
 * sec.jsx: conditionally get csv data or load test data.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import { readString } from 'react-papaparse';

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (err) {
        return false;
    }
}

function get_promise(url, callback, source=null, stream=null) {
    if (isValidUrl(url)) {
        return fetch(url, {method: 'GET'})
            .then((response) => {
                if (response.ok) {
                    return response.json();
                }
                return Promise.reject(response);
            })
            .then((json) => {
                if ('report' in json) {
                    if (
                        'data-distribution' in json.report
                        && 'partition' in json.report
                    ) {
                        const promise_distribution = readString(json.report['data-distribution'], {
                            download: false,
                            header: true,
                            skipEmptyLines: 'greedy',
                            complete: (results) => {
                                if ('data' in results && results.data) {
                                    callback({
                                        'data-distribution': results.data,
                                        source: source,
                                        stream: stream
                                    });
                                } else {
                                    callback({ 'data-distribution': null, source: source, stream: stream });
                                }
                            }
                        });

                        const promise_count = readString(json.report.partition, {
                            download: false,
                            header: true,
                            skipEmptyLines: 'greedy',
                            complete: (results) => {
                                if ('data' in results && results.data) {
                                    callback({ partition: results.data, source: source, stream: stream });
                                } else {
                                    callback({ partition: null, source: source, stream: stream });
                                }
                            }
                        });

                        return Promise.all([promise_distribution, promise_count]).then((v) => {
                            return {'data-distribution': v[0], 'partition': v[1]};
                        });
                    }
                }
                return Promise.reject(json);
            })
            .catch((e) => {
                if (typeof e === 'object') {
                    console.log(`Error: url=${url} returned ${JSON.stringify(e)}`);
                } else {
                    console.log(`Error: url=${url} returned ${e}`);
                }
            });
    } else {
        const promise_distribution = readString(url['data-distribution'], {
            download: false,
            header: true,
            skipEmptyLines: 'greedy',
            complete: (results) => {
                if ('data' in results && results.data) {
                    callback({
                        'data-distribution': results.data,
                        source: source,
                        stream: stream
                    });
                } else {
                    callback({ 'data-distribution': null, source: source, stream: stream });
                }
            }
        });

        const promise_count = readString(url['count'], {
            download: false,
            header: true,
            skipEmptyLines: 'greedy',
            complete: (results) => {
                if ('data' in results && results.data) {
                    callback({ partition: results.data, source: source, stream: stream });
                } else {
                    callback({ partition: null, source: source, stream: stream });
                }
            }
        });

        return Promise.all([promise_distribution, promise_count]).then((v) => {
            return {'data-distribution': v[0], 'partition': v[1]};
        });
    }
}

function get(type, url, callback=()=>{}, worker=false, source=null, stream=null) {

    if (type === 'data-distribution') {
        if (url) {
            return get_promise(url, callback, source, stream);
        } else {
            {/*

                production sec rows carry a constant category ('Filings') and derive 'form'
                from the leading token of the edgar title, which yields ~250 distinct form
                types in a real month. mirror that shape here (single category, many forms,
                long tail) so localhost exercises the top-N + 'Other' bar cap

            */}
            var csv_data_distribution = `total_records,category,form
                15230,Filings,4
                9820,Filings,8-K
                7610,Filings,10-Q
                6040,Filings,10-K
                5120,Filings,3
                4310,Filings,SC 13G
                3980,Filings,SC 13D
                3220,Filings,S-1
                2870,Filings,424B5
                2610,Filings,DEF 14A
                2350,Filings,6-K
                2100,Filings,485BPOS
                1890,Filings,FWP
                1720,Filings,NPORT-P
                1540,Filings,497
                1380,Filings,N-CEN
                1210,Filings,13F-HR
                1050,Filings,S-3
                930,Filings,25-NSE
                820,Filings,SD
                710,Filings,144
                640,Filings,POS AM
                560,Filings,8-A12B
                490,Filings,DEFA14A
                420,Filings,20-F
                360,Filings,ABS-EE
                310,Filings,N-1A
                260,Filings,S-8
                210,Filings,40-F
                170,Filings,PRE 14A
            ,,,`;

            var csv_count = `count\n0,,,`;

            return get_promise({
                'data-distribution': csv_data_distribution,
                'count': csv_count
            }, callback, source, stream);
        }
    } else {
        console.log(`Error: ${type} not a valid choice.`)
    }
}

export default function getDataDistribution(type, url=null, callback=()=>{}, worker=false, source=null, stream=null) {
    return get(type, url, callback, worker, source, stream);
}
