/**
 * graph.test.jsx: the graph explorer page.
 *
 * The page is a picker, a metadata panel, a legend and a canvas. What is worth
 * testing is how those four stay in agreement -- with each other and with the
 * build that is actually selected.
 *
 * The misleading case is the one to hold hardest: a load that fails while the
 * previous build is still on screen. A stale graph under a fresh label is
 * indistinguishable from a correct answer, so it must be cleared rather than
 * left, and the failure has to say so.
 *
 * Note: GraphExplorer is mocked as a probe that records what reached its `data`
 *       prop. It has its own suite, and rendering a real d3 simulation here
 *       would make every assertion below depend on it.
 *
 * Note: filter-schema is NOT mocked. The page's job includes asking for the
 *       right sized slice, and a mocked filter would let a wrong limit pass.
 */

import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';

jest.mock('../../import/animation/graph-explorer.jsx', () => ({
    __esModule: true,
    default: ({ data }) => (
        <div
            data-testid='explorer'
            data-types={data ? Object.keys(data.node_types).length : 'none'}
        />
    ),
    TAIL: 'shade',
}));

jest.mock('../../import/general/get-graph-schema.js', () => ({
    __esModule: true,
    getGraphListing: jest.fn(),
    getGraphById: jest.fn(),
}));

import { getGraphListing, getGraphById } from '../../import/general/get-graph-schema.js';
import GraphLayout, { EXPLORER_NODE_TYPES } from '../../import/layout/graph/graph.jsx';

const BUILD_A = {
    id: 'build-a',
    label: 'September 2026 (a)',
    dataset: 'all-sources',
    period: '2026-09',
    variant: '1024d',
    run: '2026-09-15T05:00:43Z',
    built: '2026-09-15T06:37:02Z',
    nodes: 9_884_064,
    edges: 73_967_362,
    sources: ['bls', 'sec'],
    error: null,
};

const BUILD_B = { ...BUILD_A, id: 'build-b', label: 'September 2026 (b)', period: '2026-08' };
const BUILD_BROKEN = { ...BUILD_A, id: 'build-broken', label: 'Broken build', error: 'malformed' };

const LISTING = { default: 'build-a', graphs: [BUILD_A, BUILD_B] };

//
// a schema with `n` node types across two namespaces, so the legend has something
// to enumerate and the filter has something to cut.
//
function schemaOf(n) {
    const node_types = {};
    for (let i = 0; i < n; i++) {
        const ns = i % 2 === 0 ? 'bls' : 'sec';
        node_types[`${ns}_T${i}`] = {
            count: n - i,
            source_type_uri: `https://example.com/ontology/${ns}/T${i}`,
        };
    }

    return {
        version: '1',
        node_types: node_types,
        edge_types: {
            a: { src_type: 'bls_T0', dst_type: 'sec_T1', relation: 'r', origin: 'raw', count: 5 },
            b: { src_type: 'sec_T1', dst_type: 'bls_T2', relation: 'r', origin: 'enrichment', count: 5 },
        },
    };
}

async function setup() {
    let utils;

    await act(async () => {
        utils = render(<GraphLayout />);
    });

    return utils;
}

const explorer = () => document.querySelector('[data-testid="explorer"]');
const picker = () => screen.getByLabelText('Published build');

beforeEach(() => {
    jest.clearAllMocks();
    getGraphListing.mockResolvedValue(LISTING);
    getGraphById.mockResolvedValue(schemaOf(4));
});

describe('loading the page', () => {
    it('asks for the listing on mount', async () => {
        await setup();

        expect(getGraphListing).toHaveBeenCalledTimes(1);
    });

    it('selects the build the service calls default', async () => {
        await setup();

        expect(getGraphById).toHaveBeenCalledWith('build-a');
    });

    it('falls back to the first build when there is no default', async () => {
        //
        // 'default' is null when the service has nothing it considers servable. The
        // page still has builds to show, so it shows one rather than an error.
        //
        getGraphListing.mockResolvedValue({ default: null, graphs: [BUILD_B] });

        await setup();

        expect(getGraphById).toHaveBeenCalledWith('build-b');
    });

    it('draws the graph once it arrives', async () => {
        await setup();

        expect(explorer()).toBeTruthy();
    });
});

describe('the picker', () => {
    it('offers every build the listing returned', async () => {
        await setup();

        expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    it('labels each build the way the listing does', async () => {
        await setup();

        expect(screen.getByRole('option', { name: 'September 2026 (a)' })).toBeTruthy();
    });

    it('swaps the graph when another build is chosen', async () => {
        await setup();
        getGraphById.mockResolvedValue(schemaOf(3));

        await act(async () => {
            fireEvent.change(picker(), { target: { value: 'build-b' } });
        });

        expect(getGraphById).toHaveBeenLastCalledWith('build-b');
        expect(explorer().getAttribute('data-types')).toBe('3');
    });

    it('marks an unusable build rather than hiding it', async () => {
        //
        // a build the service flagged is still part of the record. Dropping it would
        // make the listing look shorter than it is; offering it would fail on click.
        //
        getGraphListing.mockResolvedValue({ default: 'build-a', graphs: [BUILD_A, BUILD_BROKEN] });

        await setup();

        const broken = screen.getByRole('option', { name: /Broken build/ });
        expect(broken).toBeDisabled();
        expect(broken.textContent).toContain('unavailable');
    });
});

describe('the build details', () => {
    it('describes the selected build', async () => {
        await setup();

        expect(document.body.textContent).toContain('2026-09');
        expect(document.body.textContent).toContain('all-sources');
        expect(document.body.textContent).toContain('1024d');
    });

    it('reads the totals from the listing, not from the drawn slice', async () => {
        //
        // the panel describes the BUILD. Reporting the filtered slice's size would
        // tell a reader the graph is sixty types big, which it is not.
        //
        await setup();

        expect(document.body.textContent).toContain('9,884,064');
    });

    it('follows the picker', async () => {
        await setup();

        await act(async () => {
            fireEvent.change(picker(), { target: { value: 'build-b' } });
        });

        expect(document.body.textContent).toContain('2026-08');
    });

    it('names the sources that went into the build', async () => {
        await setup();

        expect(document.body.textContent).toContain('bls, sec');
    });
});

describe('the legend', () => {
    it('lists the namespaces actually on screen', async () => {
        await setup();

        const sources = document.querySelector('.graph-legend-sources');
        expect(sources.textContent).toContain('bls');
        expect(sources.textContent).toContain('sec');
    });

    it('lists the origins actually on screen', async () => {
        //
        // built from the rendered graph rather than from a fixed list, so it cannot
        // describe a relationship the drawn graph does not contain.
        //
        await setup();

        const origins = document.querySelector('.graph-legend-origins');
        expect(origins.textContent).toContain('raw');
        expect(origins.textContent).toContain('enrichment');
        expect(origins.textContent).not.toContain('unification');
    });

    it('gives each namespace its own swatch', async () => {
        await setup();

        const swatches = [...document.querySelectorAll('.graph-legend-swatch')];
        const colours = new Set(swatches.map(s => s.style.backgroundColor));

        expect(swatches).toHaveLength(2);
        expect(colours.size).toBe(2);
    });

    it('is absent when there is no graph', async () => {
        getGraphById.mockResolvedValue(null);

        await setup();

        expect(document.querySelector('.graph-legend')).toBeNull();
    });
});

describe('the size of the slice', () => {
    it('draws more than the front page does', async () => {
        getGraphById.mockResolvedValue(schemaOf(200));

        await setup();

        expect(explorer().getAttribute('data-types')).toBe(String(EXPLORER_NODE_TYPES));
    });

    it('draws a small build whole', async () => {
        getGraphById.mockResolvedValue(schemaOf(5));

        await setup();

        expect(explorer().getAttribute('data-types')).toBe('5');
    });
});

describe('when something cannot be loaded', () => {
    it('says so when the listing fails', async () => {
        getGraphListing.mockResolvedValue(null);

        await setup();

        expect(document.body.textContent).toContain('could not be listed');
        expect(explorer()).toBeNull();
    });

    it('says so when the listing is empty', async () => {
        getGraphListing.mockResolvedValue({ default: null, graphs: [] });

        await setup();

        expect(document.body.textContent).toContain('could not be listed');
    });

    it('says so when the selected build fails', async () => {
        getGraphById.mockResolvedValue(null);

        await setup();

        expect(document.body.textContent).toContain('could not be loaded');
    });

    it('clears the graph rather than leaving a stale one', async () => {
        //
        // the misleading case: a previous build still drawn under the new build's
        // label reads as a correct answer, and a reader has no way to tell.
        //
        await setup();
        expect(explorer()).toBeTruthy();

        getGraphById.mockResolvedValue(null);

        await act(async () => {
            fireEvent.change(picker(), { target: { value: 'build-b' } });
        });

        expect(explorer()).toBeNull();
        expect(document.body.textContent).toContain('could not be loaded');
    });

    it('treats a malformed schema as a failure', async () => {
        //
        // filterSchema answers null for anything unusable, so a body that arrived but
        // is not a graph lands in the same state as a request that never returned.
        //
        getGraphById.mockResolvedValue({ version: '1' });

        await setup();

        expect(document.body.textContent).toContain('could not be loaded');
    });
});
