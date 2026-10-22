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
    spaceNodes,
    settleLayout,
    driftNodes,
    NODE_RADIUS,
    NODE_RADIUS_SMALL,
    DRIFT_SPEED,
    DRIFT_REACH,
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

//
// four hubs of fourteen spokes each, every hub tied to the first: sixty nodes,
// as many as the canvas draws, and as crowded on a phone as the real ones. At
// 348 x 244 the fit alone leaves the nearest two 15.6px apart (#281)
//
function hubs() {
    const nodes = [];
    const links = [];

    [0, 1, 2, 3].forEach((hub) => {
        nodes.push({ id: `${hub}`, r: NODE_RADIUS_SMALL });

        if (hub) {
            links.push({ source: '0', target: `${hub}` });
        }

        for (let spoke = 0; spoke < 14; spoke += 1) {
            nodes.push({ id: `${hub}.${spoke}`, r: NODE_RADIUS_SMALL });
            links.push({ source: `${hub}`, target: `${hub}.${spoke}` });
        }
    });

    return { nodes: nodes, links: links };
}

// how near the two nearest nodes are, center to center
function nearest(nodes) {
    let least = Infinity;

    nodes.forEach((node, index) => {
        nodes.slice(index + 1).forEach((other) => {
            least = Math.min(least, Math.hypot(node.x - other.x, node.y - other.y));
        });
    });

    return least;
}

//
// how far apart two nodes of radius `r` have to rest for their drifts never to
// meet, less a millionth of a pixel for the arithmetic
//
function clear(r) {
    return 2 * (r + DRIFT_REACH) - 1e-6;
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

describe('spaceNodes (#281)', () => {
    it('moves apart two nodes nearer than their drifts can keep clear', () => {
        const nodes = [{ x: 100, y: 100, r: 6 }, { x: 110, y: 100, r: 6 }];

        spaceNodes(nodes, 400, 300, 26);

        expect(nearest(nodes)).toBeGreaterThanOrEqual(clear(6));
    });

    it('leaves nodes with room to spare exactly where they were', () => {
        const nodes = [{ x: 100, y: 100, r: 6 }, { x: 200, y: 150, r: 6 }, { x: 300, y: 100, r: 6 }];

        spaceNodes(nodes, 400, 300, 26);

        expect(nodes.map((node) => [node.x, node.y])).toEqual([[100, 100], [200, 150], [300, 100]]);
    });

    it('starts them at rest, whatever the layout\'s own simulation left them moving at', () => {
        const nodes = [
            { x: 100, y: 100, r: 6, vx: 40, vy: -40 },
            { x: 300, y: 200, r: 6, vx: -40, vy: 40 },
        ];

        spaceNodes(nodes, 400, 300, 26);

        expect(nodes.map((node) => [node.x, node.y])).toEqual([[100, 100], [300, 200]]);
    });

    it('keeps every node inside the margin the fit kept, however crowded its corner', () => {
        //
        // a dozen nodes heaped where the margin starts, which can only spread
        // along the edges and inward
        //
        const nodes = Array.from({ length: 12 }, (_, index) => ({
            x: 26 + (index % 4),
            y: 26 + Math.floor(index / 4),
            r: 6,
        }));

        spaceNodes(nodes, 400, 300, 26);

        nodes.forEach((node) => {
            expect(node.x).toBeGreaterThanOrEqual(26);
            expect(node.x).toBeLessThanOrEqual(400 - 26);
            expect(node.y).toBeGreaterThanOrEqual(26);
            expect(node.y).toBeLessThanOrEqual(300 - 26);
        });
        expect(nearest(nodes)).toBeGreaterThanOrEqual(clear(6));
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

    it('rests every two nodes far enough apart for their drifts never to meet, on a phone (#281)', () => {
        const { nodes, links } = hubs();

        settleLayout(nodes, links, 348, 244);

        expect(nearest(nodes)).toBeGreaterThanOrEqual(clear(NODE_RADIUS_SMALL));
        nodes.forEach((node) => {
            expect(node.x).toBeGreaterThanOrEqual(20 + NODE_RADIUS_SMALL);
            expect(node.x).toBeLessThanOrEqual(348 - 20 - NODE_RADIUS_SMALL);
            expect(node.y).toBeGreaterThanOrEqual(20 + NODE_RADIUS_SMALL);
            expect(node.y).toBeLessThanOrEqual(244 - 20 - NODE_RADIUS_SMALL);
        });
    });
});

describe('driftNodes', () => {
    let asked;
    let canceled;

    beforeEach(() => {
        asked = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 7);
        canceled = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    });

    afterEach(() => {
        asked.mockRestore();
        canceled.mockRestore();
    });

    it('hands back what stops it, and that cancels the frame it asked for', () => {
        const { nodes, links } = graph();

        settleLayout(nodes, links, 800, 500);

        const stop = driftNodes(nodes, () => {});

        expect(asked).toHaveBeenCalledTimes(1);

        stop();

        expect(canceled).toHaveBeenCalledWith(7);
    });

    it('asks for nothing when there is nothing to move', () => {
        expect(driftNodes([], () => {})).toBeNull();
        expect(asked).not.toHaveBeenCalled();
    });

    it('never takes a node further from home than DRIFT_REACH, which spaceNodes keeps clear (#281)', () => {
        let frame = null;

        asked.mockImplementation((next) => {
            frame = next;

            return 7;
        });

        const { nodes, links } = graph();

        settleLayout(nodes, links, 800, 500);

        const homes = nodes.map((node) => [node.x, node.y]);
        let furthest = 0;

        driftNodes(nodes, () => {
            nodes.forEach((node, index) => {
                furthest = Math.max(furthest, Math.hypot(node.x - homes[index][0], node.y - homes[index][1]));
            });
        });

        //
        // one whole cycle: across at one turn and down at four fifths of one,
        // the two back in step after ten half turns
        //
        for (let step = 0; step * DRIFT_SPEED < 10 * Math.PI; step += 1) {
            frame();
        }

        expect(furthest).toBeGreaterThan(0);
        expect(furthest).toBeLessThanOrEqual(DRIFT_REACH);
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
