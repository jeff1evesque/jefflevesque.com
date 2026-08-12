/**
 * valid-phone-number.js: check provided argument is a valid E164 phone number.
 */

function validator(value) {
    var urlregex = new RegExp(/^\+[1-9]\d{10,14}$/);
    return urlregex.test(value);
}

export default function checkValidPhoneNumber(value) {
    return validator(value);
}
