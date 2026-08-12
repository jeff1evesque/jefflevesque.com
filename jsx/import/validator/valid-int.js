/**
 * valid-int.js: check provided argument is int type.
 */

export default function checkValidInt(value) {
    return Math.round(parseInt(value)) === parseInt(value);
}
