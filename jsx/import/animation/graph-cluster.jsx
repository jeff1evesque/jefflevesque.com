/**
 * graph-cluster.jsx: D3 force-directed cluster of the knowledge graph schema.
 *
 *   Each node type in the pyg-knowledge-graph-builder graph_schema.json is
 *   drawn as a node; each edge type is a link. Connected types pull together
 *   via d3.forceLink, so the clusters (economic / financial / market /
 *   environmental) emerge from the actual edge topology rather than a
 *   hardcoded layout.
 *
 *   Data-driven visual channels:
 *     - radius  ∝ sqrt(node count)
 *     - color   =  node category (measurement/observation/temporal/...)
 *     - link    =  edge origin (raw = solid, enrichment = dashed,
 *                  unification = accent)
 *
 *   Mouse behavior:
 *     - the cursor is a smooth repeller: nearby nodes flow away, with a push
 *       that ramps up the closer the pointer gets (proximity, not collision)
 *     - at rest every node wears a washed-out tint of its category color, so
 *       the cluster reads as a quiet backdrop rather than a chart
 *     - hovering a node reveals its type name + count and brings the hovered
 *       type and the types it connects to up to full color; the rest stay muted
 *
 * @GraphCluster, must be capitalized so reactjs renders it as a component.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: the data is currently a committed mock derived from the pyg codebase
 *       ontology inventory. Swap `graph-schema.mock.json` for a live
 *       graph_schema.json (identical shape) when a build is published.
 */

import React, { Component } from 'react';
import * as d3 from 'd3';
import { colors, colors_categorical } from '../general/colors.js';
import { medium_minWidth } from '../general/breakpoints';
import schemaMock from './graph-schema.mock.json';
import PropTypes from 'prop-types';

// fixed category order → stable color assignment (matches metadata_writer.py
// allowed categories: measurement, observation, temporal, structural, entity)
const CATEGORIES = [
    'measurement',
    'observation',
    'temporal',
    'structural',
    'entity',
];

// pointer repel: nodes in the annulus [INNER, OUTER] px from the cursor are
// pushed away — gently, and NOT inside INNER, so the node you're inspecting can
// rest close enough to read instead of fleeing. HOVER_DETECT is how near a node
// must be to the cursor to be highlighted + labeled.
const POINTER_OUTER = 150;
const POINTER_INNER = 45;
const POINTER_STRENGTH = 4;
const HOVER_DETECT = 130;
// how long after a touch the emulated mouse events (which a touch device
// dispatches once per tap, after touchend) are ignored
const MOUSE_AFTER_TOUCH = 700;

// how far a resting node's color is mixed toward white (0 = full color, 1 =
// white). Color arrives on hover; at rest the cluster is a pale backdrop.
const MUTED_MIX = 0.62;
// ...and how much darker than the raw category color a lit node goes. The node
// under the cursor darkens further than its neighbors, so the two roles stay
// readable when a whole neighborhood lights up at once.
const HOVER_DARKEN = 0.5;
const HOVER_DARKEN_SELF = 0.85;

// ambient motion: keep the simulation gently warm so the whole cluster keeps
// slowly floating instead of settling to a dead stop. DRIFT is the per-tick
// wander magnitude; DRIFT_SPEED how fast the wander cycles (small = slow).
const AMBIENT_ALPHA = 0.05;
const DRIFT = 0.06;
const DRIFT_SPEED = 0.003;

// Decorative gray field filling the whole viewport: same-size nodes carrying NO
// data (no labels/tooltips, excluded from hover detection), animated separately
// from the force sim. Each node only darkens slightly on direct hover.
//
// Home spots come from Poisson-disk sampling, not a jittered grid. A grid always
// reads as a grid — the eye finds the rows however much jitter you add, and the
// jitter can't grow past a point without making edges long enough to straddle
// the cluster's corridor (see BG_LINK_MAX). Poisson sampling gives organic,
// non-repeating spacing with a guaranteed minimum separation, which is also what
// keeps nodes from overlapping at rest.
const BG_MIN_DIST = 74;  // closest two home spots may be — sets the density
const BG_WOBBLE = 16;    // px each background node drifts around its home spot
// Edge length is load-bearing, not taste: the cluster clears a corridor around
// itself, and a gray edge can only cross that corridor if it is LONGER than the
// corridor is wide. Candidate links longer than this are never created, which
// bounds every edge below 2 × BG_REPEL_EDGE (150px) and makes straddling
// geometrically impossible. K caps how many neighbors each node links to, which
// is what keeps the mesh sparse.
const BG_LINK_MAX = 132;
const BG_LINK_K = 3;
// per-node variation so the field doesn't wobble in lockstep: each gray node
// gets its own speed and orbit size drawn from these ranges
const BG_SPEED_MIN = 0.35;
const BG_SPEED_MAX = 1.8;
const BG_WOBBLE_MIN = 0.5;   // fraction of BG_WOBBLE
const BG_WOBBLE_MAX = 1.4;
// the colored cluster carves a hole in the gray field: gray nodes are pushed
// out of BG_REPEL_COLOR around every colored node and BG_REPEL_EDGE away from
// every colored edge, so neither the nodes nor the mesh they carry ever land on
// top of the data graph. RELAX is how many times the push set is re-applied per
// tick — one pass can shove a gray node off a colored node straight into an edge.
// Both radii are sized off the longest gray edge (~128px, see above):
//   - EDGE 75 makes the corridor either side of a colored edge 150px wide, so no
//     gray edge is long enough to span it and cross.
//   - COLOR 75 means a near-tangent edge clipping the keep-out disk still only
//     reaches radius ~46 (penetration ≈ L²/8R ≈ 29), far outside the node itself.
const BG_REPEL_COLOR = 75;
const BG_REPEL_EDGE = 75;
const BG_REPEL_RELAX = 3;
// however far the cluster shoves a gray node, it stays within this much of its
// home spot and inside the viewport — otherwise a node near the edge gets pushed
// off-screen and reads as having disappeared
// generous, because a node starting deep inside the cluster has to travel to
// the rim to get clear — a tight cap would strand it in the middle. The viewport
// clamp, not this, is what keeps nodes on screen.
const BG_MAX_PUSH = 420;
// hard non-overlap, enforced on the DRAWN position after easing. The forces
// above only aim for clearance; this guarantees it. Margins are true geometry
// (colored radius + gray radius + a hair), not the roomier force radii, so it
// only engages when a node is genuinely touching something.
const BG_SOLID_MARGIN = 2;
const BG_SOLID_RELAX = 4;
// hard ceiling on how far a gray node's DRAWN position may move in one tick.
// Nothing upstream — easing, projection, a flipped escape route — can move a
// node faster than this, which makes teleporting structurally impossible rather
// than merely unlikely.
const BG_MAX_STEP = 5;
// gray nodes also push each other apart: Poisson spacing keeps them clear at
// rest, but the cluster crowds them together as it shoves them aside, and they
// would otherwise pile up along its rim.
const BG_SELF_GAP = 4;      // px of daylight between two gray nodes
const BG_SELF_STRENGTH = 0.5;
// The repel target is recomputed from scratch every tick, and it is a
// DISCONTINUOUS function of the cluster: a node wedged between two colored nodes
// flips to the other escape route the instant the cluster shifts a pixel, which
// on screen is a node vanishing and reappearing 80px away. So a node never jumps
// to its target — it glides there, covering this fraction of the gap per tick.
// Any discontinuity in the target becomes a fast slide instead of a teleport.
const BG_EASE = 0.12;
// Rebuilding the field re-runs the Poisson sampling from scratch, so every gray
// node lands on a brand-new home spot — on screen that is the whole field
// jumping at once. Mobile browsers fire `resize` whenever the URL bar
// collapses or expands, which a single tap can trigger repeatedly, so a
// rebuild-per-resize reads as the field jittering under your finger. Coalesce
// the events, and treat a height-only change of less than a URL bar as "same
// viewport" — the field already overhangs the screen by a row, so it still
// covers the taller layout without being regenerated.
const BG_RESIZE_DEBOUNCE = 150;
const BG_RESIZE_SLOP = 160;
const BG_LINK_OPACITY = 0.08;
const BG_OPACITY = 0.12;
const BG_OPACITY_HOVER = 0.62;
const BG_DARK_RADIUS = 110;  // gray nodes within this radius of the cursor darken

export function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}

// closest point on the segment (ax,ay)-(bx,by) to (px,py). Writes into a shared
// scratch object rather than returning a new one — this runs (gray nodes ×
// colored edges × relax passes) times per tick, and the garbage adds up.
const segNear = { x: 0, y: 0, t: 0 };
export function segClosest(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    segNear.x = ax + t * dx;
    segNear.y = ay + t * dy;
    segNear.t = t;
    return segNear;
}

class GraphCluster extends Component {
    // prop validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        data: PropTypes.shape({
            node_types: PropTypes.object.isRequired,
            edge_types: PropTypes.object.isRequired,
        }),
    }

    constructor(props) {
        super(props);

        this.svgRef = React.createRef();
        this.pointer = null;
        this.hoveredId = null;
        this.touchedAt = 0;

        const width = window.innerWidth;
        const height = window.innerHeight;

        this.state = { width: width, height: height };

        this.buildGraph = this.buildGraph.bind(this);
        this.buildBackground = this.buildBackground.bind(this);
        this.drawBackground = this.drawBackground.bind(this);
        this.renderD3 = this.renderD3.bind(this);
        this.categoryColor = this.categoryColor.bind(this);
        this.mutedColor = this.mutedColor.bind(this);
        this.highlight = this.highlight.bind(this);
        this.updateHover = this.updateHover.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.applyResize = this.applyResize.bind(this);
    }

    componentDidMount() {
        this.renderD3();
        window.addEventListener('resize', this.handleResize);
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

    // resize arrives in bursts (a drag of the window edge, a mobile URL bar
    // animating away), and the work it triggers is expensive and visible — so
    // act once the burst is over rather than on every event.
    handleResize() {
        if (this.resizeTimer) clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(this.applyResize, BG_RESIZE_DEBOUNCE);
    }

    // keep the canvas and centering forces in sync with the window size, so
    // expanding/shrinking the browser doesn't clip the animation.
    applyResize() {
        this.resizeTimer = null;
        const banner = document.querySelector('.under-construction');
        this.topMargin = banner ? Math.ceil(banner.getBoundingClientRect().height) : 0;
        const width = window.innerWidth;
        const height = window.innerHeight - this.topMargin;
        d3.select(this.svgRef.current)
            .attr('width', width)
            .attr('height', height)
            .style('top', `${this.topMargin}px`);
        // rebuild the gray field so it re-fills the new viewport size — but
        // only when the viewport really changed shape. A pure height nudge
        // within BG_RESIZE_SLOP is a mobile URL bar, not a new layout, and the
        // field's overhang already covers it; regenerating there would teleport
        // every gray node for nothing (see BG_RESIZE_SLOP).
        if (this.gBgNodes) {
            const reshaped = width !== this.viewW
                || Math.abs(height - this.viewH) > BG_RESIZE_SLOP;
            if (reshaped) {
                this.drawBackground(width, height);
            } else {
                // still track the live viewport, so the tick's on-screen clamp
                // follows the URL bar instead of a stale edge
                this.viewH = height;
            }
        }
        if (this.simulation) {
            this.simulation.force('x').x(width / 2);
            this.simulation.force('y').y(height / 2);
            this.simulation.alpha(0.3).restart();
        }
    }

    // color a node by its ontology category, falling back to a neutral gray
    categoryColor(category) {
        const index = CATEGORIES.indexOf(category);
        return index >= 0
            ? colors_categorical[index % colors_categorical.length]
            : colors['gray-5'];
    }

    // the resting tint: the category color mixed most of the way to white, so a
    // node still hints at its category without competing for attention. Mixing
    // toward white rather than lowering opacity keeps it opaque over the gray
    // field — a translucent node would pick up whatever mesh sits behind it.
    mutedColor(category) {
        return d3.interpolateRgb(this.categoryColor(category), '#ffffff')(MUTED_MIX);
    }

    // transform the graph_schema.json shape into d3 nodes + links
    buildGraph() {
        const schema = this.props.data ? this.props.data : schemaMock;

        const nodes = Object.keys(schema.node_types).map((id) => {
            const meta = schema.node_types[id];
            return {
                id: id,
                count: meta.count,
                category: meta.category,
                source_type_uri: meta.source_type_uri,
            };
        });

        {/*

            Note: edge endpoints reference node-type ids; forceLink resolves
                  them by id. Self-loops (src === dst) are kept — d3 tolerates
                  them and they read as recurring/temporal relations.

        */}

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

    // Build the gray field: Poisson-disk home spots (organic spacing, minimum
    // separation guaranteed) linked to their nearest few neighbours. Positions
    // are set directly, not by the force sim, so the field stays spread across
    // the viewport instead of collapsing into the cluster.
    //
    // Bridson's algorithm: keep an "active" list of accepted points, repeatedly
    // fling candidates into the annulus [d, 2d] around a random active point,
    // and accept the first that is at least d from every neighbour. An
    // acceleration grid with cells of d/sqrt(2) holds at most one point each, so
    // the neighbour check only ever looks at the surrounding cells.
    buildBackground(width, height) {
        const d = BG_MIN_DIST;
        // overhang the viewport so the field runs off every edge rather than
        // stopping short of it
        const pad = d;
        const x0 = -pad;
        const y0 = -pad;
        const w = width + pad * 2;
        const h = height + pad * 2;
        const cell = d / Math.SQRT2;
        const gw = Math.ceil(w / cell);
        const gh = Math.ceil(h / cell);
        const cells = new Int32Array(gw * gh).fill(-1);
        const pts = [];
        const active = [];

        const fits = (px, py) => {
            const cx = Math.floor((px - x0) / cell);
            const cy = Math.floor((py - y0) / cell);
            for (let iy = Math.max(cy - 2, 0); iy <= Math.min(cy + 2, gh - 1); iy++) {
                for (let ix = Math.max(cx - 2, 0); ix <= Math.min(cx + 2, gw - 1); ix++) {
                    const idx = cells[iy * gw + ix];
                    if (idx >= 0) {
                        const q = pts[idx];
                        if (Math.hypot(q.hx - px, q.hy - py) < d) return false;
                    }
                }
            }
            return true;
        };
        const accept = (px, py) => {
            const node = {
                background: true,
                hx: px,
                hy: py,
                x: px,
                y: py,
                // where the repel wants it (tx,ty) vs. where it is drawn
                // (x,y) — the gap is closed gradually, see BG_EASE
                tx: px,
                ty: py,
                phase: Math.random() * Math.PI * 2,
                // own tempo + orbit size: some nodes creep, some skitter
                speed: BG_SPEED_MIN + Math.random() * (BG_SPEED_MAX - BG_SPEED_MIN),
                wobble: BG_WOBBLE * (BG_WOBBLE_MIN
                    + Math.random() * (BG_WOBBLE_MAX - BG_WOBBLE_MIN)),
            };
            const idx = pts.length;
            pts.push(node);
            active.push(idx);
            const cx = Math.floor((px - x0) / cell);
            const cy = Math.floor((py - y0) / cell);
            cells[cy * gw + cx] = idx;
        };

        accept(x0 + Math.random() * w, y0 + Math.random() * h);
        while (active.length) {
            const a = Math.floor(Math.random() * active.length);
            const p = pts[active[a]];
            let placed = false;
            for (let attempt = 0; attempt < 24; attempt++) {
                const angle = Math.random() * Math.PI * 2;
                const r = d * (1 + Math.random());
                const px = p.hx + Math.cos(angle) * r;
                const py = p.hy + Math.sin(angle) * r;
                if (px < x0 || py < y0 || px >= x0 + w || py >= y0 + h) continue;
                if (!fits(px, py)) continue;
                accept(px, py);
                placed = true;
                break;
            }
            // exhausted: this point can take no more neighbours
            if (!placed) active.splice(a, 1);
        }

        // Link each node to its nearest few neighbours within BG_LINK_MAX. The
        // cap on both count and length is what keeps the mesh sparse and every
        // edge too short to straddle the cluster's corridor.
        const links = [];
        const seen = new Set();
        const reach = Math.ceil(BG_LINK_MAX / cell);
        pts.forEach((p, i) => {
            const cx = Math.floor((p.hx - x0) / cell);
            const cy = Math.floor((p.hy - y0) / cell);
            const near = [];
            for (let iy = Math.max(cy - reach, 0); iy <= Math.min(cy + reach, gh - 1); iy++) {
                for (let ix = Math.max(cx - reach, 0); ix <= Math.min(cx + reach, gw - 1); ix++) {
                    const j = cells[iy * gw + ix];
                    if (j < 0 || j === i) continue;
                    const dist = Math.hypot(pts[j].hx - p.hx, pts[j].hy - p.hy);
                    if (dist <= BG_LINK_MAX) near.push({ j: j, dist: dist });
                }
            }
            near.sort((a, b) => a.dist - b.dist);
            for (let k = 0; k < Math.min(BG_LINK_K, near.length); k++) {
                const j = near[k].j;
                const key = i < j ? `${i}:${j}` : `${j}:${i}`;
                if (seen.has(key)) continue;
                seen.add(key);
                links.push({ source: p, target: pts[j] });
            }
        });

        return { nodes: pts, links: links };
    }

    // (re)draw the gray field for the current viewport; called on first render
    // and on resize so it always covers the whole screen. Same radius as the
    // real nodes; darkens slightly on hover; never triggers a tooltip.
    drawBackground(width, height) {
        const nodeRadius = width < medium_minWidth ? 6 : 9;
        // remembered for the tick's viewport clamp — the tick closure captures
        // the size at first render, which goes stale after a resize
        this.viewW = width;
        this.viewH = height;
        this.bgRadius = nodeRadius;
        this.background = this.buildBackground(width, height);

        this.bgLinkSel = this.gBgLinks.selectAll('line')
            .data(this.background.links)
            .join('line')
            .attr('stroke', colors['gray-6'])
            .attr('stroke-width', 0.6)
            .attr('opacity', BG_LINK_OPACITY);

        this.bgNodeSel = this.gBgNodes.selectAll('circle')
            .data(this.background.nodes)
            .join('circle')
            .attr('r', nodeRadius)
            .attr('fill', colors['gray-5'])
            .attr('opacity', BG_OPACITY);
    }

    // Resting state is muted: every node wears a washed-out tint of its category
    // color, so the cluster reads as one quiet backdrop. Hovering is what brings
    // color in — the hovered type and the types it actually connects to snap to
    // full saturation, which makes the neighborhood the thing you see rather
    // than something you have to pick out of an already-colorful field.
    highlight(nodeId) {
        const connected = new Set();
        if (nodeId != null) {
            connected.add(nodeId);
            this.links.forEach((l) => {
                const s = l.source.id ? l.source.id : l.source;
                const t = l.target.id ? l.target.id : l.target;
                if (s === nodeId) connected.add(t);
                if (t === nodeId) connected.add(s);
            });
        }

        const active = nodeId != null;
        const lit = (d) => active && connected.has(d.id);

        // lit nodes come up to full color and a touch darker than the raw
        // category color — deeper reads as "selected" against the pale resting
        // field, and the hovered node is darkened furthest so it stays
        // distinguishable from the neighbors lighting up alongside it
        this.nodeSel.attr('fill', (d) => {
            if (!lit(d)) return this.mutedColor(d.category);
            const base = d3.color(this.categoryColor(d.category));
            return base.darker(d.id === nodeId ? HOVER_DARKEN_SELF : HOVER_DARKEN)
                .toString();
        });
        // muted nodes also sit back a little, so the lit neighborhood carries
        // both more color and more presence
        this.nodeSel.attr('opacity', (d) => (!active || lit(d) ? 1 : 0.5));
        this.linkSel.attr('opacity', (d) => {
            const s = d.source.id ? d.source.id : d.source;
            const t = d.target.id ? d.target.id : d.target;
            if (!active) return 0.18;
            return s === nodeId || t === nodeId ? 0.9 : 0.05;
        });
        // only the hovered node's own label — showing every neighbor's label
        // too was cluttered and hard to read
        this.labelSel.attr('opacity', (d) =>
            active && d.id === nodeId ? 1 : 0
        );
    }

    // Highlight the node nearest the cursor (within HOVER_DETECT px) and keep
    // its label up as it moves. Decoupled from the cursor being exactly over a
    // circle — the repel makes that nearly impossible to hold, which is why the
    // tooltip only used to flash by. Recomputed every tick so the label tracks
    // the node even while it drifts.
    updateHover() {
        if (!this.pointer || !this.nodes) {
            if (this.hoveredId != null) {
                this.hoveredId = null;
                this.highlight(null);
            }
            return;
        }
        let nearest = null;
        let best = HOVER_DETECT * HOVER_DETECT;
        this.nodes.forEach((n) => {
            const dx = n.x - this.pointer.x;
            const dy = n.y - this.pointer.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < best) {
                best = d2;
                nearest = n;
            }
        });
        const id = nearest ? nearest.id : null;
        if (id !== this.hoveredId) {
            this.hoveredId = id;
            this.highlight(id);
        }
    }

    renderD3() {
        // offset the whole canvas below the "Site Under Construction" banner so
        // no node ever renders over it
        const banner = document.querySelector('.under-construction');
        this.topMargin = banner ? Math.ceil(banner.getBoundingClientRect().height) : 0;

        const width = window.innerWidth;
        const height = window.innerHeight - this.topMargin;
        const small = width < medium_minWidth;

        const nodeRadius = small ? 6 : 9;

        const { nodes, links } = this.buildGraph();
        this.links = links;
        this.nodes = nodes;

        // real cluster nodes: uniform radius + a per-node wander phase
        nodes.forEach((d) => {
            d.r = nodeRadius;
            d.phase = Math.random() * Math.PI * 2;
        });

        const svg = d3.select(this.svgRef.current);
        svg.attr('width', width).attr('height', height).style('top', `${this.topMargin}px`);
        svg.selectAll('*').remove();

        // background groups first so the gray field renders behind the cluster
        this.gBgLinks = svg.append('g').attr('class', 'bg-links');
        this.gBgNodes = svg.append('g').attr('class', 'bg-nodes');
        const gLinks = svg.append('g').attr('class', 'links');
        const gNodes = svg.append('g').attr('class', 'nodes');
        const gLabels = svg.append('g').attr('class', 'labels');

        // the screen-filling gray field (built + animated separately from sim)
        this.drawBackground(width, height);

        // ---- links (styled by origin) --------------------------------------
        const originDash = { raw: null, enrichment: '5 4', unification: '2 6' };
        const originColor = {
            raw: colors['gray-5'],
            enrichment: colors_categorical[0],
            unification: colors_categorical[1],
        };

        this.linkSel = gLinks.selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', (d) => originColor[d.origin] || colors['gray-5'])
            .attr('stroke-width', (d) => (d.origin === 'raw' ? 1 : 1.5))
            .attr('stroke-dasharray', (d) => originDash[d.origin])
            // faint at rest, to match the muted nodes
            .attr('opacity', 0.18);

        // ---- nodes ---------------------------------------------------------
        this.nodeSel = gNodes.selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('r', (d) => d.r)
            // resting state is the muted tint; hover is what brings color in
            .attr('fill', (d) => this.mutedColor(d.category))
            .attr('stroke', colors['gray-1'])
            .attr('stroke-width', 1)
            .style('cursor', 'pointer');

        // ---- labels (hidden until hover) -----------------------------------
        this.labelSel = gLabels.selectAll('text')
            .data(nodes)
            .join('text')
            .text((d) => `${d.id} · ${d.count.toLocaleString()}`)
            .attr('font-size', small ? 11 : 13)
            .attr('font-family', 'sans-serif')
            .attr('font-weight', 600)
            .attr('fill', colors['gray-8'])
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 3)
            .attr('paint-order', 'stroke')
            .attr('text-anchor', 'middle')
            .attr('pointer-events', 'none')
            .attr('opacity', 0);

        // ---- drag ----------------------------------------------------------
        const drag = d3.drag()
            .on('start', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
            .on('end', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0);
                d.fx = null; d.fy = null;
            });
        this.nodeSel.call(drag);

        // ---- simulation ----------------------------------------------------
        // forceLink is what makes it cluster: connected node types attract, so
        // the source-family communities pull themselves into visible blobs.
        const pointerForce = (alpha) => {
            if (!this.pointer) return;
            nodes.forEach((n) => {
                // background lattice stays serene — only the real cluster reacts
                // to the cursor (it still drifts, and follows via its tethers)
                if (n.background) return;
                const dx = n.x - this.pointer.x;
                const dy = n.y - this.pointer.y;
                const dist = Math.hypot(dx, dy);
                // dead zone inside INNER: leave the node you're inspecting be,
                // so it stays close enough to read; push only in the annulus.
                if (dist > POINTER_INNER && dist < POINTER_OUTER) {
                    const push = ((POINTER_OUTER - dist) / (POINTER_OUTER - POINTER_INNER))
                        * POINTER_STRENGTH;
                    n.vx += (dx / dist) * push;
                    n.vy += (dy / dist) * push;
                }
            });
        };

        // ambient wander: nudge each node along a slow per-node sine cycle so
        // the cluster is always gently drifting/jittering, even when idle.
        let driftT = 0;
        const driftForce = () => {
            driftT += DRIFT_SPEED;
            nodes.forEach((n) => {
                n.vx += Math.cos(driftT + n.phase) * DRIFT;
                n.vy += Math.sin(driftT * 0.8 + n.phase) * DRIFT;
            });
        };

        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links)
                .id((d) => d.id)
                // background links carry no count — give them a fixed short
                // tether; a bare Math.sqrt(undefined) would be NaN and poison
                // every connected node's position.
                .distance((d) => (d.count ? 60 + Math.sqrt(d.count) * 0.15 : 40))
                .strength((d) => (d.background ? 0.15 : 0.4)))
            .force('charge', d3.forceManyBody().strength(small ? -60 : -120))
            .force('collide', d3.forceCollide().radius((d) => d.r + 3).iterations(2))
            .force('x', d3.forceX(width / 2).strength(0.04))
            .force('y', d3.forceY(height / 2).strength(0.04))
            .force('pointer', pointerForce)
            .force('drift', driftForce)
            .on('tick', () => {
                // wobble the gray field gently around its fixed home grid
                const colored = this.nodes;
                const coloredLinks = this.links;

                // the colored graph lives inside its nodes' bounding box (edges
                // connect nodes, so they can't escape it). Gray nodes and edges
                // outside the box + clearance can't be touching anything, and
                // skipping them early is what keeps this affordable — the vast
                // majority of the field is nowhere near the cluster.
                let clMinX = Infinity, clMinY = Infinity;
                let clMaxX = -Infinity, clMaxY = -Infinity;
                for (let i = 0; i < colored.length; i++) {
                    const c = colored[i];
                    if (c.x < clMinX) clMinX = c.x;
                    if (c.x > clMaxX) clMaxX = c.x;
                    if (c.y < clMinY) clMinY = c.y;
                    if (c.y > clMaxY) clMaxY = c.y;
                }
                const nodePad = BG_REPEL_COLOR;
                const edgePad = this.bgRadius + 2;

                this.background.nodes.forEach((n) => {
                    // start from the node's gentle orbit around its home spot
                    const t = driftT * n.speed;
                    let px = n.hx + Math.cos(t * 3 + n.phase) * n.wobble;
                    let py = n.hy + Math.sin(t * 2.4 + n.phase) * n.wobble;

                    // pushed out of the way by the colored cluster — both its
                    // nodes and the edges between them — so the gray field
                    // parts around the data graph instead of overlapping it.
                    // Recomputed from home each tick, so it eases back once the
                    // cluster moves off. Several passes: escaping a node can
                    // land you on an edge, and vice versa.
                    const nearCluster = px > clMinX - nodePad && px < clMaxX + nodePad
                        && py > clMinY - nodePad && py < clMaxY + nodePad;
                    for (let pass = 0; nearCluster && pass < BG_REPEL_RELAX; pass++) {
                        for (let i = 0; i < colored.length; i++) {
                            const c = colored[i];
                            const dx = px - c.x;
                            const dy = py - c.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < BG_REPEL_COLOR && dist > 0.01) {
                                const push = BG_REPEL_COLOR - dist;
                                px += (dx / dist) * push;
                                py += (dy / dist) * push;
                            }
                        }
                        for (let i = 0; i < coloredLinks.length; i++) {
                            const l = coloredLinks[i];
                            const near = segClosest(px, py,
                                l.source.x, l.source.y, l.target.x, l.target.y);
                            const dx = px - near.x;
                            const dy = py - near.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < BG_REPEL_EDGE && dist > 0.01) {
                                const push = BG_REPEL_EDGE - dist;
                                px += (dx / dist) * push;
                                py += (dy / dist) * push;
                            }
                        }
                    }

                    // however hard it was shoved, a node stays near home and on
                    // screen: being pushed out of frame is indistinguishable
                    // from disappearing.
                    const ox = px - n.hx;
                    const oy = py - n.hy;
                    const off = Math.sqrt(ox * ox + oy * oy);
                    if (off > BG_MAX_PUSH) {
                        px = n.hx + (ox / off) * BG_MAX_PUSH;
                        py = n.hy + (oy / off) * BG_MAX_PUSH;
                    }
                    // the grid intentionally overhangs the viewport by a row and
                    // column, so the bound is "no further out than home already
                    // is" rather than a hard viewport clamp — on-screen nodes
                    // stay on screen, overhang nodes stay put.
                    n.tx = clamp(px, Math.min(n.hx, edgePad),
                        Math.max(n.hx, this.viewW - edgePad));
                    n.ty = clamp(py, Math.min(n.hy, edgePad),
                        Math.max(n.hy, this.viewH - edgePad));
                });
                // ---- commit: glide toward the target, never snap to it ------
                const solidGray = this.bgRadius + BG_SOLID_MARGIN;
                const bgNodes = this.background.nodes;
                bgNodes.forEach((n) => {
                    n.pX = n.x;
                    n.pY = n.y;
                    n.x += (n.tx - n.x) * BG_EASE;
                    n.y += (n.ty - n.y) * BG_EASE;
                });

                // ---- gray nodes separate from each other --------------------
                // Poisson spacing keeps them apart at rest, but the cluster
                // crowds them as it shoves them aside. Bucket by cell so this
                // stays linear — comparing every pair would be ~n²/2 per tick.
                const selfWant = this.bgRadius * 2 + BG_SELF_GAP;
                const sCell = selfWant;
                const sCols = Math.ceil(this.viewW / sCell) + 3;
                const sRows = Math.ceil(this.viewH / sCell) + 3;
                if (!this.selfBuckets || this.selfBuckets.length !== sCols * sRows) {
                    this.selfBuckets = Array.from({ length: sCols * sRows }, () => []);
                }
                const buckets = this.selfBuckets;
                for (let i = 0; i < buckets.length; i++) buckets[i].length = 0;
                const bucketOf = (n) => {
                    const cx = clamp(Math.floor(n.x / sCell) + 1, 0, sCols - 1);
                    const cy = clamp(Math.floor(n.y / sCell) + 1, 0, sRows - 1);
                    return cy * sCols + cx;
                };
                bgNodes.forEach((n) => buckets[bucketOf(n)].push(n));
                bgNodes.forEach((n) => {
                    const cx = clamp(Math.floor(n.x / sCell) + 1, 0, sCols - 1);
                    const cy = clamp(Math.floor(n.y / sCell) + 1, 0, sRows - 1);
                    // a node closer than selfWant must be in one of the 9 cells
                    // around this one, since cells are selfWant across
                    for (let iy = Math.max(cy - 1, 0); iy <= Math.min(cy + 1, sRows - 1); iy++) {
                        for (let ix = Math.max(cx - 1, 0); ix <= Math.min(cx + 1, sCols - 1); ix++) {
                            const list = buckets[iy * sCols + ix];
                            for (let k = 0; k < list.length; k++) {
                                const m = list[k];
                                if (m === n) continue;
                                const dx = n.x - m.x;
                                const dy = n.y - m.y;
                                const dist = Math.hypot(dx, dy);
                                if (dist >= selfWant) continue;
                                // each node moves half the overlap, so the pair
                                // separates without either doing all the work
                                const push = (selfWant - dist) * 0.5 * BG_SELF_STRENGTH;
                                const ux = dist > 0.01 ? dx / dist : 1;
                                const uy = dist > 0.01 ? dy / dist : 0;
                                n.x += ux * push;
                                n.y += uy * push;
                                m.x -= ux * push;
                                m.y -= uy * push;
                            }
                        }
                    }
                });

                bgNodes.forEach((n) => {
                    const prevX = n.pX;
                    const prevY = n.pY;

                    // Hard constraint on the drawn position. Easing means the
                    // node lags its (already clear) target, so mid-glide it can
                    // still be sitting on the cluster — the forces alone can't
                    // promise otherwise. This projects it back out to the
                    // surface of whatever it's touching, by the minimum distance
                    // needed. Small correction in practice, so it doesn't fight
                    // the easing or reintroduce jumps: it slides a node around
                    // the rim rather than letting it pass through.
                    if (n.x > clMinX - nodePad && n.x < clMaxX + nodePad
                        && n.y > clMinY - nodePad && n.y < clMaxY + nodePad) {
                        for (let pass = 0; pass < BG_SOLID_RELAX; pass++) {
                            let moved = false;
                            for (let i = 0; i < colored.length; i++) {
                                const c = colored[i];
                                const dx = n.x - c.x;
                                const dy = n.y - c.y;
                                const dist = Math.hypot(dx, dy);
                                const want = c.r + solidGray;
                                if (dist < want) {
                                    // dead center: pick a direction rather than
                                    // divide by zero
                                    const ux = dist > 0.01 ? dx / dist : 1;
                                    const uy = dist > 0.01 ? dy / dist : 0;
                                    n.x = c.x + ux * want;
                                    n.y = c.y + uy * want;
                                    moved = true;
                                }
                            }
                            for (let i = 0; i < coloredLinks.length; i++) {
                                const l = coloredLinks[i];
                                const near = segClosest(n.x, n.y, l.source.x,
                                    l.source.y, l.target.x, l.target.y);
                                const dx = n.x - near.x;
                                const dy = n.y - near.y;
                                const dist = Math.hypot(dx, dy);
                                if (dist < solidGray) {
                                    const ux = dist > 0.01 ? dx / dist : 1;
                                    const uy = dist > 0.01 ? dy / dist : 0;
                                    n.x = near.x + ux * solidGray;
                                    n.y = near.y + uy * solidGray;
                                    moved = true;
                                }
                            }
                            if (!moved) break;
                        }
                    }

                    // Last word on motion, and the reason a node can no longer
                    // glitch: whatever the easing and the projection above came
                    // up with, the drawn position moves at most BG_MAX_STEP px
                    // this frame. The projection assigns absolute positions, so
                    // when a node's escape route flips it *would* snap across
                    // the screen; capping the step turns any such jump into a
                    // fast slide. Non-overlap then reasserts itself over the
                    // next few frames instead of instantly.
                    const sdx = n.x - prevX;
                    const sdy = n.y - prevY;
                    const step = Math.hypot(sdx, sdy);
                    if (step > BG_MAX_STEP) {
                        n.x = prevX + (sdx / step) * BG_MAX_STEP;
                        n.y = prevY + (sdy / step) * BG_MAX_STEP;
                    }

                    // gray nodes don't repel from the cursor; instead every
                    // node within BG_DARK_RADIUS darkens — strongest at the
                    // center, fading to the edge (a soft spotlight).
                    if (this.pointer) {
                        const dx = n.x - this.pointer.x;
                        const dy = n.y - this.pointer.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        n.dark = dist < BG_DARK_RADIUS ? 1 - dist / BG_DARK_RADIUS : 0;
                    } else {
                        n.dark = 0;
                    }
                });

                this.bgLinkSel
                    .attr('x1', (d) => d.source.x)
                    .attr('y1', (d) => d.source.y)
                    .attr('x2', (d) => d.target.x)
                    .attr('y2', (d) => d.target.y);
                this.bgNodeSel
                    .attr('cx', (d) => d.x)
                    .attr('cy', (d) => d.y)
                    .attr('opacity', (d) =>
                        BG_OPACITY + (BG_OPACITY_HOVER - BG_OPACITY) * (d.dark || 0)
                    );
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
                    .attr('y', (d) => d.y - d.r - 6);
                this.updateHover();
            });

        // keep the sim gently warm forever so the cluster never freezes; the
        // initial layout still settles because alpha starts high and decays
        // down to this ambient floor.
        this.simulation.alphaTarget(AMBIENT_ALPHA);

        // ---- pointer proximity (reheats sim so nodes react to the cursor) --
        svg.on('mousemove', (event) => {
            // a tap on a touch device replays as a mousemove *after* touchend,
            // which would re-latch the pointer we just cleared; the touch
            // handlers below own the pointer for as long as MOUSE_AFTER_TOUCH
            if (Date.now() - this.touchedAt < MOUSE_AFTER_TOUCH) return;
            const p = d3.pointer(event);
            this.pointer = { x: p[0], y: p[1] };
            this.simulation.alphaTarget(0.15).restart();
            this.updateHover();
        });
        const clearPointer = () => {
            this.pointer = null;
            // return to the ambient floor (not 0) so it keeps floating
            this.simulation.alphaTarget(AMBIENT_ALPHA);
            this.hoveredId = null;
            this.highlight(null);
        };
        svg.on('mouseleave', clearPointer);

        // ---- touch ---------------------------------------------------------
        // A touch device emits one synthetic mousemove per tap and never a
        // mouseleave, so the handlers above would latch the pointer wherever
        // the finger last touched: the cluster stays shoved aside and the gray
        // spotlight stays lit for good. Drive the pointer from the touch
        // events themselves and drop it when the finger lifts. Listeners are
        // passive — this only reads the position, and preventing the default
        // would break scrolling the page underneath.
        const touchEnd = () => {
            this.touchedAt = Date.now();
            clearPointer();
        };
        const touchMove = (event) => {
            this.touchedAt = Date.now();
            const touch = event.touches[0];
            if (!touch) return;
            const p = d3.pointer(touch, this.svgRef.current);
            this.pointer = { x: p[0], y: p[1] };
            this.simulation.alphaTarget(0.15).restart();
            this.updateHover();
        };
        svg.on('touchstart', touchMove, { passive: true });
        svg.on('touchmove', touchMove, { passive: true });
        svg.on('touchend', touchEnd, { passive: true });
        svg.on('touchcancel', touchEnd, { passive: true });
    }

    render() {
        // width/height are set imperatively by d3 (renderD3 + handleResize) so
        // React re-renders never reconcile — and never wipe — the d3 content.
        return <svg className='d3-absolute' ref={this.svgRef} />;
    }
}

export default GraphCluster;
