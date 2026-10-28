/**
 * account-api.js: the account api, as the pages call it -- a signed-in reader's alarm
 *                 subscriptions, and the alarms there are to subscribe to: each
 *                 stream's, and each model's (#255).
 *
 *     signedIn()                             whether there is a reader at all, asking no one
 *     readerToken()                          the reader's own ID token, for them to copy
 *     readAsReader(url)                      another api's private GET, as the reader (#290)
 *     listSubscriptions()                    the reader's subscriptions, every stream's and model's
 *     subscribe(stream, alarm, terms)        subscribe, having accepted that version of the terms
 *     unsubscribe(stream, alarm)             unsubscribe
 *     subscribeModel(model, alarm, terms)    the same, for a model's alarm
 *     unsubscribeModel(model, alarm)         the same, for a model's alarm
 *     streamAlarms(stream)                   a stream's alarms, the same for every reader
 *     modelAlarms(model)                     a model's alarms, the same for every reader
 *
 * Listing, subscribing and unsubscribing carry the reader's ID token as a bearer
 * token, and it is the only thing in a request that says who is asking: the api reads
 * the reader from the token and from nothing else, so no username or email address is
 * ever sent. See currentUser.js.
 *
 * Signed out -- no token to send, or one the api answers 401 -- each of those resolves
 * to null rather than rejecting, and with no token it makes no request at all. A page
 * reads null as the signed-out view: a session that has ended is not an error, and
 * should not look like one.
 *
 * Any other refusal rejects with an AccountError, carrying the status and the api's
 * own message. Those are written for a reader -- a 403 asks them to verify their
 * email address, a 503 to try again -- and the pages show them as they are.
 */

import amplifyCurrentUser from './currentUser.js';
import {
    alarmsUrl,
    modelAlarmsUrl,
    subscriptionsUrl,
    subscriptionUrl,
    modelSubscriptionUrl,
} from './api-url.js';

export class AccountError extends Error {
    constructor(status, message) {
        super(message);

        this.name = 'AccountError';
        this.status = status;
    }
}

//
// what a failure says when the api said nothing a reader can use: the network
// failed, or the answer was not the api's own json
//
export const UNREACHABLE = 'The account service could not be reached. Try again.';

//
// what a signed-out call resolves to inside this module, kept apart from a report
// that is null -- an unsubscribe answers 200 with a null report
//
const SIGNED_OUT = { signed_out: true };

//
// the answer's report, or null when it carries none
//
async function reportOf(response) {
    try {
        const body = await response.json();

        return body && typeof body === 'object' && 'report' in body ? body.report : null;
    } catch (error) {
        return null;
    }
}

//
// the report of an answer that succeeded, or an AccountError carrying the api's
// message for one that did not
//
async function answer(response) {
    const report = await reportOf(response);

    if (response.ok) {
        return report;
    }

    const message = report && typeof report.error === 'string' && report.error
        ? report.error
        : UNREACHABLE;

    throw new AccountError(response.status, message);
}

async function send(url, options) {
    try {
        return await fetch(url, options);
    } catch (error) {
        throw new AccountError(0, UNREACHABLE);
    }
}

//
// a request as the signed-in reader: SIGNED_OUT without a token, or when the api
// refuses the token, and otherwise { report }
//
// Note: the body is json only on a subscribe, and the Content-Type goes with it.
//       Every request here is preflighted anyway -- Authorization is not a header
//       a browser sends cross-origin without asking -- and the api allows both.
//
async function asReader(url, method, body) {
    const token = await amplifyCurrentUser();

    if (!token) {
        return SIGNED_OUT;
    }

    const headers = { Authorization: `Bearer ${token}` };
    const options = { method: method, headers: headers };

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    const response = await send(url, options);

    if (response.status === 401) {
        return SIGNED_OUT;
    }

    return { report: await answer(response) };
}

/**
 * whether a reader is signed in, from the session alone: no request is made. A page
 * asks this to choose between its signed-in and signed-out views before a list of
 * subscriptions has had time to arrive, so a signed-in reader is never asked to
 * sign in while it does. Never rejects.
 *
 * Note: only a first answer. The api is what decides, and a list, a subscribe or an
 *       unsubscribe that comes back signed out -- a session ended since -- is what
 *       a page then goes by.
 */
export async function signedIn() {
    return Boolean(await amplifyCurrentUser());
}

/**
 * the reader's own ID token, for Account Settings to show them and copy, so a script
 * can call the api as they do. Read through the session as every call here reads it,
 * so it is always a current one -- see currentUser.js. Null signed out, and no
 * request is made. Never rejects.
 *
 * Note: asked for when the reader asks to see it, and not before. A page holding the
 *       token only while it shows it is a page that cannot leak it anywhere else.
 */
export async function readerToken() {
    return amplifyCurrentUser();
}

/**
 * a GET of another of the site's apis as the signed-in reader (#290), asked as every
 * call here is: the ID token as a bearer token, no request at all while signed out,
 * and a 401 read as a session that has ended. Resolves to { report }, or null signed
 * out. Any other refusal rejects with an AccountError carrying its status.
 *
 * The model api serves an options model's picks this way -- see model/source.js's
 * loadOptionPicks -- on a private path of its own, as this api serves a reader's
 * subscriptions.
 */
export async function readAsReader(url) {
    const result = await asReader(url, 'GET');

    return result === SIGNED_OUT ? null : result;
}

/**
 * the reader's subscriptions, each as the api answers it: a stream's as
 * { stream, alarm, since, terms }, and a model's as { model, alarm, since, terms }
 * (#255). Null when signed out.
 *
 * Note: both kinds come in one list, so a page that draws one kind reads it by the
 *       name it carries -- a model's has no 'stream', and a stream's no 'model'.
 */
export async function listSubscriptions() {
    const result = await asReader(subscriptionsUrl(), 'GET');

    if (result === SIGNED_OUT) {
        return null;
    }

    return Array.isArray(result.report) ? result.report : [];
}

/**
 * subscribe to one alarm, sending the version of the terms the reader accepted.
 * Resolves to the subscription -- new, or already held, which the api treats alike
 * -- or null when signed out.
 */
export async function subscribe(stream, alarm, terms) {
    const result = await asReader(subscriptionUrl(stream, alarm), 'PUT', { terms: terms });

    return result === SIGNED_OUT ? null : result.report;
}

/**
 * unsubscribe from one alarm. Resolves to true -- also when it was not held, which
 * the api treats as done -- or null when signed out.
 */
export async function unsubscribe(stream, alarm) {
    const result = await asReader(subscriptionUrl(stream, alarm), 'DELETE');

    return result === SIGNED_OUT ? null : true;
}

/**
 * subscribe to one of a model's alarms (#255), as subscribe does a stream's.
 * Resolves to the subscription, or null when signed out.
 */
export async function subscribeModel(model, alarm, terms) {
    const result = await asReader(modelSubscriptionUrl(model, alarm), 'PUT', { terms: terms });

    return result === SIGNED_OUT ? null : result.report;
}

/**
 * unsubscribe from one of a model's alarms (#255). Resolves to true, also when it
 * was not held, or null when signed out.
 *
 * Note: a retired model's alarm can still be unsubscribed from. The api reads no
 *       listing to remove one, so one held is never stranded.
 */
export async function unsubscribeModel(model, alarm) {
    const result = await asReader(modelSubscriptionUrl(model, alarm), 'DELETE');

    return result === SIGNED_OUT ? null : true;
}

/**
 * a stream's alarms, each { id, name }. Public, so asked with no token, and the
 * same for a signed-out reader as for a signed-in one.
 *
 * Note: none for a stream the api does not know yet, which it answers 404 'no
 *       such stream': the stock tickers' until their alarm is added (#314). So
 *       their page says they have none, and lists the alarm once there is one,
 *       rather than saying the list could not be had.
 */
export async function streamAlarms(stream) {
    try {
        const report = await answer(await send(alarmsUrl(stream), undefined));

        return Array.isArray(report) ? report : [];
    } catch (error) {
        if (error instanceof AccountError && error.status === 404) {
            return [];
        }

        throw error;
    }
}

/**
 * a model's alarms, each { id, name } (#255): none for a retired model. Public, as
 * a stream's are, so asked with no token.
 */
export async function modelAlarms(model) {
    const report = await answer(await send(modelAlarmsUrl(model), undefined));

    return Array.isArray(report) ? report : [];
}
