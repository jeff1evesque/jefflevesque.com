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
 *   - the placeholder on /graph and the two drawn graphs keep one period.
 *   - the front page's lit neighbourhood holds still, which only works if its
 *     rule comes after the one it overrides.
 *   - a reader who asked for less motion gets none.
 */

import fs from 'fs';
import path from 'path';

import { breathDelay, BREATH_STAGGER } from '../../import/animation/breath.js';

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

describe('the pulse, as the stylesheet runs it', () => {
    const animation = stylesheet('_animation.scss');
    const graph = stylesheet('_graph.scss');

    it('finds the stylesheets where it expects them', () => {
        expect(animation.length).toBeGreaterThan(0);
        expect(graph.length).toBeGreaterThan(0);
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

        it('rests at the node\'s own colour at both ends of the pulse', () => {
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
    });

    it('breathes the placeholder on the period the graph replacing it glints on', () => {
        const placeholder = rule(graph, '.graph-pending-node', 'animation:');

        expect(placeholder.body).toMatch(/animation:\s*graph-pending-breathe\s+\$graph-node-breath\s/);
    });

    it('holds the front page\'s lit neighbourhood still, after the rule it overrides', () => {
        //
        // the two selectors weigh the same, so source order decides. Before the
        // glint, it would lose, and the lit nodes would go on glinting.
        //
        const glint = rule(animation, '.graph-cluster-node', 'animation: graph-node-glint');
        const lit = rule(animation, '.graph-cluster-node-lit', 'animation:');

        expect(lit.body).toMatch(/animation:\s*none\s*;/);
        expect(lit.at).toBeGreaterThan(glint.at);
    });
});
