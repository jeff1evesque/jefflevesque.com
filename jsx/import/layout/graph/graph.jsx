/**
 * graph.jsx: browse the published knowledge graph builds.
 *
 * The front page draws one graph -- the default build -- as a backdrop, and is
 * deliberately not readable up close. This page is the other half: pick a build,
 * see what is in it, and read the thing properly.
 *
 * Laid out in three columns on a wide screen -- what the build is, the graph,
 * and how to read its colours -- so all three are in view together. On a narrow
 * one the columns stack in the same order, and the two panels above the graph
 * start closed: a phone that opened on a page-long list of metadata showed the
 * graph, the reason for the page, only after a long scroll.
 *
 * Note: the slice here is larger than the backdrop's. Both go through the same
 *       selection rule, which takes the limit as an argument precisely so two
 *       surfaces can want different amounts. At this size the published graph
 *       stays in one piece, which it does not at the backdrop's budget.
 *
 * Note: a failed load clears the graph rather than leaving the previous one on
 *       screen. A stale graph beside a fresh label is indistinguishable from a
 *       correct one, which is the worst outcome available here -- worse than an
 *       error, and much worse than an empty panel.
 */

import React, { Component } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import GraphExplorer, { TAIL } from '../../animation/graph-explorer.jsx';
import { getGraphListing, getGraphById } from '../../general/get-graph-schema.js';
import { knowledgeGraphUrl, API_DOCS } from '../../general/api-url.js';
import ApiLinks from '../../general/api-links.jsx';
import filterSchema from '../../animation/filter-schema.js';
import GraphTables from './tables.jsx';
import {
    sourceNamespace,
    assignNamespaceColors,
    rankNamespaces,
    ORIGIN_DASH,
    originColor,
} from '../../animation/encoding.js';

//
// how many node types this page draws.
//
// Larger than the front page, which carries 24 because that is the density a
// backdrop reads at. Measured against the published build, the selection stays
// in one connected piece from about 40 upward; 60 is comfortably inside that and
// still legible. It is a look-at-it number and can move.
//
const EXPLORER_NODE_TYPES = 60;

//
// what each origin means, for the legend. The styling itself lives in
// encoding.js -- this is only the wording.
//
const ORIGIN_LABEL = {
    raw: 'as published by the source',
    enrichment: 'derived during the build',
    unification: 'the same thing, seen twice',
};

//
// the two panels that close on a narrow screen. Both start closed there, so a
// phone opens on the graph; a wide screen ignores this and shows both.
//
const PANELS_CLOSED = { build: false, legend: false };

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
// There is deliberately no 'Period' row below, and the listing's `period` is
// read by nothing on this page.
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

class GraphLayout extends Component {
    constructor() {
        super();

        this.state = {
            listing: null,
            selected: null,
            schema: null,
            // the WHOLE build, beside the slice above. The tables read every node
            // and edge type from here; it used to be measured for the caption and
            // then discarded on the same line.
            build: null,
            loading: true,
            failed: false,
            open: PANELS_CLOSED,
        };

        this.selectBuild = this.selectBuild.bind(this);
        this.navigateToBuild = this.navigateToBuild.bind(this);
        this.requestedBuild = this.requestedBuild.bind(this);
        this.selectedBuild = this.selectedBuild.bind(this);
        this.onScreen = this.onScreen.bind(this);
        this.toggle = this.toggle.bind(this);
        this.panel = this.panel.bind(this);
        this.legend = this.legend.bind(this);
        this.details = this.details.bind(this);
        this.picker = this.picker.bind(this);
        this.caption = this.caption.bind(this);
    }

    componentDidMount() {
        getGraphListing().then((listing) => {
            if (!listing || !listing.graphs.length) {
                this.setState({ listing: null, loading: false, failed: true });
                return;
            }

            this.setState({ listing: listing });
            this.selectBuild(this.requestedBuild(listing));
        });
    }

    /**
     * the build the address asks for, when the listing holds it.
     *
     * Note: an id the listing does not hold falls back to the default rather
     *       than 404ing. The listing is what decides which builds exist, and a
     *       link to a build that has since rolled off is an ordinary thing to
     *       find in someone's bookmarks -- the page still has something true to
     *       draw, and the picker shows what it drew instead.
     */
    requestedBuild(listing) {
        const requested = this.props.params.graph;

        if (requested && listing.graphs.some((b) => b.id === requested)) {
            return requested;
        }

        return listing.default || listing.graphs[0].id;
    }

    /**
     * a build chosen in the picker becomes the address, so the selection can be
     * linked to and the back button moves between builds.
     *
     * Note: componentDidUpdate does the selecting, off the address, rather than
     *       this navigating AND selecting. Two entry points writing 'selected'
     *       -- the picker and the back button -- is how they get to disagree.
     */
    navigateToBuild(id) {
        this.props.navigate(`/graph/${encodeURIComponent(id)}`);
    }

    componentDidUpdate(previous) {
        const before = previous.params.graph;
        const now = this.props.params.graph;
        const { listing } = this.state;

        if (before !== now && listing) {
            const wanted = this.requestedBuild(listing);

            if (wanted !== this.state.selected) {
                this.selectBuild(wanted);
            }
        }
    }

    /**
     * Note: the graph is cleared BEFORE the fetch, not after it resolves. The
     *       alternative leaves the previous build on screen under the new
     *       build's label for as long as the request takes, which reads as a
     *       correct answer and is not one.
     */
    selectBuild(id) {
        this.setState({ selected: id, schema: null, build: null, loading: true, failed: false });

        return getGraphById(id).then((schema) => {
            const filtered = filterSchema(schema, EXPLORER_NODE_TYPES);

            this.setState({
                schema: filtered,
                build: filtered ? schema : null,
                loading: false,
                failed: !filtered,
            });
        });
    }

    selectedBuild() {
        const { listing, selected } = this.state;

        if (!listing || !selected) {
            return null;
        }

        return listing.graphs.find((b) => b.id === selected) || null;
    }

    //
    // the namespaces and origins actually ON SCREEN, not a fixed list. A
    // hardcoded legend drifts the moment a build carries a namespace nobody
    // anticipated, and then it is describing a graph that is not there.
    //
    onScreen() {
        const { schema } = this.state;

        if (!schema) {
            return null;
        }

        //
        // memoised on the schema OBJECT, which only changes when a build is
        // selected. Recomputed per render it would hand the tables below a fresh
        // colour Map every time, and a table that caches its rows against that
        // Map would rebuild all 976 of them on every keystroke in its filter box.
        //
        if (this.screenFor === schema) {
            return this.screen;
        }

        const nodes = Object.keys(schema.node_types).map((id) => ({
            id: id,
            namespace: sourceNamespace(schema.node_types[id], id),
        }));

        this.screenFor = schema;
        this.screen = {
            namespaces: rankNamespaces(nodes),
            painted: assignNamespaceColors(nodes, TAIL),
            origins: [...new Set(
                Object.values(schema.edge_types).map((e) => e.origin).filter(Boolean)
            )].sort(),
        };

        return this.screen;
    }

    toggle(key) {
        this.setState((state) => ({ open: { ...state.open, [key]: !state.open[key] } }));
    }

    /**
     * a column on a wide screen, and a section that opens and closes on a narrow
     * one.
     *
     * Both forms are rendered and the stylesheet shows one: the toggle button
     * below the breakpoint, the plain heading above it. Hiding with display:none
     * also hides from assistive technology, so a screen reader meets a button
     * where there is something to open and a heading where there is not --
     * never a button announcing 'collapsed' over content that is on screen.
     *
     * Note: the closed body stays in the document and is hidden by the
     *       stylesheet, not by React. Unmounting it would make the wide layout,
     *       which never closes anything, depend on state it has no control of.
     */
    panel(key, title, summary, heading, content) {
        if (!content) {
            return null;
        }

        const open = this.state.open[key];
        const body = `graph-panel-${key}-body`;

        return (
            <section className={`graph-panel graph-panel-${key}${open ? ' graph-panel-open' : ''}`}>
                <button
                    type='button'
                    className='graph-panel-toggle'
                    aria-expanded={open}
                    aria-controls={body}
                    onClick={() => this.toggle(key)}
                >
                    <span className='graph-panel-title'>{title}</span>
                    {summary ? <span className='graph-panel-summary'>{summary}</span> : null}
                </button>
                {heading ? <h6 className='graph-panel-heading'>{heading}</h6> : null}
                <div className='graph-panel-body' id={body}>
                    {content}
                </div>
            </section>
        );
    }

    picker() {
        const { listing, selected } = this.state;

        if (!listing) {
            return null;
        }

        const labels = pickerLabels(listing.graphs);

        return (
            <select
                className='graph-picker'
                aria-label='Published build'
                value={selected || ''}
                onChange={(event) => this.navigateToBuild(event.target.value)}
            >
                {listing.graphs.map((build, index) => (
                    <option key={build.id} value={build.id} disabled={!!build.error}>
                        {build.error ? `${labels[index]} (unavailable)` : labels[index]}
                    </option>
                ))}
            </select>
        );
    }

    //
    // what the selected build is, from the LISTING rather than from the schema.
    // The listing is the authority on a build's identity -- the schema's own
    // dataset field is empty on published builds, and a panel reading 'n/a'
    // beside a named picker entry invites the reader to distrust both.
    //
    // Note: 'Nodes', not 'Node types'. The listing's figure is every node in
    //       the build -- ten million of them -- while a node TYPE is what one
    //       circle on the canvas stands for, and a build has about a hundred
    //       and fifty. The label said the second over the first, which made the
    //       canvas look like it was missing all but sixty of ten million.
    //
    details(build) {
        if (!build) {
            return null;
        }

        const rows = [
            ['Nodes', count(build.nodes)],
            ['Edges', count(build.edges)],
            ['Sources', (build.sources || []).join(', ')],
            ['Run', when(build.run)],
            ['Built', when(build.built)],
            ['Dataset', build.dataset],
            ['Variant', build.variant],
        ];

        return (
            <dl className='graph-details'>
                {rows.map(([label, value]) => (
                    <div key={label} className='graph-details-row'>
                        <dt>{label}</dt>
                        <dd>{value || 'n/a'}</dd>
                    </div>
                ))}
            </dl>
        );
    }

    //
    // Note: headed 'Namespaces', not 'Sources'. These are the namespaces the
    //       node types come from -- jolts, eci, laus -- which is not the same
    //       list as the build's sources (bls, market, noaa, sec). The panel
    //       beside it lists the sources under that name, and two different
    //       lists under one heading read as a contradiction.
    //
    legend(shown) {
        if (!shown) {
            return null;
        }

        return (
            <div className='graph-legend'>
                <h6>Namespaces</h6>
                <ul className='graph-legend-namespaces'>
                    {shown.namespaces.map((namespace) => (
                        <li key={namespace}>
                            <span
                                className='graph-legend-swatch'
                                style={{ backgroundColor: shown.painted.get(namespace) }}
                            />
                            {namespace}
                        </li>
                    ))}
                </ul>

                <h6>Edges</h6>
                <ul className='graph-legend-origins'>
                    {shown.origins.map((origin) => (
                        <li key={origin}>
                            <svg width='34' height='10' aria-hidden='true'>
                                <line
                                    x1='0' y1='5' x2='34' y2='5'
                                    stroke={originColor(origin)}
                                    strokeWidth={origin === 'raw' ? 1 : 1.5}
                                    strokeDasharray={ORIGIN_DASH[origin] || undefined}
                                />
                            </svg>
                            {origin}
                            <span className='graph-legend-note'>
                                {ORIGIN_LABEL[origin] || ''}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    //
    // how much of the build the canvas is showing. Each circle is a node TYPE,
    // and the canvas carries a slice of them; without saying so, a reader
    // comparing the canvas with the totals beside it has no way to reconcile
    // the two.
    //
    // Note: it guards on the schema itself rather than being rendered behind a
    //       guard, because it now shares its row with the api icons, which are
    //       there whether or not a graph is.
    //
    caption() {
        const { schema, build } = this.state;

        if (!schema) {
            return null;
        }

        const drawn = Object.keys(schema.node_types).length;
        const published = build ? Object.keys(build.node_types).length : 0;
        const scope = published > drawn
            ? `${drawn} of ${published} node types`
            : `All ${drawn} node types`;

        return (
            <p className='graph-caption'>
                {scope} · hover or tap a node for details · the rest are below
            </p>
        );
    }

    render() {
        const { schema, loading, failed, listing } = this.state;
        const build = this.selectedBuild();
        const shown = this.onScreen();

        const body = () => {
            if (loading) {
                return <p className='graph-status'>Loading the graph…</p>;
            }
            if (failed || !schema) {
                return (
                    <p className='graph-status graph-status-failed'>
                        {listing
                            ? 'That build could not be loaded.'
                            : 'The published builds could not be listed.'}
                    </p>
                );
            }

            return <GraphExplorer data={schema} />;
        };

        const nodes = build && typeof build.nodes === 'number'
            ? `${COMPACT.format(build.nodes)} nodes`
            : null;
        const namespaces = shown
            ? `${shown.namespaces.length} ${shown.namespaces.length === 1 ? 'namespace' : 'namespaces'}`
            : null;

        return (
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className='container graph-page'>
                    <div className='graph-header'>
                        <h5>Knowledge graph</h5>
                        {this.picker()}
                    </div>
                    <div className='graph-layout'>
                        {this.panel('build', 'Build details', nodes, 'Build', this.details(build))}
                        {this.panel('legend', 'Legend', namespaces, null, this.legend(shown))}
                        <div className='graph-canvas'>
                            {/*

                                the caption and the api icons head the canvas
                                column rather than the page, because both
                                describe the graph rather than the page: what of
                                the build is drawn, and the request it was drawn
                                from -- the build the picker has selected, as
                                getGraphById fetches it, or the listing, before
                                one is selected.

                            */}
                            <div className='graph-canvas-header'>
                                {this.caption()}
                                <ApiLinks
                                    docs={API_DOCS.knowledgeGraph}
                                    request={knowledgeGraphUrl(this.state.selected)}
                                    size='medium'
                                />
                            </div>
                            {body()}
                        </div>
                    </div>
                    {/*

                        everything the canvas could not draw, at full width below
                        the three columns. It reads the UNFILTERED build and is
                        handed the canvas's own colour assignment, so a swatch in
                        a row is the colour that namespace is above it.

                    */}
                    <GraphTables
                        schema={this.state.build}
                        drawn={schema}
                        painted={shown ? shown.painted : null}
                    />
                </div>
            </ErrorBoundary>
        );
    }
}

//
// the address is injected rather than read inside the class, the way
// stream/trigger.jsx and stream/alarm.jsx do it -- react-router's hooks cannot
// be called from a class component.
//
export default (props) => <GraphLayout {...props} params={useParams()} navigate={useNavigate()} />;

export { GraphLayout, EXPLORER_NODE_TYPES };
