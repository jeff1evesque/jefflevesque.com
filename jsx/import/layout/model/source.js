/**
 * source.js: where the model pages get what they draw (#243): the listing of
 * models, and a model's history and track record, from the model api, and an
 * options model's picks (#279), from its private path, for a signed-in reader
 * (#290).
 *
 *     GET <model>                                              -> { report: { tasks: [...], models: [...] } }
 *     GET <model>?Model=<name>&Report=history                  -> { report: '<csv>' }
 *     GET <model>?Model=<name>&Report=track-record             -> { report: '<csv>' }
 *     GET <private model>?Model=<name>&Report=picks[&Ticker=AAPL]
 *         with the reader's ID token                           -> { report: '<csv>' }
 *
 * Each answer is read in a worker -- see worker/model/report.js -- which hands
 * back what the pages draw: the listing's tasks and models, or a report's rows,
 * with a track record's 20-day averages worked out.
 *
 * Note: the public answers' envelope is read by get-graph-schema.js's `report`,
 *       as the tables' is. Every api answers in it, and one reading of it means
 *       they cannot come to disagree about it. The picks' is read by
 *       account-api.js, which sends a signed-in reader's requests.
 *
 * Note: failures resolve to null, and are logged with console.log rather than
 *       console.error, as get-graph-schema.js's are and for its reason. Until
 *       the api answers, every request is one: the pages say there is nothing to
 *       show yet. The picks tell a reader signed out, picks there are none of and
 *       a failure apart, since the page says something different for each.
 */

import WorkerBuilder from '../../worker/web-worker.js';
import workerModelReport from '../../worker/model/report.js';
import { ENDPOINTS, MODEL_PICKS, modelPicksUrl, modelUrl } from '../../general/api-url.js';
import { AccountError, readAsReader } from '../../general/account-api.js';
import { report as envelope } from '../../general/get-graph-schema.js';

const MODEL = ENDPOINTS.model;

//
// what loadOptionPicks resolves to where it has no picks to hand back (#290): a
// reader signed out, or whose session the api no longer takes; a model or a
// stock with none; and picks that could not be read
//
export const PICKS_SIGNED_OUT = 'signed-out';
export const NO_PICKS = 'none';
export const PICKS_FAILED = 'failed';

function logged(what, e) {
    const detail = (e && e.status) ? `status ${e.status}` : e;
    console.log(`Error: ${what} returned ${detail}`);

    return null;
}

/**
 * what the worker makes of one answer: { kind, name, ... } as it posts it, or
 * null where the worker could not run.
 *
 * Note: a worker for each answer, let go once it has answered. A row's trend
 *       line and the compare chart ask for one track record each, at once, and
 *       none of them waits on another.
 */
export function readInWorker(kind, value, name = null) {
    return new Promise((resolve) => {
        const worker = new WorkerBuilder(workerModelReport);

        worker.onmessage = (event) => {
            worker.terminate();
            resolve(event.data);
        };

        worker.onerror = (err) => {
            worker.terminate();
            console.log('Error (web-worker): could not read the model report');
            console.log(err);
            resolve(null);
        };

        worker.postMessage({ kind: kind, report: value, name: name });
    });
}

/**
 * the listing: { tasks, models }, or null where it cannot be had.
 */
export function loadListing(base = MODEL) {
    return envelope(modelUrl(null, null, base))
        .then((value) => readInWorker('list', value))
        .then((read) => (read && Array.isArray(read.models)
            ? { tasks: read.tasks, models: read.models }
            : Promise.reject(read)))
        .catch((e) => logged(`${base} listing`, e));
}

/**
 * one of a model's reports, 'history' or 'track-record': its rows, oldest
 * first, or null where they cannot be had. A model with none yet has an empty
 * list, which is not a failure.
 */
export function loadReport(name, kind, base = MODEL) {
    //
    // the url built inside the chain, so a request modelUrl refuses -- a report
    // the api does not keep -- is a failure like any other rather than a throw
    //
    return Promise.resolve()
        .then(() => envelope(modelUrl(name, kind, base)))
        .then((value) => readInWorker(kind, value, name))
        .then((read) => (read && Array.isArray(read.rows) ? read.rows : Promise.reject(read)))
        .catch((e) => logged(`${base} Model=${name} Report=${kind}`, e));
}

/**
 * an options model's picks (#279), from the model api's private path, asked as
 * the signed-in reader (#290): each hold's top 10, or with `ticker` that stock's
 * options, best first, up to 100 for each hold -- their rows, each hold's apart
 * and best first. Where it has none to hand back, which of three:
 *
 *     PICKS_SIGNED_OUT   no reader signed in, or a session the api no longer
 *                        takes. Signed out, nothing is asked at all
 *     NO_PICKS           a model or a stock the api has no picks for, which it
 *                        answers with a 404, an answer with no rows, and a ticker
 *                        that is no stock's symbol, which is never sent
 *     PICKS_FAILED       anything else: the request never landed, the api failed,
 *                        or the worker could not read its answer
 */
export function loadOptionPicks(name, ticker = null, base = MODEL_PICKS) {
    const what = `${base} Model=${name} Report=picks${ticker ? ` Ticker=${ticker}` : ''}`;

    //
    // the url built inside the chain, as a report's is, so a ticker that
    // modelPicksUrl refuses is answered rather than thrown
    //
    return Promise.resolve()
        .then(() => readAsReader(modelPicksUrl(name, ticker, base)))
        .then((answered) => {
            if (answered === null) {
                return PICKS_SIGNED_OUT;
            }

            return readInWorker('option-picks', answered.report, name).then((read) => {
                if (!read) {
                    logged(what, 'what the worker could not read');
                    return PICKS_FAILED;
                }

                return Array.isArray(read.rows) ? read.rows : NO_PICKS;
            });
        })
        .catch((e) => {
            logged(what, e);

            if (!(e instanceof AccountError)) {
                return NO_PICKS;
            }

            return e.status === 404 ? NO_PICKS : PICKS_FAILED;
        });
}

export { MODEL };
