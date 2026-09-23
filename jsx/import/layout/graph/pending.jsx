/**
 * pending.jsx: what /graph holds while the build it draws is still on its way.
 *
 * The page used to wait as a heading over an empty screen and the words
 * 'Loading the graph'. Everything else -- the build picker, both reference
 * columns, the tables and the controls that drive them -- arrived WITH the
 * data, and in two jumps rather than one: the picker and the build panel when
 * the listing landed, the legend, the canvas and the tables when the schema
 * did.
 *
 * On a desktop that is close to invisible, which is why it lasted. Both
 * responses carry a Cache-Control the browser honors -- the schema is
 * 'immutable', for a year -- so every visit after the first paints the finished
 * page at once. A phone on a cold cache is the same page over two serial round
 * trips and about half a megabyte of json, and what a reader sees for the
 * length of it is a title above nothing.
 *
 * So the page draws its own shape while it waits. Each piece here stands in for
 * something the page is about to hold, at the size and in the place of the
 * thing it replaces, so what arrives FILLS one of these rather than pushing the
 * page around underneath the reader.
 *
 * Note: nothing here invents a value. The build panel's stand-in carries the
 *       row LABELS, which are the same seven whatever build loads, and leaves
 *       every value blank; a placeholder that guessed '10.4M' would be a wrong
 *       answer on screen rather than an honest wait.
 *
 * Note: every bar is a FIXED length rather than a percentage of its box. Two of
 *       the three places these land -- a flex row in the narrow build panel, a
 *       table cell under 'table-layout: auto' -- size the box to its contents,
 *       so a percentage would be resolving against a width that is waiting on
 *       the percentage. The lengths below are roughly what the real values
 *       measure, which is also what keeps the columns from resizing when they
 *       arrive.
 *
 * Note: the motion is the point of a placeholder -- a still gray block is
 *       indistinguishable from a page that has given up -- and is also the
 *       first thing given up. Everything animated here stops under
 *       'prefers-reduced-motion' and leaves the same blocks standing still: the
 *       breathing and the marching in '_graph.scss', and the canvas's drift in
 *       driftNodes, which asks for itself.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import { GRAPH_NODE_TYPES } from '../../animation/filter-schema.js';
import {
    frameSize,
    nodeRadius,
    settleLayout,
    driftNodes,
} from '../../animation/explorer-layout.js';
import { breathDelay } from '../../animation/breath.js';

//
// how far apart, in milliseconds, two neighboring bars breathe.
//
// Small enough that a block of them reads as one thing and large enough that it
// travels: at 90ms across a dozen rows the wave crosses the table in about the
// time one bar takes to fade, which is what makes it a wave rather than a
// flicker. Milliseconds rather than seconds because an index times 0.09 is a
// float, and '0.44999999999999996s' in the markup is a number nobody wrote.
//
const STAGGER = 90;

/**
 * one value that has not arrived, as wide as the value it stands in for.
 *
 * Note: `width` is required rather than defaulted. Every one of these stands in
 *       for something whose size is known -- a namespace, a count, an ontology
 *       uri -- and a default would be the one bar on the page that had not been
 *       measured against anything.
 */
export function PendingBar({ width, delay = 0 }) {
    return (
        <span
            className='graph-pending-bar'
            style={{ animationDelay: `${delay}ms`, width: width }}
        />
    );
}

PendingBar.propTypes = {
    width: PropTypes.string.isRequired,
    delay: PropTypes.number,
};

//
// the build picker, before there is a listing to choose from. It wears the
// control's own class so it takes the same border, height and font, and is
// spaced by '.graph-pending-picker' -- the padding the real one carries is on
// the element mui draws the value into, which is not this.
//
export function PendingPicker() {
    return (
        <span className='graph-picker graph-pending graph-pending-picker' aria-hidden='true'>
            <PendingBar width='11rem' />
        </span>
    );
}

//
// what each of the build panel's seven values roughly measures, in the order
// the panel lists them: two counts, a source list, two timestamps, a dataset
// name and a variant.
//
const DETAIL_WIDTHS = ['4.5rem', '5.5rem', '7rem', '9rem', '9rem', '6rem', '3.5rem'];

/**
 * one of the build panel's values that has not arrived, by its row.
 *
 * The whole panel's stand-in draws one of these in every row. The real panel
 * draws one in its Sources row alone, which waits for the schema a round trip
 * after the rest of the panel has filled in from the listing -- see graphSources
 * in graph.jsx -- so the row keeps the bar it had rather than changing size
 * twice.
 */
export function PendingDetail({ index }) {
    return (
        <PendingBar
            width={DETAIL_WIDTHS[index % DETAIL_WIDTHS.length]}
            delay={index * STAGGER}
        />
    );
}

PendingDetail.propTypes = {
    index: PropTypes.number.isRequired,
};

/**
 * the build panel, before the listing names a build.
 *
 * The labels are handed in rather than written here, because graph.jsx holds
 * them for the panel itself -- see DETAILS there. A second copy would drift
 * apart from the first the day a row was added.
 */
export function PendingDetails({ labels }) {
    return (
        <dl className='graph-details graph-pending' aria-hidden='true'>
            {labels.map((label, index) => (
                <div key={label} className='graph-details-row'>
                    <dt>{label}</dt>
                    <dd>
                        <PendingDetail index={index} />
                    </dd>
                </div>
            ))}
        </dl>
    );
}

PendingDetails.propTypes = {
    labels: PropTypes.arrayOf(PropTypes.string).isRequired,
};

//
// the legend's rows: one width per namespace, and a count of edge origins.
//
// How MANY of each is a guess, because the legend lists what the build carries
// and nothing knows that yet. These are what the published builds have carried:
// about a dozen namespaces, of which eight fills the column without claiming to
// be the whole list, and the three edge origins encoding.js knows about. The
// widths are the range a namespace name actually spans, 'sec' to
// 'market-quotes'.
//
const PENDING_NAMESPACES = ['5.5rem', '4rem', '6rem', '4.5rem', '5rem', '6.5rem', '4rem', '5.5rem'];
const PENDING_ORIGINS = 3;

export function PendingLegend() {
    return (
        <div className='graph-legend graph-pending' aria-hidden='true'>
            <h6>Namespaces</h6>
            <ul className='graph-legend-namespaces'>
                {PENDING_NAMESPACES.map((width, index) => (
                    <li key={index}>
                        <span className='graph-pending-entry'>
                            <span className='graph-legend-swatch' />
                            <PendingBar width={width} delay={index * STAGGER} />
                        </span>
                    </li>
                ))}
            </ul>

            <h6>Edges</h6>
            <ul className='graph-legend-origins'>
                {[...Array(PENDING_ORIGINS).keys()].map((index) => (
                    <li key={index}>
                        <span className='graph-pending-entry'>
                            <span className='graph-pending-rule' />
                            <PendingBar width='5rem' delay={index * STAGGER} />
                            <span className='graph-legend-note'>
                                <PendingBar width='9rem' delay={index * STAGGER} />
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

//
// the made-up graph the canvas placeholder draws -- see pendingGraph.
//
// HUB_POWER is what gives it hubs. A node joins an earlier one picked in
// proportion to that one's links plus one, raised to this power. At 1 -- plain
// preferential attachment -- the busiest of sixty nodes gathers about fifteen
// neighbors and the rest spread evenly, which reads as a mesh. The build
// published in September 2026 gives one type 48 neighbors and two others 25
// while the median type has 4, and squaring is what gets most of the way there.
//
// LOOPS is the share of nodes that join a second one as well. With none, the
// graph is a tree of stars; the real one has loops running through its hubs.
//
// Note: seeded, so it is the same graph every time. It is laid out again when
//       its box changes size -- a phone turned on its side mid-load -- and a
//       stand-in that became a different graph then, or on every visit, would
//       be one more thing moving on a page that is only waiting.
//
const PENDING_SEED = 7;
const HUB_POWER = 2;
const LOOPS = 0.35;

/**
 * a graph the shape of the ones this page draws: `count` nodes, most of their
 * links gathered at a few hubs, and a few loops through them.
 *
 * Note: `random` is an argument so a test can hand in its own sequence. The page
 *       passes nothing and gets the seeded one.
 */
export function pendingGraph(count = GRAPH_NODE_TYPES, random = d3.randomLcg(PENDING_SEED)) {
    const nodes = d3.range(count).map((id) => ({ id: id }));
    const links = [];
    const degree = nodes.map(() => 0);

    // one of the first `before` nodes, other than `not`, weighted by its links
    const pick = (before, not) => {
        const reach = d3.cumsum(
            d3.range(before),
            (index) => (index === not ? 0 : (degree[index] + 1) ** HUB_POWER)
        );

        return d3.bisectRight(reach, random() * reach[before - 1]);
    };

    const join = (from, to) => {
        links.push({ source: from, target: to });
        degree[from] += 1;
        degree[to] += 1;
    };

    for (let index = 1; index < count; index += 1) {
        const first = pick(index, -1);

        join(index, first);

        if (index > 1 && random() < LOOPS) {
            join(index, pick(index, first));
        }
    }

    return { nodes: nodes, links: links };
}

/**
 * the canvas, before there is a graph in it.
 *
 * A graph rather than a spinner, because the box it fills is the graph's and a
 * spinner in it says only 'something is happening somewhere'. It is the real
 * canvas's graph in everything but its data: as many nodes as the canvas draws,
 * at the radius it draws them, laid out by its forces, fitted to the box the way
 * it fits them and set drifting by its motion -- all of it explorer-layout.js's
 * -- so what arrives takes on color and settles into its own shape, rather than
 * replacing one drawing with a differently sized one.
 *
 * It used to be nine hand-placed circles in a viewBox scaled into a 22rem box,
 * their radii varying 'the way the real ones do'. The real ones do not vary, and
 * the scale drew the nine at 7 to 15px ahead of a graph drawn at 7.
 *
 * What keeps it from reading as a real graph that came back colorless is what
 * always has: neutral grays, links on a MARCHING dash, and the sentence saying
 * what it is waiting for -- see PendingCaption, which holds the caption's place
 * above it.
 *
 * Note: the dash is '3 5', which is neither of the two ORIGIN_DASH patterns in
 *       encoding.js. Those mean something on this page, and a placeholder
 *       wearing 'enrichment' beside a legend that has not loaded is a legend
 *       entry nobody can check.
 *
 * Note: it wears the canvas's own classes, '.graph-explorer-frame' and
 *       '.graph-explorer', so it is laid out by the rules the canvas will be.
 */
export class PendingCanvas extends Component {
    constructor(props) {
        super(props);

        this.svgRef = React.createRef();
        this.size = { width: 0, height: 0 };
        this.drift = null;

        this.draw = this.draw.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.applyResize = this.applyResize.bind(this);
    }

    componentDidMount() {
        this.renderD3();

        //
        // laid out again when the box changes size. ResizeObserver rather than
        // the window's own event, because the box also changes with the window
        // standing still -- either column beside it folds -- and guarded, the
        // way the canvas guards it. Without one, the placeholder keeps the size
        // it was first drawn at, for the few seconds it is on screen.
        //
        if (typeof ResizeObserver === 'function') {
            this.frameObserver = new ResizeObserver(this.handleResize);
            this.frameObserver.observe(this.svgRef.current.parentNode);
        }
    }

    componentWillUnmount() {
        this.stopDrift();

        if (this.frameObserver) {
            this.frameObserver.disconnect();
        }
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }
    }

    handleResize() {
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }
        this.resizeTimer = setTimeout(this.applyResize, 150);
    }

    // an observer reports the size it starts at as well, which is not a change
    applyResize() {
        this.resizeTimer = null;

        const { width, height } = frameSize(this.svgRef.current.parentNode);

        if (width !== this.size.width || height !== this.size.height) {
            this.renderD3();
        }
    }

    stopDrift() {
        if (this.drift !== null) {
            this.drift();
            this.drift = null;
        }
    }

    draw() {
        this.linkSel
            .attr('x1', (d) => d.source.x)
            .attr('y1', (d) => d.source.y)
            .attr('x2', (d) => d.target.x)
            .attr('y2', (d) => d.target.y);
        this.nodeSel
            .attr('cx', (d) => d.x)
            .attr('cy', (d) => d.y);
    }

    renderD3() {
        const { width, height } = frameSize(this.svgRef.current.parentNode);
        const { nodes, links } = pendingGraph();
        const radius = nodeRadius(width);

        this.size = { width: width, height: height };
        nodes.forEach((node) => { node.r = radius; });
        settleLayout(nodes, links, width, height);

        const svg = d3.select(this.svgRef.current)
            .attr('width', width)
            .attr('height', height);

        svg.selectAll('*').remove();

        this.linkSel = svg.append('g')
            .attr('class', 'graph-pending-links')
            .selectAll('line')
            .data(links)
            .join('line');

        //
        // each node a beat behind the one before, in the rhythm the graph that
        // replaces it keeps -- see breathDelay.
        //
        this.nodeSel = svg.append('g')
            .selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('class', 'graph-pending-node')
            .attr('r', (d) => d.r)
            .style('animation-delay', (d, index) => breathDelay(index));

        this.draw();
        this.stopDrift();
        this.drift = driftNodes(nodes, this.draw);
    }

    render() {
        return (
            <div className='graph-explorer-frame graph-pending-canvas'>
                <svg
                    className='graph-explorer graph-pending-cluster'
                    ref={this.svgRef}
                    aria-hidden='true'
                />
            </div>
        );
    }
}

/**
 * the wait, in words, in the caption's place above the canvas.
 *
 * It used to sit under the placeholder's cluster, in the middle of the box. The
 * placeholder is the whole box now, and a sentence across the middle of a graph
 * is a sentence across whatever node is there -- so it takes the line the
 * caption will, where the sentence saying how much of the build is drawn
 * replaces it.
 *
 * Note: the drawing is aria-hidden and this is a live region. One of them is
 *       the wait as a picture and the other is the wait as words; announcing
 *       both would say it twice.
 */
export function PendingCaption() {
    return (
        <p className='graph-caption' role='status'>
            Loading the graph&hellip;
        </p>
    );
}

export { PENDING_NAMESPACES, PENDING_ORIGINS };
