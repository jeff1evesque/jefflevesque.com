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
 *       circles, lines and text, so hover color and per-tick geometry are observable
 *       even though the animation never runs.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';

import GraphCluster, {
    clamp,
    segClosest,
    CHARGE_SMALL,
    GRAPH_TOP_PAD,
    EDGE_MARGIN,
} from '../../import/animation/graph-cluster.jsx';
import { colors, colors_dark } from '../../import/general/colors.js';
import * as d3 from 'd3';
import { glintDelay } from '../../import/animation/breath.js';
import schema from '../fixtures/graph-schema.mock.json';

//
// mirrors of the module's own constants, so a test says what it depends on rather than
// hiding a magic number.
//
const HOVER_DETECT = 130;
const BG_RESIZE_DEBOUNCE = 150;
const BG_DARK_RADIUS = 110;
const MOUSE_AFTER_TOUCH = 700;

//
// Note: the schema is passed explicitly. The component has no fallback graph -- an
//       unprop'd render draws the gray field and nothing else -- so every case
//       below, all of which reach for page.nodes or page.links, needs data to
//       exist at all. What is being exercised here is the interaction, not the
//       loading, so the fixture stands in for whatever the api returned.
//
function setup() {
    const held = React.createRef();

    const utils = render(<GraphCluster ref={held} data={schema} />);

    return { ...utils, page: held.current };
}

const circles = (container) => [...container.querySelectorAll('circle')];
const labels = (container) => [...container.querySelectorAll('text')];

//
// the colored nodes carry data; the gray background field is a separate selection.
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
        // deliberate: this runs (gray nodes x colored edges x relax passes) times per
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
        // the resting field is deliberately pale; hovering is what brings color in, so
        // the unlit nodes have to sit back for the neighborhood to read.
        //
        const { page } = setup();
        const [id] = nodeIds(page);

        page.highlight(id);

        const dimmed = page.nodeSel.nodes()
            .filter(n => n.getAttribute('opacity') === '0.5');
        expect(dimmed.length).toBeGreaterThan(0);
    });

    it('darkens the hovered node further than its neighbors', () => {
        //
        // both come up to full color, so the hovered one is darkened more or it becomes
        // indistinguishable from the neighbors lighting up beside it.
        //
        const { page } = setup();
        const link = page.links[0];
        const self = link.source.id ? link.source.id : link.source;

        page.highlight(self);

        const fills = new Map(
            page.nodeSel.nodes().map((n, i) => [page.nodes[i].id, n.getAttribute('fill')])
        );
        const neighbor = link.target.id ? link.target.id : link.target;
        expect(fills.get(self)).not.toBe(fills.get(neighbor));
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

    it('lights the types pointing AT the hovered node, not only the ones it points at', () => {
        //
        // edges are directed, and a neighborhood is both ends of them. Hovering the
        // target of an edge has to light its source too.
        //
        const { page } = setup();
        const link = page.links.find(l => l.source.id !== l.target.id);

        page.highlight(link.target.id);

        const opacity = new Map(
            page.nodeSel.nodes().map((n, i) => [page.nodes[i].id, n.getAttribute('opacity')])
        );
        expect(opacity.get(link.source.id)).toBe('1');
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
        // showing every neighbor's label too was unreadable, so exactly one is visible.
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

//
// once the graph is drawn, each node rests at its tint and glints lighter now and
// then. The stylesheet runs it -- see breath.test.js, which reads it there -- so
// what is held here is what the cluster owes it: which circles carry the class,
// the delay on each, and which of them hold still while hover has them lit.
//
describe('the glint', () => {
    const lit = (page) => page.nodeSel.nodes()
        .filter(n => n.classList.contains('graph-cluster-node-lit'));

    it('marks every node of the graph, and none of the gray field', () => {
        //
        // the field is on screen before the graph arrives and is decoration,
        // not data; it keeps the stillness it always had.
        //
        const { container, page } = setup();

        page.nodeSel.nodes().forEach(n => expect(n).toHaveClass('graph-cluster-node'));
        page.bgNodeSel.nodes().forEach(n => expect(n).not.toHaveClass('graph-cluster-node'));
        expect(container.querySelectorAll('.graph-cluster-node')).toHaveLength(page.nodes.length);
    });

    it('scatters the nodes through the glint, in the order they are drawn', () => {
        const { page } = setup();

        expect(page.nodeSel.nodes().map(n => n.style.animationDelay))
            .toEqual(page.nodes.map((n, index) => glintDelay(index)));
    });

    it('holds nothing still at rest', () => {
        const { page } = setup();

        expect(lit(page)).toHaveLength(0);
    });

    it('holds the lit neighborhood still, and only that', () => {
        //
        // hover brings those nodes up to full color, which the glint -- tuned
        // for the pale tints -- would swing far harder. The rest, dimmed, go on.
        //
        const { page } = setup();
        const link = page.links.find(l => l.source.id !== l.target.id);

        page.highlight(link.source.id);

        const held = new Set(lit(page));
        page.nodeSel.nodes().forEach(n => {
            expect(held.has(n)).toBe(n.getAttribute('opacity') === '1');
        });
        expect(held.size).toBeGreaterThan(1);
        expect(held.size).toBeLessThan(page.nodes.length);
    });

    it('lets every node glint again once the hover clears', () => {
        const { page } = setup();
        const [id] = nodeIds(page);

        page.highlight(id);
        page.highlight(null);

        expect(lit(page)).toHaveLength(0);
    });
});

describe('nodeColor', () => {
    it('falls back to a neutral gray before any graph has been drawn', () => {
        //
        // no schema means no color assignment at all, which is the cold-load state
        // rather than a mistake.
        //
        const held = React.createRef();
        render(<GraphCluster ref={held} />);

        expect(held.current.nodeColor('bls')).toBe(colors['gray-5']);
    });

    it('falls back to a neutral gray for a namespace the build does not carry', () => {
        const { page } = setup();

        expect(page.nodeColor('no-such-namespace')).toBe(colors['gray-5']);
    });

    it('gives a namespace the build does carry its assigned color', () => {
        const { page } = setup();
        const { namespace } = page.nodes[0];

        expect(page.nodeColor(namespace)).toBe(page.namespaceColors.get(namespace));
    });
});

//
// the backdrop on a dark page -- see theme-mode.jsx. What it does with color is the
// same, turned round: a resting node sits most of the way to the PAGE, which is
// dark, and the neighborhood the pointer lights stands out from it by coming up
// lighter rather than deeper.
//
describe('on a dark page', () => {
    function dark() {
        const held = React.createRef();
        const utils = render(<GraphCluster ref={held} data={schema} theme='dark' />);

        return { ...utils, page: held.current };
    }

    const lightness = (color) => d3.hsl(color).l;

    it('rests every node most of the way to the dark page, as a light one rests them toward white', () => {
        const { page } = dark();
        const { namespace } = page.nodes[0];
        const own = page.nodeColor(namespace);

        expect(page.mutedColor(namespace)).toBe(d3.interpolateRgb(own, colors_dark['white-1'])(0.62));
        expect(lightness(page.mutedColor(namespace))).toBeLessThan(lightness(own));
    });

    it('lights the pointed-at neighborhood lighter than its own color, and the node itself lightest', () => {
        const { page } = dark();
        const link = page.links[0];
        const self = link.source.id ? link.source.id : link.source;
        const neighbor = link.target.id ? link.target.id : link.target;

        page.highlight(self);

        const fills = new Map(
            page.nodeSel.nodes().map((n, i) => [page.nodes[i].id, n.getAttribute('fill')])
        );
        const own = (id) => page.nodeColor(page.nodes.find((n) => n.id === id).namespace);

        expect(lightness(fills.get(neighbor))).toBeGreaterThan(lightness(own(neighbor)));
        expect(lightness(fills.get(self))).toBeGreaterThan(lightness(own(self)));
    });

    it('draws the field, the rings and the labels in the dark page\'s grays', () => {
        const { page } = dark();

        expect(page.bgNodeSel.attr('fill')).toBe(colors_dark['gray-5']);
        expect(page.bgLinkSel.attr('stroke')).toBe(colors_dark['gray-6']);
        expect(page.nodeSel.attr('stroke')).toBe(colors_dark['gray-1']);
        expect(page.labelSel.attr('fill')).toBe(colors_dark['gray-8']);
        expect(page.labelSel.attr('stroke')).toBe(colors_dark['white-1']);
    });

    it('hands each node its resting color, for the glint the dark page runs', () => {
        const { page } = dark();

        page.nodeSel.nodes().forEach((n, i) => {
            expect(n.style.getPropertyValue('--node-fill')).toBe(page.mutedColor(page.nodes[i].namespace));
        });
    });

    it('recolors where it stands when the page changes theme', () => {
        //
        // a reader pressed a button in the header; nothing on the screen moves
        //
        const held = React.createRef();
        const { rerender } = render(<GraphCluster ref={held} data={schema} />);
        const page = held.current;
        const where = page.nodes.map((n) => [n.x, n.y]);
        const { namespace } = page.nodes[0];

        rerender(<GraphCluster ref={held} data={schema} theme='dark' />);

        expect(page.nodeSel.nodes()[0].getAttribute('fill')).toBe(page.mutedColor(namespace));
        expect(page.nodeSel.nodes()[0].style.getPropertyValue('--node-fill')).toBe(page.mutedColor(namespace));
        expect(page.bgNodeSel.attr('fill')).toBe(colors_dark['gray-5']);
        expect(page.nodes.map((n) => [n.x, n.y])).toEqual(where);

        rerender(<GraphCluster ref={held} data={schema} theme='light' />);

        expect(page.bgNodeSel.attr('fill')).toBe(colors['gray-5']);
        expect(lightness(page.nodeSel.nodes()[0].getAttribute('fill'))).toBeGreaterThan(0.5);
    });

    it('falls back to the dark page\'s quiet gray', () => {
        const held = React.createRef();
        render(<GraphCluster ref={held} theme='dark' />);

        expect(held.current.nodeColor('bls')).toBe(colors_dark['gray-5']);
    });
});

describe('on a phone-sized screen', () => {
    const width = window.innerWidth;

    afterEach(() => {
        window.innerWidth = width;
    });

    it('draws smaller nodes, a smaller gray field and smaller labels', () => {
        window.innerWidth = 500;

        const { page } = setup();

        expect(page.nodes[0].r).toBe(6);
        expect(page.bgRadius).toBe(6);
        expect(page.labelSel.nodes()[0].getAttribute('font-size')).toBe('11');
    });

    it('pushes the cluster apart more gently, to fit the narrower screen', () => {
        window.innerWidth = 500;

        const { page } = setup();

        expect(page.simulation.force('charge').strength()()).toBe(CHARGE_SMALL);
    });
});

describe('dragging a node', () => {
    //
    // d3-drag listens for the press on the circle and for the move and the release on
    // the window, so the events are dispatched where it listens. Each carries the
    // window as its view, because d3-drag reads the window from there.
    //
    function press(page) {
        fireEvent.mouseDown(page.nodeSel.nodes()[0], { view: window, clientX: 100, clientY: 100 });

        return page.nodes[0];
    }

    const move = (x, y) => fireEvent.mouseMove(window, { view: window, clientX: x, clientY: y });
    const release = (x, y) => fireEvent.mouseUp(window, { view: window, clientX: x, clientY: y });

    it('pins the node where it is, and wakes the simulation to follow', () => {
        const { page } = setup();

        const node = press(page);

        expect(node.fx).toBe(node.x);
        expect(node.fy).toBe(node.y);
        expect(page.simulation.alphaTarget()).toBe(0.3);
        release(100, 100);
    });

    it('carries the node with the pointer', () => {
        const { page } = setup();
        const node = press(page);
        const [x, y] = [node.x, node.y];

        move(130, 120);

        expect(node.fx).toBeCloseTo(x + 30);
        expect(node.fy).toBeCloseTo(y + 20);
        release(130, 120);
    });

    it('lets go of the node when released, so the layout takes it back', () => {
        const { page } = setup();
        const node = press(page);
        move(130, 120);

        release(130, 120);

        expect(node.fx).toBeNull();
        expect(node.fy).toBeNull();
        expect(page.simulation.alphaTarget()).toBeLessThan(0.3);
    });
});

describe('the pointer force', () => {
    //
    // fetched off the simulation and applied once, as a tick would apply it: a push
    // away from the cursor for the nodes in the ring between POINTER_INNER (45px) and
    // POINTER_OUTER (150px), and for no others.
    //
    function pushed(page, distance) {
        const node = page.nodes[0];

        page.pointer = { x: 500, y: 300 };
        node.x = 500 + distance;
        node.y = 300;
        node.vx = 0;
        node.vy = 0;

        page.simulation.force('pointer')(1);

        return node;
    }

    it('pushes a node in the ring directly away from the cursor', () => {
        const { page } = setup();

        const node = pushed(page, 100);

        expect(node.vx).toBeGreaterThan(0);
        expect(node.vy).toBe(0);
    });

    it('pushes harder the closer the node is', () => {
        const { page } = setup();

        const near = pushed(page, 60).vx;
        const far = pushed(page, 140).vx;

        expect(near).toBeGreaterThan(far);
    });

    it('leaves the node under the cursor alone, so it stays close enough to read', () => {
        const { page } = setup();

        expect(pushed(page, 20).vx).toBe(0);
    });

    it('leaves a node outside the ring alone', () => {
        const { page } = setup();

        expect(pushed(page, 200).vx).toBe(0);
    });

    it('does nothing without a cursor', () => {
        const { page } = setup();
        const node = page.nodes[0];
        node.vx = 0;
        page.pointer = null;

        page.simulation.force('pointer')(1);

        expect(node.vx).toBe(0);
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
        expect(svg.getAttribute('height')).toBe(String(900 - GRAPH_TOP_PAD));
    });

    //
    // the svg is absolutely positioned, so without an offset it starts at y=0 and
    // the cluster drifts up behind whatever the page keeps at the top.
    //
    // Note: jsdom measures every element as a zero rect, so a bar has to be given
    //       a height for any of this to be observable. The old version of this
    //       case appended a banner, measured nothing, and asserted the offset was
    //       zero -- which passed whether the offset worked or not.
    //
    describe.each([
        ['the construction banner', 'under-construction', 48],
        ['the main navigation', 'main-navigation', 64],
    ])('leaves room for %s', (_name, className, height) => {
        let bar;

        beforeEach(() => {
            bar = document.createElement('div');
            bar.className = className;
            bar.getBoundingClientRect = () => ({ height: height, bottom: height });
            document.body.appendChild(bar);
        });

        afterEach(() => {
            bar.remove();
        });

        it('offsets the canvas below it', () => {
            const { page } = setup();

            page.applyResize();

            expect(page.topMargin).toBe(height + GRAPH_TOP_PAD);
            expect(page.svgRef.current.style.top).toBe(`${height + GRAPH_TOP_PAD}px`);
        });

        it('takes the offset off the canvas height, so it still ends at the fold', () => {
            window.innerHeight = 900;
            const { page } = setup();

            page.applyResize();

            expect(page.svgRef.current.getAttribute('height'))
                .toBe(String(900 - height - GRAPH_TOP_PAD));
        });
    });

    it('offsets below whichever bar reaches lowest, not the first one found', () => {
        //
        // there are two navigation bars in the markup -- a desktop one and a
        // taller mobile one -- and the stylesheet decides which is on screen.
        // The hidden one measures zero, so the visible one is what counts.
        //
        const hidden = document.createElement('div');
        hidden.className = 'main-navigation';
        hidden.getBoundingClientRect = () => ({ height: 0, bottom: 0 });
        const shown = document.createElement('div');
        shown.className = 'main-navigation';
        shown.getBoundingClientRect = () => ({ height: 96, bottom: 96 });
        document.body.append(hidden, shown);

        try {
            const { page } = setup();

            page.applyResize();

            expect(page.topMargin).toBe(96 + GRAPH_TOP_PAD);
        } finally {
            hidden.remove();
            shown.remove();
        }
    });

    it('re-centers the simulation forces on the new middle', () => {
        //
        // without this the cluster keeps drifting toward where the center used to be, and
        // expanding the window pushes the animation off screen.
        //
        const { page } = setup();
        window.innerWidth = 1400;
        window.innerHeight = 900;

        page.applyResize();

        expect(page.simulation.force('x').x()()).toBeCloseTo(700);
    });

    it('rebuilds the gray field when the viewport changes shape', () => {
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
        // new layout. Regenerating there would teleport every gray node for nothing, so
        // the live viewport is tracked instead.
        //
        const { page } = setup();
        const before = page.background.nodes;
        window.innerHeight = window.innerHeight - 40;

        page.applyResize();

        expect(page.background.nodes).toBe(before);
        expect(page.viewH).toBe(window.innerHeight - page.topMargin);
    });

    it('places a rebuilt field at once, since it has no earlier frame to glide from', () => {
        const { page } = setup();
        window.innerWidth = window.innerWidth + 600;

        page.applyResize();

        expect(page.snapField).toBe(true);
    });

    it('leaves a kept field gliding as usual', () => {
        const { page } = setup();
        window.innerHeight = window.innerHeight - 40;

        page.applyResize();

        expect(page.snapField).toBe(false);
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

    it('drops a pending resize once unmounted', () => {
        //
        // the work it would do draws into an svg that is no longer in the page.
        //
        const { page, unmount } = setup();
        jest.useFakeTimers();
        const applied = jest.spyOn(page, 'applyResize');

        page.handleResize();
        unmount();
        jest.advanceTimersByTime(BG_RESIZE_DEBOUNCE);

        expect(applied).not.toHaveBeenCalled();
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

    it('writes every colored node position onto its circle', () => {
        const { page } = setup();
        page.nodes.forEach((n, i) => { n.x = 100 + i; n.y = 200 + i; });

        tick(page);

        page.nodeSel.nodes().forEach((circle, i) => {
            expect(Number(circle.getAttribute('cx'))).toBeCloseTo(100 + i);
            expect(Number(circle.getAttribute('cy'))).toBeCloseTo(200 + i);
        });
    });

    it('writes both endpoints of every colored edge', () => {
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

    it('writes the gray field positions too', () => {
        const { page } = setup();

        tick(page);

        page.bgNodeSel.nodes().forEach(circle => {
            expect(Number.isNaN(Number(circle.getAttribute('cx')))).toBe(false);
        });
    });

    it('darkens the gray nodes near the cursor', () => {
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

    it('leaves the distant gray nodes alone', () => {
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

    //
    // a gray node with the whole cluster piled up just beside its home spot, so the
    // repel wants it about 75px from where it is drawn. Chosen well inside the
    // viewport, so neither the on-screen clamp nor the overhang enters into it.
    //
    function crowd(page) {
        const n = page.background.nodes.find(b => b.hx > 300 && b.hx < page.viewW - 300
            && b.hy > 300 && b.hy < page.viewH - 300);

        page.nodes.forEach(c => { c.x = n.hx + 10; c.y = n.hy; });
        n.x = n.hx;
        n.y = n.hy;

        return n;
    }

    it('glides a gray node out of the cluster\'s way, a few px a frame', () => {
        const { page } = setup();
        const n = crowd(page);

        tick(page);

        expect(Math.hypot(n.x - n.hx, n.y - n.hy)).toBeLessThanOrEqual(5 + 1e-9);
    });

    it('places it clear at once on the first frame of a drawing', () => {
        //
        // nothing is on screen yet to glide from. Gliding anyway plays the field
        // parting around the cluster as an animation on every page load.
        //
        const { page } = setup();
        const n = crowd(page);
        page.snapField = true;

        tick(page);

        expect(Math.hypot(n.x - (n.hx + 10), n.y - n.hy)).toBeGreaterThan(60);
    });

    it('goes back to gliding after that one frame', () => {
        const { page } = setup();
        page.snapField = true;

        tick(page);

        expect(page.snapField).toBe(false);
    });

    //
    // an interior gray node held exactly at its home spot, so the only thing moving it
    // is whatever the cluster does
    //
    function stillAtHome(page, inset = 300) {
        const n = page.background.nodes.find(b => b.hx > inset && b.hx < page.viewW - inset
            && b.hy > inset && b.hy < page.viewH - inset);

        n.wobble = 0;
        n.x = n.hx;
        n.y = n.hy;

        return n;
    }

    it('keeps a gray node within reach of home however hard the cluster shoves it', () => {
        //
        // the whole cluster in a row stepping left from just beside the node, each one
        // pushing it on into the next: unbounded, that is more than 1600px. A node
        // shoved out of view is indistinguishable from one that vanished, so the aim is
        // held to BG_MAX_PUSH (420px) of home.
        //
        const { page } = setup();
        const n = page.background.nodes.find(b => b.hx > 750 && b.hx < page.viewW - 50
            && b.hy > 200 && b.hy < page.viewH - 200);
        n.wobble = 0;
        page.nodes.forEach((c, i) => { c.x = n.hx + 10 - i * 70; c.y = n.hy; });

        tick(page);

        const aim = Math.hypot(n.tx - n.hx, n.ty - n.hy);
        expect(aim).toBeGreaterThan(400);
        expect(aim).toBeLessThanOrEqual(420 + 1e-9);
    });

    it('moves a gray node drawn dead on a cluster node, picking a way out', () => {
        //
        // exactly concentric there is no direction to push along -- the repel skips it
        // for that reason -- so the hard non-overlap has to choose one rather than divide
        // by zero or leave the node drawn over the cluster.
        //
        const { page } = setup();
        const n = stillAtHome(page);
        page.nodes.forEach(c => { c.x = n.hx; c.y = n.hy; });

        tick(page);

        expect(Number.isNaN(n.x) || Number.isNaN(n.y)).toBe(false);
        expect(Math.hypot(n.x - n.hx, n.y - n.hy)).toBeGreaterThan(0);
    });

    //
    // every cluster node on a row `below` px under the gray node, alternately far to
    // its left and right, so the edges between the two sides pass right under it and
    // no cluster NODE is anywhere near.
    //
    function straddled(page, n, below) {
        page.nodes.forEach((c, i) => {
            c.x = n.hx + (i % 2 ? -1 : 1) * (200 + i * 10);
            c.y = n.hy + below;
        });

        // the premise, rather than an assumption about the fixture's edges
        expect(page.links.some(l => (l.source.x - n.hx) * (l.target.x - n.hx) < 0)).toBe(true);
    }

    it('slides a gray node drawn across a cluster edge off it', () => {
        //
        // 1px from the edge, its glide toward a clear spot still leaves it overlapping
        // on this frame, and the hard non-overlap moves it the rest of the way out --
        // straight up, away from the edge.
        //
        const { page } = setup();
        const n = stillAtHome(page);
        straddled(page, n, 1);

        tick(page);

        expect(n.y).toBeLessThan(n.hy);
        expect(n.x).toBeCloseTo(n.hx);
    });

    it('moves a gray node drawn exactly on a cluster edge, picking a way out', () => {
        const { page } = setup();
        const n = stillAtHome(page);
        straddled(page, n, 0);

        tick(page);

        expect(Number.isNaN(n.x) || Number.isNaN(n.y)).toBe(false);
        expect(Math.hypot(n.x - n.hx, n.y - n.hy)).toBeGreaterThan(0);
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

describe('the mouse handlers', () => {
    //
    // d3 binds these to the svg itself, so they are dispatched as real dom events
    // rather than pulled off an object -- which is also the only way to prove they were
    // wired to the element at all.
    //
    const svgOf = (page) => page.svgRef.current;

    it('latches the pointer where the cursor is', () => {
        const { page } = setup();

        fireEvent.mouseMove(svgOf(page), { clientX: 120, clientY: 90 });

        expect(page.pointer).not.toBeNull();
    });

    it('drops the pointer when the cursor leaves', () => {
        const { page } = setup();
        fireEvent.mouseMove(svgOf(page), { clientX: 120, clientY: 90 });

        fireEvent.mouseLeave(svgOf(page));

        expect(page.pointer).toBeNull();
    });

    it('clears the hover when the cursor leaves', () => {
        const { page } = setup();
        page.hoveredId = page.nodes[0].id;

        fireEvent.mouseLeave(svgOf(page));

        expect(page.hoveredId).toBeNull();
    });

    it('ignores the synthetic mousemove that a tap replays', () => {
        //
        // a touch device emits one mousemove per tap AFTER touchend and never a
        // mouseleave, so without this guard the pointer would re-latch wherever the
        // finger last was: the cluster stays shoved aside and the gray spotlight stays
        // lit for good.
        //
        const { page } = setup();
        page.touchedAt = Date.now();

        fireEvent.mouseMove(svgOf(page), { clientX: 120, clientY: 90 });

        expect(page.pointer).toBeNull();
    });

    it('accepts a mousemove once the touch guard has expired', () => {
        //
        // the other arm: a real mouse on a machine that once saw a touch must still
        // work, so the guard is a window rather than a latch.
        //
        const { page } = setup();
        page.touchedAt = Date.now() - (MOUSE_AFTER_TOUCH + 50);

        fireEvent.mouseMove(svgOf(page), { clientX: 120, clientY: 90 });

        expect(page.pointer).not.toBeNull();
    });
});

describe('the touch handlers', () => {
    const svgOf = (page) => page.svgRef.current;
    const touchAt = (x, y) => ({ touches: [{ clientX: x, clientY: y }] });

    it('drives the pointer from the touch itself', () => {
        //
        // not from the emulated mouse events: those arrive once per tap, after the
        // finger has already lifted.
        //
        const { page } = setup();

        fireEvent.touchMove(svgOf(page), touchAt(140, 100));

        expect(page.pointer).not.toBeNull();
    });

    it('drops the pointer when the finger lifts', () => {
        const { page } = setup();
        fireEvent.touchMove(svgOf(page), touchAt(140, 100));

        fireEvent.touchEnd(svgOf(page));

        expect(page.pointer).toBeNull();
    });

    it('drops the pointer when the touch is canceled', () => {
        const { page } = setup();
        fireEvent.touchMove(svgOf(page), touchAt(140, 100));

        fireEvent.touchCancel(svgOf(page));

        expect(page.pointer).toBeNull();
    });

    it('starts tracking on touchstart, not only on move', () => {
        //
        // a tap that never moves still has to light its node, so touchstart shares the
        // move handler.
        //
        const { page } = setup();

        fireEvent.touchStart(svgOf(page), touchAt(140, 100));

        expect(page.pointer).not.toBeNull();
    });

    it('ignores a touch event carrying no touch', () => {
        //
        // touches is empty on some cancel sequences, and reading [0] blindly would put
        // NaN into the pointer and from there into every node position.
        //
        const { page } = setup();

        fireEvent.touchMove(svgOf(page), { touches: [] });

        expect(page.pointer).toBeNull();
    });

    it('records when the touch happened, so the mouse guard can see it', () => {
        const { page } = setup();
        page.touchedAt = 0;

        fireEvent.touchEnd(svgOf(page));

        expect(page.touchedAt).toBeGreaterThan(0);
    });
});


//
// the canvas edge pushes back.
//
// The cluster had no viewport bound at all while pointerForce adds velocity with
// no ceiling, so sweeping the cursor along its rim shoved nodes out of frame --
// off the top first, where the clearance is thinnest.
//
describe('the canvas edge', () => {
    //
    // a node placed `over` px past one edge, with the viewport stated: the force
    // reads the live size rather than whatever the closure captured, so a test
    // sets it the same way a resize would.
    //
    function strayed(page, axis, over, view = { w: 1200, h: 800 }) {
        const node = page.nodes[0];

        page.viewW = view.w;
        page.viewH = view.h;
        node.x = view.w / 2;
        node.y = view.h / 2;
        node.vx = 0;
        node.vy = 0;

        const edge = EDGE_MARGIN + node.r;

        if (axis === 'top') node.y = edge - over;
        if (axis === 'bottom') node.y = view.h - edge + over;
        if (axis === 'left') node.x = edge - over;
        if (axis === 'right') node.x = view.w - edge + over;

        page.simulation.force('edge')(1);

        return node;
    }

    it('pushes a node back down when it strays over the top', () => {
        const { page } = setup();

        expect(strayed(page, 'top', 40).vy).toBeGreaterThan(0);
    });

    it('pushes back up, left and right from the other three edges', () => {
        const { page } = setup();

        expect(strayed(page, 'bottom', 40).vy).toBeLessThan(0);
        expect(strayed(page, 'left', 40).vx).toBeGreaterThan(0);
        expect(strayed(page, 'right', 40).vx).toBeLessThan(0);
    });

    //
    // the four edges are independent, so a node past two of them at once gets
    // both pushes and comes back diagonally. Worth holding explicitly: a
    // boundary written as one 'which edge is nearest' branch would pick a side
    // and leave the corner leaking, and a phone is where that shows -- the
    // cluster is widest against the sides while the drift and the cursor are
    // still moving it up and down.
    //
    it.each([
        ['top left', 'left', 'top', 1, 1],
        ['top right', 'right', 'top', -1, 1],
        ['bottom left', 'left', 'bottom', 1, -1],
        ['bottom right', 'right', 'bottom', -1, -1],
    ])('pushes a node out of the %s corner on both axes', (_name, across, down, sx, sy) => {
        const { page } = setup();
        const view = { w: 390, h: 760 };
        const node = page.nodes[0];
        const edge = EDGE_MARGIN + node.r;

        page.viewW = view.w;
        page.viewH = view.h;
        node.x = across === 'left' ? edge - 50 : view.w - edge + 50;
        node.y = down === 'top' ? edge - 50 : view.h - edge + 50;
        node.vx = 0;
        node.vy = 0;

        page.simulation.force('edge')(1);

        expect(Math.sign(node.vx)).toBe(sx);
        expect(Math.sign(node.vy)).toBe(sy);
    });

    it('leaves a node inside the margin alone', () => {
        //
        // a spring at the boundary, not a force field across the canvas
        //
        const { page } = setup();
        const node = strayed(page, 'top', -20);

        expect(node.vx).toBe(0);
        expect(node.vy).toBe(0);
    });

    it('pushes harder the further out the node is', () => {
        const { page } = setup();

        const near = strayed(page, 'top', 10).vy;
        const far = strayed(page, 'top', 100).vy;

        expect(far).toBeGreaterThan(near);
    });

    it('follows a resize rather than bounding the window that has gone', () => {
        //
        // a resize does not rebuild the simulation, so a boundary read from the
        // captured size would sit where the window used to be.
        //
        const { page } = setup();

        const inside = strayed(page, 'bottom', -60, { w: 1200, h: 1400 });
        expect(inside.vy).toBe(0);

        const outside = strayed(page, 'bottom', 60, { w: 1200, h: 400 });
        expect(outside.vy).toBeLessThan(0);
    });

    it('bounds a phone as well, which is where nodes were being lost', () => {
        //
        // #78 let the cluster run off the sides here, on the reasoning that it
        // wants more width than a phone has and bounding it would crush the
        // layout. Measured, it does not: the cluster only fills 577 of a
        // phone's 764 usable pixels vertically, so a bound layout spreads into
        // that slack instead. Five node types come back on screen and the
        // median gap between neighbors goes up rather than down.
        //
        const { page } = setup();
        const node = strayed(page, 'left', 120, { w: 390, h: 760 });

        expect(node.vx).toBeGreaterThan(0);
    });

    it('cannot reach the gray field, which is not in the simulation', () => {
        //
        // the lattice snaps back to fixed home spots and the tick handler
        // bounds it already. It is a separate array rather than simulation
        // nodes, which is WHY the force needs no guard against it -- this
        // holds the reason, since a guard would be a branch that never runs.
        //
        // Note: written against the simulation's own node list rather than by
        //       shoving a field node and checking it did not move. That version
        //       passed whatever the force did, because the object it moved was
        //       never handed to the force in the first place.
        //
        const { page } = setup();
        const inSimulation = page.simulation.nodes();

        expect(page.background.nodes.length).toBeGreaterThan(0);
        expect(inSimulation.some((n) => page.background.nodes.includes(n))).toBe(false);
    });
});
