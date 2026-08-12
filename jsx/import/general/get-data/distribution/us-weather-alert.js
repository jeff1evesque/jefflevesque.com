/**
 * us-weather-alert.jsx: conditionally get csv data or load test data.
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
            var csv_data_distribution = `total_events,severity,event
                    8266,Moderate,Special Weather Statement
                    6,Extreme,Local Area Emergency
                    71,Minor,Coastal Flood Advisory
                    55,Severe,Tropical Storm Warning
                    44,Moderate,Dense Fog Advisory
                    2,Extreme,Civil Emergency Message
                    9,Moderate,Lake Wind Advisory
                    4,Minor,Extreme Heat Warning
                    8,Moderate,Hazardous Seas Warning
                    8,Minor,Brisk Wind Advisory
                    2,Moderate,Winter Weather Advisory
                    1,Minor,Extreme Heat Watch
                    1,Extreme,Evacuation Immediate
                    353,Severe,Severe Thunderstorm Watch
                    941,Moderate,Heat Advisory
                    111,Severe,Extreme Heat Watch
                    326,Severe,Extreme Heat Warning
                    674,Minor,Marine Weather Statement
                    131,Moderate,Beach Hazards Statement
                    50,Moderate,Rip Current Statement
                    70,Moderate,Tropical Cyclone Local Statement
                    58,Severe,Tropical Storm Watch
                    16,Severe,Flash Flood Watch
                    11,Moderate,Blowing Dust Advisory
                    2,Severe,Local Area Emergency
                    3,Severe,High Wind Warning
                    2,Severe,Civil Emergency Message
                    1,Minor,Fire Weather Watch
                    2604,Minor,Small Craft Advisory
                    72,Severe,Fire Weather Watch
                    320,Severe,Flood Warning
                    1041,Severe,Special Marine Warning
                    259,Extreme,Tornado Warning
                    229,Moderate,Gale Warning
                    25,Minor,High Surf Advisory
                    41,Moderate,Wind Advisory
                    9,Severe,Storm Surge Watch
                    40,Minor,Coastal Flood Statement
                    6,Minor,Flood Watch
                    49,Minor,Dense Smoke Advisory
                    2,Extreme,Shelter in Place Warning
                    1,Extreme,Immediate Evacuation
                    4,Moderate,Hazardous Seas Watch
                    4,Moderate,High Surf Warning
                    1,Minor,Coastal Flood Warning
                    3,Extreme,Extreme Wind Warning
                    3828,Severe,Severe Thunderstorm Warning
                    296,Severe,Flood Watch
                    1390,Severe,Flash Flood Warning
                    1307,Unknown,Air Quality Alert
                    187,Severe,Red Flag Warning
                    17,Unknown,Hydrologic Outlook
                    1850,Minor,Flood Advisory
                    3,Severe,Typhoon Watch
                    27,Minor,Dense Fog Advisory
                    26,Extreme,Tornado Watch
                    33,Moderate,Dust Advisory
                    20,Moderate,Gale Watch
                    4,Moderate,Dense Smoke Advisory
                    8,Minor,Heat Advisory
                    6,Severe,Blowing Dust Warning
                    1,Minor,Hazardous Seas Warning
                    40,Severe,Dust Storm Warning
                    5,Minor,Beach Hazards Statement
                    4,Severe,Coastal Flood Warning
                    2,Extreme,Child Abduction Emergency
                    2,Extreme,Typhoon Warning
                    1,Extreme,Law Enforcement Warning
                    1,Moderate,Coastal Flood Watch
                    1,Severe,High Wind Watch
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
