/**
 * candlestick.js: generate array object for toggleChartScale function.
 */

import { dstDate } from '../../../../general/dst.js';
import checkValidArray from '../../../../validator/valid-array.js';

export default function getCandlestickArrResult(
    chart_data_original,
    field_datetime,
    datetime_label,
    patterns
) {
    const arr_date = [];
    const arr_result = [];

    {/*

        https://stackoverflow.com/a/39033210

    */}

    chart_data_original.forEach((item) => {
        const year = item[field_datetime].getFullYear();
        const month = String(item[field_datetime].getMonth() + 1).padStart(2, '0');
        const day = String(item[field_datetime].getDate()).padStart(2, '0');
        const hour = item[field_datetime].getHours();
        const minute = item[field_datetime].getMinutes();

        {/*

            monthly buckets on the first of the month, in the SAME 'yyyy/mm/dd'
            form the other scales use.

            It used to build '`${year}-${month}`' with getMonth() + 2. Two things
            were wrong with that and they hid each other. The hyphenated form is
            an ISO date, which parses as UTC and then rendered an hour behind
            midnight in eastern time -- landing the point in the PREVIOUS month --
            and the + 2 pushed the label a month forward to compensate, so the
            axis looked right by accident.

            It was not right in december: getMonth() + 2 is 13, and
            new Date('2024-13') is an Invalid Date, so a december bucket carried
            NaN onto the axis. The slash form parses as local time, so + 1 -- the
            calendar month, as everywhere else in this function -- now lands where
            it should in every month.

        */}

        if (datetime_label === 'monthly') {
            var date_string = `${year}/${month}/01`;
        } else if (datetime_label === 'daily') {
            var date_string = `${year}/${month}/${day}`;
        } else if (datetime_label === 'hourly') {
            var date_string = `${year}/${month}/${day} ${hour}`;
        } else if (datetime_label === 'minutes') {
            var date_string = `${year}/${month}/${day} ${hour}:${minute}`;
        } else {
            var date_string = item[field_datetime].toISOString().replace(/T/, ' ');
        }

        const index = arr_date.indexOf(date_string);
        const date = new Date(new Date(datetime_label === 'hourly' ? `${date_string}:00` : date_string).toLocaleString(
            'en-US',
            {timeZone: 'America/New_York'}
        ));

        if (index === -1) {
            arr_date.push(date_string);
            if (patterns && checkValidArray(patterns)) {
                const arr_item = Object.assign(
                    {[field_datetime]: date},
                    ...patterns.map((x) => ({[x]: item[x]}))
                );
                arr_result.push(arr_item);
            } else {
                arr_result.push({
                    [field_datetime]: date,
                    inverted_hammer: item.inverted_hammer,
                    shooting_star: item.shooting_star,
                    hammer: item.hammer,
                    hanging_man: item.hanging_man,
                    piercing: item.piercing,
                    dark_cloud_cover: item.dark_cloud_cover,
                    morning_doji_star: item.morning_doji_star,
                    evening_doji_star: item.evening_doji_star,
                    bearish_engulfing: item.bearish_engulfing,
                    bullish_engulfing: item.bullish_engulfing,
                    dragonfly_doji: item.dragonfly_doji,
                    gravestone_doji: item.gravestone_doji,
                    morning_star: item.morning_star,
                    evening_star: item.evening_star
                });
            }
        } else {
            if (patterns && checkValidArray(patterns)) {
                for (const pattern of patterns) {
                    arr_result[index][pattern] += item[pattern];
                }
            } else {
                arr_result[index].inverted_hammer += item.inverted_hammer;
                arr_result[index].shooting_star += item.shooting_star;
                arr_result[index].hammer += item.hammer;
                arr_result[index].hanging_man += item.hanging_man;
                arr_result[index].piercing += item.piercing;
                arr_result[index].dark_cloud_cover += item.dark_cloud_cover;
                arr_result[index].morning_doji_star += item.morning_doji_star;
                arr_result[index].evening_doji_star += item.evening_doji_star;
                arr_result[index].bearish_engulfing += item.bearish_engulfing;
                arr_result[index].bullish_engulfing += item.bullish_engulfing;
                arr_result[index].dragonfly_doji += item.dragonfly_doji;
                arr_result[index].gravestone_doji += item.gravestone_doji;
                arr_result[index].morning_star += item.morning_star;
                arr_result[index].evening_star += item.evening_star;
            }
        }
    });

    if (datetime_label === 'monthly') {
        var chart_data = arr_result;
    } else if (datetime_label === 'daily') {
        var d_arr = [];
        const d = dstDate();

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        d_arr.push(new Date(new Date(`${year}/${month}/${day}`).toLocaleString(
            'en-US',
            {timeZone: 'America/New_York'}
        )));

        for (let i = 1; i < 20; i++) {
            const d_new = new Date(new Date(new Date().toLocaleString(
                'en-US',
                {timeZone: 'America/New_York'}
            )).setDate(d.getDate() - i));

            const year = d_new.getFullYear();
            const month = String(d_new.getMonth() + 1).padStart(2, '0');
            const day = String(d_new.getDate()).padStart(2, '0');

            d_arr.push(new Date(new Date(`${year}/${month}/${day}`).toLocaleString(
                'en-US',
                {timeZone: 'America/New_York'}
            )));
        }

        var chart_data = arr_result.filter((item) =>
            d_arr.some(d_item => d_item <= item[field_datetime])
        );
    } else if (datetime_label === 'hourly') {
        const d = dstDate();
        var chart_data = arr_result.filter((item) =>
            item[field_datetime].getFullYear() === d.getFullYear()
            && item[field_datetime].getMonth() === d.getMonth()
            && item[field_datetime].getDate() === d.getDate()
        );
    } else if (datetime_label === 'minutes') {
        const d = dstDate();
        var chart_data = arr_result.filter((item) =>
            item[field_datetime].getFullYear() === d.getFullYear()
            && item[field_datetime].getMonth() === d.getMonth()
            && item[field_datetime].getDate() === d.getDate()
            && item[field_datetime].getHours() === d.getHours()
        )
    } else {
        var chart_data = arr_result
    }

    return chart_data;
}
