/**
 * rate-limit.js: whether the api has told this reader to wait (#210).
 *
 * The api limits how many requests one address can make in a few minutes. It
 * answers a request past that with a 429: how long to wait in `Retry-After`,
 * and the limit and its window in the body, in the api's usual envelope --
 * `{"report": {"error": ..., "limit": ..., "window_seconds": ...}}`. Every place
 * the page asks the api hands its answer here first, and whatever draws the
 * notice, or would ask again on its own, listens.
 *
 * Nothing here holds the limit or the window. The wait comes from each blocked
 * answer: its `Retry-After`, else the body's `window_seconds`, and with neither,
 * until an answer succeeds. The next answer to succeed ends any wait early.
 *
 * Note: a request made while blocked still counts toward the limit, so a page
 *       that would ask again on its own asks limitedUntil() first -- see
 *       refresh in stream.jsx.
 *
 * Note: one wait for the whole page, kept in the module, since the limit is the
 *       reader's address's, whichever page asked.
 */

const listeners = new Set();

//
// the moment the wait ends, in ms since the epoch; Infinity while it lasts until
// an answer succeeds; null while there is no wait
//
let until = null;

function tell() {
    const now = limitedUntil();

    listeners.forEach((listener) => listener(now));
}

/**
 * the seconds a `Retry-After` header asks for: a count of seconds, or an HTTP
 * date to wait until. Null for a header that is missing or says neither.
 */
export function retryAfterSeconds(value, now = Date.now()) {
    if (value === null || value === undefined || String(value).trim() === '') {
        return null;
    }

    const seconds = Number(value);

    if (Number.isFinite(seconds)) {
        return seconds >= 0 ? seconds : null;
    }

    const at = Date.parse(value);

    return Number.isFinite(at) ? Math.max(0, (at - now) / 1000) : null;
}

//
// the window a blocked answer's body names, in seconds, or null where it names
// none -- a body that is not the envelope, or not json at all
//
function windowSeconds(body) {
    const report = body && typeof body === 'object' ? body.report : null;
    const seconds = report && typeof report === 'object' ? Number(report.window_seconds) : NaN;

    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

//
// a blocked answer's body, read from a copy so the caller can still read its own;
// null where it can't be read
//
function readBody(response) {
    try {
        return response.clone().json().catch(() => null);
    } catch (e) {
        return Promise.resolve(null);
    }
}

//
// the reader waits until `at`. Of two blocked answers, the later end is kept, so
// one that came back sooner can't cut a longer wait short
//
function wait(at) {
    until = until === null ? at : Math.max(until, at);
    tell();

    return limitedUntil();
}

/**
 * hand any answer from the api here before reading it.
 *
 * A 429 starts a wait, and an answer that succeeds ends one; anything else
 * changes nothing. Resolves to limitedUntil() once the answer has been read --
 * a 429 with no `Retry-After` is read for its body's window first.
 */
export function noteResponse(response) {
    if (!response || typeof response.status !== 'number') {
        return Promise.resolve(limitedUntil());
    }

    if (response.ok) {
        if (until !== null) {
            until = null;
            tell();
        }

        return Promise.resolve(null);
    }

    if (response.status !== 429) {
        return Promise.resolve(limitedUntil());
    }

    const now = Date.now();
    const header = response.headers && typeof response.headers.get === 'function'
        ? response.headers.get('Retry-After')
        : null;
    const seconds = retryAfterSeconds(header, now);

    if (seconds !== null) {
        return Promise.resolve(wait(now + seconds * 1000));
    }

    return readBody(response).then((body) => {
        const window = windowSeconds(body);

        return wait(window === null ? Infinity : Date.now() + window * 1000);
    });
}

/**
 * the moment the reader's wait ends, in ms since the epoch -- Infinity while it
 * lasts until an answer succeeds -- or null when they are not waiting.
 */
export function limitedUntil(now = Date.now()) {
    if (until !== null && until <= now) {
        until = null;
    }

    return until;
}

/**
 * hear each change a 429 or a success makes, with limitedUntil(). Answers the
 * function that stops hearing.
 */
export function subscribe(listener) {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

/**
 * no wait, and no one listening: where a test starts.
 */
export function resetRateLimit() {
    until = null;
    listeners.clear();
}
