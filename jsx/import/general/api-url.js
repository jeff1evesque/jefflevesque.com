/**
 * api-url.js: the requests this application makes to its three public apis, and
 *             where each api is documented.
 *
 *     performance       read by /stream                        Stream, Interval, Timezone
 *     datalake          read by /data, /stream/:stream/alarm   Data, Scale
 *     knowledge-graph   read by /graph and /                   Graph
 *
 * Every url a page fetches from these apis is built here, and so is the link that
 * shows a reader the request behind what the page draws. One builder for both is
 * the point of the module: a link assembled apart from the request it describes is
 * one refactor away from describing a different request.
 *
 * Note: the parameters are the ones this application sends, and each is declared
 *       in its api's OpenAPI document under documentation/api/openapi/.
 *       api-url.test.js reads those documents and fails when the two disagree, so
 *       a parameter cannot be added here without being documented there.
 */

const API = 'https://api.jefflevesque.com/v1/public';

const ENDPOINTS = {
    performance: `${API}/performance`,
    datalake: `${API}/datalake`,
    knowledgeGraph: `${API}/knowledge-graph`,
};

//
// the documentation site, and each api's reference page on it. Moving the site is
// a change to this one constant.
//
const DOCUMENTATION = 'https://jeff1evesque.github.io/jefflevesque.com';

const API_DOCS = {
    performance: `${DOCUMENTATION}/api/performance/`,
    datalake: `${DOCUMENTATION}/api/datalake/`,
    knowledgeGraph: `${DOCUMENTATION}/api/knowledge-graph/`,
};

//
// the datalake's name for each stream's dataset, keyed by stream id. They are not
// the same strings -- three of the five differ -- and a page that sent the stream
// id instead ('stockmarket') was answered with a 400. Both pages that ask the
// datalake read their dataset from here.
//
const DATASETS = {
    stockmarket: 'stock-market',
    stockmarketstocksplit: 'stock-split',
    bls: 'bls',
    sec: 'sec',
    usnationalweather: 'us-weather-alert',
};

function withParams(base, params) {
    const url = new URL(base);

    Object.keys(params).forEach((key) => url.searchParams.append(key, params[key]));

    return url;
}

/**
 * one stream's ingest performance over its trailing window, bucketed by `interval`
 * and measured on `timezone`'s calendar.
 *
 * Note: the zone travels with the request rather than being applied to the answer.
 *       A trailing 20 days ending at 22:00 in Tokyo is not the same 20 dates as one
 *       ending at 09:00 in New York.
 */
export function performanceUrl(stream, interval, timezone, base = ENDPOINTS.performance) {
    return withParams(base, {
        Stream: String(stream).toLowerCase(),
        Interval: String(interval).toLowerCase(),
        Timezone: timezone,
    });
}

/**
 * one dataset's record distribution, and its partition count, for a month.
 *
 * Note: `data` is a DATASET name -- 'stock-market', 'stock-split', 'bls', 'sec',
 *       'us-weather-alert' -- not a stream id. The two differ for three of the
 *       five, and the api answers a stream id such as 'stockmarket' with a 400.
 */
export function datalakeUrl(data, year, month, base = ENDPOINTS.datalake) {
    return withParams(base, {
        Data: data,
        Scale: JSON.stringify({ year: year, month: String(month).padStart(2, '0') }),
    });
}

/**
 * the listing of published knowledge graph builds or, given an id from that
 * listing, one build's schema.
 */
export function knowledgeGraphUrl(graph = null, base = ENDPOINTS.knowledgeGraph) {
    return graph ? withParams(base, { Graph: graph }) : new URL(base);
}

export { API, ENDPOINTS, DOCUMENTATION, API_DOCS, DATASETS };
