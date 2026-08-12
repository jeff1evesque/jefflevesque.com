/**
 * valid-bool.js: check provided argument a valid boolean.
 */

function validator(value) {
    return (value === true || value === false);
}

export default function checkValidBool(value) {
    return validator(value);
}
