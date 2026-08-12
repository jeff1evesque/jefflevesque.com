/**
 * graph-cluster.test.jsx: the node-type cluster on the home page.
 *
 * A d3 force simulation, so what can honestly be asserted here is narrower than
 * what the component does. Two limits, both worth stating rather than working
 * around:
 *
 *   - the simulation does not tick under jsdom. Every circle keeps the background
 *     radius, so the documented 'radius proportional to sqrt(node count)' is not
 *     observable from the DOM and is NOT asserted below. A test claiming to check
 *     it would be checking nothing.
 *
 *   - the cursor repeller, the hover reveal and the edge mesh are all
 *     pointer-driven physics. Asserting on them would mean asserting on d3's
 *     internals rather than on behaviour.
 *
 * What IS real and worth holding: the component reads its content from
 * graph-schema.mock.json, and every node type in that file has to reach the screen
 * with its count formatted for a reader. The docstring says the mock is to be
 * swapped for live data, so the mapping from schema to labels is the part that has
 * to survive that swap.
 */

import React from 'react';
import { render } from '@testing-library/react';

import GraphCluster from '../../import/animation/graph-cluster.jsx';
import schema from '../../import/animation/graph-schema.mock.json';

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
        // far more circles than there are node types: the coloured cluster sits in a
        // gray field of same-size nodes carrying no data, which the cluster then
        // carves a hole in.
        //
        render(<GraphCluster />);

        expect(document.querySelectorAll('circle').length).toBeGreaterThan(NODE_TYPES.length);
    });
});

describe('the schema reaches the screen', () => {
    it('labels every node type in the schema', () => {
        //
        // 24 types in the mock, and all 24 have to appear -- a partial render would
        // silently under-report the ontology.
        //
        render(<GraphCluster />);

        const text = bodyText();
        NODE_TYPES.forEach(type => expect(text).toContain(type));
    });

    it('renders exactly one label per node type', () => {
        render(<GraphCluster />);

        expect(document.querySelectorAll('text')).toHaveLength(NODE_TYPES.length);
    });

    it('shows the count for every node type', () => {
        render(<GraphCluster />);

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
        render(<GraphCluster />);

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
        render(<GraphCluster />);

        const smallest = Math.min(...NODE_TYPES.map(t => schema.node_types[t].count));
        expect(smallest).toBe(4);
        expect(bodyText()).toContain('· 4');
    });

    it('pairs each type with the count that belongs to it', () => {
        //
        // the label is 'type · count', so a mismatched pairing would still render 24
        // types and 24 counts while attributing them to the wrong types.
        //
        render(<GraphCluster />);

        const text = bodyText().replace(/\s+/g, ' ');

        ['cpi_Index', 'filings_Filing', 'market_EquityQuote'].forEach(type => {
            const count = schema.node_types[type].count.toLocaleString();
            expect(text).toContain(`${type} · ${count}`);
        });
    });
});

describe('the mock schema itself', () => {
    it('is the shape the component expects', () => {
        //
        // the docstring says to swap this file for a live feed, so its shape is a
        // contract rather than a fixture. A live feed missing 'count' would render
        // labels reading 'undefined'.
        //
        expect(schema).toHaveProperty('node_types');
        expect(NODE_TYPES.length).toBeGreaterThan(0);

        NODE_TYPES.forEach(type => {
            expect(typeof schema.node_types[type].count).toBe('number');
        });
    });

    it('is marked as mock data', () => {
        //
        // so a live swap is detectable: the flag is in the file rather than only in
        // the filename.
        //
        expect(schema.build_metadata.pipeline_config.mock).toBe(true);
    });
});
