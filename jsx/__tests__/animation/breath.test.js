/**
 * breath.test.js: when a graph's nodes pulse, and how the stylesheet pulses them.
 *
 * Two halves, because the pulse is split across two languages. breath.js hands
 * each node its delay; '_animation.scss' and '_graph.scss' run the animation that
 * delay offsets. jsdom runs no css animation at all, so the second half is read
 * from the stylesheets themselves -- the way colors.test.js reads
 * '_variables.scss' -- and what is held there is what fails silently in a browser:
 *
 *   - the glint animates FILL-opacity. Both graphs dim what the reader is not
 *     asking about through each node's opacity attribute, and an animation of
 *     'opacity' outranks an attribute: every dimmed node would come back to full
 *     strength, and nothing would fail.
 *   - the placeholder on /graph and the two drawn graphs keep one period, and
 *     it is the one breath.js reckons its delays in.
 *   - on both pages the neighborhood under the pointer holds still, which only
 *     works if each hold comes after the rule it overrides.
 *   - a reader who asked for less motion gets none.
 */

import fs from 'fs';
import path from 'path';

import {
    breathDelay,
    glintDelay,
    BREATH_PERIOD,
    BREATH_STAGGER,
} from '../../import/animation/breath.js';
import { seedAround } from '../../import/animation/layout.js';
import { GRAPH_NODE_TYPES } from '../../import/animation/filter-schema.js';

const SCSS = path.resolve(__dirname, '../../../scss');

// a partial with its '//' comments taken out, so a rule named in prose is not read as a rule
function stylesheet(name) {
    return fs.readFileSync(path.join(SCSS, name), 'utf8').replace(/\/\/.*$/gm, '');
}

//
// the text between the braces of every block opened by `header`, at any depth, in
// source order. `header` is matched whole, so '.graph-cluster-node' does not also
// find '.graph-cluster-node-lit'.
//
function blocks(source, header) {
    const found = [];
    const opener = new RegExp(`(^|\\s)${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'g');
    let match;

    while ((match = opener.exec(source)) !== null) {
        const start = match.index + match[0].length;
        let depth = 1;
        let at = start;

        while (depth > 0 && at < source.length) {
            if (source[at] === '{') depth += 1;
            if (source[at] === '}') depth -= 1;
            at += 1;
        }

        found.push({ at: match.index, body: source.slice(start, at - 1) });
    }

    return found;
}

// the block of `header` that sets `property`, which tells a rule from its reduced-motion twin
function rule(source, header, property) {
    return blocks(source, header).find((block) => block.body.includes(property));
}

describe('breathDelay', () => {
    it('starts the first node at the top of its pulse', () => {
        expect(breathDelay(0)).toBe('0ms');
    });

    it('sets each node a beat behind the one before', () => {
        const delays = [0, 1, 2, 3].map((index) => parseFloat(breathDelay(index)));

        delays.slice(1).forEach((delay, index) => {
            expect(delays[index] - delay).toBe(BREATH_STAGGER);
        });
    });

    it('starts every node partway through rather than holding it until its turn', () => {
        //
        // a positive delay would hold node sixty still for over five seconds, and
        // the graph would spend them waking up one node at a time.
        //
        [1, 10, 59].forEach((index) => {
            expect(parseFloat(breathDelay(index))).toBeLessThan(0);
        });
    });

    it('writes whole milliseconds', () => {
        expect(breathDelay(5)).toBe('-450ms');
    });
});

describe('glintDelay', () => {
    // how far through its pulse, as a fraction of it, a node with `delay` is at `time`
    const phase = (delay, time) => ((time - parseFloat(delay)) % BREATH_PERIOD) / BREATH_PERIOD;

    //
    // lit: past half the glint's depth. The keyframes are lightest at 80% and at
    // the node's own color at 60% and 100%, easing in and out, so half the depth
    // falls at 70% and at 90%.
    //
    const lit = (delay, time) => phase(delay, time) >= 0.7 && phase(delay, time) <= 0.9;

    // the most of `delays` lit at any one moment of a pulse
    const mostLit = (delays) => {
        let most = 0;

        for (let time = 0; time < BREATH_PERIOD; time += 5) {
            most = Math.max(most, delays.filter((delay) => lit(delay, time)).length);
        }

        return most;
    };

    it('starts the first node at the start of its pulse', () => {
        expect(glintDelay(0)).toBe('0ms');
    });

    it('starts every node partway through its pulse, and inside one', () => {
        [1, 10, 59, 500].forEach((index) => {
            expect(parseFloat(glintDelay(index))).toBeLessThan(0);
            expect(parseFloat(glintDelay(index))).toBeGreaterThan(-BREATH_PERIOD);
        });
    });

    it('writes whole milliseconds', () => {
        expect(glintDelay(1)).toBe('-1318ms');
    });

    it('lights no more than two of any seven nodes drawn in a row at once', () => {
        //
        // a graph is handed its node types a source at a time, and the builds
        // of September 2026 carry rows of up to seven -- one color, drawn side by
        // side. A beat apart, as the placeholder breathes, lit five of them
        // together.
        //
        const row = (delay, start) => [...Array(7).keys()].map((k) => delay(start + k));

        expect(mostLit(row(breathDelay, 0))).toBe(5);

        [...Array(GRAPH_NODE_TYPES).keys()].forEach((start) => {
            expect(mostLit(row(glintDelay, start))).toBeLessThanOrEqual(2);
        });
    });

    it('does not follow the spiral the layout seeds its nodes on', () => {
        //
        // seedAround turns each node the golden angle from the one before, and a
        // settled layout remembers some of it. Where a node starts in the glint
        // must not track where it sat on that spiral, one arm or two, turning
        // either way, or the glint sweeps round the graph like a beam. Stepped
        // by the golden ratio, each would track it exactly.
        //
        const nodes = seedAround([...Array(GRAPH_NODE_TYPES)].map(() => ({})), 0, 0);

        [1, -1, 2, -2].forEach((arms) => {
            let x = 0;
            let y = 0;

            nodes.forEach((node, index) => {
                const turn = 2 * Math.PI * phase(glintDelay(index), 0)
                    - arms * Math.atan2(node.y, node.x);

                x += Math.cos(turn);
                y += Math.sin(turn);
            });

            expect(Math.hypot(x, y) / nodes.length).toBeLessThan(0.2);
        });
    });
});

describe('the pulse, as the stylesheet runs it', () => {
    const animation = stylesheet('_animation.scss');
    const graph = stylesheet('_graph.scss');

    it('finds the stylesheets where it expects them', () => {
        expect(animation.length).toBeGreaterThan(0);
        expect(graph.length).toBeGreaterThan(0);
    });

    it('pulses for as long as breath.js reckons its delays in', () => {
        //
        // glintDelay spreads its delays over one pulse. Measured against a
        // longer one, they would bunch into the start of it.
        //
        const period = animation.match(/\$graph-node-breath:\s*([\d.]+)(m?s)\s*;/);

        expect(period).not.toBeNull();
        expect(Number(period[1]) * (period[2] === 's' ? 1000 : 1)).toBe(BREATH_PERIOD);
    });

    describe('the glint', () => {
        const [keyframes] = blocks(animation, '@keyframes graph-node-glint');

        it('is there to be run', () => {
            expect(keyframes).toBeDefined();
        });

        it('lightens the fill, and leaves opacity to the emphasis', () => {
            expect(keyframes.body).toMatch(/fill-opacity\s*:/);
            expect(keyframes.body).not.toMatch(/(^|[^-])opacity\s*:/m);
        });

        it('rests at the node\'s own color at both ends of the pulse', () => {
            const ends = keyframes.body.match(/0%\s*,[^{]*100%\s*\{([^}]*)\}/);

            expect(ends).not.toBeNull();
            expect(ends[1]).toMatch(/fill-opacity\s*:\s*1\s*;/);
        });

        it('takes how far to lighten from the graph it runs on', () => {
            expect(keyframes.body).toMatch(/fill-opacity\s*:\s*var\(--graph-node-glint\)/);
        });
    });

    describe.each([
        ['/graph', '_graph.scss', '.graph-explorer-node'],
        ['the front page', '_animation.scss', '.graph-cluster-node'],
    ])('on %s', (page, file, selector) => {
        const source = stylesheet(file);
        const nodes = rule(source, selector, 'animation: graph-node-glint');

        it('glints every node, on the shared period', () => {
            expect(nodes).toBeDefined();
            expect(nodes.body).toMatch(/animation:\s*graph-node-glint\s+\$graph-node-breath\s/);
        });

        it('lightens by a fraction, not by nothing and not out of sight', () => {
            const depth = nodes.body.match(/--graph-node-glint:\s*([\d.]+)\s*;/);

            expect(depth).not.toBeNull();
            expect(Number(depth[1])).toBeGreaterThan(0.5);
            expect(Number(depth[1])).toBeLessThan(1);
        });

        it('stops for a reader who asked for less motion', () => {
            const still = blocks(source, '@media (prefers-reduced-motion: reduce)')
                .flatMap((media) => blocks(media.body, selector))
                .filter((block) => /animation:\s*none\s*;/.test(block.body));

            expect(still).toHaveLength(1);
        });

        it('holds the hovered neighborhood still, after the rule it overrides', () => {
            //
            // the two selectors weigh the same, so source order decides. Before
            // the glint, the hold would lose, and the nodes under the pointer
            // would go on glinting.
            //
            const lit = rule(source, `${selector}-lit`, 'animation:');

            expect(lit.body).toMatch(/animation:\s*none\s*;/);
            expect(lit.at).toBeGreaterThan(nodes.at);
        });
    });

    it('breathes the placeholder on the period the graph replacing it glints on', () => {
        const placeholder = rule(graph, '.graph-pending-node', 'animation:');

        expect(placeholder.body).toMatch(/animation:\s*graph-pending-breathe\s+\$graph-node-breath\s/);
    });
});
