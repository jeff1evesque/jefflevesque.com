/**
 * source.js: which graph the graph page draws, and where it gets it.
 *
 * One page layout draws two graphs, and they are the builder's own split:
 *
 *     Training graph    a published PyG build, read from its schema -- the graph a
 *                       graph neural network trains and runs on
 *     Retrieval graph   one day of the published query tables, put into a
 *                       schema's shape -- the graph an LLM's retrieval step reads
 *
 * Everything that differs between the two is here, as a SOURCE. graph.jsx holds
 * the rest -- the layout, the folding and dragging, the legend, the canvas and the
 * tables -- and asks the source whenever what it needs to know is which graph it
 * is drawing:
 *
 *     list()               the choices the picker offers, and the default:
 *                          { default, choices: [{ id, ... }] }, or null
 *     load(id)             one choice's document, in the shape of a build's
 *                          schema, or null
 *     rows                 the details panel's rows -- see DETAILS below
 *     labels(choices)      what the picker calls each choice
 *     summary(choice, whole)  what the folded details panel says instead of itself
 *     requests(id)         the request, or requests, a choice is drawn from, each
 *                          named for the icon that opens it
 *
 * and in the words the page uses for it: its heading, the address a choice is
 * linked at, the picker's name, the panel's title, what a failure says, where the
 * reader's arrangement of the page is kept, and whether its node types carry an
 * ontology term.
 *
 * And by what a node type WEIGHS, which decides which sixty of them the canvas
 * draws -- see filter-schema.js. The two are drawn alike, every node the same
 * size, so this is what makes them two pictures:
 *
 *     Training graph    by nodes. A build's bulk is market quotes, nine million
 *                       option snapshots a day, which is what a graph neural
 *                       network is trained on.
 *     Retrieval graph   by entities, the nodes that carry text and so can be
 *                       found by name. Not one market snapshot does, and weighed
 *                       by nodes the day drew its own build again: 56 of the
 *                       same 60 types, measured on 2026-09-23. By entities, 21.
 *
 * Note: a DAY is the unit of the retrieval side for the reason the tables give.
 *       Every day is written whole, so a question across days sees each node
 *       once per day that holds it, and the ids an edge joins on are renumbered
 *       daily. A picker of days is what makes every row on the page one day's.
 */

import { getGraphListing, getGraphById } from '../../general/get-graph-schema.js';
import { getTableDays, getTableDay, daysRequest, dayRequests } from '../../general/get-graph-tables.js';
import { knowledgeGraphUrl } from '../../general/api-url.js';

const COMPACT = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumSignificantDigits: 3,
});

function when(iso) {
    if (!iso) {
        return 'n/a';
    }

    const zone = /(Z|[+-]00:?00)$/.test(String(iso)) ? ' UTC' : '';

    return String(iso).replace('T', ' ').replace(/(:\d\d).*$/, '$1').replace(/\+.*$/, '') + zone;
}

function count(n) {
    return typeof n === 'number' ? n.toLocaleString() : 'n/a';
}

//
// the first schema version that says which sources reached the graph, rather
// than only which ones its run read. See graphSources.
//
const SOURCES_IN_GRAPH = [1, 4];

//
// whether a schema's `version` is at least [major, minor].
//
// Compared a part at a time, as numbers. As text or as one float, '1.10' would
// come out below '1.4'.
//
// Note: a version that is missing or does not parse is below every version,
//       so the page reads that build the way it read every build before 1.4.
//
function atLeast(version, [major, minor]) {
    const [have, part] = String(version || '').split('.').map(Number);

    return have > major || (have === major && part >= minor);
}

/**
 * the sources the GRAPH holds, which need not be every source its run read.
 *
 * The listing's `sources` is what the run read. From schema 1.4 a build also
 * says what reached the graph, in `build_metadata.sources_in_graph`, and the two
 * can differ by a whole source: the daily run reads noaa and leaves every one of
 * its node types out of the graph. Below 1.4 a build cannot say, and `sources`
 * is the only account there is. It is what this row showed for every build
 * before.
 *
 * Note: undefined while there is no schema, because until there is one it is
 *       not known which of the two lists applies. The listing's list is not a
 *       safe guess: on a 1.4 build it names a source the graph does not hold.
 */
function graphSources(build, schema) {
    if (!schema) {
        return undefined;
    }

    const sources = atLeast(schema.version, SOURCES_IN_GRAPH)
        ? (schema.build_metadata || {}).sources_in_graph
        : build.sources;

    return (sources || []).join(', ');
}

//
// the build panel's rows: what each is called, and how to read it off a listing
// entry. `schema` marks the one row that is read off the build's schema as
// well, and so has to wait for it. See details in graph.jsx.
//
// A table rather than a list built inline, because the placeholder that stands
// in for this panel while the listing is still on its way is laid out from the
// same labels -- see pending.jsx. Two copies of them drift apart the first time
// a row is added to one of them.
//
const DETAILS = [
    { label: 'Nodes', read: (build) => count(build.nodes) },
    { label: 'Edges', read: (build) => count(build.edges) },
    { label: 'Sources', read: graphSources, schema: true },
    { label: 'Run', read: (build) => when(build.run) },
    { label: 'Built', read: (build) => when(build.built) },
    { label: 'Dataset', read: (build) => build.dataset },
    { label: 'Variant', read: (build) => build.variant },
];

//
// what tells the builds in the picker apart, which is not what the listing
// calls them.
//
// The listing labels a build with a sentence -- 'September 2026 (all-sources,
// 1024d, run 2026-09-19 05:00 UTC)' -- and the builds it returns differ only in
// the last few characters of it. Seven of those made a 466px control beside the
// page heading, and, in a phone's option list, seven wrapped paragraphs to
// choose between builds that read as identical until their end.
//
// Every constant part of that sentence is already on the page, in the build
// panel directly below it: Dataset, Variant, Run. So an option says the run
// time -- the part that differs, in the words the Run row uses -- and then
// whatever else actually varies across THIS listing, which is nothing while
// every published build is the same dataset and variant.
//
// Note: `period` is deliberately not one of the fields that can be added. It is
//       a partition key rather than a window over the data -- see the note below
//       -- and an option ending '2026-09' would put it back in front of a reader
//       as though it bounded something.
//
// Note: the listing's own labels are used for ALL of them when the derived ones
//       do not tell every build apart: two builds run in the same minute would
//       both read '2026-09-19 05:00 UTC'. A shorter label is worth having, and a
//       label that names two different builds is not.
//
const DISTINGUISHING = ['dataset', 'variant'];

function pickerLabels(graphs) {
    const varies = DISTINGUISHING.filter(
        (key) => new Set(graphs.map((build) => build[key])).size > 1
    );

    const labels = graphs.map((build) => (build.run
        ? [when(build.run), ...varies.map((key) => build[key]).filter(Boolean)].join(' · ')
        : build.label));

    return new Set(labels).size === labels.length ? labels : graphs.map((build) => build.label);
}

//
// There is deliberately no 'Period' row among the build's details, and the
// listing's `period` is read by nothing on the page.
//
// It is a PARTITION KEY: the builds are listed out of a partition, and an id is
// selected from within it. It is not a window over the data, and a row headed
// 'Period' invited every reader to take it for one. The September build carries
// 76 distinct dates -- `bls_enrichment_UnifiedDay` in its own schema -- across
// economic series going back eighteen years, so '2026-09' bounds none of it.
//
// The page said so twice before arriving here. First as a derived day range,
// '2026-09-01 – 2026-09-19', whose end was the run date wearing a coverage
// date's clothes. Then as 'September 2026', which dropped the invented precision
// and kept the false framing. What a reader can actually use is in the rows that
// remain -- and the partition itself is already in the picker's label, where it
// reads as part of a build's name rather than as a claim about its contents.
//

//
// Note: 'Nodes', not 'Node types', on the folded panel as in its first row. The
//       listing's figure is every node in the build -- ten million of them --
//       while a node TYPE is what one circle on the canvas stands for.
//
function buildSummary(build) {
    return build && typeof build.nodes === 'number'
        ? `${COMPACT.format(build.nodes)} nodes`
        : null;
}

const BUILDS = {
    heading: 'Training graph',
    surface: 'graph',
    param: 'graph',
    path: (id) => `/graph/${encodeURIComponent(id)}`,
    picker: { label: 'Build', name: 'Published build' },
    panel: 'Build details',
    rows: DETAILS,
    failed: {
        list: 'The published builds could not be listed.',
        load: 'That build could not be loaded.',
    },
    terms: true,
    scope: 'in this build',
    weight: 'count',
    lookups: false,

    //
    // Note: the listing is what decides which builds exist. An empty one is no
    //       different to the page from one that could not be had -- there is
    //       nothing to pick, and nothing to draw.
    //
    list: () => getGraphListing().then((listing) => (listing && listing.graphs.length
        ? { default: listing.default, choices: listing.graphs }
        : null)),
    load: (id) => getGraphById(id),
    labels: pickerLabels,
    summary: buildSummary,

    //
    // the build the picker has selected, as getGraphById fetches it -- or the
    // listing, before one is selected
    //
    requests: (id) => [{ url: knowledgeGraphUrl(id), label: 'This request' }],
};

//
// a total over a day's rows, of one measure: every node of every type, every
// edge, every findable entity or every fact.
//
function total(types, measure = 'count') {
    return Object.values(types).reduce((sum, type) => sum + (type[measure] || 0), 0);
}

//
// the day panel's rows, as DETAILS is the build panel's.
//
// A build's listing entry describes the build before its schema arrives -- how
// many nodes, when it ran. A day's describes nothing but the day, so every other
// row is TOTALLED from the day's own rows, and waits for them: `schema` on each.
//
// `pending` is the width a row's value is drawn at while it waits, as pending.jsx
// does for the build panel's: a date, totals in the thousands and the millions,
// and two counts of types in the hundreds.
//
// Note: 'Entities' and 'Facts' lead, because they are what this graph is drawn
//       by: the nodes that carry text, and so can be found by name, and the
//       values held about them. 'Nodes' and 'Edges' are every node and every
//       edge the day holds, the figures the build panel's first two rows give
//       for a build. 'Node types' and 'Edge types' are what the canvas and the
//       tables below it count.
//
const DAY_DETAILS = [
    { label: 'Day', read: (day) => day.id, pending: '6rem' },
    {
        label: 'Entities',
        read: (day, whole) => whole && count(total(whole.node_types, 'entities')),
        schema: true,
        pending: '3.5rem',
    },
    {
        label: 'Facts',
        read: (day, whole) => whole && count(total(whole.node_types, 'facts')),
        schema: true,
        pending: '4.5rem',
    },
    { label: 'Nodes', read: (day, whole) => whole && count(total(whole.node_types)), schema: true, pending: '5rem' },
    { label: 'Edges', read: (day, whole) => whole && count(total(whole.edge_types)), schema: true, pending: '5.5rem' },
    {
        label: 'Node types',
        read: (day, whole) => whole && count(Object.keys(whole.node_types).length),
        schema: true,
        pending: '2rem',
    },
    {
        label: 'Edge types',
        read: (day, whole) => whole && count(Object.keys(whole.edge_types).length),
        schema: true,
        pending: '2rem',
    },
];

const DAYS = {
    heading: 'Retrieval graph',
    surface: 'graph-retrieval',
    param: 'day',
    path: (day) => `/graph/retrieval/${encodeURIComponent(day)}`,
    picker: { label: 'Day', name: 'Published day' },
    panel: 'Day details',
    rows: DAY_DETAILS,
    failed: {
        list: 'The published days could not be listed.',
        load: 'That day could not be loaded.',
    },
    terms: false,
    scope: 'on this day',
    weight: 'entities',
    lookups: true,
    chosen: 'by what can be found by name',

    //
    // the newest day is the default, the way the listing's default build is: it
    // is the one a reader arriving with no day in mind wants.
    //
    list: () => getTableDays().then((days) => (days && days.length
        ? { default: days[0], choices: days.map((day) => ({ id: day })) }
        : null)),
    load: (day) => getTableDay(day),
    labels: (choices) => choices.map((choice) => choice.id),

    //
    // the day's findable entities, once its rows have arrived to be totalled --
    // the measure this graph is drawn by. Before then there is nothing to say
    // that the heading does not.
    //
    summary: (day, whole) => (whole ? `${COMPACT.format(total(whole.node_types, 'entities'))} entities` : null),

    //
    // both of the day's requests, named apart -- or the listing of days, before
    // one is selected
    //
    requests: (day) => {
        if (!day) {
            return [{ url: daysRequest(), label: 'This request' }];
        }

        const { nodeTypes, edgeTypes } = dayRequests(day);

        return [
            { url: nodeTypes, label: 'Node types request' },
            { url: edgeTypes, label: 'Edge types request' },
        ];
    },
};

export { BUILDS, DAYS, DETAILS, DAY_DETAILS, pickerLabels, graphSources, when };
