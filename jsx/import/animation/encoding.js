/**
 * encoding.js: how a graph_schema.json becomes colour and line style.
 *
 * Two surfaces draw the same published graph and have to agree about what it
 * looks like: the front page backdrop (graph-cluster.jsx), glanced at, and the
 * explorer page, read closely and carrying a legend that names what each colour
 * means. If the two drift, the explorer's legend starts describing the backdrop
 * incorrectly -- and nothing fails, because both still render.
 *
 * So the mapping lives here once, and both import it. Presentation does NOT:
 * the muting, the decorative field, the drift and the cursor repel belong to
 * the backdrop alone, and the explorer's always-on labels belong to it alone.
 * This module is only the part that must not disagree.
 *
 * Note: category was the original colour channel and it carried nothing --
 *       every node type in a published build arrives as 'entity', so the whole
 *       cluster resolved to a single hue while still looking like a working
 *       encoding. Namespace is what actually varies across a build, and it
 *       groups the graph the way a reader expects: by where the data came from.
 */

import { colors, colors_categorical, color_other, color_tail } from '../general/colors.js';

// ontology uris are '<origin>/ontology/<namespace>/<Type>'; the id prefix is the
// fallback for anything that does not match.
const NAMESPACE_FROM_URI = /\/ontology\/([^/]+)\//;

/**
 * the namespace a node type belongs to.
 *
 * Note: the uri is the authority, but a schema is free to omit it, and the id
 *       prefix has to stand in without the caller noticing.
 */
export function sourceNamespace(meta, id) {
    const uri = meta && meta.source_type_uri ? String(meta.source_type_uri) : '';
    const match = NAMESPACE_FROM_URI.exec(uri);

    if (match) {
        return match[1];
    }

    const underscore = id.indexOf('_');

    return underscore > 0 ? id.slice(0, underscore) : id;
}

/**
 * the namespaces present, ordered biggest first, ties broken by name.
 *
 * Note: ordered by how many node types a namespace contributes so the same
 *       build always paints the same colours. Object key order would repaint
 *       the graph whenever the builder emitted its types in a different
 *       sequence.
 */
export function rankNamespaces(nodes) {
    const totals = new Map();
    nodes.forEach((node) => {
        totals.set(node.namespace, (totals.get(node.namespace) || 0) + 1);
    });

    return [...totals.keys()].sort((a, b) => {
        const delta = totals.get(b) - totals.get(a);
        return delta !== 0 ? delta : a.localeCompare(b);
    });
}

/**
 * assign a colour to every namespace present, biggest first.
 *
 * `tail` decides what happens past the eight categorical slots, and the two
 * surfaces answer it differently on purpose:
 *
 *   - the BACKDROP rolls the tail into one neutral (`color_other`). It is
 *     glanced at and carries no legend, so nine namespaces sharing a grey costs
 *     nothing and keeps the named ones legible.
 *   - the EXPLORER shades the tail (`color_tail`), one desaturated hue varying
 *     in lightness. It carries a legend, and "and 9 others" is exactly what a
 *     legend must not say.
 *
 * Note: the palette is never cycled. Two unrelated sources sharing a colour
 *       reads as a relationship that is not there, which is worse than a tail
 *       that reads as a tail.
 */
export function assignNamespaceColors(nodes, tail = 'roll-up') {
    const ordered = rankNamespaces(nodes);
    const slots = colors_categorical.length;
    const overflow = Math.max(0, ordered.length - slots);

    const assigned = new Map();
    ordered.forEach((namespace, index) => {
        if (index < slots) {
            assigned.set(namespace, colors_categorical[index]);
            return;
        }
        assigned.set(namespace, tail === 'shade'
            ? color_tail(index - slots, overflow)
            : color_other);
    });

    return assigned;
}

{/*

    link styling by edge origin.

    Note: 'origin' is the channel most likely to be lost without anyone
          noticing. A published build that stopped carrying origins would render
          every link solid grey -- a plausible looking graph that has quietly
          dropped a dimension -- which is why the styling degrades to grey
          rather than throwing, and why the suite pins it.

*/}

export const ORIGIN_DASH = { raw: null, enrichment: '5 4', unification: '2 6' };

export const ORIGIN_COLOR = {
    raw: colors['gray-5'],
    enrichment: colors_categorical[0],
    unification: colors_categorical[1],
};

/**
 * the colour for an edge origin, falling back to neutral grey for an origin
 * this codebase does not know about.
 */
export function originColor(origin) {
    return ORIGIN_COLOR[origin] || colors['gray-5'];
}

export { NAMESPACE_FROM_URI };
