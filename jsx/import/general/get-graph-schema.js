/**
 * get-graph-schema.js: fetch a published knowledge graph schema from the site's
 *                      public graph api.
 *
 * Two calls, because a caller picks a build from a listing rather than naming
 * one:
 *
 *     GET <base>                 -> { report: { default, graphs: [...] } }
 *     GET <base>?Graph=<id>      -> { report: { node_types, edge_types, ... } }
 *
 * Ids are opaque: take one from the listing and send it back unchanged.
 *
 * Note: NOT built on general/get-data.js, which is the codebase's other fetch
 *       helper and looks like it should fit. It unwraps 'report' and pipes the
 *       result straight into papaparse -- every other api-* service answers with
 *       a csv string, and this one answers with a json object, so sharing the
 *       helper would parse a graph schema as a spreadsheet.
 *
 * Note: no caching, retry or in-flight de-duplication here, deliberately. The
 *       service sends its own Cache-Control and the browser honours it across
 *       page loads, so a cache here would be a second, worse one.
 *
 * Note: failures are logged with console.log rather than console.error, matching
 *       get-data.js. The test setup turns an unexpected console.error into a
 *       failed test, and a front page that cannot reach the graph api is not a
 *       defect in whatever component happens to be mounting.
 */

import { ENDPOINTS, knowledgeGraphUrl } from './api-url.js';

//
// fixed rather than configured: the '.replace' substitution mechanism carries
// cognito and region config that differs per deployment, and the public api path
// does not. It lives in api-url.js with the other two apis' endpoints, which is
// also where the requests are built.
//
const KNOWLEDGE_GRAPH = ENDPOINTS.knowledgeGraph;

/**
 * fetch one url and unwrap the 'report' envelope every api-* service answers in.
 *
 * A non-ok response and a body without 'report' are both rejections: the service
 * answers errors as a 4xx/5xx carrying 'report.error', so there is no success
 * shape that lacks the envelope.
 */
function report(url) {
    return fetch(url, { method: 'GET' })
        .then((response) => {
            if (response.ok) {
                return response.json();
            }
            return Promise.reject(response);
        })
        .then((json) => {
            if (json && typeof json === 'object' && 'report' in json) {
                return json.report;
            }
            return Promise.reject(json);
        });
}

/**
 * resolve the default published build, then fetch its schema.
 *
 * Resolves to the schema object, or to NULL for every failure -- a rejected
 * fetch, a non-ok response, a listing with nothing servable in it, a malformed
 * body. The caller renders no graph in exactly those cases, so telling them
 * apart would only invite a branch that does the same thing twice.
 */
/**
 * every published build, for a page that lets someone choose between them.
 *
 * The front page never needs this -- it takes the default and draws it -- so it
 * is a separate entry point rather than something bolted onto the call below.
 *
 * Resolves to the listing, or null if it cannot be had.
 */
export function getGraphListing(base = KNOWLEDGE_GRAPH) {
    return report(base)
        .then((listing) => {
            if (!listing || !Array.isArray(listing.graphs)) {
                return Promise.reject(listing);
            }

            return listing;
        })
        .catch((e) => {
            const detail = (e && e.status) ? `status ${e.status}` : e;
            console.log(`Error: ${base} listing returned ${detail}`);
            return null;
        });
}

/**
 * one build's schema, by the id the listing gave.
 *
 * Note: ids are opaque. They come from the listing and go back unchanged -- a
 *       caller that builds one by hand is guessing at a format it does not own.
 */
export function getGraphById(id, base = KNOWLEDGE_GRAPH) {
    if (!id) {
        return Promise.resolve(null);
    }

    return report(knowledgeGraphUrl(id, base)).catch((e) => {
        const detail = (e && e.status) ? `status ${e.status}` : e;
        console.log(`Error: ${base} Graph=${id} returned ${detail}`);
        return null;
    });
}

export default function getGraphSchema(base = KNOWLEDGE_GRAPH) {
    return report(base)
        .then((listing) => {
            {/*

                Note: 'default' can be null, when the listing holds nothing
                      servable. Asking for it anyway would send '?Graph=null'
                      and be rejected.

            */}

            if (!listing || !listing.default) {
                return Promise.reject(listing);
            }

            return report(knowledgeGraphUrl(listing.default, base));
        })
        .catch((e) => {
            const detail = (e && e.status) ? `status ${e.status}` : e;
            console.log(`Error: ${base} returned ${detail}`);
            return null;
        });
}

export { KNOWLEDGE_GRAPH };
