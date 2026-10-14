/**
 * source.js: where the model pages get what they draw (#243): the listing of
 * models, and a model's history and track record, from the model api.
 *
 *     GET <model>                                   -> { report: { tasks: [...], models: [...] } }
 *     GET <model>?Model=<name>&Report=history       -> { report: '<csv>' }
 *     GET <model>?Model=<name>&Report=track-record  -> { report: '<csv>' }
 *
 * Each answer is read in a worker -- see worker/model/report.js -- which hands
 * back what the pages draw: the listing's tasks and models, or a report's rows,
 * with a track record's 20-day averages worked out.
 *
 * Note: the envelope is read by get-graph-schema.js's `report`, as the tables'
 *       is. Every api answers in it, and one reading of it means they cannot
 *       come to disagree about it.
 *
 * Note: failures resolve to null, and are logged with console.log rather than
 *       console.error, as get-graph-schema.js's are and for its reason. Until
 *       the api answers, every request is one: the pages say there is nothing to
 *       show yet.
 */

import WorkerBuilder from '../../worker/web-worker.js';
import workerModelReport from '../../worker/model/report.js';
import { ENDPOINTS, modelUrl } from '../../general/api-url.js';
import { report as envelope } from '../../general/get-graph-schema.js';

const MODEL = ENDPOINTS.model;

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

export { MODEL };
