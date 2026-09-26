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
 *
 * Note: the Training graph picks by day as well. A build IS one day of the
 *       tables -- that day's node types and edges, less four node types the
 *       build leaves out -- and its picker used to name each build by when it
 *       ran, which is never the day it holds: the build run on 09-25 holds
 *       09-24. Lining up the two graphs of one day took a rule the page stated
 *       nowhere. A choice is still a build, linked by its id, because one day
 *       can name two builds. See buildDay.
 */

import { getGraphListing, getGraphById } from '../../general/get-graph-schema.js';
import { DAY, getTableDays, getTableDay, daysRequest, dayRequests } from '../../general/get-graph-tables.js';
import { knowledgeGraphUrl } from '../../general/api-url.js';
import { typeSource } from '../../animation/encoding.js';

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
// the first schema version whose builds record the day of the tables they hold,
// which the listing passes on as `day`. See buildDay.
//
const DAY_RECORDED = [1, 5];

//
// the UTC date a run started on, as 'YYYY-MM-DD', or null.
//
// Note: a time published without a zone is read as UTC, which is what the
//       listing says its times are. Read the way Date reads one, in the
//       reader's own zone, a build would hold one day in Tokyo and another in
//       Boston.
//
function runDate(run) {
    if (!run) {
        return null;
    }

    const time = new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(run) ? run : `${run}Z`);

    return Number.isNaN(time.getTime()) ? null : time.toISOString().slice(0, 10);
}

/**
 * the day of the published tables a build holds, as 'YYYY-MM-DD', or null.
 *
 * Which rule applies goes by the schema version the listing carries, as the
 * Sources row goes by the schema's -- see graphSources:
 *
 *     1.5 and later     the listing's `day`, the builder's own record of it,
 *                       whatever the run says. A build of that version with no
 *                       well-formed day has none, and none is guessed for it
 *     older, or none    the newest of `days` before the run's UTC date
 *
 * The second is how the builds have been run, and no build states it. Measured
 * on 2026-09-25, 10 of the 11 listed builds equal that day's tables exactly,
 * node for node and edge for edge, once the four node types a build leaves out
 * are taken out of the day. The Saturday 09-19 run holds Friday 09-18, and the
 * Sunday 09-13 run holds Wednesday 09-09, the tables holding no day between. It
 * is safe because the builds it applies to are a closed set: none from 1.5 on
 * needs it, and the older ones leave the listing in turn.
 *
 * Note: BEFORE the run's date, and not simply the day before it. The tables can
 *       hold the run's own date by the time anyone reads the listing -- the
 *       09-16 17:15 run holds 09-15 -- and they hold no day for a weekend.
 *
 * Note: `days` are the published days, as the rows getTableDays answers name
 *       them, or null when they could not be had. Then an older build has no
 *       day, and keeps the label its run gave it: the Training graph never fails
 *       because the tables did.
 */
function buildDay(build, days) {
    if (atLeast(build.schema_version, DAY_RECORDED)) {
        return typeof build.day === 'string' && DAY.test(build.day) ? build.day : null;
    }

    const date = runDate(build.run);

    return (date && (days || []).filter((day) => day < date).sort().pop()) || null;
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
// Note: the three dates lead. 'Day' is the day the picker names the build by,
//       which list() gives each choice, and 'Run' and 'Built' are when the build
//       ran and when it finished -- which is not that day: the build run on
//       09-25 holds 09-24. The day panel opens with its Day and Run in the same
//       place, and one day shows the same Run on both pages, so that is where
//       the two line up. The rows below them describe what the build holds.
//
// Note: 'Sources' comes straight after the dates, where the day panel has its
//       own under Published: what the run brought in is read with when it ran,
//       ahead of how much it came to. It is the one row read off the schema, so
//       for the round trip the schema takes it holds its bar between rows the
//       listing has already filled -- see details in graph.jsx.
//
const DETAILS = [
    { label: 'Day', read: (build) => build.day },
    { label: 'Run', read: (build) => when(build.run) },
    { label: 'Built', read: (build) => when(build.built) },
    { label: 'Sources', read: graphSources, schema: true },
    { label: 'Nodes', read: (build) => count(build.nodes) },
    { label: 'Edges', read: (build) => count(build.edges) },
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
// panel directly below it: Dataset, Variant, Run. So an option says the DAY the
// build holds -- in the Day row's words, which are the Retrieval graph's, so the
// two pickers name one day alike -- and then whatever else actually varies
// across THIS listing, which is nothing while every published build is the same
// dataset and variant.
//
// Note: one day can name two builds. The 09-10 and 09-13 runs both hold 09-09,
//       the second having written that day again. Those two, and only those,
//       add their run in the Run row's words -- '2026-09-09 · run 2026-09-13
//       15:04 UTC' -- and every other option stays a bare day. It goes by what
//       an option would say rather than by its day alone, so two variants of
//       one run, which their variant already tells apart, do not both add a
//       run that tells them apart from nothing.
//
// Note: a build with no day -- a 1.5 build that records none, or an older one
//       while the published days cannot be had -- is labeled by its run time,
//       as every build was before, and one with no run either by the listing's
//       own label.
//
// Note: `period` is deliberately not one of the fields that can be added. It is
//       a partition key rather than a window over the data -- see the note below
//       -- and an option ending '2026-09' would put it back in front of a reader
//       as though it bounded something.
//
// Note: the listing's own labels are used for ALL of them when the derived ones
//       still do not tell every build apart: two builds of one day run in the
//       same minute would both read '2026-09-09 · run 2026-09-13 15:04 UTC'. A
//       shorter label is worth having, and a label that names two different
//       builds is not.
//
const DISTINGUISHING = ['dataset', 'variant'];

function pickerLabels(graphs) {
    const varies = DISTINGUISHING.filter(
        (key) => new Set(graphs.map((build) => build[key])).size > 1
    );
    const extra = (build) => varies.map((key) => build[key]).filter(Boolean);

    const short = graphs.map((build) => (build.day ? [build.day, ...extra(build)].join(' · ') : null));
    const twice = new Set(short.filter((label, index) => label && short.indexOf(label) !== index));

    const labels = graphs.map((build, index) => {
        if (build.day) {
            return twice.has(short[index]) && build.run
                ? [build.day, `run ${when(build.run)}`, ...extra(build)].join(' · ')
                : short[index];
        }

        return build.run ? [when(build.run), ...extra(build)].join(' · ') : build.label;
    });

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
// remain -- the Day among them, which is what the tables say a build holds -- and
// the partition itself is in the listing's own label for a build, where it reads
// as part of a name rather than as a claim about its contents.
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

//
// the picker both pages offer, which is a picker of days on both: the Retrieval
// graph's choices are days of the tables, and the Training graph's are builds,
// each named by the day it holds. One pair of words for the one thing, where the
// Training graph's 'Build' and 'Published build' named something a reader could
// not line up with the other page.
//
// `pending` is the width its stand-in is drawn at while there is nothing to
// pick from, which is a date's -- about half the run time it was sized for
// before. See PendingPicker in pending.jsx.
//
const DAY_PICKER = { label: 'Day', name: 'Published day', pending: '5.5rem' };

const BUILDS = {
    heading: 'Training Graph',
    surface: 'graph',
    param: 'graph',
    path: (id) => `/graph/${encodeURIComponent(id)}`,
    picker: DAY_PICKER,
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
    // Note: the published days are asked for only while the listing holds a
    //       build too old to record its own day, and only once the listing has
    //       said so. When the last of those has rolled off, the page makes
    //       exactly the requests it made before it picked by day. See buildDay.
    //
    list: () => getGraphListing().then((listing) => {
        if (!listing || !listing.graphs.length) {
            return null;
        }

        const older = listing.graphs.some((build) => !atLeast(build.schema_version, DAY_RECORDED));

        return (older ? getTableDays() : Promise.resolve(null)).then((rows) => {
            const days = rows && rows.map((row) => row.day);

            return {
                default: listing.default,
                choices: listing.graphs.map((build) => ({ ...build, day: buildDay(build, days) })),
            };
        });
    }),
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

/**
 * the sources a day holds, as its own rows name them: every source a vocabulary
 * of its node types is published under.
 *
 * The Training graph's row of the same name reads the build's own list, which a
 * day does not have. The builder files every vocabulary under its source, so the
 * day's vocabularies say it instead -- see typeSource in encoding.js. On every day
 * published from 2026-09-21 to 09-24 that is bls, market, noaa and sec, which is
 * what the run that published each one read. The build of the same run says bls,
 * market and sec, because it leaves out the four node types of noaa, and the
 * tables keep them.
 *
 * Note: '' for a day whose vocabularies name no source, which the panel prints as
 *       'n/a'. That is every day published before the builder filed its
 *       vocabularies under their sources, 09-18 and earlier: 'ontology/jolts/'
 *       says nothing of bls. Read off such a day's type names instead, the list
 *       came out as market and sec, two of the day's four.
 */
function daySources(types) {
    return [...new Set(Object.values(types).map((type) => typeSource(type)).filter(Boolean))]
        .sort()
        .join(', ');
}

//
// the day panel's rows, as DETAILS is the build panel's.
//
// A build's listing entry describes the build before its schema arrives -- how
// many nodes, when it ran. A day's describes the day and where it came from: the
// run that published it, and when that finished. Those three rows fill in with
// the picker, as a build's Run and Built do, and lead the panel, so what is on
// screen with the picker is one block and what waits is the block below it.
// Every other row is TOTALLED from the day's own rows, or read off them, and
// waits for them: `schema` on each.
//
// `pending` is the width a row's value is drawn at while it waits, as pending.jsx
// does for the build panel's: a date, two timestamps at the width the build panel
// gives its own, four sources, totals in the thousands and the millions, and two
// counts of types in the hundreds.
//
// Note: 'Run' is the run that published the day, and it is the Run of the build
//       the Training graph names by the same day: the two graphs of a day are
//       one run's work. Both panels put it directly under their Day, which is
//       where a reader lines the two pages up. 'Published', not 'Built', because
//       what the tables record is when a day finished publishing, which is when
//       it became readable -- not when its tables were written, which nothing
//       records.
//
// Note: 'Entities' and 'Facts' lead the totals, because they are what this graph
//       is drawn by: the nodes that carry text, and so can be found by name, and
//       the values held about them. 'Nodes' and 'Edges' are every node and every
//       edge the day holds, the figures the build panel's rows of those names
//       give for a build. 'Node types' and 'Edge types' are what the canvas and
//       the tables below it count.
//
// Note: 'Sources' comes straight after Published, where the build panel has
//       its own under Built. It waits for the day's rows like the totals below
//       it do, because it is read off them -- see daySources -- so it heads the
//       block that waits.
//
const DAY_DETAILS = [
    { label: 'Day', read: (day) => day.id, pending: '6rem' },
    { label: 'Run', read: (day) => when(day.run), pending: '9rem' },
    { label: 'Published', read: (day) => when(day.published), pending: '9rem' },
    {
        label: 'Sources',
        read: (day, whole) => whole && daySources(whole.node_types),
        schema: true,
        pending: '8.5rem',
    },
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
    heading: 'Retrieval Graph',
    surface: 'graph-retrieval',
    param: 'day',
    path: (day) => `/graph/retrieval/${encodeURIComponent(day)}`,
    picker: DAY_PICKER,
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
    // Note: each choice carries the run that published its day and when that
    //       finished, as a build's listing entry carries its run and built --
    //       so both are on the panel as soon as the picker is.
    //
    list: () => getTableDays().then((days) => (days && days.length
        ? {
            default: days[0].day,
            choices: days.map((row) => ({ id: row.day, run: row.run, published: row.published })),
        }
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
    // both of the day's requests, named apart and marked apart -- N and E inside
    // their braces, so the two icons differ before either is pointed at -- or the
    // listing of days, before one is selected
    //
    requests: (day) => {
        if (!day) {
            return [{ url: daysRequest(), label: 'This request' }];
        }

        const { nodeTypes, edgeTypes } = dayRequests(day);

        return [
            { url: nodeTypes, label: 'Node types request', mark: 'N' },
            { url: edgeTypes, label: 'Edge types request', mark: 'E' },
        ];
    },
};

export { BUILDS, DAYS, DETAILS, DAY_DETAILS, buildDay, pickerLabels, graphSources, when };
