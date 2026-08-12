/**
 * valid-array.js: check provided argument in object is a valid non-empty array.
 */

export default function checkValidArray(k, v=null) {
    if (
        k
        && v
        && k in v
        && Array.isArray(v[k])
        && v[k].length > 0
    ) {
        return true;
    } else if (
        k
        && Array.isArray(k)
        && k.length > 0
    ) {
        return true;
    } else {
        return false;
    }
}
