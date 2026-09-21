/**
 * explorer-layout.test.js: the rules /graph's canvas and its placeholder both
 * draw by.
 *
 * The canvas's own suite holds what the explorer does with these, drift and
 * all. What is held here is what they promise to BOTH callers, directly -- the
 * placeholder leans on them too, and a change that suited the canvas could
 * otherwise quietly change the placeholder with nothing noticing.
 */

import {
    frameSize,
    nodeRadius,
    settleLayout,
    driftNodes,
    NODE_RADIUS,
    NODE_RADIUS_SMALL,
} from '../../import/animation/explorer-layout.js';
import { medium_minWidth } from '../../import/general/breakpoints.js';

// a hub with three spokes and a tail, every node at the size the canvas draws
function graph(radius = NODE_RADIUS) {
    const nodes = [0, 1, 2, 3, 4].map((id) => ({ id: id, r: radius }));
    const links = [
        { source: 0, target: 1 },
        { source: 0, target: 2 },
        { source: 0, target: 3 },
        { source: 3, target: 4 },
    ];

    return { nodes: nodes, links: links };
}

describe('nodeRadius', () => {
    it('draws the smaller node below the medium breakpoint, and only there', () => {
        expect(nodeRadius(medium_minWidth - 1)).toBe(NODE_RADIUS_SMALL);
        expect(nodeRadius(medium_minWidth)).toBe(NODE_RADIUS);
    });
});

describe('frameSize', () => {
    it('reads the frame once it has been laid out', () => {
        expect(frameSize({ clientWidth: 640, clientHeight: 480 }))
            .toEqual({ width: 640, height: 480 });
    });

    it('falls back to the window, and a default height, where it has not', () => {
        //
        // every frame under jsdom, and a frame that has not been placed yet
        //
        expect(frameSize(null)).toEqual({ width: window.innerWidth, height: 600 });
        expect(frameSize({ clientWidth: 0, clientHeight: 0 }))
            .toEqual({ width: window.innerWidth, height: 600 });
    });

    it('takes a caller\'s own height over the frame\'s', () => {
        expect(frameSize({ clientWidth: 640, clientHeight: 480 }, 300).height).toBe(300);
    });
});

describe('settleLayout', () => {
    it('fits the layout inside the canvas, clear of every edge by more than a node', () => {
        const { nodes, links } = graph();

        settleLayout(nodes, links, 800, 500);

        nodes.forEach((node) => {
            expect(node.x).toBeGreaterThan(NODE_RADIUS);
            expect(node.x).toBeLessThan(800 - NODE_RADIUS);
            expect(node.y).toBeGreaterThan(NODE_RADIUS);
            expect(node.y).toBeLessThan(500 - NODE_RADIUS);
        });
    });

    it('hands the links back holding the nodes they join', () => {
        const { nodes, links } = graph();

        settleLayout(nodes, links, 800, 500);

        expect(links[0].source).toBe(nodes[0]);
        expect(links[3].target).toBe(nodes[4]);
    });

    it('comes back stopped and at rest, for a hit test to ask', () => {
        //
        // at rest is what 'settled before the first paint' means: a simulation
        // handed back with heat left in it would move the layout the moment
        // anything restarted it.
        //
        const { nodes, links } = graph();
        const simulation = settleLayout(nodes, links, 800, 500);

        expect(simulation.alpha()).toBeLessThan(simulation.alphaMin());
        expect(simulation.find(nodes[0].x, nodes[0].y, 1)).toBe(nodes[0]);
    });
});

describe('driftNodes', () => {
    let asked;
    let cancelled;

    beforeEach(() => {
        asked = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 7);
        cancelled = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    });

    afterEach(() => {
        asked.mockRestore();
        cancelled.mockRestore();
    });

    it('hands back what stops it, and that cancels the frame it asked for', () => {
        const { nodes, links } = graph();

        settleLayout(nodes, links, 800, 500);

        const stop = driftNodes(nodes, () => {});

        expect(asked).toHaveBeenCalledTimes(1);

        stop();

        expect(cancelled).toHaveBeenCalledWith(7);
    });

    it('asks for nothing when there is nothing to move', () => {
        expect(driftNodes([], () => {})).toBeNull();
        expect(asked).not.toHaveBeenCalled();
    });

    it('asks for nothing when the reader has asked for stillness', () => {
        const real = window.matchMedia;

        window.matchMedia = () => ({ matches: true });

        try {
            const { nodes, links } = graph();

            settleLayout(nodes, links, 800, 500);

            expect(driftNodes(nodes, () => {})).toBeNull();
            expect(asked).not.toHaveBeenCalled();
        } finally {
            window.matchMedia = real;
        }
    });
});
