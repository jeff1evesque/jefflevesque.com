/**
 * breath.js: when each node of a graph pulses.
 *
 * Three graphs on this site pulse their nodes: /graph's placeholder, breathing
 * gray while a build is on its way; the build it stands in for, whose nodes
 * glint brighter in their own colors once it is drawn; and the front page's
 * cluster, which does the same behind the hero. The pulse itself is the
 * stylesheet's -- '$graph-node-breath' and 'graph-node-glint' in
 * '_animation.scss' -- and what lives here is the one part of it that has to
 * come from the drawing: how far apart two nodes are in it.
 *
 * Note: a module of its own because all three import it, and nothing else is
 *       shared by all three to hang it on. explorer-layout.js is /graph's, and
 *       layout.js is where a layout starts rather than how it moves.
 */

//
// how far apart, in milliseconds, two neighboring nodes pulse. A 1.8s breath
// takes twenty nodes to go round once at this spacing, so a graph of sixty reads
// as a ripple running through it rather than as every node pulsing in unison.
//
const BREATH_STAGGER = 90;

/**
 * the 'animation-delay' for the `index`th node drawn, a beat behind the one
 * before it.
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

export { BREATH_STAGGER };
