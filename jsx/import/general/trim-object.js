/**
 * trim-object: trim white spaces in both object key and value recursively.
 */

export default function trim(obj) {
    const trimmed = JSON.stringify(obj, (key, value) => {
        if (typeof value === 'string') {
            return value.trim();
        }
        return value;
    });
    return JSON.parse(trimmed);
}
