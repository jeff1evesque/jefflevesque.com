/**
 * dst.js: dst related functions.
 */

function dstOffset(est=true) {
    {/*

    return whether daylight savings time (DST) is in effect

    */}

    const stdTimezoneOffset = () => {
        const jan = est
            ? new Date(new Date(0, 1).toLocaleString('en-US', {timeZone: 'America/New_York'}))
            : new Date(0, 1).toLocaleString('en-US', {timeZone: 'America/New_York'});

        const jul = est
            ? new Date(new Date(6, 1).toLocaleString('en-US', {timeZone: 'America/New_York'}))
            : new Date(6, 1).toLocaleString('en-US', {timeZone: 'America/New_York'});

        return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    }

    const today = new Date(new Date().toLocaleString('en-US', {timeZone: 'America/New_York'}));

    const isDstObserved = (today) => {
        return today.getTimezoneOffset() < stdTimezoneOffset();
    }

    if (isDstObserved(today)) {
        return -1;
    } else {
        return 0;
    }
}

function dstDate(est=true) {
    {/*

    return current datetime object

    */}

    return est
        ? new Date(new Date().toLocaleString('en-US', {timeZone: 'America/New_York'}))
        : new Date().toLocaleString('en-US', {timeZone: 'America/New_York'});
}

function dstDateAdjusted(datetime, adjust=true, est=true) {
    {/*

    return daylight savings adjusted date/time

    @datetime, provided datetime object to apply adjustment
    @adjust, when true subtract 1 hour to counteract date object not correctly
        taking into account daylight savings time

    */}

    const stdTimezoneOffset = () => {
        const jan = est
            ? new Date(new Date(0, 1).toLocaleString('en-US', {timeZone: 'America/New_York'}))
            : new Date(0, 1).toLocaleString('en-US', {timeZone: 'America/New_York'});

        const jul = est
            ? new Date(new Date(6, 1).toLocaleString('en-US', {timeZone: 'America/New_York'}))
            : new Date(6, 1).toLocaleString('en-US', {timeZone: 'America/New_York'});

        return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    }

    const isDstObserved = (datetime) => {
        return datetime.getTimezoneOffset() < stdTimezoneOffset();
    }

    if (isDstObserved(datetime)) {
        return datetime;
    } else {
        // Was `1 ? adjust : 0` -- a constant condition, so the `: 0` branch
        // could never be taken. Simplified to the value it always evaluated
        // to, leaving behaviour unchanged.
        const adjustment = adjust;
        const datetime_adjusted = new Date(new Date(datetime.getTime() - (adjustment * 60) * 60 * 1000).toLocaleString('en-US', {timeZone: 'America/New_York'}));
        return datetime_adjusted
    }
}

function addHours(date, hours) {
    {/*

    add hour(s) offset to provided date

    */}

    date.setHours(date.getHours() + hours);
    return date;
}

export { dstOffset, dstDate, dstDateAdjusted, addHours }
