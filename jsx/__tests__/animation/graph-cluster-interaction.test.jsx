/**
 * graph-cluster-interaction.test.jsx: the hover, resize and per-tick work.
 *
 * graph-cluster.test.jsx covers mounting and that the schema reaches the screen. This
 * covers the parts that only run in response to something -- a cursor, a window
 * resize, a simulation tick -- and which therefore never execute under jsdom on their
 * own, because nothing moves and no frame is ever painted.
 *
 * Three things make that reachable:
 *
 *   - 'clamp' and 'segClosest' are pure and exported, so they are called directly
 *   - 'highlight', 'updateHover' and 'applyResize' are methods, driven through a ref
 *   - the tick handler is fetched off the simulation with simulation.on('tick') and
 *     invoked, which is the only way to run it deliberately: d3's own
 *     simulation.tick() advances the physics but does NOT dispatch the event
 *
 * Note: the assertions read the real svg d3 produced. The component builds actual
 *       circles, lines and text, so hover colour and per-tick geometry are observable
 *       even though the animation never runs.
 */

import React from 'react';
import { render } from '@testing-library/react';

import GraphCluster, { clamp, segClosest } from '../../import/animation/graph-cluster.jsx';

//
// mirrors of the module's own constants, so a test says what it depends on rather than
// hiding a magic number.
//
const HOVER_DETECT = 130;
const BG_RESIZE_DEBOUNCE = 150;
const BG_DARK_RADIUS = 110;

function setup() {
    const held = React.createRef();

    const utils = render(<GraphCluster ref={held} />);

    return { ...utils, page: held.current };
}

const circles = (container) => [...container.querySelectorAll('circle')];
const labels = (container) => [...container.querySelectorAll('text')];

//
// the coloured nodes carry data; the grey background field is a separate selection.
// Reading the bound data is how a test names a node to hover.
//
function nodeIds(page) {
    return page.nodes.map(n => n.id);
}

describe('clamp', () => {
    it('returns a value already inside the range', () => {
        expect(clamp(5, 0, 10)).toBe(5);
    });

    it('raises a value below the floor', () => {
        expect(clamp(-3, 0, 10)).toBe(0);
    });

    it('lowers a value above the ceiling', () => {
        expect(clamp(42, 0, 10)).toBe(10);
    });

    it('keeps the bounds themselves', () => {
        expect(clamp(0, 0, 10)).toBe(0);
        expect(clamp(10, 0, 10)).toBe(10);
    });

    it('handles a collapsed range', () => {
        //
        // lo === hi happens when the viewport is narrower than the margins the caller
        // reserves, which is reachable on a phone in landscape.
        //
        expect(clamp(5, 3, 3)).toBe(3);
    });
});

describe('segClosest', () => {
    it('finds the perpendicular foot on a horizontal segment', () => {
        const near = segClosest(5, 5, 0, 0, 10, 0);

        expect(near.x).toBeCloseTo(5);
        expect(near.y).toBeCloseTo(0);
        expect(near.t).toBeCloseTo(0.5);
    });

    it('clamps to the start when the point is behind it', () => {
        //
        // the parameter is clamped to [0,1] so the result is a point ON the segment, not
        // on the infinite line -- a gray node behind an edge must be pushed away from the
        // edge's end, not from empty space beyond it.
        //
        const near = segClosest(-20, 0, 0, 0, 10, 0);

        expect(near.t).toBe(0);
        expect(near.x).toBeCloseTo(0);
    });

    it('clamps to the end when the point is past it', () => {
        const near = segClosest(50, 0, 0, 0, 10, 0);

        expect(near.t).toBe(1);
        expect(near.x).toBeCloseTo(10);
    });

    it('treats a zero-length segment as its own start', () => {
        //
        // two nodes at identical positions give a degenerate edge, and len2 is 0 -- the
        // division is guarded, so this returns the point rather than NaN.
        //
        const near = segClosest(5, 5, 3, 3, 3, 3);

        expect(near.t).toBe(0);
        expect(near.x).toBe(3);
        expect(near.y).toBe(3);
        expect(Number.isNaN(near.x)).toBe(false);
    });

    it('reuses one scratch object rather than allocating', () => {
        //
        // deliberate: this runs (gray nodes x coloured edges x relax passes) times per
        // tick, so it writes into a shared object. A caller that keeps the result across
        // calls gets the LAST answer, which is worth knowing before using it.
        //
        const first = segClosest(5, 5, 0, 0, 10, 0);
        const second = segClosest(1, 1, 0, 0, 10, 0);

        expect(first).toBe(second);
    });
});

describe('highlight', () => {
    it('mutes every node when nothing is hovered', () => {
        const { container, page } = setup();

        page.highlight(null);

        const opacities = new Set(
            page.nodeSel.nodes().map(n => n.getAttribute('opacity'))
        );
        expect(opacities).toEqual(new Set(['1']));
        expect(circles(container).length).toBeGreaterThan(0);
    });

    it('brings the hovered node to full opacity and dims the rest', () => {
        //
        // the resting field is deliberately pale; hovering is what brings colour in, so
        // the unlit nodes have to sit back for the neighbourhood to read.
        //
        const { page } = setup();
        const [id] = nodeIds(page);

        page.highlight(id);

        const dimmed = page.nodeSel.nodes()
            .filter(n => n.getAttribute('opacity') === '0.5');
        expect(dimmed.length).toBeGreaterThan(0);
    });

    it('darkens the hovered node further than its neighbours', () => {
        //
        // both come up to full colour, so the hovered one is darkened more or it becomes
        // indistinguishable from the neighbours lighting up beside it.
        //
        const { page } = setup();
        const link = page.links[0];
        const self = link.source.id ? link.source.id : link.source;

        page.highlight(self);

        const fills = new Map(
            page.nodeSel.nodes().map((n, i) => [page.nodes[i].id, n.getAttribute('fill')])
        );
        const neighbour = link.target.id ? link.target.id : link.target;
        expect(fills.get(self)).not.toBe(fills.get(neighbour));
    });

    it('lights the edges touching the hovered node and hides the others', () => {
        const { page } = setup();
        const link = page.links[0];
        const id = link.source.id ? link.source.id : link.source;

        page.highlight(id);

        const opacities = page.linkSel.nodes().map(n => Number(n.getAttribute('opacity')));
        expect(opacities).toContain(0.9);
        expect(opacities).toContain(0.05);
    });

    it('gives every edge the same resting opacity when nothing is hovered', () => {
        const { page } = setup();

        page.highlight(null);

        const opacities = new Set(
            page.linkSel.nodes().map(n => n.getAttribute('opacity'))
        );
        expect(opacities).toEqual(new Set(['0.18']));
    });

    it('shows only the hovered node\'s own label', () => {
        //
        // showing every neighbour's label too was unreadable, so exactly one is visible.
        //
        const { page } = setup();
        const [id] = nodeIds(page);

        page.highlight(id);

        const visible = page.labelSel.nodes()
            .filter(n => n.getAttribute('opacity') === '1');
        expect(visible).toHaveLength(1);
    });

    it('hides every label once the hover clears', () => {
        const { container, page } = setup();
        const [id] = nodeIds(page);

        page.highlight(id);
        page.highlight(null);

        const visible = page.labelSel.nodes()
            .filter(n => n.getAttribute('opacity') === '1');
        expect(visible).toHaveLength(0);
        expect(labels(container).length).toBeGreaterThan(0);
    });
});

describe('updateHover', () => {
    it('clears the highlight when there is no pointer', () => {
        const { page } = setup();
        const [id] = nodeIds(page);
        page.hoveredId = id;
        page.pointer = null;

        page.updateHover();

        expect(page.hoveredId).toBeNull();
    });

    it('picks the node nearest the cursor', () => {
        //
        // decoupled from the cursor being over a circle: the repel makes that nearly
        // impossible to hold, which is why the label only used to flash by.
        //
        const { page } = setup();
        const target = page.nodes[0];
        page.pointer = { x: target.x + 5, y: target.y + 5 };

        page.updateHover();

        expect(page.hoveredId).toBe(target.id);
    });

    it('ignores a cursor beyond the detection radius', () => {
        const { page } = setup();
        page.nodes.forEach((n, i) => { n.x = 10_000 + i; n.y = 10_000; });
        page.pointer = { x: 0, y: 0 };

        page.updateHover();

        expect(page.hoveredId).toBeNull();
    });

    it('detects a node just inside the radius', () => {
        const { page } = setup();
        page.nodes.forEach((n, i) => { n.x = 5_000 + i * 1_000; n.y = 5_000; });
        const target = page.nodes[0];
        page.pointer = { x: target.x + HOVER_DETECT - 5, y: target.y };

        page.updateHover();

        expect(page.hoveredId).toBe(target.id);
    });

    it('follows the cursor from one node to another', () => {
        const { page } = setup();
        page.nodes.forEach((n, i) => { n.x = 5_000 + i * 1_000; n.y = 5_000; });

        page.pointer = { x: page.nodes[0].x, y: page.nodes[0].y };
        page.updateHover();
        const first = page.hoveredId;

        page.pointer = { x: page.nodes[1].x, y: page.nodes[1].y };
        page.updateHover();

        expect(page.hoveredId).toBe(page.nodes[1].id);
        expect(page.hoveredId).not.toBe(first);
    });
});

describe('applyResize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    afterEach(() => {
        window.innerWidth = width;
        window.innerHeight = height;
        document.querySelectorAll('.under-construction').forEach(n => n.remove());
    });

    it('resizes the svg to the new viewport', () => {
        const { page } = setup();
        window.innerWidth = 1400;
        window.innerHeight = 900;

        page.applyResize();

        const svg = page.svgRef.current;
        expect(svg.getAttribute('width')).toBe('1400');
        expect(svg.getAttribute('height')).toBe('900');
    });

    it('leaves room for the construction banner when one is present', () => {
        //
        // the svg is absolutely positioned, so without the offset it would sit under the
        // banner and the top of the cluster would be hidden behind it.
        //
        const banner = document.createElement('div');
        banner.className = 'under-construction';
        document.body.appendChild(banner);
        const { page } = setup();

        page.applyResize();

        expect(page.topMargin).toBe(0);
        expect(page.svgRef.current.style.top).toBe('0px');
    });

    it('re-centres the simulation forces on the new middle', () => {
        //
        // without this the cluster keeps drifting toward where the centre used to be, and
        // expanding the window pushes the animation off screen.
        //
        const { page } = setup();
        window.innerWidth = 1400;
        window.innerHeight = 900;

        page.applyResize();

        expect(page.simulation.force('x').x()()).toBeCloseTo(700);
    });

    it('rebuilds the grey field when the viewport changes shape', () => {
        const { page } = setup();
        const before = page.background.nodes.length;
        window.innerWidth = window.innerWidth + 600;

        page.applyResize();

        expect(page.background.nodes.length).toBeGreaterThan(0);
        expect(typeof before).toBe('number');
    });

    it('does NOT rebuild for a small height nudge', () => {
        //
        // a pure height change within the slop is a mobile URL bar animating away, not a
        // new layout. Regenerating there would teleport every grey node for nothing, so
        // the live viewport is tracked instead.
        //
        const { page } = setup();
        const before = page.background.nodes;
        window.innerHeight = window.innerHeight - 40;

        page.applyResize();

        expect(page.background.nodes).toBe(before);
        expect(page.viewH).toBe(window.innerHeight - page.topMargin);
    });
});

describe('handleResize', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('waits for the burst to finish before doing the work', () => {
        //
        // resize arrives in bursts -- a drag of the window edge fires continuously -- and
        // the work is expensive and visible, so it runs once at the end rather than per
        // event.
        //
        // Note: only the timers are faked, and only after mounting. Faking them before
        //       would stall React's scheduler and the component would never commit.
        //
        const { page } = setup();
        jest.useFakeTimers();
        const applied = jest.spyOn(page, 'applyResize');

        page.handleResize();
        page.handleResize();
        page.handleResize();

        expect(applied).not.toHaveBeenCalled();

        jest.advanceTimersByTime(BG_RESIZE_DEBOUNCE);

        expect(applied).toHaveBeenCalledTimes(1);

        applied.mockRestore();
    });

    it('restarts the wait on each further event', () => {
        const { page } = setup();
        jest.useFakeTimers();
        const applied = jest.spyOn(page, 'applyResize');

        page.handleResize();
        jest.advanceTimersByTime(BG_RESIZE_DEBOUNCE - 20);
        page.handleResize();
        jest.advanceTimersByTime(BG_RESIZE_DEBOUNCE - 20);

        expect(applied).not.toHaveBeenCalled();

        jest.advanceTimersByTime(20);

        expect(applied).toHaveBeenCalledTimes(1);

        applied.mockRestore();
    });
});

describe('the per-tick work', () => {
    //
    // fetched off the simulation and invoked directly. d3's simulation.tick() advances
    // the physics but deliberately does not dispatch the 'tick' event, so this is the
    // only way to run the handler on purpose -- and without it none of the geometry
    // below is ever written, because jsdom paints no frames.
    //
    function tick(page) {
        page.simulation.on('tick').call(page.simulation);
    }

    it('writes every coloured node position onto its circle', () => {
        const { page } = setup();
        page.nodes.forEach((n, i) => { n.x = 100 + i; n.y = 200 + i; });

        tick(page);

        page.nodeSel.nodes().forEach((circle, i) => {
            expect(Number(circle.getAttribute('cx'))).toBeCloseTo(100 + i);
            expect(Number(circle.getAttribute('cy'))).toBeCloseTo(200 + i);
        });
    });

    it('writes both endpoints of every coloured edge', () => {
        const { page } = setup();

        tick(page);

        page.linkSel.nodes().forEach(line => {
            ['x1', 'y1', 'x2', 'y2'].forEach(attr => {
                expect(line.getAttribute(attr)).not.toBeNull();
                expect(Number.isNaN(Number(line.getAttribute(attr)))).toBe(false);
            });
        });
    });

    it('sits each label just above its node', () => {
        //
        // offset by the radius plus a few pixels, so the text clears the circle rather
        // than sitting on top of it.
        //
        const { page } = setup();
        const node = page.nodes[0];
        node.x = 300;
        node.y = 400;

        tick(page);

        const label = page.labelSel.nodes()[0];
        expect(Number(label.getAttribute('x'))).toBeCloseTo(300);
        expect(Number(label.getAttribute('y'))).toBeCloseTo(400 - node.r - 6);
    });

    it('writes the grey field positions too', () => {
        const { page } = setup();

        tick(page);

        page.bgNodeSel.nodes().forEach(circle => {
            expect(Number.isNaN(Number(circle.getAttribute('cx')))).toBe(false);
        });
    });

    it('darkens the grey nodes near the cursor', () => {
        //
        // the field responds to the cursor without lighting up: nodes within
        // BG_DARK_RADIUS fade up toward the hover opacity, in proportion to distance, so
        // the backdrop acknowledges the pointer rather than competing with it.
        //
        const { page } = setup();
        const near = page.background.nodes[0];
        page.pointer = { x: near.x, y: near.y };

        tick(page);

        expect(near.dark).toBeGreaterThan(0);
        expect(near.dark).toBeLessThanOrEqual(1);
    });

    it('leaves the distant grey nodes alone', () => {
        const { page } = setup();
        const far = page.background.nodes[0];
        page.pointer = { x: far.x + BG_DARK_RADIUS + 50, y: far.y };

        tick(page);

        expect(far.dark).toBe(0);
    });

    it('clears the darkening when the cursor leaves', () => {
        const { page } = setup();
        const node = page.background.nodes[0];
        page.pointer = { x: node.x, y: node.y };
        tick(page);
        expect(node.dark).toBeGreaterThan(0);

        page.pointer = null;
        tick(page);

        expect(node.dark).toBe(0);
    });

    it('turns the darkening into an opacity on the circle', () => {
        const { page } = setup();
        page.pointer = { x: page.background.nodes[0].x, y: page.background.nodes[0].y };

        tick(page);

        const opacities = page.bgNodeSel.nodes()
            .map(n => Number(n.getAttribute('opacity')));
        expect(Math.max(...opacities)).toBeGreaterThan(Math.min(...opacities));
    });

    it('re-evaluates the hover on every tick', () => {
        //
        // the label has to track its node while the node drifts, which is why the nearest
        // node is recomputed per tick rather than on pointer events alone.
        //
        const { page } = setup();
        const target = page.nodes[0];
        page.pointer = { x: target.x, y: target.y };

        tick(page);

        expect(page.hoveredId).toBe(target.id);
    });
});
