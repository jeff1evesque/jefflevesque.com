/**
 * graph-explorer.test.jsx: the knowledge graph drawn at full attention.
 *
 * Same d3 limits as the backdrop's suite: nothing ticks under jsdom, so per-tick
 * geometry is driven deliberately rather than waited for, and the physics itself
 * is d3's to test rather than this codebase's.
 *
 * What is worth holding here is the set of things this component does
 * DIFFERENTLY from the backdrop, because that difference is the only reason it
 * exists as a separate component:
 *
 *   - colour at rest rather than on hover
 *   - labels always visible
 *   - no decorative gray field
 *   - hovering emphasises a neighbourhood instead of shoving nodes away
 *
 * A regression in any of those turns this page back into the backdrop, which
 * renders fine and is useless to read.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';

import GraphExplorer from '../../import/animation/graph-explorer.jsx';

const schema = {
    version: '1',
    node_types: {
        bls_A: { count: 100, source_type_uri: 'https://example.com/ontology/bls/A' },
        bls_B: { count: 90, source_type_uri: 'https://example.com/ontology/bls/B' },
        sec_C: { count: 80, source_type_uri: 'https://example.com/ontology/sec/C' },
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
const labels = () => [...document.querySelectorAll('text')];

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

    it('labels every node type without being hovered', () => {
        //
        // the backdrop hides labels until hover because it sits behind hero text.
        // Somebody who opened this page should not have to interrogate it.
        //
        setup();

        expect(labels()).toHaveLength(TYPES.length);
        TYPES.forEach(type => expect(document.body.textContent).toContain(type));
    });

    it('draws one line per edge type', () => {
        setup();

        expect(document.querySelectorAll('line')).toHaveLength(2);
    });

    it('takes its height from the caller', () => {
        setup({ height: 420 });

        expect(document.querySelector('svg').getAttribute('height')).toBe('420');
    });

    it('falls back to a default height', () => {
        setup();

        expect(document.querySelector('svg').getAttribute('height')).toBe('600');
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

describe('hovering a node', () => {
    it('dims everything outside the neighbourhood', () => {
        const { page } = setup();

        page.highlight('sec_C');

        const dimmed = circles().filter(c => Number(c.getAttribute('opacity')) < 1);
        expect(dimmed.length).toBeGreaterThan(0);
    });

    it('keeps the hovered node and its neighbours at full strength', () => {
        //
        // bls_B touches both others, so hovering it leaves nothing dimmed.
        //
        const { page } = setup();

        page.highlight('bls_B');

        const dimmed = circles().filter(c => Number(c.getAttribute('opacity')) < 1);
        expect(dimmed).toHaveLength(0);
    });

    it('dims the labels alongside the nodes', () => {
        const { page } = setup();

        page.highlight('sec_C');

        expect(labels().some(t => Number(t.getAttribute('opacity')) < 1)).toBe(true);
    });

    it('lights the edges touching the hovered node', () => {
        const { page } = setup();

        page.highlight('bls_A');

        const opacities = [...document.querySelectorAll('line')]
            .map(l => Number(l.getAttribute('opacity')));

        expect(Math.max(...opacities)).toBeGreaterThan(0.9);
    });

    it('restores everything when the hover clears', () => {
        const { page } = setup();

        page.highlight('sec_C');
        page.highlight(null);

        circles().forEach(c => expect(Number(c.getAttribute('opacity'))).toBe(1));
    });

    it('is driven by the pointer entering a circle', () => {
        const { page } = setup();

        fireEvent.mouseEnter(circles()[0]);

        expect(page.hoveredId).toBe(TYPES[0]);
    });

    it('clears when the pointer leaves', () => {
        const { page } = setup();

        fireEvent.mouseEnter(circles()[0]);
        fireEvent.mouseLeave(circles()[0]);

        expect(page.hoveredId).toBeNull();
    });

    it('does nothing when there is no graph to highlight', () => {
        //
        // the guard exists because a hover can be requested before anything is drawn;
        // without it this throws on a null selection.
        //
        const held = React.createRef();
        render(<GraphExplorer ref={held} />);
        held.current.nodeSel = null;

        expect(() => held.current.highlight('anything')).not.toThrow();
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

    it('sits each label above its node', () => {
        const { page } = setup();
        const node = page.nodes[0];
        node.x = 300;
        node.y = 400;

        tick(page);

        const label = labels()[0];
        expect(Number(label.getAttribute('x'))).toBeCloseTo(300);
        expect(Number(label.getAttribute('y'))).toBeCloseTo(400 - node.r - 4);
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
        page.handleResize();

        expect(drew).not.toHaveBeenCalled();

        jest.advanceTimersByTime(150);

        expect(drew).toHaveBeenCalledTimes(1);
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
});
