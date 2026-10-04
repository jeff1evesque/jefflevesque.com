/**
 * blocked-answer.js: what the api answers a request past its rate limit (#210),
 * as a fetch Response, for the suites of every place the site asks the api.
 *
 * A 429, with how long to wait in `Retry-After`, and the limit and its window in
 * the body, in the api's usual envelope. `clone` answers a fresh copy, as a real
 * Response's does, since rate-limit.js reads the body from a copy.
 *
 * Note: outside __tests__, so jest does not collect it as a suite, and outside
 *       import/, so it is never instrumented -- as validator-source.js is.
 */

export const BLOCKED_BODY = {
    report: {
        error: 'Too many requests from this address. Wait a few minutes, then try again.',
        limit: 100,
        window_seconds: 300,
    },
};

/**
 * a 429, its `Retry-After` the seconds given -- or none, for null -- and its body
 * the one given.
 */
export function blockedAnswer({ retryAfter = 300, body = BLOCKED_BODY } = {}) {
    const make = () => ({
        ok: false,
        status: 429,
        headers: {
            get: (name) => (String(name).toLowerCase() === 'retry-after' && retryAfter !== null
                ? String(retryAfter)
                : null),
        },
        json: () => Promise.resolve(body),
        clone: () => make(),
    });

    return make();
}
