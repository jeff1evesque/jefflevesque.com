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
 * responses carry a Cache-Control the browser honours -- the schema is
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
 * Note: the motion is the point of a placeholder -- a still grey block is
 *       indistinguishable from a page that has given up -- and is also the
 *       first thing given up. Everything animated here stops under
 *       'prefers-reduced-motion' and leaves the same blocks standing still. See
 *       '_graph.scss'.
 */

import React from 'react';
import PropTypes from 'prop-types';

//
// how far apart, in milliseconds, two neighbouring bars breathe.
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
                        <PendingBar
                            width={DETAIL_WIDTHS[index % DETAIL_WIDTHS.length]}
                            delay={index * STAGGER}
                        />
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
// a cluster the shape of the one that is coming: a hub, a ring around it, and
// links between neighbours as well as to the middle. Each entry is [x, y, r] in
// the viewBox below, and the radii vary the way the real ones do -- the canvas
// sizes a node by how many of that type the build holds.
//
const CLUSTER_NODES = [
    [130, 85, 13],
    [72, 48, 9],
    [196, 52, 10],
    [58, 120, 8],
    [205, 122, 9],
    [130, 24, 6],
    [130, 148, 7],
    [30, 82, 6],
    [232, 88, 6],
];

const CLUSTER_EDGES = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8],
    [1, 5], [5, 2], [3, 7], [4, 8], [1, 7], [2, 8], [3, 6], [6, 4],
];

/**
 * the canvas, before there is a graph in it.
 *
 * A cluster rather than a spinner, because the box it fills is the graph's and
 * a spinner in it says only 'something is happening somewhere'. It is drawn in
 * neutral greys and on a MARCHING dash, which is what keeps it from being read
 * as a real graph that came back colourless -- a plausible enough failure on a
 * page whose colours are assigned per build.
 *
 * Note: the dash is '3 5', which is neither of the two ORIGIN_DASH patterns in
 *       encoding.js. Those mean something on this page, and a placeholder
 *       wearing 'enrichment' beside a legend that has not loaded is a legend
 *       entry nobody can check.
 *
 * Note: the drawing is aria-hidden and the sentence below it is a live region.
 *       One of them is the wait as a picture and the other is the wait as
 *       words; announcing both would say it twice.
 */
export function PendingCanvas() {
    return (
        <div className='graph-pending-canvas'>
            <svg
                className='graph-pending-cluster'
                viewBox='0 0 260 170'
                preserveAspectRatio='xMidYMid meet'
                aria-hidden='true'
            >
                <g className='graph-pending-links'>
                    {CLUSTER_EDGES.map(([from, to]) => (
                        <line
                            key={`${from}-${to}`}
                            x1={CLUSTER_NODES[from][0]}
                            y1={CLUSTER_NODES[from][1]}
                            x2={CLUSTER_NODES[to][0]}
                            y2={CLUSTER_NODES[to][1]}
                        />
                    ))}
                </g>
                {CLUSTER_NODES.map(([cx, cy, r], index) => (
                    <circle
                        key={index}
                        className='graph-pending-node'
                        cx={cx}
                        cy={cy}
                        r={r}
                        style={{ animationDelay: `${index * 120}ms` }}
                    />
                ))}
            </svg>
            <p className='graph-status graph-pending-status' role='status'>
                Loading the graph&hellip;
            </p>
        </div>
    );
}

export { PENDING_NAMESPACES, PENDING_ORIGINS, CLUSTER_NODES, CLUSTER_EDGES };
