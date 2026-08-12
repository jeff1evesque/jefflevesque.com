/**
 * bls.jsx: conditionally get csv data or load test data.
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

                production bls rows carry a constant category ('Reports', naming what each
                row is, as 'Filings' does for sec) and use the feed family (upper(feed):
                CPI, PPI, ...) as 'series'; api-datalake counts *releases* per family per
                month, which is typically ~1. mirror that shape here so localhost reflects
                what production actually renders (single category, one release each)

            */}
            var csv_data_distribution = `total_records,category,series
                1,Reports,CPI
                1,Reports,PPI
                1,Reports,EMPSIT
                1,Reports,JOLTS
                1,Reports,LAUS
                1,Reports,METRO
                1,Reports,REALER
                1,Reports,XIMPIM
                2,Reports,WKYENG
                1,Reports,ECI
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
