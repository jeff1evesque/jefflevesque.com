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

//
// hardcoded, like every other api caller in this codebase -- data.jsx, stream.jsx
// and alarm.jsx all name their endpoint inline. The '.replace' substitution
// mechanism carries cognito and region config that differs per deployment; the
// public api path does not.
//
const KNOWLEDGE_GRAPH = 'https://api.jefflevesque.com/v1/public/knowledge-graph';

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

            const url = new URL(base);
            url.searchParams.append('Graph', listing.default);

            return report(url);
        })
        .catch((e) => {
            const detail = (e && e.status) ? `status ${e.status}` : e;
            console.log(`Error: ${base} returned ${detail}`);
            return null;
        });
}

export { KNOWLEDGE_GRAPH };
