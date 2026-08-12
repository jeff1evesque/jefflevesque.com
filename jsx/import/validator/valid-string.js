/**
 * valid-string.js: check provided argument is string type.
 */

export default function checkValidString(value) {
    if (typeof value === 'string' && value.length > 0) {
        return true;
    } else {
        return false;
    }
}
