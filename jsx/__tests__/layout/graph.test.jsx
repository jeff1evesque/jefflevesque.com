/**
 * graph.test.jsx: the graph explorer page.
 *
 * The page is a picker, a metadata panel, a legend and a canvas. What is worth
 * testing is how those four stay in agreement -- with each other and with the
 * build that is actually selected.
 *
 * On a narrow screen the metadata panel and the legend open and close, and start
 * closed. Which of the two forms is on screen is the stylesheet's decision, so it
 * is not observable here; what is, and is held, is that both panels start closed,
 * that each toggle opens its own panel only, and that the closed toggles still say
 * something about what is inside them.
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
import GraphLayout, { EXPLORER_NODE_TYPES, period } from '../../import/layout/graph/graph.jsx';
import { API_DOCS, knowledgeGraphUrl } from '../../import/general/api-url.js';

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
const toggle = (name) => screen.getByRole('button', { name: new RegExp(name) });

//
// the value beside a label in the build details, or undefined
//
function detail(label) {
    const row = [...document.querySelectorAll('.graph-details-row')]
        .find(r => r.querySelector('dt').textContent === label);

    return row ? row.querySelector('dd').textContent : undefined;
}

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

    it('calls the build total Nodes, because that is what it counts', async () => {
        //
        // the listing's figure is every node in the build. It was labelled 'Node
        // types' -- what each circle on the canvas is -- which made ten million of
        // them look like they were missing from a sixty-circle canvas.
        //
        await setup();

        expect(detail('Nodes')).toBe('9,884,064');
        expect(detail('Node types')).toBeUndefined();
    });

    it('gives the period as the days it covers', async () => {
        await setup();

        expect(detail('Period')).toBe('2026-09-01 – 2026-09-15');
    });

    it('marks the run and build times as UTC', async () => {
        await setup();

        expect(detail('Run')).toBe('2026-09-15 05:00 UTC');
        expect(detail('Built')).toBe('2026-09-15 06:37 UTC');
    });

    it('does not claim a zone for a time published without one', async () => {
        getGraphListing.mockResolvedValue({
            default: 'build-a',
            graphs: [{ ...BUILD_A, run: '2026-09-15T05:00:43', built: null }],
        });

        await setup();

        expect(detail('Run')).toBe('2026-09-15 05:00');
        expect(detail('Built')).toBe('n/a');
    });

    it('reads n/a for a total the listing did not carry', async () => {
        getGraphListing.mockResolvedValue({
            default: 'build-a',
            graphs: [{ ...BUILD_A, nodes: undefined, sources: undefined }],
        });

        await setup();

        expect(detail('Nodes')).toBe('n/a');
        expect(detail('Sources')).toBe('n/a');
    });
});

describe('period', () => {
    it('ends a build of the current month on the day it ran', () => {
        expect(period('2026-09', '2026-09-16T17:15:46Z')).toBe('2026-09-01 – 2026-09-16');
    });

    it('covers the whole month for a build run after it', () => {
        expect(period('2026-08', '2026-09-02T05:00:00Z')).toBe('2026-08-01 – 2026-08-31');
    });

    it('covers the whole month when the run is on its last day', () => {
        expect(period('2026-09', '2026-09-30T23:00:00Z')).toBe('2026-09-01 – 2026-09-30');
    });

    it('reads as one day for a build run on the first', () => {
        expect(period('2026-09', '2026-09-01T02:00:00Z')).toBe('2026-09-01');
    });

    it('takes the day in UTC, the zone the run is published in', () => {
        //
        // 01:00 UTC on the 16th is still the 15th in New York, where the suite runs.
        //
        expect(period('2026-09', '2026-09-16T01:00:00Z')).toBe('2026-09-01 – 2026-09-16');
    });

    it('knows the length of each month', () => {
        expect(period('2028-02', null)).toBe('2028-02-01 – 2028-02-29');
        expect(period('2026-02', null)).toBe('2026-02-01 – 2026-02-28');
        expect(period('2026-12', null)).toBe('2026-12-01 – 2026-12-31');
    });

    it('covers the whole month when there is no usable run time', () => {
        expect(period('2026-09', undefined)).toBe('2026-09-01 – 2026-09-30');
        expect(period('2026-09', 'not a time')).toBe('2026-09-01 – 2026-09-30');
    });

    it('ignores a run from before the period started', () => {
        expect(period('2026-09', '2026-08-20T00:00:00Z')).toBe('2026-09-01 – 2026-09-30');
    });

    it('passes a period in any other shape through as published', () => {
        expect(period('2026-Q3', '2026-09-16T17:15:46Z')).toBe('2026-Q3');
        expect(period('2026-13', null)).toBe('2026-13');
    });

    it('answers nothing for no period', () => {
        expect(period(undefined, '2026-09-16T17:15:46Z')).toBeNull();
        expect(period('', null)).toBeNull();
    });
});

describe('the panels', () => {
    it('start closed, so a phone opens on the graph', async () => {
        await setup();

        expect(toggle('Build details').getAttribute('aria-expanded')).toBe('false');
        expect(toggle('Legend').getAttribute('aria-expanded')).toBe('false');
    });

    it('keep their contents in the page while closed', async () => {
        //
        // a wide screen shows both panels regardless, so closing one hides it with the
        // stylesheet rather than removing it.
        //
        await setup();

        expect(document.querySelector('.graph-details')).not.toBeNull();
        expect(document.querySelector('.graph-legend')).not.toBeNull();
    });

    it('open and close from their toggles', async () => {
        await setup();

        fireEvent.click(toggle('Build details'));
        expect(toggle('Build details').getAttribute('aria-expanded')).toBe('true');
        expect(document.querySelector('.graph-panel-build'))
            .toHaveClass('graph-panel-open');

        fireEvent.click(toggle('Build details'));
        expect(toggle('Build details').getAttribute('aria-expanded')).toBe('false');
        expect(document.querySelector('.graph-panel-build'))
            .not.toHaveClass('graph-panel-open');
    });

    it('open one at a time', async () => {
        await setup();

        fireEvent.click(toggle('Legend'));

        expect(toggle('Legend').getAttribute('aria-expanded')).toBe('true');
        expect(toggle('Build details').getAttribute('aria-expanded')).toBe('false');
    });

    it('point each toggle at the body it controls', async () => {
        await setup();

        const button = toggle('Legend');
        const body = document.getElementById(button.getAttribute('aria-controls'));

        expect(body).not.toBeNull();
        expect(body.querySelector('.graph-legend')).not.toBeNull();
    });

    it('summarise the build on its closed toggle', async () => {
        await setup();

        expect(toggle('Build details').textContent).toContain('9.88M nodes');
    });

    it('count the namespaces on the closed legend toggle', async () => {
        await setup();

        expect(toggle('Legend').textContent).toContain('2 namespaces');
    });

    it('do not pluralise a single namespace', async () => {
        getGraphById.mockResolvedValue({
            node_types: { bls_A: { count: 1, source_type_uri: 'https://example.com/ontology/bls/A' } },
            edge_types: {},
        });

        await setup();

        expect(toggle('Legend').textContent).toContain('1 namespace');
        expect(toggle('Legend').textContent).not.toContain('namespaces');
    });

    it('leave the build toggle without a summary when there is no total', async () => {
        getGraphListing.mockResolvedValue({
            default: 'build-a',
            graphs: [{ ...BUILD_A, nodes: null }],
        });

        await setup();

        expect(document.querySelector('.graph-panel-build .graph-panel-summary')).toBeNull();
    });

    it('head the build column for the wide layout, where nothing toggles', async () => {
        await setup();

        expect(document.querySelector('.graph-panel-build .graph-panel-heading').textContent)
            .toBe('Build');
    });

    it('are absent when there is nothing to put in them', async () => {
        getGraphListing.mockResolvedValue(null);

        await setup();

        expect(document.querySelector('.graph-panel')).toBeNull();
    });
});

describe('the caption', () => {
    it('says how much of the build the canvas shows', async () => {
        getGraphById.mockResolvedValue(schemaOf(200));

        await setup();

        expect(document.querySelector('.graph-caption').textContent)
            .toContain(`${EXPLORER_NODE_TYPES} of 200 node types`);
    });

    it('says when the canvas shows all of it', async () => {
        await setup();

        expect(document.querySelector('.graph-caption').textContent).toContain('All 4 node types');
    });

    it('is absent while there is no graph', async () => {
        getGraphById.mockResolvedValue(null);

        await setup();

        expect(document.querySelector('.graph-caption')).toBeNull();
    });
});

describe('the legend', () => {
    it('lists the namespaces actually on screen', async () => {
        await setup();

        const namespaces = document.querySelector('.graph-legend-namespaces');
        expect(namespaces.textContent).toContain('bls');
        expect(namespaces.textContent).toContain('sec');
    });

    it('heads them Namespaces, not Sources', async () => {
        //
        // the build details list the build's sources under that name, and they are a
        // different list -- bls and sec there, jolts and eci here on a real build.
        //
        await setup();

        const headings = [...document.querySelectorAll('.graph-legend h6')].map(h => h.textContent);
        expect(headings).toEqual(['Namespaces', 'Edges']);
    });

    it('leaves the note blank for an origin it has no wording for', async () => {
        const schema = schemaOf(4);
        schema.edge_types.c = {
            src_type: 'bls_T0', dst_type: 'bls_T2', relation: 'r', origin: 'novel', count: 5,
        };
        getGraphById.mockResolvedValue(schema);

        await setup();

        const novel = [...document.querySelectorAll('.graph-legend-origins li')]
            .find(li => li.textContent.startsWith('novel'));
        expect(novel.querySelector('.graph-legend-note').textContent).toBe('');
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

describe('the api icons in the header', () => {
    it('link the knowledge graph api\'s documentation', async () => {
        await setup();

        expect(screen.getByRole('link', { name: 'API docs' }))
            .toHaveAttribute('href', API_DOCS.knowledgeGraph);
    });

    it('link the request for the build the picker has selected', async () => {
        await setup();

        expect(getGraphById).toHaveBeenLastCalledWith('build-a');
        expect(screen.getByRole('link', { name: 'This request' }))
            .toHaveAttribute('href', String(knowledgeGraphUrl('build-a')));
    });

    it('follow the picker to another build', async () => {
        await setup();

        await act(async () => {
            fireEvent.change(picker(), { target: { value: 'build-b' } });
        });

        expect(screen.getByRole('link', { name: 'This request' }))
            .toHaveAttribute('href', String(knowledgeGraphUrl('build-b')));
    });

    it('link the listing while no build is selected', async () => {
        //
        // when the listing itself could not be had there is no build to name, and the
        // listing request is the one worth opening.
        //
        getGraphListing.mockResolvedValue(null);

        await setup();

        expect(screen.getByRole('link', { name: 'This request' }))
            .toHaveAttribute('href', String(knowledgeGraphUrl()));
    });
});
