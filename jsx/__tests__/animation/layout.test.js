/**
 * layout.test.js: where a force layout starts, and how far it runs unseen.
 *
 * These are the functions that keep both graph surfaces from playing the
 * simulation's warm-up in public -- the whole graph sweeping in from the svg's
 * top-left corner, which is where d3 puts nodes it has to place itself.
 *
 * Note: d3-force is used for real here, not stubbed, wherever the claim is about
 *       d3's behaviour -- that the seeded spiral is d3's own, and that the tick
 *       count really does bring a real simulation to rest. A stub would only
 *       confirm the arithmetic agrees with itself.
 */

import * as d3 from 'd3';

import { seedAround, settleTicks, fitLayout, SEED_RADIUS } from '../../import/animation/layout.js';

const bare = (n) => [...Array(n)].map((_, i) => ({ id: `n${i}` }));

describe('seedAround', () => {
    it('lays out the spiral d3 would have used, moved to the given centre', () => {
        //
        // same shape, different place: the only thing seeding changes is WHERE the
        // simulation starts, not how it starts.
        //
        const d3Placed = bare(12);
        d3.forceSimulation(d3Placed).stop();

        const seeded = seedAround(bare(12), 400, 300);

        seeded.forEach((node, i) => {
            expect(node.x).toBeCloseTo(d3Placed[i].x + 400);
            expect(node.y).toBeCloseTo(d3Placed[i].y + 300);
        });
    });

    it('starts the first node right beside the centre', () => {
        const [first] = seedAround(bare(1), 400, 300);

        expect(Math.hypot(first.x - 400, first.y - 300)).toBeLessThanOrEqual(SEED_RADIUS);
    });

    it('leaves a node that already has a position where it is', () => {
        const nodes = bare(2);
        nodes[1].x = 5;
        nodes[1].y = 6;

        seedAround(nodes, 400, 300);

        expect(nodes[1]).toMatchObject({ x: 5, y: 6 });
        expect(nodes[0].x).not.toBe(5);
    });

    it('places a node whose position is only half there', () => {
        const nodes = bare(1);
        nodes[0].x = 5;

        seedAround(nodes, 400, 300);

        expect(Number.isFinite(nodes[0].y)).toBe(true);
        expect(nodes[0].x).not.toBe(5);
    });

    it('is kept by d3 once the simulation starts', () => {
        //
        // d3 only places nodes that arrive without a position, so a seeded layout
        // survives being handed to it.
        //
        const nodes = seedAround(bare(5), 400, 300);
        const before = nodes.map((n) => [n.x, n.y]);

        d3.forceSimulation(nodes).stop();

        nodes.forEach((n, i) => {
            expect(n.x).toBe(before[i][0]);
            expect(n.y).toBe(before[i][1]);
        });
    });
});

describe('settleTicks', () => {
    it('brings a fresh simulation to where d3 would stop it', () => {
        const simulation = d3.forceSimulation(bare(3)).stop();

        simulation.tick(settleTicks(simulation));

        expect(simulation.alpha()).toBeLessThanOrEqual(simulation.alphaMin());
    });

    it('takes d3\'s own three hundred ticks from a cold start', () => {
        const simulation = d3.forceSimulation([]).stop();

        expect(settleTicks(simulation)).toBe(300);
    });

    it('settles toward a target the simulation is held at, not toward zero', () => {
        //
        // the front page holds alpha at a small floor forever. Counting toward zero
        // there would never arrive; counting toward the floor does.
        //
        const simulation = d3.forceSimulation([]).alphaTarget(0.05).stop();

        simulation.tick(settleTicks(simulation));

        expect(simulation.alpha() - simulation.alphaTarget())
            .toBeLessThanOrEqual(simulation.alphaMin());
    });

    it('needs no ticks once already at rest', () => {
        const simulation = d3.forceSimulation([]).alpha(0.0005).stop();

        expect(settleTicks(simulation)).toBe(0);
    });

    it('needs no ticks when alpha sits below its target', () => {
        //
        // a simulation being warmed up is not settling, and running it hotter before
        // the first paint is the opposite of what a caller of this wants.
        //
        const simulation = d3.forceSimulation([]).alpha(0.01).alphaTarget(0.3).stop();

        expect(settleTicks(simulation)).toBe(0);
    });

    it('does not count forever for a decay that never decays', () => {
        const still = d3.forceSimulation([]).alphaDecay(0).stop();

        expect(settleTicks(still)).toBe(0);
    });

    it('takes a single tick for a decay that closes the gap at once', () => {
        const instant = d3.forceSimulation([]).alphaDecay(1).stop();

        expect(settleTicks(instant)).toBe(1);

        instant.tick(1);
        expect(instant.alpha()).toBe(instant.alphaTarget());
    });
});

describe('fitLayout', () => {
    //
    // a 100 x 50 layout sitting nowhere in particular
    //
    const layout = () => [
        { x: 1000, y: 1000 },
        { x: 1100, y: 1050 },
        { x: 1050, y: 1025 },
    ];

    const extent = (nodes) => ({
        x0: Math.min(...nodes.map((n) => n.x)),
        x1: Math.max(...nodes.map((n) => n.x)),
        y0: Math.min(...nodes.map((n) => n.y)),
        y1: Math.max(...nodes.map((n) => n.y)),
    });

    it('centres the layout on the canvas', () => {
        const nodes = layout();

        fitLayout(nodes, 800, 600, 20, 10);

        const e = extent(nodes);
        expect((e.x0 + e.x1) / 2).toBeCloseTo(400);
        expect((e.y0 + e.y1) / 2).toBeCloseTo(300);
    });

    it('scales until the layout meets the padding on its limiting side', () => {
        //
        // 100 wide into 760 is 7.6; 50 tall into 560 is 11.2 -- width limits.
        //
        const nodes = layout();

        const scale = fitLayout(nodes, 800, 600, 20, 10);

        expect(scale).toEqual({ x: 7.6, y: 7.6 });
        const e = extent(nodes);
        expect(e.x0).toBeCloseTo(20);
        expect(e.x1).toBeCloseTo(780);
    });

    it('shrinks a layout too big for its canvas', () => {
        const nodes = layout();

        const scale = fitLayout(nodes, 80, 600, 10, 10);

        expect(scale.x).toBeCloseTo(0.6);
        expect(extent(nodes).x1 - extent(nodes).x0).toBeCloseTo(60);
    });

    it('never enlarges past the cap', () => {
        //
        // a tiny graph on a large canvas would otherwise be blown up until its edges
        // spanned the screen.
        //
        const nodes = layout();

        expect(fitLayout(nodes, 8000, 6000, 20, 2)).toEqual({ x: 2, y: 2 });
    });

    it('stretches the axis with room to spare, by no more than it is allowed', () => {
        const nodes = layout();

        const scale = fitLayout(nodes, 800, 600, 20, 10, 1.25);

        expect(scale.x).toBeCloseTo(7.6);
        expect(scale.y).toBeCloseTo(7.6 * 1.25);
    });

    it('stretches only as far as the canvas goes', () => {
        const nodes = layout();

        const scale = fitLayout(nodes, 800, 600, 20, 100, 5);

        expect(scale.y).toBeCloseTo(11.2);
        expect(extent(nodes).y1).toBeCloseTo(580);
    });

    it('does not stretch past the cap either', () => {
        const nodes = layout();

        expect(fitLayout(nodes, 8000, 6000, 20, 2, 3)).toEqual({ x: 2, y: 2 });
    });

    it('stretches nothing by default', () => {
        const nodes = layout();

        const scale = fitLayout(nodes, 800, 600, 20, 10);

        expect(scale.x).toBe(scale.y);
    });

    it('puts a single node in the middle', () => {
        const nodes = [{ x: 7, y: 9 }];

        fitLayout(nodes, 800, 600, 20, 3);

        expect(nodes[0]).toEqual({ x: 400, y: 300 });
    });

    it('fits a row of nodes by its length alone', () => {
        //
        // no height at all: dividing by it would scale everything to infinity.
        //
        const nodes = [{ x: 0, y: 50 }, { x: 100, y: 50 }];

        const scale = fitLayout(nodes, 800, 600, 50, 100);

        expect(scale.x).toBeCloseTo(7);
        expect(Number.isFinite(scale.y)).toBe(true);
        nodes.forEach((n) => expect(n.y).toBeCloseTo(300));
    });

    it('answers for an empty layout without touching anything', () => {
        expect(fitLayout([], 800, 600, 20, 3)).toEqual({ x: 1, y: 1 });
    });

    it('collapses to the middle rather than inverting on a canvas smaller than its padding', () => {
        const nodes = layout();

        fitLayout(nodes, 30, 30, 20, 3);

        nodes.forEach((n) => {
            expect(n.x).toBeCloseTo(15);
            expect(n.y).toBeCloseTo(15);
        });
    });
});
