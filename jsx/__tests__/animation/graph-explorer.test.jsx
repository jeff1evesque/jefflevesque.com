/**
 * graph-explorer.test.jsx: the knowledge graph drawn at full attention.
 *
 * Same d3 limits as the backdrop's suite: nothing ticks under jsdom on its own,
 * so per-tick geometry is driven deliberately rather than waited for, and the
 * physics itself is d3's to test rather than this codebase's.
 *
 * What is worth holding here is the set of things this component does
 * DIFFERENTLY from the backdrop, because that difference is the only reason it
 * exists as a separate component:
 *
 *   - colour at rest rather than on hover
 *   - no decorative gray field
 *   - a layout already at rest, inside its canvas, before anything is painted
 *   - focusing a node lifts its neighbourhood and names it in a card, instead
 *     of shoving nodes away from the pointer
 *   - a drift that moves each node a little around where it settled, rather than
 *     a simulation left running that moves the layout itself
 *
 * A regression in any of those turns this page back into the backdrop, which
 * renders fine and is useless to read.
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';

import GraphExplorer, {
    shortName,
    breakable,
    placeCard,
    reducedMotion,
    HOVER_REACH,
    TAP_REACH,
    CARD_DOCK_WIDTH,
    DRIFT,
} from '../../import/animation/graph-explorer.jsx';

const schema = {
    version: '1',
    node_types: {
        bls_A: { count: 100, source_type_uri: 'https://example.com/ontology/bls/A' },
        bls_B: { count: 90, source_type_uri: 'https://example.com/ontology/bls/B' },
        sec_C: { count: 1, source_type_uri: 'https://example.com/ontology/sec/C' },
    },
    edge_types: {
        raw: { src_type: 'bls_A', dst_type: 'bls_B', relation: 'r', origin: 'raw', count: 10 },
        enr: { src_type: 'bls_B', dst_type: 'sec_C', relation: 'r', origin: 'enrichment', count: 20 },
    },
};

const TYPES = Object.keys(schema.node_types);

function setup(props = {}) {
    const held = React.createRef();
    const utils = render(<GraphExplorer ref={held} data={schema} {...props} />);

    return { ...utils, page: held.current };
}

const circles = () => [...document.querySelectorAll('circle')];
const card = () => document.querySelector('.graph-card');
const svg = () => document.querySelector('svg');
const node = (page, id) => page.nodes.find(n => n.id === id);

//
// the pointer at a node's centre, or `offset` px to its right. d3.pointer falls back
// to client coordinates under jsdom, where nothing has a layout.
//
function pointAt(page, id, offset = 0) {
    const n = node(page, id);
    fireEvent.mouseMove(svg(), { clientX: n.x + offset, clientY: n.y });
}

function clickAt(page, id, offset = 0) {
    const n = node(page, id);
    fireEvent.click(svg(), { clientX: n.x + offset, clientY: n.y });
}

describe('mounting', () => {
    it('renders a single svg', () => {
        setup();

        expect(document.querySelectorAll('svg')).toHaveLength(1);
    });

    it('draws one circle per node type and nothing else', () => {
        //
        // the backdrop surrounds its cluster with a gray field of decorative nodes.
        // This one does not -- every circle on the page is data.
        //
        setup();

        expect(circles()).toHaveLength(TYPES.length);
    });

    it('draws no labels on the canvas', () => {
        //
        // sixty names, some past sixty characters, overprinted each other into a block
        // that named nothing. A node names itself in the card, when asked.
        //
        setup();

        expect(document.querySelectorAll('text')).toHaveLength(0);
    });

    it('shows no card until a node is focused', () => {
        setup();

        expect(card()).toBeNull();
    });

    it('draws one line per edge type', () => {
        setup();

        expect(document.querySelectorAll('line')).toHaveLength(2);
    });

    it('takes its height from the caller', () => {
        setup({ height: 420 });

        expect(svg().getAttribute('height')).toBe('420');
    });

    it('falls back to a default height', () => {
        setup();

        expect(svg().getAttribute('height')).toBe('600');
    });

    it('describes itself to assistive technology', () => {
        setup();

        expect(svg().getAttribute('role')).toBe('img');
        expect(svg().getAttribute('aria-label')).toContain('3 node types');
    });
});

describe('the layout before the first paint', () => {
    //
    // the page used to start the simulation on the next frame, so the first thing on
    // screen was the whole graph sweeping in from the svg's top-left corner. These
    // read the circles straight after mounting, without a single tick having been
    // dispatched: whatever is there is what the first frame paints.
    //
    const width = () => window.innerWidth;
    const height = 600;

    it('has a position for every node already', () => {
        setup();

        circles().forEach(c => {
            expect(Number.isFinite(Number(c.getAttribute('cx')))).toBe(true);
            expect(Number.isFinite(Number(c.getAttribute('cy')))).toBe(true);
            expect(c.getAttribute('cx')).not.toBeNull();
        });
    });

    it('keeps every node inside the canvas', () => {
        setup();

        circles().forEach(c => {
            expect(Number(c.getAttribute('cx'))).toBeGreaterThan(0);
            expect(Number(c.getAttribute('cx'))).toBeLessThan(width());
            expect(Number(c.getAttribute('cy'))).toBeGreaterThan(0);
            expect(Number(c.getAttribute('cy'))).toBeLessThan(height);
        });
    });

    it('centres the graph on the canvas rather than its corner', () => {
        const { page } = setup();

        const xs = page.nodes.map(n => n.x);
        const ys = page.nodes.map(n => n.y);

        expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(width() / 2);
        expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(height / 2);
    });

    it('leaves the simulation stopped, so the layout is final', () => {
        //
        // the nodes drift afterwards (see 'the drift'), but the FORCES are done:
        // a simulation still running would pull the layout off the fit that was
        // just applied to it.
        //
        const { page } = setup();

        expect(page.simulation.alpha()).toBeLessThanOrEqual(page.simulation.alphaMin());
    });
});

describe('with no data', () => {
    it('draws nothing rather than a stand-in', () => {
        const held = React.createRef();
        render(<GraphExplorer ref={held} />);

        expect(circles()).toHaveLength(0);
        expect(held.current.nodes).toEqual([]);
    });

    it('treats a payload missing node_types as no data', () => {
        const held = React.createRef();
        render(<GraphExplorer ref={held} data={{ edge_types: {} }} />);

        expect(held.current.nodes).toEqual([]);
    });

    it('treats a payload missing edge_types as no data', () => {
        const held = React.createRef();
        render(<GraphExplorer ref={held} data={{ node_types: {} }} />);

        expect(held.current.nodes).toEqual([]);
    });

    it('ignores the pointer', () => {
        const held = React.createRef();
        render(<GraphExplorer ref={held} />);

        fireEvent.mouseMove(svg(), { clientX: 10, clientY: 10 });
        fireEvent.click(svg(), { clientX: 10, clientY: 10 });

        expect(held.current.hoveredId).toBeNull();
        expect(card()).toBeNull();
    });
});

describe('colour at rest', () => {
    it('paints every node from the start', () => {
        //
        // the backdrop washes nodes toward white until hovered. Here the colour IS
        // the content, so nothing is muted.
        //
        setup();

        circles().forEach(c => expect(c.getAttribute('fill')).toBeTruthy());
    });

    it('gives two namespaces two colours', () => {
        setup();

        const fills = new Map(circles().map((c, i) => [TYPES[i], c.getAttribute('fill')]));

        expect(fills.get('bls_A')).toBe(fills.get('bls_B'));
        expect(fills.get('bls_A')).not.toBe(fills.get('sec_C'));
    });

    it('dashes an enrichment edge and leaves a raw one solid', () => {
        setup();

        const dashes = [...document.querySelectorAll('line')]
            .map(l => l.getAttribute('stroke-dasharray'));

        expect(dashes.filter(Boolean)).toHaveLength(1);
    });
});

describe('focusing a node', () => {
    it('dims everything outside the neighbourhood', () => {
        const { page } = setup();

        page.highlight('sec_C');

        const dimmed = circles().filter(c => Number(c.getAttribute('opacity')) < 1);
        expect(dimmed.length).toBeGreaterThan(0);
    });

    it('keeps the focused node and its neighbours at full strength', () => {
        //
        // bls_B touches both others, so focusing it leaves nothing dimmed.
        //
        const { page } = setup();

        page.highlight('bls_B');

        const dimmed = circles().filter(c => Number(c.getAttribute('opacity')) < 1);
        expect(dimmed).toHaveLength(0);
    });

    it('rings the focused node, and only that one', () => {
        //
        // its neighbours light up alongside it, so without a mark of its own the node
        // the card describes is one of several equally lit circles.
        //
        const { page } = setup();

        page.highlight('bls_B');

        const ringed = circles().filter(c => Number(c.getAttribute('stroke-width')) > 1);
        expect(ringed).toHaveLength(1);
        expect(ringed[0]).toBe(circles()[TYPES.indexOf('bls_B')]);
    });

    it('lights the edges touching the focused node', () => {
        const { page } = setup();

        page.highlight('bls_A');

        const opacities = [...document.querySelectorAll('line')]
            .map(l => Number(l.getAttribute('opacity')));

        expect(Math.max(...opacities)).toBeGreaterThan(0.9);
    });

    it('restores everything when the focus clears', () => {
        const { page } = setup();

        page.highlight('sec_C');
        page.highlight(null);

        circles().forEach(c => {
            expect(Number(c.getAttribute('opacity'))).toBe(1);
            expect(Number(c.getAttribute('stroke-width'))).toBe(1);
        });
    });

    it('dims everything for an id the graph does not have', () => {
        const { page } = setup();

        page.highlight('nope');

        circles().forEach(c => expect(Number(c.getAttribute('opacity'))).toBeLessThan(1));
    });

    it('does nothing when there is no graph to highlight', () => {
        //
        // the guard exists because a focus can be requested before anything is drawn;
        // without it this throws on a null selection.
        //
        const held = React.createRef();
        render(<GraphExplorer ref={held} />);
        held.current.nodeSel = null;

        expect(() => held.current.highlight('anything')).not.toThrow();
    });
});

describe('pointing at a node', () => {
    //
    // resolved against the nearest node within reach rather than by events on the
    // circles, so the target is a generous disc instead of a 7px mark.
    //
    it('focuses the node under the pointer', () => {
        const { page } = setup();

        pointAt(page, 'sec_C');

        expect(page.hoveredId).toBe('sec_C');
        expect(card()).not.toBeNull();
    });

    it('reaches a node from beside it, not only from on top of it', () => {
        const { page } = setup();

        pointAt(page, 'sec_C', HOVER_REACH - 2);

        expect(page.hoveredId).toBe('sec_C');
    });

    it('ignores a pointer beyond reach', () => {
        const { page } = setup();

        fireEvent.mouseMove(svg(), { clientX: -500, clientY: -500 });

        expect(page.hoveredId).toBeNull();
        expect(card()).toBeNull();
    });

    it('clears when the pointer leaves the canvas', () => {
        const { page } = setup();

        pointAt(page, 'sec_C');
        fireEvent.mouseLeave(svg());

        expect(page.hoveredId).toBeNull();
        expect(card()).toBeNull();
    });

    it('shows a pointing cursor only over a node', () => {
        const { page } = setup();

        pointAt(page, 'sec_C');
        expect(svg().style.cursor).toBe('pointer');

        fireEvent.mouseLeave(svg());
        expect(svg().style.cursor).toBe('');
    });

    it('does not redo the work while the pointer stays on one node', () => {
        const { page } = setup();
        pointAt(page, 'sec_C');
        const lit = jest.spyOn(page, 'highlight');

        pointAt(page, 'sec_C', 1);

        expect(lit).not.toHaveBeenCalled();
        lit.mockRestore();
    });
});

describe('the card', () => {
    it('names the node without repeating its namespace', () => {
        const { page } = setup();

        pointAt(page, 'bls_A');

        expect(card().querySelector('.graph-card-namespace').textContent).toBe('bls');
        expect(card().querySelector('.graph-card-name').textContent).toBe('A');
    });

    it('gives the namespace the colour its nodes are painted', () => {
        const { page } = setup();

        pointAt(page, 'bls_A');

        //
        // compared through a style declaration, which normalises both to the same
        // notation -- the fill is written as hex and the swatch reads back as rgb().
        //
        const swatch = card().querySelector('.graph-legend-swatch');
        const expected = document.createElement('span');
        expected.style.backgroundColor = circles()[TYPES.indexOf('bls_A')].getAttribute('fill');

        expect(swatch.style.backgroundColor).toBe(expected.style.backgroundColor);
    });

    it('says how many nodes the type holds and how many types it touches', () => {
        const { page } = setup();

        pointAt(page, 'bls_B');

        expect(card().textContent).toContain('90 nodes');
        expect(card().textContent).toContain('connected to 2 types');
    });

    it('does not pluralise one', () => {
        const { page } = setup();

        pointAt(page, 'sec_C');

        expect(card().textContent).toContain('1 node ');
        expect(card().textContent).toContain('connected to 1 type');
        expect(card().textContent).not.toContain('1 types');
    });

    it('counts a neighbour once however many edges join them, and not itself', () => {
        //
        // a pair of types commonly has several relations between them, and a type can
        // relate to itself. Neither makes it connected to more types.
        //
        const busy = {
            node_types: schema.node_types,
            edge_types: {
                ...schema.edge_types,
                again: { src_type: 'bls_B', dst_type: 'bls_A', relation: 's', origin: 'raw', count: 3 },
                self: { src_type: 'bls_A', dst_type: 'bls_A', relation: 't', origin: 'raw', count: 3 },
            },
        };
        const held = React.createRef();
        render(<GraphExplorer ref={held} data={busy} />);

        pointAt(held.current, 'bls_A');

        expect(card().textContent).toContain('connected to 1 type');
    });

    it('says so when a count is missing rather than printing undefined', () => {
        const bare = {
            node_types: { bls_A: { source_type_uri: 'https://example.com/ontology/bls/A' } },
            edge_types: {},
        };
        const held = React.createRef();
        render(<GraphExplorer ref={held} data={bare} />);

        pointAt(held.current, 'bls_A');

        expect(card().textContent).toContain('n/a nodes');
        expect(card().textContent).not.toContain('undefined');
    });

    it('offers a line break at each word of a long name', () => {
        const long = {
            node_types: { eci_CivilianWorkerWages: { count: 5 } },
            edge_types: {},
        };
        const held = React.createRef();
        render(<GraphExplorer ref={held} data={long} />);

        pointAt(held.current, 'eci_CivilianWorkerWages');

        const name = card().querySelector('.graph-card-name');
        expect(name.textContent).toBe('CivilianWorkerWages');
        expect(name.querySelectorAll('wbr')).toHaveLength(2);
    });

    it('describes nothing for a node that is not in the graph', () => {
        const { page } = setup();

        expect(page.describe('nope')).toBeNull();
    });
});

describe('clicking and tapping', () => {
    //
    // a phone cannot hover, so a tap pins the focus where a hover would only preview
    // it. The same click works with a mouse.
    //
    it('keeps a clicked node focused after the pointer leaves', () => {
        const { page } = setup();

        clickAt(page, 'sec_C');
        fireEvent.mouseLeave(svg());

        expect(page.pinnedId).toBe('sec_C');
        expect(card().textContent).toContain('C');
    });

    it('reaches further for a tap than for a hover', () => {
        const { page } = setup();
        const between = Math.round((HOVER_REACH + TAP_REACH) / 2);

        pointAt(page, 'sec_C', between);
        expect(page.hoveredId).toBeNull();

        clickAt(page, 'sec_C', between);
        expect(page.pinnedId).toBe('sec_C');
    });

    it('lets go of the pinned node when it is clicked again', () => {
        const { page } = setup();

        clickAt(page, 'sec_C');
        clickAt(page, 'sec_C');

        expect(page.pinnedId).toBeNull();
        expect(card()).toBeNull();
    });

    it('lets go when the click lands on empty canvas', () => {
        const { page } = setup();

        clickAt(page, 'sec_C');
        fireEvent.click(svg(), { clientX: -500, clientY: -500 });

        expect(page.pinnedId).toBeNull();
        expect(card()).toBeNull();
    });

    it('moves the pin to another node that is clicked', () => {
        const { page } = setup();

        clickAt(page, 'sec_C');
        clickAt(page, 'bls_A');

        expect(page.pinnedId).toBe('bls_A');
    });

    it('previews a hovered node over the pinned one, then returns to it', () => {
        const { page } = setup();
        clickAt(page, 'sec_C');

        pointAt(page, 'bls_A');
        expect(card().querySelector('.graph-card-name').textContent).toBe('A');

        fireEvent.mouseMove(svg(), { clientX: -500, clientY: -500 });
        expect(card().querySelector('.graph-card-name').textContent).toBe('C');
    });

    it('clears the focus when a different build is drawn', () => {
        //
        // the pinned node belonged to the previous layout, and may not exist in this one.
        //
        const held = React.createRef();
        const { rerender } = render(<GraphExplorer ref={held} data={schema} />);
        clickAt(held.current, 'sec_C');
        expect(card()).not.toBeNull();

        rerender(<GraphExplorer ref={held} data={{ ...schema }} />);

        expect(card()).toBeNull();
        expect(held.current.pinnedId).toBeNull();
    });

    it('can be driven without a pointer at all', () => {
        const { page } = setup();

        act(() => page.pin('bls_B'));

        expect(card()).not.toBeNull();

        act(() => page.pin(null));

        expect(card()).toBeNull();
    });
});

describe('on a narrow canvas', () => {
    const width = window.innerWidth;

    afterEach(() => {
        window.innerWidth = width;
    });

    it('draws smaller nodes', () => {
        window.innerWidth = 400;

        setup();

        circles().forEach(c => expect(Number(c.getAttribute('r'))).toBeLessThan(7));
    });

    it('docks the card rather than setting it beside the node', () => {
        window.innerWidth = CARD_DOCK_WIDTH - 100;
        const { page } = setup();

        pointAt(page, 'sec_C');

        expect(card().className).toMatch(/graph-card-dock-(top|bottom)/);
        expect(card().getAttribute('style')).toBeNull();
    });
});

describe('how long an edge is drawn', () => {
    //
    // the accessor is pulled off the force and called directly: the layout that uses
    // it runs before anything could observe it.
    //
    function distanceFn() {
        const { page } = setup();

        return page.simulation.force('link').distance();
    }

    it('lengthens with the edge count', () => {
        const distance = distanceFn();

        expect(distance({ count: 10_000 })).toBeGreaterThan(distance({ count: 100 }));
    });

    it('stops at a ceiling, so one heavy edge cannot drag the layout apart', () => {
        const distance = distanceFn();

        expect(distance({ count: 9_749_369 })).toBe(140);
    });

    it('gives an edge with no count a fixed length rather than NaN', () => {
        const distance = distanceFn();

        expect(distance({})).toBe(40);
    });
});

describe('an edge to a type the schema does not carry', () => {
    it('is rejected by name rather than failing on the way there', () => {
        //
        // the page only hands this a filtered schema, which drops such edges. Should
        // one arrive anyway, the error that surfaces is d3's -- which names the
        // missing type -- rather than a TypeError from the neighbour count.
        //
        const broken = {
            node_types: { bls_A: { count: 1 } },
            edge_types: { e: { src_type: 'bls_A', dst_type: 'ghost', origin: 'raw', count: 1 } },
        };
        const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});

        try {
            expect(() => render(<GraphExplorer data={broken} />)).toThrow(/ghost/);
        } finally {
            quiet.mockRestore();
        }
    });
});

describe('shortName', () => {
    it('drops a prefix that is the namespace', () => {
        expect(shortName('eci_CivilianWorker', 'eci')).toBe('CivilianWorker');
    });

    it('keeps a prefix that is not the namespace', () => {
        expect(shortName('filings_Filing', 'sec-filings')).toBe('filings_Filing');
    });

    it('keeps only the first prefix off a nested id', () => {
        expect(shortName('bls_enrichment_CensusRegion', 'bls')).toBe('enrichment_CensusRegion');
    });

    it('never answers an empty name', () => {
        //
        // an id that is nothing BUT its namespace and an underscore has no name left to
        // show, so it is shown whole.
        //
        expect(shortName('bls_', 'bls')).toBe('bls_');
        expect(shortName('bls', 'bls')).toBe('bls');
    });
});

describe('breakable', () => {
    it('splits CamelCase into its words', () => {
        expect(breakable('CivilianWorkerWages')).toEqual(['Civilian', 'Worker', 'Wages']);
    });

    it('breaks after an underscore, keeping it on the first line', () => {
        expect(breakable('enrichment_CensusRegion')).toEqual(['enrichment_', 'Census', 'Region']);
    });

    it('breaks after a digit that runs into a capital', () => {
        expect(breakable('Q3Data')).toEqual(['Q3', 'Data']);
    });

    it('leaves a run of capitals whole', () => {
        //
        // an acronym is one word; splitting it letter by letter would let a line break
        // anywhere inside it.
        //
        expect(breakable('SECFiling')).toEqual(['SECFiling']);
    });

    it('leaves a single word alone', () => {
        expect(breakable('word')).toEqual(['word']);
    });
});

describe('placeCard', () => {
    const W = 1000;
    const H = 600;

    it('sets the card beside a node on a wide canvas', () => {
        const place = placeCard(200, 300, W, H);

        expect(place.className).toContain('graph-card-right');
        expect(place.style).toEqual({ left: '200px', top: '300px' });
    });

    it('sets it to the left of a node past the middle, where the right has no room', () => {
        expect(placeCard(800, 300, W, H).className).toContain('graph-card-left');
    });

    it('drops it below a node near the top edge', () => {
        expect(placeCard(200, 50, W, H).className).toContain('graph-card-below');
    });

    it('lifts it above a node near the bottom edge', () => {
        expect(placeCard(200, 550, W, H).className).toContain('graph-card-above');
    });

    it('centres it on a node in the middle band', () => {
        expect(placeCard(200, 300, W, H).className).toContain('graph-card-middle');
    });

    it('docks it on a narrow canvas, on the side away from the node', () => {
        //
        // a phone's canvas is too narrow for a card beside a node near the middle, and
        // a card over the node would hide what it describes.
        //
        const narrow = CARD_DOCK_WIDTH - 1;

        expect(placeCard(100, 100, narrow, H)).toEqual({
            className: 'graph-card-dock-bottom',
            style: null,
        });
        expect(placeCard(100, 500, narrow, H).className).toBe('graph-card-dock-top');
    });
});

describe('data arriving after the first paint', () => {
    it('draws the graph when data replaces nothing', () => {
        const { rerender } = render(<GraphExplorer />);
        expect(circles()).toHaveLength(0);

        rerender(<GraphExplorer data={schema} />);

        expect(circles()).toHaveLength(TYPES.length);
    });

    it('redraws when one build replaces another', () => {
        const trimmed = {
            ...schema,
            node_types: { bls_A: schema.node_types.bls_A },
            edge_types: {},
        };
        const { rerender } = render(<GraphExplorer data={schema} />);

        rerender(<GraphExplorer data={trimmed} />);

        expect(circles()).toHaveLength(1);
    });

    it('does not redraw when the same data is passed again', () => {
        const held = React.createRef();
        const { rerender } = render(<GraphExplorer ref={held} data={schema} />);
        const before = held.current.simulation;

        rerender(<GraphExplorer ref={held} data={schema} />);

        expect(held.current.simulation).toBe(before);
    });

    it('stops the previous simulation before redrawing', () => {
        const held = React.createRef();
        const { rerender } = render(<GraphExplorer ref={held} data={schema} />);
        const stopped = jest.spyOn(held.current.simulation, 'stop');

        rerender(<GraphExplorer ref={held} data={{ ...schema }} />);

        expect(stopped).toHaveBeenCalled();
        stopped.mockRestore();
    });
});

describe('the per-tick work', () => {
    //
    // pulled off the simulation and invoked: d3's tick() advances the physics but
    // does not dispatch the event, and jsdom paints no frames.
    //
    function tick(page) {
        page.simulation.on('tick').call(page.simulation);
    }

    it('writes every node position onto its circle', () => {
        const { page } = setup();
        page.nodes.forEach((n, i) => { n.x = 100 + i; n.y = 200 + i; });

        tick(page);

        circles().forEach((c, i) => {
            expect(Number(c.getAttribute('cx'))).toBeCloseTo(100 + i);
            expect(Number(c.getAttribute('cy'))).toBeCloseTo(200 + i);
        });
    });

    it('writes both endpoints of every edge', () => {
        const { page } = setup();

        tick(page);

        [...document.querySelectorAll('line')].forEach(line => {
            ['x1', 'y1', 'x2', 'y2'].forEach(attr => {
                expect(Number.isNaN(Number(line.getAttribute(attr)))).toBe(false);
            });
        });
    });
});

describe('resizing', () => {
    const width = window.innerWidth;

    afterEach(() => {
        window.innerWidth = width;
        jest.useRealTimers();
    });

    it('waits for the burst to finish before redrawing', () => {
        const { page } = setup();
        jest.useFakeTimers();
        const drew = jest.spyOn(page, 'renderD3');

        page.handleResize();
        window.innerWidth = width + 200;
        page.handleResize();

        expect(drew).not.toHaveBeenCalled();

        act(() => { jest.advanceTimersByTime(150); });

        expect(drew).toHaveBeenCalledTimes(1);
        drew.mockRestore();
    });

    it('lays the graph out again for the new size', () => {
        const { page } = setup();
        jest.useFakeTimers();

        window.innerWidth = width + 200;
        page.handleResize();
        act(() => { jest.advanceTimersByTime(150); });

        expect(svg().getAttribute('width')).toBe(String(width + 200));
    });

    it('ignores a resize that leaves the canvas the same size', () => {
        //
        // a phone fires 'resize' as its address bar slides away on scroll, and the
        // canvas does not change size when it does. Laying out again there would
        // shuffle the graph under the reader's thumb.
        //
        const { page } = setup();
        jest.useFakeTimers();
        const drew = jest.spyOn(page, 'renderD3');

        page.handleResize();
        act(() => { jest.advanceTimersByTime(150); });

        expect(drew).not.toHaveBeenCalled();
        drew.mockRestore();
    });

    it('stops listening once unmounted', () => {
        const held = React.createRef();
        const { unmount } = render(<GraphExplorer ref={held} data={schema} />);
        const stopped = jest.spyOn(held.current.simulation, 'stop');

        unmount();

        expect(stopped).toHaveBeenCalled();
        stopped.mockRestore();
    });

    it('drops a pending resize once unmounted', () => {
        const held = React.createRef();
        const { unmount } = render(<GraphExplorer ref={held} data={schema} />);
        jest.useFakeTimers();
        const page = held.current;
        const applied = jest.spyOn(page, 'applyResize');

        page.handleResize();
        unmount();
        jest.advanceTimersByTime(150);

        expect(applied).not.toHaveBeenCalled();
        applied.mockRestore();
    });
});

describe('the drift', () => {
    //
    // the settled layout wanders a couple of pixels, so the page reads as live
    // rather than as a screenshot. jsdom paints no frames, so the animation frame
    // is replaced by a single pending callback the test advances by hand -- the
    // same treatment the per-tick work gets above.
    //
    // The loop only ever has one frame outstanding, which is why one slot is
    // enough, and why an outstanding frame after an unmount is a leak rather than
    // an ordinary state.
    //
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

    const home = (n) => ({ x: n.hx, y: n.hy });
    const away = (n) => Math.hypot(n.x - n.hx, n.y - n.hy);

    it('paints the settled layout before it moves anything', () => {
        //
        // the layout is computed to rest and fitted to the canvas, and THAT is what
        // the first frame shows. A node whose wander started at its own phase
        // rather than at zero would be a couple of pixels off the moment it was
        // drawn, and the fitted layout would be one nobody ever saw.
        //
        const { page } = setup();

        page.nodes.forEach((n) => {
            expect(n.x).toBe(home(n).x);
            expect(n.y).toBe(home(n).y);
        });
    });

    it('moves every node once the frames start', () => {
        const { page } = setup();

        frames(120);

        page.nodes.forEach((n) => {
            expect(away(n)).toBeGreaterThan(0);
        });
    });

    it('never takes a node further from home than the drift allows', () => {
        //
        // 1600 frames is several full turns of both terms, so this covers the
        // whole path rather than the start of it.
        //
        // The bound is twice DRIFT PER AXIS -- the circle starts at the node
        // instead of being centred on it, so each term ranges over [-2, 2] rather
        // than [-1, 1] -- which makes the bound on the DISTANCE the diagonal of
        // that square. Asserting 2 * DRIFT here passed only because the previous
        // speed never swept far enough to put a node near a corner.
        //
        const { page } = setup();

        frames(1600);

        page.nodes.forEach((n) => {
            expect(away(n)).toBeLessThanOrEqual(DRIFT * 2 * Math.SQRT2 + 1e-9);
        });
    });

    it('holds each node to its own home rather than letting the graph wander', () => {
        //
        // the offset is recomputed from the home each frame. Accumulated onto the
        // position instead, rounding would compound into a random walk and the
        // graph would leave its canvas over a long enough sitting.
        //
        const { page } = setup();
        const before = page.nodes.map(home);

        frames(1600);

        page.nodes.map(home).forEach((after, i) => {
            expect(after.x).toBe(before[i].x);
            expect(after.y).toBe(before[i].y);
        });
    });

    it('draws where the nodes actually are', () => {
        const { page } = setup();

        frames(400);

        circles().forEach((c, i) => {
            expect(Number(c.getAttribute('cx'))).toBeCloseTo(page.nodes[i].x);
            expect(Number(c.getAttribute('cy'))).toBeCloseTo(page.nodes[i].y);
        });
    });

    it('keeps the hit test agreeing with what is drawn', () => {
        //
        // the drift writes the node's OWN position rather than a drawing offset,
        // so simulation.find still answers with the node under the pointer. Written
        // as an offset, a reader would be pointing at where a node used to be.
        //
        const { page } = setup();

        frames(400);
        pointAt(page, 'bls_A');

        expect(card()).not.toBeNull();
        expect(card().textContent).toContain('A');
    });

    it('stops when the component goes away', () => {
        const { unmount } = render(<GraphExplorer data={schema} />);

        expect(pending).not.toBeNull();

        unmount();

        expect(cancelled).toHaveBeenCalled();
        expect(pending).toBeNull();
    });

    it('does not leave the old graph drifting when the data changes', () => {
        //
        // the frame closes over the node array it was started with. Left running,
        // it would go on writing positions onto circles the new render replaced.
        //
        const { page, rerender } = setup();
        const stale = page.nodes;

        rerender(<GraphExplorer data={{ ...schema, version: '2' }} />);
        frames(50);

        expect(page.nodes).not.toBe(stale);
        stale.forEach((n) => {
            expect(away(n)).toBe(0);
        });
    });

    it('does not move at all for a reader who asked for less motion', () => {
        const real = window.matchMedia;

        window.matchMedia = () => ({ matches: true });

        try {
            const { page } = setup();

            expect(pending).toBeNull();
            expect(page.drift).toBeNull();
            page.nodes.forEach((n) => {
                expect(Number.isFinite(n.x)).toBe(true);
            });
        } finally {
            window.matchMedia = real;
        }
    });

    it('asks for nothing when there is no graph to move', () => {
        setup({ data: null });

        expect(pending).toBeNull();
    });
});

describe('reducedMotion', () => {
    const real = window.matchMedia;

    afterEach(() => {
        window.matchMedia = real;
    });

    it('is false where the browser cannot be asked', () => {
        window.matchMedia = undefined;

        expect(reducedMotion()).toBe(false);
    });

    it('follows the media query', () => {
        window.matchMedia = (query) => ({ matches: query.includes('reduced-motion') });

        expect(reducedMotion()).toBe(true);
    });

    it('is false when the reader has expressed no preference', () => {
        window.matchMedia = () => ({ matches: false });

        expect(reducedMotion()).toBe(false);
    });
});
