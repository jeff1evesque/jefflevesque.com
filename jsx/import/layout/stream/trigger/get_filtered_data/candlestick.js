/**
 * candlestick.js: get candlestick data, then returned filtered data and keys
 */

import trim from '../../../../general/trim-object.js';
import checkValidString from '../../../../validator/valid-string.js';
import checkValidObject from '../../../../validator/valid-object.js';

export default function getFilteredCandlestickData(v, field_datetime) {
    const data = v[0].map(v => {
        {/*

            below corrects backend computed UTC date values

        */}
        let temp_date = new Date(v[field_datetime]);
        v[field_datetime] = new Date(temp_date.setHours(temp_date.getHours() - 4));

        v[trim(v.group_by.toLowerCase())] = checkValidString(v.total_detected) ? parseInt(v.total_detected) : 0;
        delete v.group_by;
        delete v.total_detected;
        delete v.window_every;
        delete v.slide_window_over;
        delete v.slide_window_every;
        return v;
    }).filter(i => {
        if (checkValidObject(field_datetime, i) && !isNaN(i[field_datetime])) { return i; }
    });

    {/*

        merge objects from array of objects having common 'window_start' field

          - https://stackoverflow.com/a/33850667
          - https://stackoverflow.com/a/171256

    */}

    const data_filtered_detected = [];
    data.forEach((item) => {
        const existing = data_filtered_detected.filter((v, i) => {
            return v[field_datetime].valueOf() == item[field_datetime].valueOf();
        });

        if (existing.length) {
            const index = data_filtered_detected.indexOf(existing[0]);
            data_filtered_detected[index] = {...data_filtered_detected[index], ...item};
        } else {
            data_filtered_detected.push(item);
        }
    });

    data_filtered_detected.forEach((item) => {
        item.inverted_hammer = item.inverted_hammer || 0
        item.shooting_star = item.shooting_star || 0
        item.hammer = item.hammer || 0
        item.hanging_man = item.hanging_man || 0
        item.piercing = item.piercing || 0
        item.dark_cloud_cover = item.dark_cloud_cover || 0
        item.morning_doji_star = item.morning_doji_star || 0
        item.evening_doji_star = item.evening_doji_star || 0
        item.bearish_engulfing = item.bearish_engulfing || 0
        item.bullish_engulfing = item.bullish_engulfing || 0
        item.dragonfly_doji = item.dragonfly_doji || 0
        item.gravestone_doji = item.gravestone_doji || 0
        item.morning_star = item.morning_star || 0
        item.evening_star = item.evening_star || 0
    });
    const keys = Object.keys(data_filtered_detected[0]).filter(v => v !== field_datetime);

    return {'data_filtered_detected': data_filtered_detected, 'keys': keys};
}
