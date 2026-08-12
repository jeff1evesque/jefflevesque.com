/**
 * validator-source.js: self-contained validator sources for the worker tests.
 *
 * The worker modules receive their five validators as SOURCE TEXT and rebuild them
 * with new Function(). A test cannot pass the imported validators' .toString()
 * output, because under coverage babel-plugin-istanbul rewrites those modules to
 * increment a counter:
 *
 *     function checkValidObject(k, v) { cov_2d45h1a6k4().f[0]++; ... }
 *
 * new Function() evaluates that text in global scope, where the counter does not
 * exist, so the reconstruction throws 'cov_... is not defined'. The tests would
 * then pass with coverage off and fail with it on.
 *
 * These copies live outside __tests__ (so jest does not collect them as a suite)
 * and outside import/ (so they are never instrumented). Their .toString() is
 * therefore clean, which is what a production bundle would hand the worker.
 *
 * Each is behaviourally identical to its counterpart in import/validator/, and the
 * worker suites assert that equivalence directly -- so a change to a real validator
 * that these did not follow is caught rather than silently diverging.
 */

export function trim(obj) {
    const trimmed = JSON.stringify(obj, (key, value) => {
        if (typeof value === 'string') {
            return value.trim();
        }
        return value;
    });
    return JSON.parse(trimmed);
}

export function checkValidInt(value) {
    return Math.round(parseInt(value)) === parseInt(value);
}

export function checkValidString(value) {
    if (typeof value === 'string' && value.length > 0) {
        return true;
    } else {
        return false;
    }
}

export function checkValidObject(k, v) {
    if (
        v === Object(v)
        && !Array.isArray(v)
        && v !== null
        && k in v
        && typeof v[k] !== 'undefined'
        && v[k] !== null
        && v[k].trim !== ''
    ) {
        return true;
    } else {
        return false;
    }
}

export function checkValidArray(k, v = null) {
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
