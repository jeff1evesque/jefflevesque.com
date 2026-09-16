/**
 * graph.jsx: browse the published knowledge graph builds.
 *
 * The front page draws one graph -- the default build -- as a backdrop, and is
 * deliberately not readable up close. This page is the other half: pick a build,
 * see what is in it, and read the thing properly.
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
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import GraphExplorer, { TAIL } from '../../animation/graph-explorer.jsx';
import { getGraphListing, getGraphById } from '../../general/get-graph-schema.js';
import filterSchema from '../../animation/filter-schema.js';
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

function when(iso) {
    if (!iso) {
        return 'n/a';
    }

    return String(iso).replace('T', ' ').replace(/(:\d\d).*$/, '$1').replace(/\+.*$/, '');
}

function count(n) {
    return typeof n === 'number' ? n.toLocaleString() : 'n/a';
}

class GraphLayout extends Component {
    constructor() {
        super();

        this.state = {
            listing: null,
            selected: null,
            schema: null,
            loading: true,
            failed: false,
        };

        this.selectBuild = this.selectBuild.bind(this);
        this.legend = this.legend.bind(this);
        this.details = this.details.bind(this);
        this.picker = this.picker.bind(this);
    }

    componentDidMount() {
        getGraphListing().then((listing) => {
            if (!listing || !listing.graphs.length) {
                this.setState({ listing: null, loading: false, failed: true });
                return;
            }

            this.setState({ listing: listing });
            this.selectBuild(listing.default || listing.graphs[0].id);
        });
    }

    /**
     * Note: the graph is cleared BEFORE the fetch, not after it resolves. The
     *       alternative leaves the previous build on screen under the new
     *       build's label for as long as the request takes, which reads as a
     *       correct answer and is not one.
     */
    selectBuild(id) {
        this.setState({ selected: id, schema: null, loading: true, failed: false });

        return getGraphById(id).then((schema) => {
            const filtered = filterSchema(schema, EXPLORER_NODE_TYPES);

            this.setState({
                schema: filtered,
                loading: false,
                failed: !filtered,
            });
        });
    }

    picker() {
        const { listing, selected } = this.state;

        if (!listing) {
            return null;
        }

        return (
            <select
                className='graph-picker'
                aria-label='Published build'
                value={selected || ''}
                onChange={(event) => this.selectBuild(event.target.value)}
            >
                {listing.graphs.map((build) => (
                    <option key={build.id} value={build.id} disabled={!!build.error}>
                        {build.error ? `${build.label} (unavailable)` : build.label}
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
    details() {
        const { listing, selected } = this.state;

        if (!listing || !selected) {
            return null;
        }

        const build = listing.graphs.find((b) => b.id === selected);

        if (!build) {
            return null;
        }

        const rows = [
            ['Period', build.period],
            ['Dataset', build.dataset],
            ['Variant', build.variant],
            ['Run', when(build.run)],
            ['Built', when(build.built)],
            ['Node types', count(build.nodes)],
            ['Edges', count(build.edges)],
            ['Sources', (build.sources || []).join(', ')],
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
    // built from what is ON SCREEN, not from a fixed list. A hardcoded legend
    // drifts the moment a build carries a namespace nobody anticipated, and then
    // it is describing a graph that is not there.
    //
    legend() {
        const { schema } = this.state;

        if (!schema) {
            return null;
        }

        const nodes = Object.keys(schema.node_types).map((id) => ({
            id: id,
            namespace: sourceNamespace(schema.node_types[id], id),
        }));

        const painted = assignNamespaceColors(nodes, TAIL);
        const origins = [...new Set(
            Object.values(schema.edge_types).map((e) => e.origin).filter(Boolean)
        )].sort();

        return (
            <div className='graph-legend'>
                <h6>Sources</h6>
                <ul className='graph-legend-sources'>
                    {rankNamespaces(nodes).map((namespace) => (
                        <li key={namespace}>
                            <span
                                className='graph-legend-swatch'
                                style={{ backgroundColor: painted.get(namespace) }}
                            />
                            {namespace}
                        </li>
                    ))}
                </ul>

                <h6>Relationships</h6>
                <ul className='graph-legend-origins'>
                    {origins.map((origin) => (
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

    render() {
        const { schema, loading, failed, listing } = this.state;

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

            return <GraphExplorer data={schema} height={620} />;
        };

        return (
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className='container graph-page'>
                    <div className='row'>
                        <div className='col'>
                            <h5>Knowledge graph</h5>
                            {this.picker()}
                        </div>
                    </div>
                    <div className='row'>
                        <div className='col-md-3'>
                            {this.details()}
                            {this.legend()}
                        </div>
                        <div className='col-md-9 graph-canvas'>
                            {body()}
                        </div>
                    </div>
                </div>
            </ErrorBoundary>
        );
    }
}

export default GraphLayout;

export { EXPLORER_NODE_TYPES };
