/**
 * graph-cluster.test.jsx: the node-type cluster on the home page.
 *
 * A d3 force simulation, so what can honestly be asserted here is narrower than
 * what the component does. Two limits, both worth stating rather than working
 * around:
 *
 *   - the simulation does not tick under jsdom. Nothing moves and no frame is
 *     painted, so per-tick geometry is not observable here; it is driven
 *     deliberately in graph-cluster-interaction.test.jsx instead.
 *
 *   - the cursor repeller, the hover reveal and the edge mesh are all
 *     pointer-driven physics. Asserting on them would mean asserting on d3's
 *     internals rather than on behaviour.
 *
 * What IS real and worth holding, and what this file is now organised around:
 *
 *   - with no data the component draws its gray field and NOTHING else. That is
 *     the cold-load state and the failed-fetch state, and it is a deliberate
 *     choice over rendering a committed stand-in graph -- see the note in
 *     graph-cluster.jsx. A regression here would put a fabricated ontology on
 *     the front page whenever the api is slow, indistinguishable from the real
 *     one.
 *
 *   - given a schema, every node type in it reaches the screen with its count
 *     formatted for a reader.
 *
 * Note: the schema here is a FIXTURE, at __tests__/fixtures/. It used to live
 *       beside the component and ship in the bundle as the runtime fallback;
 *       now that there is no fallback, its only reader is the test suite, so it
 *       moved into it.
 */

import React from 'react';
import { render } from '@testing-library/react';

import GraphCluster from '../../import/animation/graph-cluster.jsx';
import schema from '../fixtures/graph-schema.mock.json';

const NODE_TYPES = Object.keys(schema.node_types);

function bodyText() {
    return document.body.textContent;
}

describe('mounting', () => {
    it('renders a single svg', () => {
        render(<GraphCluster />);

        expect(document.querySelectorAll('svg')).toHaveLength(1);
    });

    it('mounts without a ResizeObserver of its own', () => {
        //
        // setup.js stubs ResizeObserver because jsdom has none and the component
        // measures its container on mount. Without the stub this throws before
        // rendering anything.
        //
        expect(() => render(<GraphCluster />)).not.toThrow();
    });

    it('draws the decorative background field', () => {
        //
        // the gray field is drawn from the viewport, not from the schema, so it is
        // there whether or not a graph is.
        //
        render(<GraphCluster data={schema} />);

        expect(document.querySelectorAll('circle').length).toBeGreaterThan(NODE_TYPES.length);
    });
});

describe('with no data', () => {
    //
    // the cold-load and failed-fetch state. Both are the same arm on purpose: a
    // visitor cannot tell a slow api from a broken one, and neither can be told
    // apart from a stand-in graph, which is why there is no stand-in.
    //
    it('draws the gray field', () => {
        const { container } = render(<GraphCluster />);

        expect(container.querySelectorAll('circle').length).toBeGreaterThan(0);
    });

    it('draws no cluster node and no label', () => {
        const { container } = render(<GraphCluster />);

        expect(container.querySelectorAll('text')).toHaveLength(0);
        expect(bodyText()).toBe('');
    });

    it('holds an empty graph rather than a stand-in one', () => {
        const held = React.createRef();

        render(<GraphCluster ref={held} />);

        expect(held.current.nodes).toEqual([]);
        expect(held.current.links).toEqual([]);
    });

    it('treats a payload missing node_types as no data', () => {
        //
        // propTypes warns on this and does not block the render, so the component
        // has to answer for it rather than assume the shape.
        //
        const held = React.createRef();

        render(<GraphCluster ref={held} data={{ edge_types: {} }} />);

        expect(held.current.nodes).toEqual([]);
    });

    it('treats a payload missing edge_types as no data', () => {
        const held = React.createRef();

        render(<GraphCluster ref={held} data={{ node_types: {} }} />);

        expect(held.current.nodes).toEqual([]);
    });
});

describe('the schema reaches the screen', () => {
    it('labels every node type in the schema', () => {
        //
        // a partial render would silently under-report the ontology.
        //
        render(<GraphCluster data={schema} />);

        const text = bodyText();
        NODE_TYPES.forEach(type => expect(text).toContain(type));
    });

    it('renders exactly one label per node type', () => {
        render(<GraphCluster data={schema} />);

        expect(document.querySelectorAll('text')).toHaveLength(NODE_TYPES.length);
    });

    it('shows the count for every node type', () => {
        render(<GraphCluster data={schema} />);

        const text = bodyText();
        NODE_TYPES.forEach(type => {
            expect(text).toContain(schema.node_types[type].count.toLocaleString());
        });
    });

    it('formats counts with thousands separators', () => {
        //
        // these run to six figures (market_OptionQuote is 128,400), and an unseparated
        // '128400' is materially harder to read at a glance.
        //
        render(<GraphCluster data={schema} />);

        const text = bodyText();
        expect(text).toContain('42,800');
        expect(text).toContain('128,400');
        expect(text).not.toContain('42800');
        expect(text).not.toContain('128400');
    });

    it('shows small counts without a separator', () => {
        //
        // the other end of the range: two types sit at 4, and toLocaleString must
        // not decorate those.
        //
        render(<GraphCluster data={schema} />);

        const smallest = Math.min(...NODE_TYPES.map(t => schema.node_types[t].count));
        expect(smallest).toBe(4);
        expect(bodyText()).toContain('· 4');
    });

    it('pairs each type with the count that belongs to it', () => {
        //
        // the label is 'type · count', so a mismatched pairing would still render 24
        // types and 24 counts while attributing them to the wrong types.
        //
        render(<GraphCluster data={schema} />);

        const text = bodyText().replace(/\s+/g, ' ');

        ['cpi_Index', 'filings_Filing', 'market_EquityQuote'].forEach(type => {
            const count = schema.node_types[type].count.toLocaleString();
            expect(text).toContain(`${type} · ${count}`);
        });
    });
});

describe('data arriving after the first paint', () => {
    //
    // the normal case, not an edge case: the mount site starts its fetch in its own
    // componentDidMount, so this component's first render is always dataless and the
    // schema lands one or more ticks later. render() only ever returns the empty
    // <svg> -- the cluster is drawn imperatively -- so without componentDidUpdate the
    // graph would arrive and never be seen.
    //
    it('draws the cluster when data replaces nothing', () => {
        const { rerender } = render(<GraphCluster />);
        expect(document.querySelectorAll('text')).toHaveLength(0);

        rerender(<GraphCluster data={schema} />);

        expect(document.querySelectorAll('text')).toHaveLength(NODE_TYPES.length);
    });

    it('redraws when one schema replaces another', () => {
        const trimmed = {
            ...schema,
            node_types: { cpi_Index: schema.node_types.cpi_Index },
            edge_types: {},
        };
        const { rerender } = render(<GraphCluster data={schema} />);

        rerender(<GraphCluster data={trimmed} />);

        expect(document.querySelectorAll('text')).toHaveLength(1);
        expect(bodyText()).toContain('cpi_Index');
    });

    it('does not redraw when the same data is passed again', () => {
        //
        // a re-render with an unchanged prop is common -- any parent setState causes
        // one -- and redrawing there would restart the simulation and visibly reset
        // the layout mid-animation.
        //
        const held = React.createRef();
        const { rerender } = render(<GraphCluster ref={held} data={schema} />);
        const before = held.current.simulation;

        rerender(<GraphCluster ref={held} data={schema} />);

        expect(held.current.simulation).toBe(before);
    });

    it('stops the previous simulation when it redraws', () => {
        //
        // renderD3 clears the svg, but a running simulation keeps its own node array
        // and goes on ticking against detached elements -- two sims then write to the
        // same selections and the cluster jitters between two layouts.
        //
        const held = React.createRef();
        const { rerender } = render(<GraphCluster ref={held} data={schema} />);
        const stopped = jest.spyOn(held.current.simulation, 'stop');

        rerender(<GraphCluster ref={held} data={{ ...schema }} />);

        expect(stopped).toHaveBeenCalled();
        stopped.mockRestore();
    });
});

describe('arriving at rest', () => {
    //
    // the cluster used to be drawn around the svg's top-left corner -- where d3
    // places nodes that arrive without a position -- and dragged to the middle of
    // the screen in full view. It now starts in the middle and is run to rest
    // before the first frame, so these read the component straight after mounting,
    // with no tick dispatched: what is here is what the first frame paints.
    //
    function mounted() {
        const held = React.createRef();
        render(<GraphCluster ref={held} data={schema} />);

        return held.current;
    }

    it('has every node drawn in place before the first frame', () => {
        const page = mounted();

        page.nodeSel.nodes().forEach(circle => {
            expect(circle.getAttribute('cx')).not.toBeNull();
            expect(Number.isFinite(Number(circle.getAttribute('cy')))).toBe(true);
        });
    });

    it('sits in the middle of the screen, not in its corner', () => {
        const page = mounted();
        const across = page.nodes.reduce((sum, n) => sum + n.x, 0) / page.nodes.length;
        const down = page.nodes.reduce((sum, n) => sum + n.y, 0) / page.nodes.length;

        expect(Math.abs(across - window.innerWidth / 2)).toBeLessThan(window.innerWidth * 0.1);
        expect(Math.abs(down - window.innerHeight / 2)).toBeLessThan(window.innerHeight * 0.1);
    });

    it('has already settled down to its ambient drift', () => {
        const page = mounted();
        const sim = page.simulation;

        expect(sim.alpha() - sim.alphaTarget()).toBeLessThanOrEqual(sim.alphaMin());
    });

    it('draws the gray field on that same frame', () => {
        const page = mounted();

        page.bgNodeSel.nodes().forEach(circle => {
            expect(circle.getAttribute('cx')).not.toBeNull();
        });
        expect(page.snapField).toBe(false);
    });
});

describe('the gray field when the graph arrives', () => {
    //
    // the graph lands a moment after the first paint, and the whole svg is drawn again
    // when it does. Sampling a new field there scattered every gray node on screen at
    // once, in the same instant the cluster appeared.
    //
    it('is kept rather than scattered afresh', () => {
        const held = React.createRef();
        const { rerender } = render(<GraphCluster ref={held} />);
        const field = held.current.background;

        rerender(<GraphCluster ref={held} data={schema} />);

        expect(held.current.background).toBe(field);
        expect(held.current.bgNodeSel.nodes()).toHaveLength(field.nodes.length);
    });

    it('is sampled afresh if the screen changed shape before the graph arrived', () => {
        const width = window.innerWidth;
        const held = React.createRef();
        const { rerender } = render(<GraphCluster ref={held} />);
        const field = held.current.background;

        try {
            window.innerWidth = width + 300;
            rerender(<GraphCluster ref={held} data={schema} />);
        } finally {
            window.innerWidth = width;
        }

        expect(held.current.background).not.toBe(field);
    });
});

describe('the fixture itself', () => {
    it('is the shape the component expects', () => {
        //
        // the live payload is a strict superset of this, so a fixture that drifts out
        // of shape would test a contract the service does not answer with.
        //
        expect(schema).toHaveProperty('node_types');
        expect(NODE_TYPES.length).toBeGreaterThan(0);

        NODE_TYPES.forEach(type => {
            expect(typeof schema.node_types[type].count).toBe('number');
        });
    });

    it('is marked as mock data', () => {
        //
        // the flag is in the file rather than only in the filename, so this fixture can
        // never be mistaken for a captured live build. The live schema carries no
        // 'mock' key at all.
        //
        expect(schema.build_metadata.pipeline_config.mock).toBe(true);
    });
});

//
// a schema whose node types are exactly `ids`, with descending counts and no edges.
// `uris` optionally supplies a source_type_uri per id.
//
function schemaWith(ids, uris = {}) {
    const node_types = {};
    ids.forEach((id, i) => {
        node_types[id] = {
            count: ids.length - i,
            category: 'entity',
            source_type_uri: uris[id],
        };
    });

    return { version: '1', node_types: node_types, edge_types: {} };
}

function fillsOf(data) {
    const held = React.createRef();
    render(<GraphCluster ref={held} data={data} />);

    return new Map(
        held.current.nodeSel.nodes().map((n, i) => [
            held.current.nodes[i].id,
            n.getAttribute('fill'),
        ])
    );
}

describe('what the cluster is colored by', () => {
    //
    // category was the original channel and carried nothing: every node type in a
    // published build arrives as 'entity', so the whole cluster resolved to one hue
    // while still looking like a working encoding.
    //
    it('does not collapse when every category is identical', () => {
        const fills = fillsOf(schemaWith(['bls_A', 'sec_B', 'market_C']));

        expect(new Set(fills.values()).size).toBe(3);
    });

    it('gives every type in one namespace the same color', () => {
        const fills = fillsOf(schemaWith(['bls_A', 'bls_B', 'sec_C']));

        expect(fills.get('bls_A')).toBe(fills.get('bls_B'));
        expect(fills.get('bls_A')).not.toBe(fills.get('sec_C'));
    });

    it('colors from the uri when one is given, not the id', () => {
        //
        // the uri is the authority: an id whose prefix disagrees with its ontology
        // namespace should follow the ontology.
        //
        const fills = fillsOf(schemaWith(
            ['odd_A', 'bls_B'],
            { odd_A: 'https://example.com/ontology/bls/Thing' }
        ));

        expect(fills.get('odd_A')).toBe(fills.get('bls_B'));
    });

    it('paints the tail of a wide build a single color', () => {
        const ids = [...Array(12)].map((_, i) => `ns${String(i).padStart(2, '0')}_T`);
        const fills = fillsOf(schemaWith(ids));

        const tail = ids.slice(8).map(id => fills.get(id));
        expect(new Set(tail).size).toBe(1);
    });
});

describe('how far apart the simulation holds a linked pair', () => {
    //
    // the accessor is pulled off the force and called directly. Nothing ticks under
    // jsdom, so this is the only way to observe the distance the layout would use.
    //
    function distanceFn() {
        const held = React.createRef();
        render(<GraphCluster ref={held} data={schema} />);

        return held.current.simulation.force('link').distance();
    }

    it('scales with the edge count', () => {
        const distance = distanceFn();

        expect(distance({ count: 10_000 })).toBeGreaterThan(distance({ count: 100 }));
    });

    it('clamps the heaviest edge rather than letting it stretch', () => {
        //
        // a published build runs to nearly ten million on one edge against a median in
        // the hundreds, which unclamped put that link 528px long beside a 62px median
        // -- one node tethered half a screen away, dragging the layout off centre.
        //
        const distance = distanceFn();

        expect(distance({ count: 9_749_369 })).toBe(160);
        expect(distance({ count: 100_000_000 })).toBe(160);
    });

    it('leaves an ordinary edge unclamped', () => {
        const distance = distanceFn();

        expect(distance({ count: 266 })).toBeCloseTo(60 + Math.sqrt(266) * 0.15);
    });

    it('gives a countless link the fixed background tether', () => {
        //
        // a bare Math.sqrt(undefined) is NaN, which would poison the position of every
        // node the link touches.
        //
        const distance = distanceFn();

        expect(distance({})).toBe(40);
        expect(Number.isNaN(distance({}))).toBe(false);
    });
});
