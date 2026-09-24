/**
 * breath.js: when each node of a graph pulses.
 *
 * Three graphs on this site pulse their nodes: /graph's placeholder, breathing
 * gray while a build is on its way; the build it stands in for, whose nodes
 * glint brighter in their own colors once it is drawn; and the front page's
 * cluster, which does the same behind the hero. The pulse itself is the
 * stylesheet's -- '$graph-node-breath' and 'graph-node-glint' in
 * '_animation.scss' -- and what lives here is the one part of it that has to
 * come from the drawing: where in the pulse each node starts.
 *
 * The placeholder and the drawn graphs keep one period, and not one order. The
 * placeholder breathes its nodes a beat apart, in the order it drew them, and
 * reads as random, because that order means nothing on screen: every node is
 * gray, and its made-up links join each node to an earlier hub rather than to
 * the node before it. A drawn graph's order means a great deal. filterSchema
 * hands over node types roughly biggest first, ties broken by name, so the types
 * of one source come in a row -- seven metro types, six laus -- in one color,
 * and linked, so the layout draws them side by side. A beat apart, the glint ran
 * down each row in turn: six nodes of one color lit together, the same six every
 * 1.8 seconds. So a drawn graph scatters its nodes through the pulse instead --
 * see glintDelay.
 *
 * Note: a module of its own because all three import it, and nothing else is
 *       shared by all three to hang it on. explorer-layout.js is /graph's, and
 *       layout.js is where a layout starts rather than how it moves.
 */

//
// how long one pulse takes, in milliseconds: '$graph-node-breath' in
// '_animation.scss', which breath.test.js holds this to.
//
const BREATH_PERIOD = 1800;

//
// how far apart, in milliseconds, the placeholder breathes two nodes it drew one
// after the other. A 1.8s breath takes twenty nodes to go round once at this
// spacing, so its sixty read as a ripple running through them rather than as
// every node pulsing in unison.
//
const BREATH_STAGGER = 90;

//
// how far round the pulse a drawn graph starts each node from the one it drew
// before, as a fraction of the pulse: √3 - 1, about 0.732.
//
// What it has to do is say nothing about the order, which carries two things:
//
//   - rows of one source. Stepped round by √3 - 1, no row lands bunched: of any
//     seven nodes drawn in a row, two at most are lit at once, where a beat
//     apart lit five.
//   - the spiral the layout started from. seedAround turns each node the golden
//     angle from the one before, and a settled layout still remembers some of
//     it. The golden ratio would space a row most evenly of all, but it IS that
//     turn: each node's glint would follow its place on the spiral, and sweep
//     round the graph like a beam -- past random's 95th percentile in 37 of the
//     45 layouts below.
//
// Measured with the site's own filter, palette and layouts over three builds
// published in September 2026, on /graph at five canvas sizes and on the front
// page at five with two drift seeds each, against the same graphs given random
// starts: never past random's 95th percentile in any of the 45 layouts, on any of
// the measures -- the most lit nodes crowded together, the most of one color lit
// at once, near neighbors glinting in step, a beam or a spiral -- and never more
// than four of one color lit at once, where random starts average five.
//
const GLINT_TURN = Math.sqrt(3) - 1;

/**
 * the 'animation-delay' for the `index`th node the placeholder draws, a beat
 * behind the one before it.
 *
 * Note: NEGATIVE, which starts a node partway through its cycle rather than
 *       holding it still until its turn comes. Sixty turns at BREATH_STAGGER
 *       apart is over five seconds, which a graph would otherwise spend waking
 *       up one node at a time.
 *
 * Note: nothing here asks after reduced motion. The pulse is a css animation,
 *       and the stylesheet takes it away for a reader who asked for stillness.
 */
export function breathDelay(index) {
    return `${-index * BREATH_STAGGER}ms`;
}

/**
 * the 'animation-delay' for the `index`th node a graph draws, GLINT_TURN of the
 * pulse round from the node drawn before it.
 *
 * Note: NEGATIVE and inside one pulse, so every node starts partway through its
 *       pulse at once -- as breathDelay's do, and for the same reason.
 */
export function glintDelay(index) {
    const turn = (index * GLINT_TURN) % 1;

    return `${-(Math.round(turn * BREATH_PERIOD) % BREATH_PERIOD)}ms`;
}

export { BREATH_PERIOD, BREATH_STAGGER, GLINT_TURN };
