/**
 * graph-explorer.jsx: the knowledge graph at full attention.
 *
 * Same data and the same visual language as the front page backdrop -- both read
 * their colours and link styling from encoding.js, so a legend here describes
 * that cluster correctly too -- but none of its presentation.
 *
 * What the backdrop does that this deliberately does not:
 *
 *   - mutes every node toward white at rest. Colour there arrives on hover,
 *     because the cluster is meant to sit behind hero text. Here it is the
 *     content, so it is painted at full strength from the start.
 *   - draws a decorative gray field and parts it around the cluster. There is
 *     nothing decorative on this page.
 *   - hides labels until hover. A page someone opened on purpose should say what
 *     it is showing without being interrogated.
 *   - shoves nodes away from the cursor. Reading a graph while it flinches from
 *     the pointer is worse than useless.
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
import { medium_minWidth } from '../general/breakpoints';
import {
    sourceNamespace,
    assignNamespaceColors,
    ORIGIN_DASH,
    originColor,
} from './encoding.js';
import PropTypes from 'prop-types';

// the tail past the eight categorical slots is SHADED here rather than rolled
// into one neutral -- this page carries a legend, and a legend that says "and 9
// others" is not a legend. See encoding.js.
const TAIL = 'shade';

const NODE_RADIUS = 7;
const NODE_RADIUS_SMALL = 5;
const LABEL_SIZE = 11;
const LABEL_SIZE_SMALL = 9;

// link length from edge count, clamped. Edge counts span seven orders of
// magnitude, and without the ceiling one edge stretches half the viewport and
// drags the layout off centre with it.
const LINK_BASE = 50;
const LINK_SCALE = 0.12;
const LINK_MAX = 140;
const LINK_PLAIN = 40;

const CHARGE = -140;
const CHARGE_SMALL = -70;

// how far a node's neighbourhood is lifted when hovered, and how far everything
// else drops back. Both stay visible -- this is emphasis, not filtering.
const DIM_OPACITY = 0.15;
const LINK_REST = 0.35;
const LINK_LIT = 0.95;
const LINK_DIM = 0.06;

class GraphExplorer extends Component {
    static propTypes = {
        data: PropTypes.shape({
            node_types: PropTypes.object,
            edge_types: PropTypes.object,
        }),
        height: PropTypes.number,
    }

    constructor(props) {
        super(props);

        this.svgRef = React.createRef();
        this.hoveredId = null;

        this.buildGraph = this.buildGraph.bind(this);
        this.renderD3 = this.renderD3.bind(this);
        this.highlight = this.highlight.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    componentDidMount() {
        this.renderD3();
        window.addEventListener('resize', this.handleResize);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.data !== this.props.data) {
            if (this.simulation) {
                this.simulation.stop();
            }
            this.renderD3();
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);

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
        this.resizeTimer = setTimeout(() => {
            this.resizeTimer = null;
            if (this.simulation) {
                this.simulation.stop();
            }
            this.renderD3();
        }, 150);
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

    // hovering lifts a node and everything it touches; the rest drops back but
    // stays on screen, so the neighbourhood reads against the whole rather than
    // against an empty canvas.
    highlight(nodeId) {
        if (!this.nodeSel) {
            return;
        }

        const near = new Set();

        if (nodeId != null) {
            near.add(nodeId);
            this.links.forEach((l) => {
                const s = l.source.id ? l.source.id : l.source;
                const t = l.target.id ? l.target.id : l.target;
                if (s === nodeId) near.add(t);
                if (t === nodeId) near.add(s);
            });
        }

        const active = nodeId != null;

        this.nodeSel.attr('opacity', (d) => (!active || near.has(d.id) ? 1 : DIM_OPACITY));
        this.labelSel.attr('opacity', (d) => (!active || near.has(d.id) ? 1 : DIM_OPACITY));
        this.linkSel.attr('opacity', (d) => {
            if (!active) {
                return LINK_REST;
            }

            const s = d.source.id ? d.source.id : d.source;
            const t = d.target.id ? d.target.id : d.target;

            return s === nodeId || t === nodeId ? LINK_LIT : LINK_DIM;
        });
    }

    renderD3() {
        const width = this.svgRef.current
            ? this.svgRef.current.parentNode.clientWidth || window.innerWidth
            : window.innerWidth;
        const height = this.props.height ? this.props.height : 600;
        const small = width < medium_minWidth;

        const { nodes, links } = this.buildGraph();
        this.nodes = nodes;
        this.links = links;

        this.namespaceColors = assignNamespaceColors(nodes, TAIL);

        const radius = small ? NODE_RADIUS_SMALL : NODE_RADIUS;
        nodes.forEach((d) => { d.r = radius; });

        const svg = d3.select(this.svgRef.current);
        svg.attr('width', width).attr('height', height);
        svg.selectAll('*').remove();

        const gLinks = svg.append('g').attr('class', 'links');
        const gNodes = svg.append('g').attr('class', 'nodes');
        const gLabels = svg.append('g').attr('class', 'labels');

        this.linkSel = gLinks.selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', (d) => originColor(d.origin))
            .attr('stroke-width', (d) => (d.origin === 'raw' ? 1 : 1.5))
            .attr('stroke-dasharray', (d) => ORIGIN_DASH[d.origin])
            .attr('opacity', LINK_REST);

        this.nodeSel = gNodes.selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('r', (d) => d.r)
            .attr('fill', (d) => this.namespaceColors.get(d.namespace) || colors['gray-5'])
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .style('cursor', 'pointer')
            .on('mouseenter', (event, d) => {
                this.hoveredId = d.id;
                this.highlight(d.id);
            })
            .on('mouseleave', () => {
                this.hoveredId = null;
                this.highlight(null);
            });

        this.labelSel = gLabels.selectAll('text')
            .data(nodes)
            .join('text')
            .text((d) => d.id)
            .attr('font-size', small ? LABEL_SIZE_SMALL : LABEL_SIZE)
            .attr('font-family', 'sans-serif')
            .attr('fill', colors['gray-8'])
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2.5)
            .attr('paint-order', 'stroke')
            .attr('text-anchor', 'middle')
            .attr('pointer-events', 'none');

        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links)
                .id((d) => d.id)
                .distance((d) => (d.count
                    ? Math.min(LINK_BASE + Math.sqrt(d.count) * LINK_SCALE, LINK_MAX)
                    : LINK_PLAIN)))
            .force('charge', d3.forceManyBody().strength(small ? CHARGE_SMALL : CHARGE))
            .force('collide', d3.forceCollide().radius((d) => d.r + 14))
            .force('x', d3.forceX(width / 2).strength(0.06))
            .force('y', d3.forceY(height / 2).strength(0.06))
            .on('tick', () => {
                this.linkSel
                    .attr('x1', (d) => d.source.x)
                    .attr('y1', (d) => d.source.y)
                    .attr('x2', (d) => d.target.x)
                    .attr('y2', (d) => d.target.y);
                this.nodeSel
                    .attr('cx', (d) => d.x)
                    .attr('cy', (d) => d.y);
                this.labelSel
                    .attr('x', (d) => d.x)
                    .attr('y', (d) => d.y - d.r - 4);
            });
    }

    render() {
        // width/height are set imperatively by d3, so a React re-render never
        // reconciles -- and never wipes -- what it drew.
        return <svg className='graph-explorer' ref={this.svgRef} />;
    }
}

export default GraphExplorer;

// exported so the legend on the page paints from the same assignment this
// component does -- a legend computed with a different tail would name colours
// that are not on screen.
export { TAIL };
