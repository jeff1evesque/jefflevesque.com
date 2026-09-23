/**
 * pending.test.jsx: the graph /graph draws while the build it will draw is on
 * its way.
 *
 * The page's suite holds that every placeholder is there while the page waits
 * and gone once it stops. What is held here is the one placeholder with
 * behaviour of its own -- a made-up graph, drawn by the real canvas's rules --
 * and the ways it could stop looking like the graph that replaces it:
 *
 *   - nodes of another size, which is what the hand-drawn cluster before it had
 *   - a layout that leaves its box, bunches in the middle of it, or turns into a
 *     different graph
 *   - motion that outlives it, or that a reader asked not to have
 *
 * Note: the drift is driven the way the canvas's own suite drives it -- the
 *       animation frame replaced by one pending callback, advanced by hand.
 *       jsdom paints nothing, and a frame left to the real clock is a test that
 *       passes or fails on how long the machine took.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';

import {
    PendingCanvas,
    PendingCaption,
    PendingDetail,
    PendingDetails,
    pendingGraph,
} from '../../../import/layout/graph/pending.jsx';
import { GRAPH_NODE_TYPES } from '../../../import/animation/filter-schema.js';
import { NODE_RADIUS, NODE_RADIUS_SMALL } from '../../../import/animation/explorer-layout.js';
import { breathDelay } from '../../../import/animation/breath.js';
import { medium_minWidth } from '../../../import/general/breakpoints.js';

const circles = () => [...document.querySelectorAll('.graph-pending-node')];
const lines = () => [...document.querySelectorAll('.graph-pending-links line')];
const svg = () => document.querySelector('.graph-pending-cluster');
const frame = () => document.querySelector('.graph-pending-canvas');
const at = (circle) => [Number(circle.getAttribute('cx')), Number(circle.getAttribute('cy'))];

function setup() {
    const held = React.createRef();
    const utils = render(<PendingCanvas ref={held} />);

    return { ...utils, page: held.current };
}

// how many links each node has, by index
function degrees({ nodes, links }) {
    const degree = nodes.map(() => 0);

    links.forEach(({ source, target }) => {
        degree[source] += 1;
        degree[target] += 1;
    });

    return degree;
}

describe('pendingGraph', () => {
    it('makes as many nodes as the canvas draws', () => {
        expect(pendingGraph().nodes).toHaveLength(GRAPH_NODE_TYPES);
    });

    it('joins only nodes it has, and none to itself', () => {
        const { nodes, links } = pendingGraph();

        expect(links.length).toBeGreaterThan(0);
        links.forEach(({ source, target }) => {
            expect(nodes[source]).toBeDefined();
            expect(nodes[target]).toBeDefined();
            expect(source).not.toBe(target);
        });
    });

    it('never joins the same two nodes twice', () => {
        //
        // two links over one pair draw as a single line, so the graph would look
        // sparser than its own count of links says it is.
        //
        const pairs = pendingGraph().links.map(({ source, target }) => (
            `${Math.min(source, target)}-${Math.max(source, target)}`
        ));

        expect(new Set(pairs).size).toBe(pairs.length);
    });

    it('is all one piece', () => {
        //
        // a node joined to nothing is pushed out to the rim by the charge and
        // sits there on its own, which reads as a fault in the drawing rather
        // than as part of a graph.
        //
        const { nodes, links } = pendingGraph();
        const near = nodes.map(() => []);

        links.forEach(({ source, target }) => {
            near[source].push(target);
            near[target].push(source);
        });

        const seen = new Set([0]);
        const queue = [0];

        while (queue.length) {
            near[queue.shift()].forEach((next) => {
                if (!seen.has(next)) {
                    seen.add(next);
                    queue.push(next);
                }
            });
        }

        expect(seen.size).toBe(nodes.length);
    });

    it('gathers its links at a few hubs, the way the real graph does', () => {
        //
        // the build published in September 2026 gives one type 48 neighbours
        // while the median type has 4. Links spread evenly draw a mesh, which is
        // not the shape of anything this page is about to show.
        //
        const degree = degrees(pendingGraph()).sort((a, b) => b - a);

        expect(degree[0]).toBeGreaterThanOrEqual(5 * degree[Math.floor(degree.length / 2)]);
    });

    it('has loops as well as spokes', () => {
        // a graph in one piece with no loops has one link fewer than it has nodes
        const { nodes, links } = pendingGraph();

        expect(links.length).toBeGreaterThan(nodes.length - 1);
    });

    it('is the same graph every time', () => {
        //
        // it is laid out again when its box changes size, and a stand-in that
        // became a different graph then would be one more thing moving on a
        // page that is only waiting.
        //
        expect(pendingGraph().links).toEqual(pendingGraph().links);
    });

    it('never sends a node\'s second link where its first one went', () => {
        //
        // the sequence is an argument, so this states one rather than leaning
        // on the seed. Always drawing zero always picks the earliest node there
        // is to pick, and always takes the loop -- so every second link has to
        // skip the node the first one reached.
        //
        expect(pendingGraph(4, () => 0).links).toEqual([
            { source: 1, target: 0 },
            { source: 2, target: 0 },
            { source: 2, target: 1 },
            { source: 3, target: 0 },
            { source: 3, target: 1 },
        ]);
    });
});

describe('PendingCanvas', () => {
    it('draws a circle for every node and a line for every link', () => {
        setup();

        const { nodes, links } = pendingGraph();

        expect(circles()).toHaveLength(nodes.length);
        expect(lines()).toHaveLength(links.length);
    });

    it('is hidden from assistive technology', () => {
        //
        // the wait is announced once, in words, by the caption above it. This
        // is the same wait as a picture.
        //
        setup();

        expect(svg()).toHaveAttribute('aria-hidden', 'true');
    });

    describe('the size of a node', () => {
        //
        // jsdom lays nothing out, so the box measures as the window -- which is
        // what the canvas sizes its own nodes by as well.
        //
        const width = window.innerWidth;

        afterEach(() => {
            window.innerWidth = width;
        });

        it('is the canvas\'s on a wide screen', () => {
            window.innerWidth = medium_minWidth + 200;
            setup();

            circles().forEach((circle) => {
                expect(Number(circle.getAttribute('r'))).toBe(NODE_RADIUS);
            });
        });

        it('is the canvas\'s on a phone', () => {
            window.innerWidth = 400;
            setup();

            circles().forEach((circle) => {
                expect(Number(circle.getAttribute('r'))).toBe(NODE_RADIUS_SMALL);
            });
        });
    });

    it('keeps every node inside its box', () => {
        setup();

        const width = Number(svg().getAttribute('width'));
        const height = Number(svg().getAttribute('height'));

        circles().forEach((circle) => {
            const [x, y] = at(circle);
            const r = Number(circle.getAttribute('r'));

            expect(x - r).toBeGreaterThanOrEqual(0);
            expect(x + r).toBeLessThanOrEqual(width);
            expect(y - r).toBeGreaterThanOrEqual(0);
            expect(y + r).toBeLessThanOrEqual(height);
        });
    });

    it('breathes each node a beat behind the one before, as the graph replacing it will', () => {
        //
        // the graph that arrives glints in the time this breathed in, so the swap
        // reads as the placeholder taking on colour rather than as a new rhythm.
        //
        setup();

        expect(circles().map((circle) => circle.style.animationDelay))
            .toEqual(circles().map((circle, index) => breathDelay(index)));
    });

    it('spreads its nodes across the box rather than bunching them in the middle', () => {
        //
        // the cluster before it was held to 22rem in the middle of a canvas
        // most of a screen wide, which is not the shape of what replaces it.
        //
        setup();

        const width = Number(svg().getAttribute('width'));
        const xs = circles().map((circle) => at(circle)[0]);

        expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(width / 2);
    });

    it('draws where the browser has no ResizeObserver', () => {
        //
        // it keeps the size it was first drawn at, for the few seconds it is on
        // screen. Failing to draw at all is not the trade.
        //
        const real = global.ResizeObserver;

        delete global.ResizeObserver;

        try {
            const { unmount } = setup();

            expect(circles()).toHaveLength(GRAPH_NODE_TYPES);

            unmount();
        } finally {
            global.ResizeObserver = real;
        }
    });

    describe('the drift', () => {
        let pending;
        let asked;
        let cancelled;

        beforeEach(() => {
            pending = null;
            asked = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
                pending = fn;
                return 1;
            });
            cancelled = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
                pending = null;
            });
        });

        afterEach(() => {
            asked.mockRestore();
            cancelled.mockRestore();
        });

        function frames(n = 1) {
            for (let i = 0; i < n; i += 1) {
                const next = pending;

                pending = null;

                if (next) {
                    next();
                }
            }
        }

        it('moves the nodes once the frames start', () => {
            setup();

            const before = circles().map(at);

            frames(60);

            expect(circles().map(at)).not.toEqual(before);
        });

        it('stops when the placeholder goes away', () => {
            const { unmount } = setup();

            expect(pending).not.toBeNull();

            unmount();

            expect(cancelled).toHaveBeenCalled();
            expect(pending).toBeNull();
        });

        it('does not move at all for a reader who asked for less motion', () => {
            const real = window.matchMedia;

            window.matchMedia = () => ({ matches: true });

            try {
                const { page } = setup();

                expect(pending).toBeNull();
                expect(page.drift).toBeNull();
                expect(circles()).toHaveLength(GRAPH_NODE_TYPES);
            } finally {
                window.matchMedia = real;
            }
        });
    });

    //
    // jsdom's ResizeObserver is a no-op shim (see setup.js), so these install one
    // that hands back its callback, and report a change of size by hand.
    //
    describe('a box that changes size', () => {
        const real = global.ResizeObserver;
        let observers;

        beforeEach(() => {
            observers = [];
            global.ResizeObserver = class {
                constructor(callback) {
                    this.callback = callback;
                    this.disconnected = false;
                    observers.push(this);
                }

                observe(target) {
                    this.target = target;
                }

                disconnect() {
                    this.disconnected = true;
                }
            };
        });

        afterEach(() => {
            global.ResizeObserver = real;
            jest.useRealTimers();
        });

        it('watches the frame it is drawn into', () => {
            setup();

            expect(observers).toHaveLength(1);
            expect(observers[0].target).toBe(frame());
        });

        it('lays itself out again for the new size', () => {
            //
            // a phone turned on its side while the build is on its way. Left at
            // the old size, the graph would run off one edge of the box and
            // stop short of the other.
            //
            setup();
            jest.useFakeTimers();

            Object.defineProperty(frame(), 'clientWidth', { value: 880, configurable: true });

            observers[0].callback();
            act(() => { jest.advanceTimersByTime(150); });

            expect(svg().getAttribute('width')).toBe('880');
            expect(circles()).toHaveLength(GRAPH_NODE_TYPES);
        });

        it('waits for a burst of reports to finish', () => {
            const { page } = setup();
            jest.useFakeTimers();
            const drew = jest.spyOn(page, 'renderD3');

            Object.defineProperty(frame(), 'clientWidth', { value: 880, configurable: true });

            observers[0].callback();
            observers[0].callback();

            expect(drew).not.toHaveBeenCalled();

            act(() => { jest.advanceTimersByTime(150); });

            expect(drew).toHaveBeenCalledTimes(1);
            drew.mockRestore();
        });

        it('ignores the report it gets for simply being connected', () => {
            //
            // an observer states the current size as soon as it is attached,
            // and the placeholder was just laid out at that size.
            //
            const { page } = setup();
            jest.useFakeTimers();
            const drew = jest.spyOn(page, 'renderD3');

            observers[0].callback();
            act(() => { jest.advanceTimersByTime(150); });

            expect(drew).not.toHaveBeenCalled();
            drew.mockRestore();
        });

        it('stops watching, and drops a pending layout, once it goes away', () => {
            const { page, unmount } = setup();
            jest.useFakeTimers();
            const applied = jest.spyOn(page, 'applyResize');

            observers[0].callback();
            unmount();
            act(() => { jest.advanceTimersByTime(150); });

            expect(observers[0].disconnected).toBe(true);
            expect(applied).not.toHaveBeenCalled();
            applied.mockRestore();
        });
    });
});

describe('PendingCaption', () => {
    it('says what the page is waiting for, as a live region', () => {
        render(<PendingCaption />);

        expect(screen.getByRole('status')).toHaveTextContent('Loading the graph');
    });
});

describe('PendingDetail', () => {
    //
    // the build panel's Sources row waits for the schema a round trip after the
    // rest of the panel has filled in from the listing, and holds its place with
    // this meanwhile. A bar of another width would be a row that changed size
    // once when the listing landed and again when the schema did.
    //
    it('draws the bar the whole panel\'s stand-in drew in the same row', () => {
        const labels = ['Nodes', 'Edges', 'Sources'];
        const { container } = render(<PendingDetails labels={labels} />);
        const stood = [...container.querySelectorAll('.graph-pending-bar')]
            .map((bar) => bar.getAttribute('style'));

        labels.forEach((label, index) => {
            const { container: row } = render(<PendingDetail index={index} />);

            expect(row.querySelector('.graph-pending-bar').getAttribute('style'))
                .toBe(stood[index]);
        });
    });
});
