/**
 * api-url.js: the requests this application makes to its three public apis, and
 *             where each api is documented.
 *
 *     performance       read by /stream                        Stream, Interval, Timezone
 *                       its archive, the published files       (none)
 *     datalake          read by /data, /stream/:stream/alarm   Data, Scale
 *     knowledge-graph   read by /graph and /                   (the id, in the path)
 *                       its tables, read by /graph/retrieval   Day, Limit
 *                         and one path per question            Text, Uri, Symbol
 *
 * Three apis, and the knowledge graph has two shapes. It answers what a build IS on
 * two paths taking their id in the path, and what the published tables CONTAIN on
 * more, one per question, each taking only that question's values. Separate builders
 * for that reason.
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

import {
    STOCK_MARKET,
    STOCK_SPLIT,
    BLS,
    SEC,
    US_NATIONAL_WEATHER,
    canonicalStream,
} from './stream-id.js';

const API = 'https://api.jefflevesque.com/v1/public';

const ENDPOINTS = {
    performance: `${API}/performance`,
    performanceArchive: `${API}/performance/archive`,
    datalake: `${API}/datalake`,
    knowledgeGraph: `${API}/knowledge-graph`,
    knowledgeGraphTables: `${API}/knowledge-graph/tables`,
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
// the datalake's name for each stream's dataset, keyed by stream id. Both pages
// that ask the datalake read their dataset from here.
//
// The two are different names for different things, even where they are the same
// string. They used to differ for three of the five, and a page that sent the
// stream id ('stockmarket') was answered with a 400. They differ for one now --
// the weather stream's dataset is 'us-weather-alert' -- and the datalake's names
// are its own, so they are not assumed to stay alike.
//
const DATASETS = {
    [STOCK_MARKET]: 'stock-market',
    [STOCK_SPLIT]: 'stock-split',
    [BLS]: 'bls',
    [SEC]: 'sec',
    [US_NATIONAL_WEATHER]: 'us-weather-alert',
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
 *
 * Note: the stream is sent by its id, whatever name it was handed by -- see
 *       canonicalStream. A name that is no stream's is sent lower-cased, as
 *       given, and the api answers it with a 400 that names what it accepts.
 */
export function performanceUrl(stream, interval, timezone, base = ENDPOINTS.performance) {
    return withParams(base, {
        Stream: canonicalStream(stream) || String(stream).toLowerCase(),
        Interval: String(interval).toLowerCase(),
        Timezone: timezone,
    });
}

/**
 * the listing of the csvs each stream has published: a file per year or per
 * month, each with the url it is served from.
 *
 * Note: the page links each file's `url` rather than asking the api for it. The
 *       api answers `archive/<stream>/<year>[/<month>]` with a redirect to that
 *       same url, but a link to the api is cross-origin, and a browser ignores
 *       `download` on one -- the file would open instead of saving.
 */
export function performanceArchiveUrl(base = ENDPOINTS.performanceArchive) {
    return new URL(base);
}

/**
 * one dataset's record distribution, and its partition count, for a month.
 *
 * Note: `data` is a DATASET name -- 'stock-market', 'stock-split', 'bls', 'sec',
 *       'us-weather-alert' -- not a stream id. Read it from DATASETS: the two
 *       differ for the weather stream, and the api answers a name it does not
 *       know with a 400.
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
 *
 * Note: the id is a path segment rather than a query parameter. The api answers
 *       the two on separate paths, and refuses a query string on either -- a
 *       '?Graph=' left over from the previous shape is a 400 rather than
 *       something ignored.
 *
 * Note: encoded, though an id from the listing never needs it. Ids are opaque,
 *       so this does not get to assume what is in one.
 */
export function knowledgeGraphUrl(graph = null, base = ENDPOINTS.knowledgeGraph) {
    return graph ? new URL(`${base}/${encodeURIComponent(graph)}`) : new URL(base);
}

//
// each question of the tables: the path it is asked on, and what it takes there.
//
// the api refuses a value meaningless to the operation rather than ignoring it, so
// sending one is a 400 -- the lists are held here so it is refused before the
// request instead.
//
// 'Limit' is accepted by every question but Days and left out of the lists, being a
// ceiling on the answer rather than part of the question. Days takes nothing at
// all, a Limit included: it is every published day, a year of them at most, and
// the api refuses a value it would have to ignore.
//
// 'Day' on EdgeTypes and Find narrows them to that day, where each row appears
// once. Without it they read every day in the window, and a row comes back once
// for every day that holds it, with nothing on it saying which.
//
// the operation used to be an 'Operation' parameter on one path. It moved because
// operations taking different parameter sets cannot be described on one path:
// OpenAPI gives a flat parameter list per path, so a document of that shape
// permitted requests the api rejects, and the rendered form on the documentation
// site built one every time.
//
const TABLES_VALUES = {
    Days: { path: 'days', values: [], limit: false },
    EdgeTypes: { path: 'edge-types', values: ['Day'] },
    NodeTypes: { path: 'node-types', values: ['Day'] },
    Find: { path: 'find', values: ['Text', 'Day'] },
    Facts: { path: 'facts', values: ['Uri', 'Day'] },
    Neighborhood: { path: 'neighborhood', values: ['Uri', 'Day'] },
    Quotes: { path: 'quotes', values: ['Symbol', 'Day'] },
    LastQuotes: { path: 'last-quotes', values: ['Day'] },
};

/**
 * one question of the published tables: which days are published, which links
 * exist and how many nodes of each type a day holds, which entities match some
 * text, what is held about one entity, what one entity is linked to within a day,
 * and one stock's quotes through a day or every stock's last.
 *
 * Note: 'Day' is required by Neighborhood, NodeTypes, Quotes and LastQuotes, and
 *       optional for the rest. That asymmetry is the api's, and it is real -- the
 *       numeric ids the tables join on are renumbered daily, so an edge only means
 *       anything joined within its own day, and a node counted across days is
 *       counted once for every day that holds it. Uris are stable across days,
 *       which is what a caller follows instead.
 *
 * Note: a value the named operation does not take throws here rather than being
 *       sent. The api answers one with a 400, so the alternative is a request that
 *       can only fail.
 *
 * Note: the operation names a PATH, not a parameter. Callers pass the same names
 *       they always did -- 'EdgeTypes', 'Find' -- and the segment is this module's
 *       business, so a renamed segment is a change here and nowhere else.
 */
export function knowledgeGraphTablesUrl(operation, values = {}, base = ENDPOINTS.knowledgeGraphTables) {
    const asked = TABLES_VALUES[operation];

    if (!asked) {
        throw new Error(`knowledgeGraphTablesUrl: no such operation '${operation}'`);
    }

    const takes = asked.limit === false ? asked.values : [...asked.values, 'Limit'];
    const given = Object.keys(values).filter((name) => values[name] !== undefined && values[name] !== null && values[name] !== '');
    const unexpected = given.filter((name) => !takes.includes(name));

    if (unexpected.length) {
        throw new Error(`knowledgeGraphTablesUrl: ${operation} does not take ${unexpected.sort().join(', ')}`);
    }

    return withParams(`${base}/${asked.path}`, given.reduce(
        (sent, name) => Object.assign(sent, { [name]: values[name] }),
        {}
    ));
}

export { API, ENDPOINTS, DOCUMENTATION, API_DOCS, DATASETS, TABLES_VALUES };
