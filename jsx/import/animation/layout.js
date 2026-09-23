/**
 * layout.js: where a force layout starts, and how far it runs before anyone sees
 *            it.
 *
 * Both graph surfaces used to hand d3 a fresh set of nodes and start the
 * simulation on the next frame. d3 gives any node without a position a place on
 * a small spiral around the ORIGIN -- (0,0), the svg's top-left corner -- so the
 * first thing a visitor saw was the whole graph sweeping in from that corner as
 * the centering forces dragged it to the middle. Nothing about that motion is
 * data; it is the simulation's warm-up, played in public.
 *
 * The answer is the same for both, and lives here once:
 *
 *   - start the spiral around the middle of the canvas instead of its corner
 *   - run the simulation to rest synchronously, before the first paint
 *   - (explorer only) fit what came out to the canvas it has to fit in
 *
 * Note: pure functions over plain node objects, with no dom and no d3 import,
 *       so they can be tested directly. The simulation is passed in rather than
 *       built here -- each surface tunes its own forces.
 */

//
// the spacing and turn d3-force itself uses for nodes it has to place, so a
// seeded layout starts in exactly the shape d3 would have chosen, just in a
// different place. The turn is the golden angle.
//
const SEED_RADIUS = 10;
const SEED_TURN = Math.PI * (3 - Math.sqrt(5));

/**
 * place every node on d3's starting spiral, centered on (cx, cy).
 *
 * Note: a node that already has a position keeps it. The callers build their
 *       nodes fresh from the schema, so in practice nothing is skipped -- but
 *       overwriting a position someone set deliberately would be a surprising
 *       thing for a function with this name to do.
 */
export function seedAround(nodes, cx, cy) {
    nodes.forEach((node, index) => {
        if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
            return;
        }

        const radius = SEED_RADIUS * Math.sqrt(0.5 + index);
        const angle = index * SEED_TURN;

        node.x = cx + radius * Math.cos(angle);
        node.y = cy + radius * Math.sin(angle);
    });

    return nodes;
}

/**
 * how many ticks a simulation needs to come to rest from where it is now.
 *
 * alpha closes a fixed fraction of its distance to alphaTarget on every tick, so
 * the count is a logarithm rather than a guess: the number of ticks until what
 * is left of that distance falls under alphaMin -- the point at which d3 would
 * stop the simulation by itself.
 *
 * Note: counted against the TARGET, not zero. The front page holds its
 *       simulation at a small ambient alpha forever, so it never reaches
 *       alphaMin at all -- counting toward zero there would never finish, and
 *       the logarithm would say so by going non-finite.
 */
export function settleTicks(simulation) {
    const gap = simulation.alpha() - simulation.alphaTarget();
    const floor = simulation.alphaMin();
    const decay = simulation.alphaDecay();

    // already there, or never going to get there by ticking
    if (gap <= floor || decay <= 0) {
        return 0;
    }

    // a decay of one closes the whole distance in a single tick, and the
    // logarithm of zero below would count it as none
    if (decay >= 1) {
        return 1;
    }

    return Math.ceil(Math.log(floor / gap) / Math.log(1 - decay));
}

/**
 * scale and center a settled layout so it fills a width x height canvas, leaving
 * `pad` px clear on every side. Returns the scale applied on each axis.
 *
 * Positions are scaled, not the drawing. Scaling an svg group would scale the
 * node radius and every stroke with it, so a dense build would draw smaller,
 * fainter nodes than a sparse one; moving the centers keeps every mark the size
 * it was designed at and changes only the distances between them.
 *
 * `most` caps the scale. A layout far smaller than its canvas -- a two-type
 * build on a wide monitor -- would otherwise be blown up until its one edge
 * spanned the screen, which reads as a rendering fault rather than as a small
 * graph.
 *
 * `stretch` lets the axis with room to spare scale further than the one that
 * ran out, by up to that factor. A force layout's proportions carry no meaning
 * -- only which nodes sit near which -- so a graph drawn somewhat taller than
 * it settled is the same graph, and one scaled evenly stops at whichever side
 * of the canvas it reaches first and leaves the rest empty. Stretching only
 * ever puts nodes further apart than the even scale would, so it cannot make
 * two of them collide that the even scale kept apart.
 */
export function fitLayout(nodes, width, height, pad, most, stretch = 1) {
    if (!nodes.length) {
        return { x: 1, y: 1 };
    }

    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;

    nodes.forEach((node) => {
        x0 = Math.min(x0, node.x);
        y0 = Math.min(y0, node.y);
        x1 = Math.max(x1, node.x);
        y1 = Math.max(y1, node.y);
    });

    // a single node, or a row of them, has no extent on one axis. It fits at any
    // scale, so that axis places no limit rather than dividing by zero.
    const fitX = x1 > x0 ? Math.max(width - pad * 2, 0) / (x1 - x0) : Infinity;
    const fitY = y1 > y0 ? Math.max(height - pad * 2, 0) / (y1 - y0) : Infinity;

    const even = Math.min(most, fitX, fitY);
    const scale = {
        x: Math.min(most, fitX, even * stretch),
        y: Math.min(most, fitY, even * stretch),
    };
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;

    nodes.forEach((node) => {
        node.x = width / 2 + (node.x - cx) * scale.x;
        node.y = height / 2 + (node.y - cy) * scale.y;
    });

    return scale;
}

export { SEED_RADIUS, SEED_TURN };
