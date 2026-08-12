/**
 * valid-object.js: check provided argument is a valid object key-value.
 */

export default function checkValidObject(k, v) {
    if (
        v === Object(v)
        && !Array.isArray(v)
        && v !== null
        && k in v
        //
        // 'typeof v[k]' -- this used to read 'v[k] !== "undefined"', comparing
        // against the STRING. A real undefined passed it and reached the
        // '.trim' access below, which throws on undefined: a key present with
        // an undefined value took the caller down, while a key missing
        // entirely returned false cleanly. The two shapes now answer alike.
        //
        && typeof v[k] !== 'undefined'
        && v[k] !== null
        && v[k].trim !== ''
    ) {
        return true;
    } else {
        return false;
    }
}
