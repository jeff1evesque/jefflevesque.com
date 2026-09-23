/**
 * graph-explorer.jsx: the knowledge graph at full attention.
 *
 * Same data and the same visual language as the front page backdrop -- both read
 * their colors and link styling from encoding.js, so a legend here describes
 * that cluster correctly too -- but none of its presentation.
 *
 * What the backdrop does that this deliberately does not:
 *
 *   - mutes every node toward white at rest. Color there arrives on hover,
 *     because the cluster is meant to sit behind hero text. Here it is the
 *     content, so it is painted at full strength from the start.
 *   - draws a decorative gray field and parts it around the cluster. There is
 *     nothing decorative on this page.
 *   - keeps the SIMULATION warm, so the backdrop's cluster is still finding its
 *     shape while it floats. This layout is computed to rest before the first
 *     paint and then stays that shape: what moves afterwards is each node a
 *     couple of pixels around where it settled, which is decoration over a
 *     finished layout rather than a layout still running. See startDrift.
 *   - shoves nodes away from the cursor. Reading a graph while it flinches from
 *     the pointer is worse than useless.
 *
 * What the two DO now share is that labels wait to be asked for. This page used
 * to label every node up front, on the grounds that a page opened on purpose
 * should not have to be interrogated -- and with sixty node types whose names
 * run past sixty characters, the result was a block of overprinted text that
 * named nothing. A node names itself when it is pointed at (or tapped: a phone
 * cannot hover), in a card that has room for the whole name.
 *
 * They also share the glint: each node rests at its color and brightens now
 * and then, in the time the placeholder here breathed in, and holds still at
 * full strength while the pointer is on it or its neighbor. See breath.js.
 *
 * Note: a separate component rather than a prop on GraphCluster. The two share
 *       the parts that must not disagree and nothing else -- threading "am I a
 *       backdrop" through the other file would have meant branching in the gray
 *       field, the tick handler, the muting, the pointer force and the labels,
 *       and every one of those branches would need its own test.
 */

import React, { Component } from 'react';
import * as d3 from 'd3';
import { colors } from '../general/colors.js';
import {
    sourceNamespace,
    assignNamespaceColors,
    ORIGIN_DASH,
    originColor,
} from './encoding.js';
import {
    reducedMotion,
    frameSize,
    nodeRadius,
    settleLayout,
    driftNodes,
    DRIFT,
    DRIFT_SPEED,
} from './explorer-layout.js';
import { breathDelay } from './breath.js';
import PropTypes from 'prop-types';

// the tail past the eight categorical slots is SHADED here rather than rolled
// into one neutral -- this page carries a legend, and a legend that says "and 9
// others" is not a legend. See encoding.js.
const TAIL = 'shade';

//
// the node radius, the forces, the fit and the drift are not here. They are
// explorer-layout.js's, and the placeholder that holds this canvas's place while
// a build loads draws with the same ones -- so the graph that replaces it is the
// one it looked like.
//

// how near the pointer must come to a node's center to point at it. Both are well
// past the drawn radius, because a 7px circle is a hard target for a mouse and
// an impossible one for a finger. A tap is allowed further than a hover: a hover
// can be corrected by moving, and a tap that misses has to be made again.
const HOVER_REACH = 16;
const TAP_REACH = 28;

// below this canvas width the card is docked along the top or bottom edge rather
// than set beside its node. Beside a node it needs its own width (17rem, see
// _graph.scss) plus its offset free on one side, and a canvas narrower than
// twice that has room on neither side for a node near the middle.
const CARD_DOCK_WIDTH = 560;

// how far a node's neighborhood is lifted when focused, and how far everything
// else drops back. Both stay visible -- this is emphasis, not filtering.
const DIM_OPACITY = 0.15;
const LINK_REST = 0.35;
const LINK_LIT = 0.95;
const LINK_DIM = 0.06;

// the ring around the node being pointed at, so it reads as the one the card is
// about rather than as one more lit neighbor
const RING = colors['gray-8'];
const RING_WIDTH = 2;

/**
 * a node type's name, without the namespace the card already shows beside it.
 *
 * Note: only a prefix that IS the namespace is dropped. An id whose prefix
 *       disagrees with its ontology namespace is shown whole, since dropping it
 *       would lose something the card does not say elsewhere.
 */
export function shortName(id, namespace) {
    const prefix = `${namespace}_`;

    return id.length > prefix.length && id.startsWith(prefix)
        ? id.slice(prefix.length)
        : id;
}

/**
 * the name split where a line may break: before each capital that follows a
 * lower-case letter or a digit, and after each underscore.
 *
 * Type names are long CamelCase runs with no spaces -- the longest in a published
 * build is sixty-six characters -- so left alone a browser either overflows the
 * card or breaks them wherever the width runs out, mid-word.
 *
 * Note: no lookbehind in the pattern. A regex literal the engine cannot parse
 *       takes the whole bundle down at load, and lookbehind arrived in Safari
 *       only in 16.4.
 */
export function breakable(name) {
    return name
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/_/g, '_ ')
        .split(' ')
        .filter(Boolean);
}

/**
 * where the card goes, for a node at (x, y) on a width x height canvas.
 *
 * On a wide canvas: beside the node, on whichever side has more room, and above
 * or below it near the top and bottom edges so it is not cut off. On a narrow
 * one: docked across the edge furthest from the node, so it never covers the
 * thing it describes.
 */
export function placeCard(x, y, width, height) {
    if (width < CARD_DOCK_WIDTH) {
        return {
            className: y > height / 2 ? 'graph-card-dock-top' : 'graph-card-dock-bottom',
            style: null,
        };
    }

    const side = x > width / 2 ? 'graph-card-left' : 'graph-card-right';
    const band = y < height / 3
        ? 'graph-card-below'
        : (y > (height * 2) / 3 ? 'graph-card-above' : 'graph-card-middle');

    return {
        className: `${side} ${band}`,
        style: { left: `${x}px`, top: `${y}px` },
    };
}

function plural(n, one, many) {
    const value = typeof n === 'number' ? n.toLocaleString() : 'n/a';

    return `${value} ${n === 1 ? one : many}`;
}

class GraphExplorer extends Component {
    static propTypes = {
        data: PropTypes.shape({
            node_types: PropTypes.object,
            edge_types: PropTypes.object,
        }),
        height: PropTypes.number,
        // namespace -> color, ranked over the whole build by buildPalette
        palette: PropTypes.instanceOf(Map),
        //
        // the classes of the graph to emphasize, asked for from outside the
        // canvas: namespaces, whose nodes are lit, and origins, whose edges
        // are. The legend beside the canvas is what sets them -- see highlight,
        // where they are the state the canvas rests at rather than a fourth
        // kind of focus, and where the two kinds filter independently.
        //
        emphasis: PropTypes.arrayOf(PropTypes.shape({
            kind: PropTypes.oneOf(['namespace', 'origin']),
            value: PropTypes.string,
        })),
        // a click anywhere on the canvas, so whatever set `emphasis` can let go
        onClear: PropTypes.func,
    }

    constructor(props) {
        super(props);

        this.svgRef = React.createRef();
        this.hoveredId = null;
        this.pinnedId = null;
        this.size = { width: 0, height: 0 };
        this.drift = null;

        // the node the card describes, or null. The only state React holds:
        // everything inside the svg is drawn by d3.
        this.state = { focus: null };

        this.buildGraph = this.buildGraph.bind(this);
        this.measure = this.measure.bind(this);
        this.renderD3 = this.renderD3.bind(this);
        this.draw = this.draw.bind(this);
        this.startDrift = this.startDrift.bind(this);
        this.stopDrift = this.stopDrift.bind(this);
        this.highlight = this.highlight.bind(this);
        this.hover = this.hover.bind(this);
        this.pin = this.pin.bind(this);
        this.refocus = this.refocus.bind(this);
        this.describe = this.describe.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.applyResize = this.applyResize.bind(this);
        this.watchFrame = this.watchFrame.bind(this);
    }

    componentDidMount() {
        this.renderD3();
        window.addEventListener('resize', this.handleResize);
        this.watchFrame();
    }

    /**
     * the canvas can change size without the WINDOW changing size.
     *
     * Either reference column on the graph page folds away, and the track it
     * gives up goes to the middle one the canvas sits in -- so the frame widens
     * by the better part of 300px while the window stays exactly where it is.
     * With only a 'resize' listener the svg kept the width it was last laid out
     * at, and the graph went on occupying the left two thirds of a canvas that
     * had just grown: folding a column looked like it had done nothing.
     *
     * Note: routed through handleResize rather than straight to renderD3, so a
     *       fold is debounced and guarded exactly as a window resize is. An
     *       observer reports the CURRENT size as soon as it is connected, and
     *       applyResize drops that first report because nothing has changed.
     *
     * Note: guarded. ResizeObserver is a browser global rather than something
     *       this bundle carries, and a browser without it still has the window
     *       listener above -- it misses the fold, which is what shipped, rather
     *       than failing to mount.
     */
    watchFrame() {
        if (typeof ResizeObserver !== 'function') {
            return;
        }

        this.frameObserver = new ResizeObserver(this.handleResize);
        this.frameObserver.observe(this.svgRef.current.parentNode);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.data !== this.props.data) {
            if (this.simulation) {
                this.simulation.stop();
            }
            this.renderD3();
            return;
        }

        //
        // the legend asked for something different. Repaint only -- the layout
        // has not changed, and re-running it would move every node on screen
        // because the reader pointed at a word beside the canvas.
        //
        if (prevProps.emphasis !== this.props.emphasis) {
            this.highlight(this.hoveredId != null ? this.hoveredId : this.pinnedId);
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
        this.stopDrift();

        if (this.frameObserver) {
            this.frameObserver.disconnect();
        }
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }
        if (this.simulation) {
            this.simulation.stop();
        }
    }

    handleResize() {
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }
        this.resizeTimer = setTimeout(this.applyResize, 150);
    }

    /**
     * lay the graph out again, but only if the canvas really changed size.
     *
     * Note: the guard is what keeps a phone's graph still. Mobile browsers fire
     *       'resize' whenever the address bar slides in or out, which happens
     *       on nearly every scroll, and the canvas takes its height from the
     *       small viewport -- which that does not change. Relaying out on every
     *       such event would shuffle the graph under the reader's thumb.
     */
    applyResize() {
        this.resizeTimer = null;

        const { width, height } = this.measure();

        if (width === this.size.width && height === this.size.height) {
            return;
        }

        if (this.simulation) {
            this.simulation.stop();
        }
        this.renderD3();
    }

    // the canvas this draws into -- see frameSize
    measure() {
        const frame = this.svgRef.current ? this.svgRef.current.parentNode : null;

        return frameSize(frame, this.props.height);
    }

    // the schema shape into d3 nodes + links. No data is a real state here as
    // well as on the front page: a listing that failed, or a build that could
    // not be read, draws nothing rather than a stand-in.
    buildGraph() {
        const schema = this.props.data;

        if (!schema || !schema.node_types || !schema.edge_types) {
            return { nodes: [], links: [] };
        }

        const nodes = Object.keys(schema.node_types).map((id) => {
            const meta = schema.node_types[id];

            return {
                id: id,
                count: meta.count,
                namespace: sourceNamespace(meta, id),
            };
        });

        const links = Object.keys(schema.edge_types).map((key) => {
            const e = schema.edge_types[key];

            return {
                source: e.src_type,
                target: e.dst_type,
                relation: e.relation,
                origin: e.origin,
                count: e.count,
            };
        });

        return { nodes: nodes, links: links };
    }

    // write the current positions onto the svg. Registered as the simulation's
    // tick handler, and called once by hand after the layout is settled, since
    // settling ticks the simulation without dispatching the event.
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

    /**
     * set the settled layout wandering, and hold on to what stops it -- see
     * driftNodes, which is the placeholder's motion as well as this.
     */
    startDrift(nodes) {
        this.stopDrift();
        this.drift = driftNodes(nodes, this.draw);
    }

    stopDrift() {
        if (this.drift !== null) {
            this.drift();
            this.drift = null;
        }
    }

    /**
     * what the canvas is emphasizing.
     *
     * Focusing a node lifts it and everything it touches; the rest drops back
     * but stays on screen, so the neighborhood reads against the whole rather
     * than against an empty canvas.
     *
     * With no node focused the canvas is not necessarily at rest: the legend
     * can ask for whole CLASSES of it instead -- namespaces, whose nodes it
     * lights, and origins, whose edges it lights -- and that is what `emphasis`
     * carries. It is deliberately the WEAKEST of the three, and reads as the
     * state the canvas rests at rather than as a fourth kind of focus: a node
     * under the pointer, or one pinned by a click, is the reader asking about
     * that node, and the pointer is nowhere near the legend while either is
     * true.
     *
     * Namespaces and origins are two CHANNELS rather than one list, because
     * they light different things. Each filters its own marks, neither cancels
     * the other, and any number of either is an ordinary state -- three
     * namespaces beside one origin reads as 'these types, and the derived edges
     * between things', which is a question that needs both halves askable at
     * once.
     *
     * Note: a namespace drops the edges rather than lighting the ones it
     *       touches. Most edges in a published build touch a given namespace
     *       somewhere, so lighting them lights nearly the whole canvas and
     *       answers a question nobody asked. The question this one answers is
     *       'which circles are these', and the answer is the circles. An origin
     *       held alongside is what puts edges back, and says which.
     *
     * Note: link ends are read as node objects. forceLink swaps the ids for the
     *       nodes themselves as soon as the simulation is built, and nothing can
     *       be focused before that.
     *
     * Note: a node under the POINTER stops glinting, and so do its neighbors,
     *       for as long as the pointer is there -- see '.graph-explorer-node-lit'
     *       -- so what the reader is pointing at is lit fully and steadily. Only
     *       a hover: a pinned node and the legend's marks are states the canvas
     *       rests in, and it rests glinting.
     */
    highlight(nodeId) {
        if (!this.nodeSel) {
            return;
        }

        const active = nodeId != null;
        const hovering = active && nodeId === this.hoveredId;
        const near = new Set(active ? [nodeId, ...(this.neighbors.get(nodeId) || [])] : []);
        const marks = active ? [] : (this.props.emphasis || []);
        const namespaces = new Set(
            marks.filter((m) => m.kind === 'namespace').map((m) => m.value)
        );
        const origins = new Set(marks.filter((m) => m.kind === 'origin').map((m) => m.value));

        this.nodeSel
            .attr('opacity', (d) => {
                if (active) {
                    return near.has(d.id) ? 1 : DIM_OPACITY;
                }
                if (namespaces.size) {
                    return namespaces.has(d.namespace) ? 1 : DIM_OPACITY;
                }

                return 1;
            })
            .attr('stroke', (d) => (d.id === nodeId ? RING : '#ffffff'))
            .attr('stroke-width', (d) => (d.id === nodeId ? RING_WIDTH : 1))
            .classed('graph-explorer-node-lit', (d) => hovering && near.has(d.id));

        this.linkSel.attr('opacity', (d) => {
            if (active) {
                return d.source.id === nodeId || d.target.id === nodeId ? LINK_LIT : LINK_DIM;
            }
            if (namespaces.size || origins.size) {
                return origins.has(d.origin) ? LINK_LIT : LINK_DIM;
            }

            return LINK_REST;
        });
    }

    // what the card says about a node
    describe(nodeId) {
        const node = this.nodes.find((n) => n.id === nodeId);

        if (!node) {
            return null;
        }

        return {
            id: node.id,
            name: shortName(node.id, node.namespace),
            namespace: node.namespace,
            color: this.namespaceColors.get(node.namespace),
            count: node.count,
            linked: this.neighbors.get(node.id).size,
            x: node.x,
            y: node.y,
        };
    }

    //
    // two ways to focus a node, and the card follows whichever is live: the node
    // under the pointer if there is one, the pinned node otherwise. So pointing
    // at another node previews it, and moving off returns to the pinned one.
    //
    refocus() {
        const id = this.hoveredId != null ? this.hoveredId : this.pinnedId;

        this.highlight(id);
        this.svgRef.current.style.cursor = this.hoveredId != null ? 'pointer' : '';
        this.setState({ focus: id != null ? this.describe(id) : null });
    }

    hover(nodeId) {
        if (nodeId === this.hoveredId) {
            return;
        }

        this.hoveredId = nodeId;
        this.refocus();
    }

    /**
     * a click or tap: pin the node it landed on, let go of the pinned node if it
     * landed there again, and let go of everything if it landed on nothing.
     *
     * Note: the hover is dropped as well. A touch screen reports a tap as a
     *       mousemove followed by a click, and never sends the mouseleave that
     *       would end the 'hover' -- so without this, tapping the pinned node to
     *       let it go would leave it focused through a hover nobody is doing.
     *       With a real mouse the pointer is still there, and the next
     *       mousemove puts the hover straight back.
     */
    pin(nodeId) {
        this.pinnedId = nodeId != null && nodeId !== this.pinnedId ? nodeId : null;
        this.hoveredId = null;
        this.refocus();
    }

    renderD3() {
        const { width, height } = this.measure();

        this.size = { width: width, height: height };

        const { nodes, links } = this.buildGraph();
        this.nodes = nodes;
        this.links = links;

        //
        // neighbors by id, excluding self-loops: a type that relates to itself
        // is not thereby connected to anything, and the card's count would
        // otherwise say it was.
        //
        // Note: an edge to a type the schema does not carry is skipped here and
        //       left for forceLink, which rejects it by name below. The page
        //       only ever hands this a filtered schema, which drops such edges.
        //
        this.neighbors = new Map(nodes.map((n) => [n.id, new Set()]));
        links.forEach((l) => {
            const ends = [this.neighbors.get(l.source), this.neighbors.get(l.target)];

            if (l.source !== l.target && ends[0] && ends[1]) {
                ends[0].add(l.target);
                ends[1].add(l.source);
            }
        });

        //
        // handed down rather than assigned here, so the canvas, the legend
        // beside it, the tables below it and the front page backdrop are all
        // reading one map. See buildPalette -- ranking per surface is what made
        // the same namespace two different colors on the two pages.
        //
        // Note: the fallback ranks what it was given, which is what this line
        //       always did. It covers a caller holding only a slice -- the suite,
        //       and nothing that ships.
        //
        this.namespaceColors = this.props.palette || assignNamespaceColors(nodes, TAIL);

        const radius = nodeRadius(width);
        nodes.forEach((d) => { d.r = radius; });

        // whatever was focused belonged to the previous layout
        this.hoveredId = null;
        this.pinnedId = null;
        if (this.state.focus) {
            this.setState({ focus: null });
        }

        const svg = d3.select(this.svgRef.current);
        svg.attr('width', width)
            .attr('height', height)
            .attr('role', 'img')
            .attr('aria-label', `Knowledge graph of ${nodes.length} node types`);
        svg.selectAll('*').remove();

        const gLinks = svg.append('g').attr('class', 'links');
        const gNodes = svg.append('g').attr('class', 'nodes');

        this.linkSel = gLinks.selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', (d) => originColor(d.origin))
            .attr('stroke-width', (d) => (d.origin === 'raw' ? 1 : 1.5))
            .attr('stroke-dasharray', (d) => ORIGIN_DASH[d.origin])
            .attr('opacity', LINK_REST);

        //
        // the class is what the stylesheet glints, and each node's delay puts it
        // a beat behind the one before -- see breathDelay. Nothing else touches
        // either: highlight holds a hovered neighborhood still with a class of
        // its own, so a change of emphasis restarts no node it did not hold.
        //
        this.nodeSel = gNodes.selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('class', 'graph-explorer-node')
            .attr('r', (d) => d.r)
            .attr('fill', (d) => this.namespaceColors.get(d.namespace) || colors['gray-5'])
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .style('animation-delay', (d, index) => breathDelay(index));

        //
        // and straight into whatever the legend is asking for, rather than into
        // the rest state and then into that on the next render. A build swapped
        // under a held legend entry would otherwise paint itself undimmed for a
        // frame and then dim, which reads as the graph flinching.
        //
        this.highlight(null);

        //
        // the layout is run to rest HERE, synchronously, fitted, and drawn once
        // -- see settleLayout, which is where the forces are and why.
        //
        this.simulation = settleLayout(nodes, links, width, height).on('tick', this.draw);
        this.draw();

        // and only now set it moving. The first frame on screen is the layout
        // exactly as it was computed and fitted; the drift is what happens to it
        // afterwards, never what it is drawn as.
        this.startDrift(nodes);

        //
        // pointing is resolved against the nearest node within reach rather than
        // by events on the circles themselves, so the target is a generous disc
        // instead of the 7px mark -- see HOVER_REACH.
        //
        const nearest = (event, reach) => {
            const [x, y] = d3.pointer(event);
            const node = this.simulation.find(x, y, reach);

            return node ? node.id : null;
        };

        svg.on('mousemove', (event) => this.hover(nearest(event, HOVER_REACH)));
        svg.on('mouseleave', () => this.hover(null));

        //
        // a click on EMPTY canvas is the page's 'never mind': it lets go of the
        // pinned node, and of whatever the legend beside the canvas was holding.
        //
        // Empty specifically. A click that lands ON a node is a question about
        // that node, and it is already answered -- a focused node outranks the
        // legend's mark, so the canvas shows the node either way. Clearing the
        // legend there as well would quietly throw away a mark the reader set
        // deliberately and never asked to lose, and they would find it gone
        // when they unpinned the node.
        //
        svg.on('click', (event) => {
            const hit = nearest(event, TAP_REACH);

            this.pin(hit);

            if (hit == null && this.props.onClear) {
                this.props.onClear();
            }
        });
    }

    card() {
        const { focus } = this.state;

        if (!focus) {
            return null;
        }

        const place = placeCard(focus.x, focus.y, this.size.width, this.size.height);

        return (
            <div className={`graph-card ${place.className}`} style={place.style || undefined}>
                <div className='graph-card-namespace'>
                    <span
                        className='graph-legend-swatch'
                        style={{ backgroundColor: focus.color }}
                    />
                    {focus.namespace}
                </div>
                <div className='graph-card-name'>
                    {breakable(focus.name).map((part, index) => (
                        <React.Fragment key={index}>
                            {index ? <wbr /> : null}
                            {part}
                        </React.Fragment>
                    ))}
                </div>
                <div className='graph-card-stats'>
                    {plural(focus.count, 'node', 'nodes')}
                    {' · connected to '}
                    {plural(focus.linked, 'type', 'types')}
                </div>
            </div>
        );
    }

    render() {
        // width/height are set imperatively by d3, so a React re-render never
        // reconciles -- and never wipes -- what it drew. The card is the one
        // part React owns, and it sits beside the svg rather than inside it.
        return (
            <div className='graph-explorer-frame'>
                <svg className='graph-explorer' ref={this.svgRef} />
                {this.card()}
            </div>
        );
    }
}

export default GraphExplorer;

// exported so the legend on the page paints from the same assignment this
// component does -- a legend computed with a different tail would name colors
// that are not on screen.
export {
    TAIL,
    HOVER_REACH,
    TAP_REACH,
    CARD_DOCK_WIDTH,
    // explorer-layout.js's, and still exported from here for the callers and
    // the suite that already read them here
    reducedMotion,
    DRIFT,
    DRIFT_SPEED,
    // exported so the suite reads the canvas against the constants it was
    // painted with rather than against copies of them
    DIM_OPACITY,
    LINK_REST,
};
