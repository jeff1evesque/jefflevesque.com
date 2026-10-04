/**
 * get-data.jsx: conditionally get csv data or load test data.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import { readString } from 'react-papaparse';
import {parseCsv, papaParseCsv} from '../general/parse-csv.js';
import { noteResponse } from './rate-limit.js';

//
// Note: 'on_error' is told when the request fails -- a response that is not ok,
//       a body with no report, or no answer at all. The failure is still caught
//       and logged, so a caller that passes nothing sees no change; a caller that
//       does can tell a request that failed from one still in flight, which the
//       callback alone cannot, since it never fires for either.
//
// Note: every answer is shown to rate-limit.js first, which tells the page when
//       the api has said to wait, and when it no longer does (#210).
//
function get_promise(url, callback, source, stream, on_error = null) {
    return fetch(url, {method: 'GET'})
        .then((response) => {
            noteResponse(response);

            if (response.ok) {
                return response.json();
            }
            return Promise.reject(response);
        })
        .then((json) => {
            if ('report' in json) {
                if (json.report) {
                    return readString(json.report, {
                        download: false,
                        header: true,
                        complete: (results) => {
                            if ('data' in results && results.data) {
                                callback({ data: results.data, source: source, stream: stream });
                            } else {
                                callback({ data: null, source: source, stream: stream });
                            }
                        }
                    });
                } else {
                    return callback({ data: null, source: source, stream: stream });
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

            if (typeof on_error === 'function') {
                on_error(e);
            }
        });
}

function get(type, url, callback, worker, source, stream, on_error) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = today.getMonth() === 11 ? '12' : String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();

    {/*

        conditional data

    */}

    if (type === 'list-months') {
        return [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December'
        ];
    } else if (type === 'ticker-custom') {
        if (url) {
            var promise = parseCsv(url);
        } else {
            const csv = `Symbol,Name,Sector,Industry
                XOM,Exxon Mobil Corporation Common Stock,Energy,Oil & Gas Integrated
                PFE,Pfizer Inc. Common Stock,Healthcare,Drug Manufacturers—General
                MCD,McDonald's Corporation Common Stock,Consumer Cyclical,Restaurants
            ,,,,
            ,,,,`;
            var promise = parseCsv(csv, false);
        }

        return promise;

    } else if (type === 'ticker-nasdaq') {
        if (url) {
            var promise = parseCsv(url);
        } else {
            const csv = `Symbol,Name,Sector,Industry
                TMUS,T-Mobile US Inc. Common Stock,Communication Services,Telecom Services
                TSLA,Tesla Inc. Common Stock,Consumer Cyclical,Auto Manufacturers
                TXN,Texas Instruments Incorporated Common Stock,Technology,Semiconductors
            ,,,,
            ,,,,`;
            var promise = parseCsv(csv, false);
        }

        return promise;

    } else if (type === 'bls-ingest') {
        if (url) {
            var promise = get_promise(url, callback, source, stream, on_error);
        } else {
            const yesterday = today.getDate() < 2 ? '01' : String(today.getDate() - 1).padStart(2, '0');
            const before_yesterday = today.getDate() < 2 ? '01' : String(today.getDate() - 2).padStart(2, '0');
            const csv = `group_by,window_start,total_success,total_fail,slide_window_over,slide_window_every
            bls,${yyyy}-${mm}-${before_yesterday} 13:15:00,292,1,10.minutes,1.minutes
            bls,${yyyy}-${mm}-${before_yesterday} 13:16:00,292,0,10.minutes,1.minutes
            bls,${yyyy}-${mm}-${before_yesterday} 13:17:00,292,0,10.minutes,1.minutes
            bls,${yyyy}-${mm}-${yesterday} 13:15:00,292,0,10.minutes,1.minutes
            bls,${yyyy}-${mm}-${yesterday} 13:16:00,292,0,10.minutes,1.minutes
            bls,${yyyy}-${mm}-${yesterday} 13:17:00,292,1,10.minutes,1.minutes
            bls,${yyyy}-${mm}-${dd} 13:15:00,292,0,10.minutes,1.minutes
            bls,${yyyy}-${mm}-${dd} 13:16:00,292,2,10.minutes,1.minutes
            bls,${yyyy}-${mm}-${dd} 13:17:00,292,1,10.minutes,1.minutes
            ,,,`;
            var promise = papaParseCsv(csv, callback, worker, false, true, source, stream);
        }

        return promise;

    } else if (type === 'sec-ingest') {
        if (url) {
            var promise = get_promise(url, callback, source, stream, on_error);
        } else {
            const yesterday = today.getDate() < 2 ? '01' : String(today.getDate() - 1).padStart(2, '0');
            const before_yesterday = today.getDate() < 2 ? '01' : String(today.getDate() - 2).padStart(2, '0');
            const csv = `group_by,window_start,total_success,total_fail,slide_window_over,slide_window_every
            sec,${yyyy}-${mm}-${before_yesterday} 13:15:00,292,1,10.minutes,1.minutes
            sec,${yyyy}-${mm}-${before_yesterday} 13:16:00,292,0,10.minutes,1.minutes
            sec,${yyyy}-${mm}-${before_yesterday} 13:17:00,292,0,10.minutes,1.minutes
            sec,${yyyy}-${mm}-${yesterday} 13:15:00,292,0,10.minutes,1.minutes
            sec,${yyyy}-${mm}-${yesterday} 13:16:00,292,0,10.minutes,1.minutes
            sec,${yyyy}-${mm}-${yesterday} 13:17:00,292,0,10.minutes,1.minutes
            sec,${yyyy}-${mm}-${dd} 13:15:00,292,0,10.minutes,1.minutes
            sec,${yyyy}-${mm}-${dd} 13:16:00,292,1,10.minutes,1.minutes
            sec,${yyyy}-${mm}-${dd} 13:17:00,292,0,10.minutes,1.minutes
            ,,,`;
            var promise = papaParseCsv(csv, callback, worker, false, true, source, stream);
        }

        return promise;

    } else if (type === 'us-national-weather-ingest') {
        if (url) {
            var promise = get_promise(url, callback, source, stream, on_error);
        } else {
            const yesterday = today.getDate() < 2 ? '01' : String(today.getDate() - 1).padStart(2, '0');
            const before_yesterday = today.getDate() < 2 ? '01' : String(today.getDate() - 2).padStart(2, '0');
            const csv = `group_by,window_start,total_success,total_fail,slide_window_over,slide_window_every
            api.weather.gov,${yyyy}-${mm-1}-${before_yesterday} 13:15:00,292,27,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm-1}-${before_yesterday} 13:16:00,292,17,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm-1}-${before_yesterday} 13:17:00,292,25,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm-1}-${before_yesterday} 13:18:00,292,2,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm}-${before_yesterday} 13:15:00,252,27,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm}-${before_yesterday} 13:16:00,236,17,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm}-${before_yesterday} 13:17:00,269,25,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm}-${before_yesterday} 13:18:00,277,2,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm}-${yesterday} 13:15:00,270,5,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm}-${yesterday} 13:16:00,248,1,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm}-${yesterday} 13:17:00,292,23,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm}-${yesterday} 13:18:00,292,20,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm}-${dd} 13:15:00,292,36,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm}-${dd} 13:16:00,292,29,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm}-${dd} 13:17:00,292,3,10.minutes,1.minutes
            api.weather.gov,${yyyy}-${mm}-${dd} 13:18:00,292,50,10.minutes,1.minutes
            ,,,`;
            var promise = papaParseCsv(csv, callback, worker, false, true, source, stream);
        }

        return promise;

    } else if (type === 'stock-market-ingest') {
        if (url) {
            var promise = get_promise(url, callback, source, stream, on_error);
        } else {
            const yesterday = today.getDate() < 2 ? '01' : String(today.getDate() - 1).padStart(2, '0');
            const before_yesterday = today.getDate() < 2 ? '01' : String(today.getDate() - 2).padStart(2, '0');
            const csv = `group_by,window_start,total_success,total_fail,slide_window_over,slide_window_every
                options,${yyyy}-${mm-1}-${before_yesterday} 13:15:00,24200,1,10.minutes,1.minutes
                price,${yyyy}-${mm-1}-${before_yesterday} 13:15:00,242,0,10.minutes,1.minutes
                options,${yyyy}-${mm}-${before_yesterday} 13:15:00,29200,1,10.minutes,1.minutes
                price,${yyyy}-${mm}-${before_yesterday} 13:15:00,292,0,10.minutes,1.minutes
                options,${yyyy}-${mm}-${before_yesterday} 13:16:00,29337,1,10.minutes,1.minutes
                price,${yyyy}-${mm}-${before_yesterday} 13:16:00,295,0,10.minutes,1.minutes
                options,${yyyy}-${mm}-${yesterday} 13:17:00,31400,0,10.minutes,1.minutes
                price,${yyyy}-${mm}-${yesterday} 13:17:00,314,2,10.minutes,1.minutes
                options,${yyyy}-${mm}-${yesterday} 13:18:00,31537,0,10.minutes,1.minutes
                price,${yyyy}-${mm}-${yesterday} 13:18:00,317,2,10.minutes,1.minutes
                options,${yyyy}-${mm}-${yesterday} 13:19:00,31674,0,10.minutes,1.minutes
                price,${yyyy}-${mm}-${yesterday} 13:19:00,320,2,10.minutes,1.minutes
                options,${yyyy}-${mm}-${dd} 13:20:00,33100,4,10.minutes,1.minutes
                price,${yyyy}-${mm}-${dd} 13:20:00,331,0,10.minutes,1.minutes
                options,${yyyy}-${mm}-${dd} 13:21:00,33237,4,10.minutes,1.minutes
                price,${yyyy}-${mm}-${dd} 13:21:00,334,0,10.minutes,1.minutes
                options,${yyyy}-${mm}-${dd} 13:22:00,33374,4,10.minutes,1.minutes
                price,${yyyy}-${mm}-${dd} 13:22:00,337,0,10.minutes,1.minutes
                options,${yyyy}-${mm}-${dd} 13:23:00,33511,4,10.minutes,1.minutes
                price,${yyyy}-${mm}-${dd} 13:23:00,340,0,10.minutes,1.minutes
                options,${yyyy}-${mm}-${dd} 13:24:00,33648,4,10.minutes,1.minutes
                price,${yyyy}-${mm}-${dd} 13:24:00,343,0,10.minutes,1.minutes
            ,,,`;
            var promise = papaParseCsv(csv, callback, worker, false, true, source, stream);
        }

        return promise;

    } else if (type === 'stock-split-ingest') {
        if (url) {
            var promise = get_promise(url, callback, source, stream, on_error);
        } else {
            const yesterday = today.getDate() < 2 ? '01' : String(today.getDate() - 1).padStart(2, '0');
            const before_yesterday = today.getDate() < 2 ? '01' : String(today.getDate() - 2).padStart(2, '0');
            const csv = `group_by,window_start,total_success,total_fail,slide_window_over,slide_window_every
                Gamma,${yyyy}-${mm}-${before_yesterday} 13:15:00,1,1,10.minutes,1.minutes
                Beta,${yyyy}-${mm}-${before_yesterday} 13:15:00,1,0,10.minutes,1.minutes
                Alpha,${yyyy}-${mm}-${before_yesterday} 13:15:00,1,0,10.minutes,1.minutes
                Beta,${yyyy}-${mm}-${before_yesterday} 13:16:00,1,0,10.minutes,1.minutes
                Gamma,${yyyy}-${mm}-${before_yesterday} 13:16:00,1,0,10.minutes,1.minutes
                Alpha,${yyyy}-${mm}-${before_yesterday} 13:16:00,1,2,10.minutes,1.minutes
                Gamma,${yyyy}-${mm}-${yesterday} 13:17:00,1,1,10.minutes,1.minutes
                Alpha,${yyyy}-${mm}-${yesterday} 13:17:00,1,1,10.minutes,1.minutes
                Beta,${yyyy}-${mm}-${yesterday} 13:17:00,1,1,10.minutes,1.minutes
                Alpha,${yyyy}-${mm}-${yesterday} 13:18:00,1,0,10.minutes,1.minutes
                Beta,${yyyy}-${mm}-${yesterday} 13:18:00,1,0,10.minutes,1.minutes
                Gamma,${yyyy}-${mm}-${yesterday} 13:18:00,1,0,10.minutes,1.minutes
                Gamma,${yyyy}-${mm}-${yesterday} 13:19:00,1,0,10.minutes,1.minutes
                Alpha,${yyyy}-${mm}-${yesterday} 13:19:00,1,0,10.minutes,1.minutes
                Beta,${yyyy}-${mm}-${yesterday} 13:19:00,1,0,10.minutes,1.minutes
                Gamma,${yyyy}-${mm}-${dd} 13:20:00,1,0,10.minutes,1.minutes
                Beta,${yyyy}-${mm}-${dd} 13:20:00,1,1,10.minutes,1.minutes
                Alpha,${yyyy}-${mm}-${dd} 13:20:00,1,2,10.minutes,1.minutes
                Gamma,${yyyy}-${mm}-${dd} 13:21:00,1,0,10.minutes,1.minutes
                Beta,${yyyy}-${mm}-${dd} 13:21:00,1,0,10.minutes,1.minutes
                Alpha,${yyyy}-${mm}-${dd} 13:21:00,1,0,10.minutes,1.minutes
                Alpha,${yyyy}-${mm}-${dd} 13:22:00,1,0,10.minutes,1.minutes
                Beta,${yyyy}-${mm}-${dd} 13:22:00,1,0,10.minutes,1.minutes
                Gamma,${yyyy}-${mm}-${dd} 13:22:00,1,1,10.minutes,1.minutes
                Beta,${yyyy}-${mm}-${dd} 13:23:00,1,1,10.minutes,1.minutes
                Gamma,${yyyy}-${mm}-${dd} 13:23:00,1,0,10.minutes,1.minutes
                Alpha,${yyyy}-${mm}-${dd} 13:23:00,1,0,10.minutes,1.minutes
                Beta,${yyyy}-${mm}-${dd} 13:24:00,1,2,10.minutes,1.minutes
                Alpha,${yyyy}-${mm}-${dd} 13:24:00,1,1,10.minutes,1.minutes
                Gamma,${yyyy}-${mm}-${dd} 13:24:00,1,0,10.minutes,1.minutes
            ,,,`;
            var promise = papaParseCsv(csv, callback, worker, false, true, source, stream);
        }

        return promise;

    } else if (type === 'stock-market-candlestick-triggers') {
        if (url) {
            var promise = parseCsv(url);
        } else {
            const yesterday = today.getDate() < 2 ? '01' : String(today.getDate() - 1).padStart(2, '0');
            const before_yesterday = today.getDate() < 2 ? '01' : String(today.getDate() - 2).padStart(2, '0');
            const csv = `group_by,window_start,total_detected,slide_window_over,slide_window_every
                inverted_hammer,${yyyy}-${mm}-${before_yesterday} 09:35:00,2,10.minutes,1.minutes
                shooting_star,${yyyy}-${mm}-${before_yesterday} 09:35:00,23,10.minutes,1.minutes
                hammer,${yyyy}-${mm}-${before_yesterday} 09:35:00,6,10.minutes,1.minutes
                hanging_man,${yyyy}-${mm}-${before_yesterday} 09:35:00,6,10.minutes,1.minutes
                piercing,${yyyy}-${mm}-${before_yesterday} 09:35:00,12,10.minutes,1.minutes
                dark_cloud_cover,${yyyy}-${mm}-${before_yesterday} 09:35:00,14,10.minutes,1.minutes
                morning_doji_star,${yyyy}-${mm}-${before_yesterday} 09:35:00,34,10.minutes,1.minutes
                evening_doji_star,${yyyy}-${mm}-${before_yesterday} 09:35:00,1,10.minutes,1.minutes
                bearish_engulfing,${yyyy}-${mm}-${before_yesterday} 09:35:00,0,10.minutes,1.minutes
                bullish_engulfing,${yyyy}-${mm}-${before_yesterday} 09:35:00,14,10.minutes,1.minutes
                dragonfly_doji,${yyyy}-${mm}-${before_yesterday} 09:35:00,14,10.minutes,1.minutes
                gravestone_doji,${yyyy}-${mm}-${before_yesterday} 09:35:00,34,10.minutes,1.minutes
                morning_star,${yyyy}-${mm}-${before_yesterday} 09:35:00,4,10.minutes,1.minutes
                evening_star,${yyyy}-${mm}-${before_yesterday} 09:35:00,34,10.minutes,1.minutes
                inverted_hammer,${yyyy}-${mm}-${before_yesterday} 09:36:00,29,10.minutes,1.minutes
                shooting_star,${yyyy}-${mm}-${before_yesterday} 09:36:00,32,10.minutes,1.minutes
                hammer,${yyyy}-${mm}-${before_yesterday} 09:36:00,62,10.minutes,1.minutes
                hanging_man,${yyyy}-${mm}-${before_yesterday} 09:36:00,86,10.minutes,1.minutes
                piercing,${yyyy}-${mm}-${before_yesterday} 09:36:00,9,10.minutes,1.minutes
                dark_cloud_cover,${yyyy}-${mm}-${before_yesterday} 09:36:00,54,10.minutes,1.minutes
                morning_doji_star,${yyyy}-${mm}-${before_yesterday} 09:36:00,63,10.minutes,1.minutes
                evening_doji_star,${yyyy}-${mm}-${before_yesterday} 09:36:00,11,10.minutes,1.minutes
                bearish_engulfing,${yyyy}-${mm}-${before_yesterday} 09:36:00,114,10.minutes,1.minutes
                bullish_engulfing,${yyyy}-${mm}-${before_yesterday} 09:36:00,0,10.minutes,1.minutes
                dragonfly_doji,${yyyy}-${mm}-${before_yesterday} 09:36:00,5,10.minutes,1.minutes
                gravestone_doji,${yyyy}-${mm}-${before_yesterday} 09:36:00,34,10.minutes,1.minutes
                morning_star,${yyyy}-${mm}-${before_yesterday} 09:36:00,1,10.minutes,1.minutes
                evening_star,${yyyy}-${mm}-${before_yesterday} 09:36:00,4,10.minutes,1.minutes
                inverted_hammer,${yyyy}-${mm}-${before_yesterday} 09:37:00,22,10.minutes,1.minutes
                shooting_star,${yyyy}-${mm}-${before_yesterday} 09:37:00,22,10.minutes,1.minutes
                hammer,${yyyy}-${mm}-${before_yesterday} 09:37:00,15,10.minutes,1.minutes
                hanging_man,${yyyy}-${mm}-${before_yesterday} 09:37:00,6,10.minutes,1.minutes
                piercing,${yyyy}-${mm}-${before_yesterday} 09:37:00,55,10.minutes,1.minutes
                dark_cloud_cover,${yyyy}-${mm}-${before_yesterday} 09:37:00,0,10.minutes,1.minutes
                morning_doji_star,${yyyy}-${mm}-${before_yesterday} 09:37:00,8,10.minutes,1.minutes
                evening_doji_star,${yyyy}-${mm}-${before_yesterday} 09:37:00,0,10.minutes,1.minutes
                bearish_engulfing,${yyyy}-${mm}-${before_yesterday} 09:37:00,4,10.minutes,1.minutes
                bullish_engulfing,${yyyy}-${mm}-${before_yesterday} 09:37:00,7,10.minutes,1.minutes
                dragonfly_doji,${yyyy}-${mm}-${before_yesterday} 09:37:00,7,10.minutes,1.minutes
                gravestone_doji,${yyyy}-${mm}-${before_yesterday} 09:37:00,7,10.minutes,1.minutes
                morning_star,${yyyy}-${mm}-${before_yesterday} 09:37:00,222,10.minutes,1.minutes
                evening_star,${yyyy}-${mm}-${before_yesterday} 09:37:00,222,10.minutes,1.minutes
                inverted_hammer,${yyyy}-${mm}-${before_yesterday} 09:38:00,11,10.minutes,1.minutes
                shooting_star,${yyyy}-${mm}-${before_yesterday} 09:38:00,41,10.minutes,1.minutes
                hammer,${yyyy}-${mm}-${before_yesterday} 09:38:00,0,10.minutes,1.minutes
                hanging_man,${yyyy}-${mm}-${before_yesterday} 09:38:00,0,10.minutes,1.minutes
                piercing,${yyyy}-${mm}-${before_yesterday} 09:38:00,5,10.minutes,1.minutes
                dark_cloud_cover,${yyyy}-${mm}-${before_yesterday} 09:38:00,19,10.minutes,1.minutes
                morning_doji_star,${yyyy}-${mm}-${before_yesterday} 09:38:00,33,10.minutes,1.minutes
                evening_doji_star,${yyyy}-${mm}-${before_yesterday} 09:38:00,66,10.minutes,1.minutes
                bearish_engulfing,${yyyy}-${mm}-${before_yesterday} 09:38:00,0,10.minutes,1.minutes
                bullish_engulfing,${yyyy}-${mm}-${before_yesterday} 09:38:00,16,10.minutes,1.minutes
                dragonfly_doji,${yyyy}-${mm}-${before_yesterday} 09:38:00,33,10.minutes,1.minutes
                gravestone_doji,${yyyy}-${mm}-${before_yesterday} 09:38:00,0,10.minutes,1.minutes
                morning_star,${yyyy}-${mm}-${before_yesterday} 09:38:00,9,10.minutes,1.minutes
                evening_star,${yyyy}-${mm}-${before_yesterday} 09:38:00,12,10.minutes,1.minutes

                inverted_hammer,${yyyy}-${mm}-${yesterday} 09:35:00,22,10.minutes,1.minutes
                shooting_star,${yyyy}-${mm}-${yesterday} 09:35:00,32,10.minutes,1.minutes
                hammer,${yyyy}-${mm}-${yesterday} 09:35:00,62,10.minutes,1.minutes
                hanging_man,${yyyy}-${mm}-${yesterday} 09:35:00,8,10.minutes,1.minutes
                piercing,${yyyy}-${mm}-${yesterday} 09:35:00,12,10.minutes,1.minutes
                dark_cloud_cover,${yyyy}-${mm}-${yesterday} 09:35:00,33,10.minutes,1.minutes
                morning_doji_star,${yyyy}-${mm}-${yesterday} 09:35:00,88,10.minutes,1.minutes
                evening_doji_star,${yyyy}-${mm}-${yesterday} 09:35:00,34,10.minutes,1.minutes
                bearish_engulfing,${yyyy}-${mm}-${yesterday} 09:35:00,0,10.minutes,1.minutes
                bullish_engulfing,${yyyy}-${mm}-${yesterday} 09:35:00,4,10.minutes,1.minutes
                dragonfly_doji,${yyyy}-${mm}-${yesterday} 09:35:00,16,10.minutes,1.minutes
                gravestone_doji,${yyyy}-${mm}-${yesterday} 09:35:00,77,10.minutes,1.minutes
                morning_star,${yyyy}-${mm}-${yesterday} 09:35:00,0,10.minutes,1.minutes
                evening_star,${yyyy}-${mm}-${yesterday} 09:35:00,55,10.minutes,1.minutes
                inverted_hammer,${yyyy}-${mm}-${yesterday} 09:36:00,0,10.minutes,1.minutes
                shooting_star,${yyyy}-${mm}-${yesterday} 09:36:00,34,10.minutes,1.minutes
                hammer,${yyyy}-${mm}-${yesterday} 09:36:00,47,10.minutes,1.minutes
                hanging_man,${yyyy}-${mm}-${yesterday} 09:36:00,53,10.minutes,1.minutes
                piercing,${yyyy}-${mm}-${yesterday} 09:36:00,85,10.minutes,1.minutes
                dark_cloud_cover,${yyyy}-${mm}-${yesterday} 09:36:00,12,10.minutes,1.minutes
                morning_doji_star,${yyyy}-${mm}-${yesterday} 09:36:00,34,10.minutes,1.minutes
                evening_doji_star,${yyyy}-${mm}-${yesterday} 09:36:00,14,10.minutes,1.minutes
                bearish_engulfing,${yyyy}-${mm}-${yesterday} 09:36:00,4,10.minutes,1.minutes
                bullish_engulfing,${yyyy}-${mm}-${yesterday} 09:36:00,1,10.minutes,1.minutes
                dragonfly_doji,${yyyy}-${mm}-${yesterday} 09:36:00,0,10.minutes,1.minutes
                gravestone_doji,${yyyy}-${mm}-${yesterday} 09:36:00,88,10.minutes,1.minutes
                morning_star,${yyyy}-${mm}-${yesterday} 09:36:00,54,10.minutes,1.minutes
                evening_star,${yyyy}-${mm}-${yesterday} 09:36:00,76,10.minutes,1.minutes
                inverted_hammer,${yyyy}-${mm}-${yesterday} 09:37:00,34,10.minutes,1.minutes
                shooting_star,${yyyy}-${mm}-${yesterday} 09:37:00,39,10.minutes,1.minutes
                hammer,${yyyy}-${mm}-${yesterday} 09:37:00,91,10.minutes,1.minutes
                hanging_man,${yyyy}-${mm}-${yesterday} 09:37:00,0,10.minutes,1.minutes
                piercing,${yyyy}-${mm}-${yesterday} 09:37:00,0,10.minutes,1.minutes
                dark_cloud_cover,${yyyy}-${mm}-${yesterday} 09:37:00,12,10.minutes,1.minutes
                morning_doji_star,${yyyy}-${mm}-${yesterday} 09:37:00,13,10.minutes,1.minutes
                evening_doji_star,${yyyy}-${mm}-${yesterday} 09:37:00,4,10.minutes,1.minutes
                bearish_engulfing,${yyyy}-${mm}-${yesterday} 09:37:00,0,10.minutes,1.minutes
                bullish_engulfing,${yyyy}-${mm}-${yesterday} 09:37:00,9,10.minutes,1.minutes
                dragonfly_doji,${yyyy}-${mm}-${yesterday} 09:37:00,9,10.minutes,1.minutes
                gravestone_doji,${yyyy}-${mm}-${yesterday} 09:37:00,9,10.minutes,1.minutes
                morning_star,${yyyy}-${mm}-${yesterday} 09:37:00,4,10.minutes,1.minutes
                evening_star,${yyyy}-${mm}-${yesterday} 09:37:00,34,10.minutes,1.minutes
                inverted_hammer,${yyyy}-${mm}-${yesterday} 09:38:00,29,10.minutes,1.minutes
                shooting_star,${yyyy}-${mm}-${yesterday} 09:38:00,102,10.minutes,1.minutes
                hammer,${yyyy}-${mm}-${yesterday} 09:38:00,16,10.minutes,1.minutes
                hanging_man,${yyyy}-${mm}-${yesterday} 09:38:00,86,10.minutes,1.minutes
                piercing,${yyyy}-${mm}-${yesterday} 09:38:00,34,10.minutes,1.minutes
                dark_cloud_cover,${yyyy}-${mm}-${yesterday} 09:38:00,14,10.minutes,1.minutes
                morning_doji_star,${yyyy}-${mm}-${yesterday} 09:38:00,14,10.minutes,1.minutes
                evening_doji_star,${yyyy}-${mm}-${yesterday} 09:38:00,10,10.minutes,1.minutes
                bearish_engulfing,${yyyy}-${mm}-${yesterday} 09:38:00,20,10.minutes,1.minutes
                bullish_engulfing,${yyyy}-${mm}-${yesterday} 09:38:00,12,10.minutes,1.minutes
                dragonfly_doji,${yyyy}-${mm}-${yesterday} 09:38:00,16,10.minutes,1.minutes
                gravestone_doji,${yyyy}-${mm}-${yesterday} 09:38:00,62,10.minutes,1.minutes
                morning_star,${yyyy}-${mm}-${yesterday} 09:38:00,71,10.minutes,1.minutes
                evening_star,${yyyy}-${mm}-${yesterday} 09:38:00,5,10.minutes,1.minutes

                inverted_hammer,${yyyy}-${mm}-${dd} 09:35:00,58,10.minutes,1.minutes
                shooting_star,${yyyy}-${mm}-${dd} 09:35:00,222,10.minutes,1.minutes
                hammer,${yyyy}-${mm}-${dd} 09:35:00,37,10.minutes,1.minutes
                hanging_man,${yyyy}-${mm}-${dd} 09:35:00,86,10.minutes,1.minutes
                piercing,${yyyy}-${mm}-${dd} 09:35:00,12,10.minutes,1.minutes
                dark_cloud_cover,${yyyy}-${mm}-${dd} 09:35:00,54,10.minutes,1.minutes
                morning_doji_star,${yyyy}-${mm}-${dd} 09:35:00,36,10.minutes,1.minutes
                evening_doji_star,${yyyy}-${mm}-${dd} 09:35:00,53,10.minutes,1.minutes
                bearish_engulfing,${yyyy}-${mm}-${dd} 09:35:00,27,10.minutes,1.minutes
                bullish_engulfing,${yyyy}-${mm}-${dd} 09:35:00,123,10.minutes,1.minutes
                dragonfly_doji,${yyyy}-${mm}-${dd} 09:35:00,104,10.minutes,1.minutes
                gravestone_doji,${yyyy}-${mm}-${dd} 09:35:00,19,10.minutes,1.minutes
                morning_star,${yyyy}-${mm}-${dd} 09:35:00,13,10.minutes,1.minutes
                evening_star,${yyyy}-${mm}-${dd} 09:35:00,67,10.minutes,1.minutes
                inverted_hammer,${yyyy}-${mm}-${dd} 09:36:00,72,10.minutes,1.minutes
                shooting_star,${yyyy}-${mm}-${dd} 09:36:00,92,10.minutes,1.minutes
                hammer,${yyyy}-${mm}-${dd} 09:36:00,99,10.minutes,1.minutes
                hanging_man,${yyyy}-${mm}-${dd} 09:36:00,37,10.minutes,1.minutes
                piercing,${yyyy}-${mm}-${dd} 09:36:00,54,10.minutes,1.minutes
                dark_cloud_cover,${yyyy}-${mm}-${dd} 09:36:00,63,10.minutes,1.minutes
                morning_doji_star,${yyyy}-${mm}-${dd} 09:36:00,38,10.minutes,1.minutes
                evening_doji_star,${yyyy}-${mm}-${dd} 09:36:00,100,10.minutes,1.minutes
                bearish_engulfing,${yyyy}-${mm}-${dd} 09:36:00,27,10.minutes,1.minutes
                bullish_engulfing,${yyyy}-${mm}-${dd} 09:36:00,36,10.minutes,1.minutes
                dragonfly_doji,${yyyy}-${mm}-${dd} 09:36:00,134,10.minutes,1.minutes
                gravestone_doji,${yyyy}-${mm}-${dd} 09:36:00,28,10.minutes,1.minutes
                morning_star,${yyyy}-${mm}-${dd} 09:36:00,114,10.minutes,1.minutes
                evening_star,${yyyy}-${mm}-${dd} 09:36:00,144,10.minutes,1.minutes
                inverted_hammer,${yyyy}-${mm}-${dd} 09:37:00,182,10.minutes,1.minutes
                shooting_star,${yyyy}-${mm}-${dd} 09:37:00,215,10.minutes,1.minutes
                hammer,${yyyy}-${mm}-${dd} 09:37:00,0,10.minutes,1.minutes
                hanging_man,${yyyy}-${mm}-${dd} 09:37:00,0,10.minutes,1.minutes
                piercing,${yyyy}-${mm}-${dd} 09:37:00,14,10.minutes,1.minutes
                dark_cloud_cover,${yyyy}-${mm}-${dd} 09:37:00,79,10.minutes,1.minutes
                morning_doji_star,${yyyy}-${mm}-${dd} 09:37:00,63,10.minutes,1.minutes
                evening_doji_star,${yyyy}-${mm}-${dd} 09:37:00,0,10.minutes,1.minutes
                bearish_engulfing,${yyyy}-${mm}-${dd} 09:37:00,111,10.minutes,1.minutes
                bullish_engulfing,${yyyy}-${mm}-${dd} 09:37:00,51,10.minutes,1.minutes
                dragonfly_doji,${yyyy}-${mm}-${dd} 09:37:00,70,10.minutes,1.minutes
                gravestone_doji,${yyyy}-${mm}-${dd} 09:37:00,24,10.minutes,1.minutes
                morning_star,${yyyy}-${mm}-${dd} 09:37:00,49,10.minutes,1.minutes
                evening_star,${yyyy}-${mm}-${dd} 09:37:00,23,10.minutes,1.minutes
                inverted_hammer,${yyyy}-${mm}-${dd} 09:38:00,141,10.minutes,1.minutes
                shooting_star,${yyyy}-${mm}-${dd} 09:38:00,13,10.minutes,1.minutes
                hammer,${yyyy}-${mm}-${dd} 09:38:00,44,10.minutes,1.minutes
                hanging_man,${yyyy}-${mm}-${dd} 09:38:00,19,10.minutes,1.minutes
                piercing,${yyyy}-${mm}-${dd} 09:38:00,29,10.minutes,1.minutes
                dark_cloud_cover,${yyyy}-${mm}-${dd} 09:38:00,63,10.minutes,1.minutes
                morning_doji_star,${yyyy}-${mm}-${dd} 09:38:00,62,10.minutes,1.minutes
                evening_doji_star,${yyyy}-${mm}-${dd} 09:38:00,34,10.minutes,1.minutes
                bearish_engulfing,${yyyy}-${mm}-${dd} 09:38:00,14,10.minutes,1.minutes
                bullish_engulfing,${yyyy}-${mm}-${dd} 09:38:00,19,10.minutes,1.minutes
                dragonfly_doji,${yyyy}-${mm}-${dd} 09:38:00,0,10.minutes,1.minutes
                gravestone_doji,${yyyy}-${mm}-${dd} 09:38:00,234,10.minutes,1.minutes
                morning_star,${yyyy}-${mm}-${dd} 09:38:00,132,10.minutes,1.minutes
                evening_star,${yyyy}-${mm}-${dd} 09:38:00,124,10.minutes,1.minutes
            ,,,`;
            var promise = parseCsv(csv, false);
        }

        return promise;

    } else {
        console.log(`Error: ${type} not a valid choice.`)
    }
}

export default function getData(type, url=null, callback=()=>{}, worker=false, source=null, stream=null, on_error=null) {
    return get(type, url, callback, worker, source, stream, on_error);
}
