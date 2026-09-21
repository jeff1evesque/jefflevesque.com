/**
 * explorer-layout.js: how /graph lays a graph out, how large it draws a node,
 *                     and how the settled layout moves.
 *
 * Two things draw into that page's canvas: the build, once it has arrived, and
 * the placeholder standing in for it while it is on its way. The placeholder
 * used to be a hand-placed cluster in a scaled viewBox, so its nodes came out at
 * whatever the scale made of them -- up to twice the size of the ones that
 * replaced them -- and it stood still where the graph replacing it moved.
 *
 * So what makes a graph look like THIS page's graph lives here once, and both
 * import it: the radius, the forces, the fit and the drift. What is drawn with
 * them -- colour, the legend's emphasis, the card -- stays with each.
 *
 * Note: a module rather than exports from graph-explorer.jsx. The page's suite
 *       replaces that component with a probe, and a placeholder importing its
 *       constants from there would draw with whatever the probe exports, which
 *       for every one of these is nothing.
 */

import * as d3 from 'd3';
import { medium_minWidth } from '../general/breakpoints.js';
import { seedAround, settleTicks, fitLayout } from './layout.js';

const NODE_RADIUS = 7;
const NODE_RADIUS_SMALL = 6;

// daylight kept between two nodes. Labels used to need room of their own here;
// without them this only has to keep neighbours far enough apart to point at.
const COLLIDE_GAP = 8;

// link length from edge count, clamped. Edge counts span seven orders of
// magnitude, and without the ceiling one edge stretches half the viewport and
// drags the layout off centre with it.
const LINK_BASE = 50;
const LINK_SCALE = 0.12;
const LINK_MAX = 140;
const LINK_PLAIN = 40;

const CHARGE = -140;
const CHARGE_SMALL = -70;

// the pull toward the middle, before it is split between the two axes by the
// canvas's shape -- see settleLayout. ASPECT_MOST bounds how lopsided that split
// may get, so a very long, thin canvas still gets a graph rather than a line.
const CENTRE = 0.06;
const ASPECT_MOST = 2.5;

// how the settled layout is fitted to its canvas: the space kept clear inside
// every edge, the most it may be enlarged to fill a large one, and how much
// further one axis may go than the other. See fitLayout for both limits.
//
// Note: MOST is sized for a tablet held upright. It is under the 768px line, so
//       it lays out with the phone's weaker charge -- a compact graph -- on a
//       canvas several times a phone's, and at 1.6 the graph stopped well
//       short of every edge.
const FIT_PAD = 20;
const FIT_MOST = 2.5;
const FIT_STRETCH = 1.35;

//
// ambient motion. Each node travels a small circle from the point it settled at,
// so the graph reads as something live rather than as a screenshot of one.
//
// DRIFT is that circle's RADIUS in pixels, not a per-tick nudge, and that is the
// whole difference from the backdrop's drift: there the wander is added to each
// node's velocity and the simulation integrates it, which is organic and
// unbounded -- fine for a cluster meant to float behind text. Here the layout has
// already been settled AND fitted to its canvas, and a force still running would
// pull it off the fit it was handed. An offset from a remembered home cannot.
//
// The circle STARTS at the node rather than being centred on it -- see
// driftNodes -- so each axis strays at most twice this, and the distance from
// home at most 2 * sqrt(2) * DRIFT, which stays inside the node's own radius.
//
// DRIFT_SPEED is radians per frame, so what a reader actually perceives is the
// product of the two:
//
//     DRIFT * DRIFT_SPEED * 60fps  =  px per second
//
// That number is the one to tune, and it is easy to get wrong from the constants
// alone: this shipped at DRIFT_SPEED 0.004, which is 0.48 px/s and a 26 second
// cycle -- slow enough to be indistinguishable from a still image. 3.6 px/s reads
// as alive without asking to be watched. Past about twice that, edges swing and
// the page becomes tiring to read.
//
const DRIFT = 2;
const DRIFT_SPEED = 0.03;

// the turn between two nodes' phases -- the golden angle, as in layout.js's
// seed spiral. Neighbouring nodes land on opposite sides of their circles, so
// the field shimmers rather than pulsing in unison, and it is a fixed sequence
// rather than Math.random so two renders of one build move alike.
const DRIFT_TURN = Math.PI * (3 - Math.sqrt(5));

// a second, slower frequency on the vertical, so a node traces a slowly
// precessing ellipse instead of a circle it retraces exactly
const DRIFT_SKEW = 0.8;

const DEFAULT_HEIGHT = 600;

/**
 * the size of the box a canvas draws into, for an svg whose parent is that box.
 *
 * The frame is sized by the stylesheet, not by the svg, so reading it back is
 * never circular; the fallbacks cover a frame with no layout at all, which is
 * every frame under jsdom. `height`, when given, is a caller's own and wins.
 */
export function frameSize(frame, height) {
    return {
        width: (frame && frame.clientWidth) || window.innerWidth,
        height: height || (frame && frame.clientHeight) || DEFAULT_HEIGHT,
    };
}

/**
 * whether the reader has asked their system for less motion.
 *
 * Note: guarded rather than called. matchMedia is absent under jsdom, and a
 *       component that threw on mount there would take the whole suite with it.
 */
export function reducedMotion() {
    return typeof window.matchMedia === 'function'
        && !!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * how large a node is drawn on a canvas `width` px wide.
 *
 * Note: ONE size, for every node. Neither graph this site draws has ever sized
 *       a node by its count -- the placeholder was drawn with radii that 'vary
 *       the way the real ones do', and the real ones never have.
 */
export function nodeRadius(width) {
    return width < medium_minWidth ? NODE_RADIUS_SMALL : NODE_RADIUS;
}

/**
 * lay a graph out the way /graph does, and hand back the simulation that did it.
 *
 * Every node carries its radius as `r` -- see nodeRadius. Links name their ends
 * by `id`, and come back holding the nodes themselves, which is forceLink's doing.
 *
 * The layout is run to rest HERE, synchronously, before anything is drawn. See
 * layout.js: started on the next frame instead, the first thing on screen is the
 * whole graph sweeping in from the top-left corner. The simulation comes back
 * STOPPED, for the caller's hit test to ask it where things are.
 *
 * The centring pull is stronger across the canvas's short side than along its
 * long one, so the graph settles into the canvas's shape. With one strength for
 * both, it settles round whatever it is drawn into, and the fit can only scale a
 * round graph until it touches the SHORT side -- on a phone held upright that
 * left the top and bottom third of the canvas empty.
 */
export function settleLayout(nodes, links, width, height) {
    const small = width < medium_minWidth;
    const aspect = Math.min(Math.max(height / width, 1 / ASPECT_MOST), ASPECT_MOST);

    seedAround(nodes, width / 2, height / 2);

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links)
            .id((d) => d.id)
            .distance((d) => (d.count
                ? Math.min(LINK_BASE + Math.sqrt(d.count) * LINK_SCALE, LINK_MAX)
                : LINK_PLAIN)))
        .force('charge', d3.forceManyBody().strength(small ? CHARGE_SMALL : CHARGE))
        .force('collide', d3.forceCollide().radius((d) => d.r + COLLIDE_GAP))
        .force('x', d3.forceX(width / 2).strength(CENTRE * Math.sqrt(aspect)))
        .force('y', d3.forceY(height / 2).strength(CENTRE / Math.sqrt(aspect)))
        .stop();

    simulation.tick(settleTicks(simulation));
    fitLayout(nodes, width, height, FIT_PAD + nodeRadius(width), FIT_MOST, FIT_STRETCH);

    return simulation;
}

/**
 * set a settled layout wandering, and hand back what stops it -- or null, when
 * there is nothing to move or the reader has asked for stillness.
 *
 * Each node remembers where it settled, and is then drawn however far around
 * a small circle it has travelled SINCE -- which is why each term subtracts
 * its own value at rest. Written the obvious way, every node would be a
 * couple of pixels off its home on the first frame, because its phase is
 * what makes it differ from its neighbours; the whole graph would pop the
 * moment the animation started, and the layout the page computed so
 * carefully would not be the one anybody saw.
 *
 * The position written is the node's OWN x/y rather than a drawing offset,
 * so everything that reads a position -- the canvas's hit test, which is
 * simulation.find over these same objects, and the card's placement -- goes
 * on agreeing with what is on screen. `draw` is then asked to put it there.
 *
 * Note: the offset is recomputed from the home every frame rather than
 *       accumulated onto the position. Accumulating rounds, and a rounding
 *       error fed back in is a random walk: over a few minutes the graph
 *       would wander off its fit, and off the canvas after that.
 *
 * Note: phases are a fixed sequence rather than Math.random, so two renders
 *       of one build move alike -- and so this is testable at all.
 */
export function driftNodes(nodes, draw) {
    if (!nodes.length || reducedMotion()) {
        return null;
    }

    nodes.forEach((node, index) => {
        node.hx = node.x;
        node.hy = node.y;
        node.phase = index * DRIFT_TURN;
    });

    let elapsed = 0;
    let request = null;

    const frame = () => {
        elapsed += DRIFT_SPEED;

        nodes.forEach((node) => {
            const turned = elapsed + node.phase;
            const skewed = elapsed * DRIFT_SKEW + node.phase;

            node.x = node.hx + (Math.cos(turned) - Math.cos(node.phase)) * DRIFT;
            node.y = node.hy + (Math.sin(skewed) - Math.sin(node.phase)) * DRIFT;
        });

        draw();
        request = requestAnimationFrame(frame);
    };

    request = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(request);
}

export { NODE_RADIUS, NODE_RADIUS_SMALL, DRIFT, DRIFT_SPEED };
