/**
 * graph.test.jsx: the graph explorer page.
 *
 * The page is a picker, a metadata panel, a legend and a canvas. What is worth
 * testing is how those four stay in agreement -- with each other and with the
 * build that is actually selected.
 *
 * The metadata panel and the legend open and close at every width, and start open
 * only where there is room for all three columns at once. How wide the screen is,
 * and therefore where anything is PLACED, is the stylesheet's decision and is not
 * observable here; what is, and is held, is which panels start open, that each
 * toggle opens its own panel only, that the closed toggles still say something
 * about what is inside them, and that a folded panel keeps both its contents and
 * its place in the document outline.
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

//
// Note: the probe records what the legend asked the canvas to emphasise, and
//       calls back on a click the way the real canvas does. What the explorer
//       DOES with an emphasis is its own suite's business; what matters here is
//       that the legend and the canvas agree on one at a time.
//
jest.mock('../../import/animation/graph-explorer.jsx', () => ({
    __esModule: true,
    default: ({ data, emphasis, onClear }) => (
        <div
            data-testid='explorer'
            data-types={data ? Object.keys(data.node_types).length : 'none'}
            data-emphasis={emphasis ? `${emphasis.kind}:${emphasis.value}` : 'none'}
            onClick={onClear}
        />
    ),
    TAIL: 'shade',
}));

//
// Note: the tables are a probe too, recording what reached them. They have their
//       own suite; what matters HERE is which document the page hands down --
//       the whole build, not the slice the canvas drew.
//
jest.mock('../../import/layout/graph/tables.jsx', () => ({
    __esModule: true,
    default: ({ schema, drawn, painted }) => (
        <div
            data-testid='tables'
            data-node-types={schema ? Object.keys(schema.node_types).length : 'none'}
            data-drawn={drawn ? Object.keys(drawn.node_types).length : 'none'}
            data-painted={painted ? painted.size : 'none'}
        />
    ),
}));

jest.mock('../../import/general/get-graph-schema.js', () => ({
    __esModule: true,
    getGraphListing: jest.fn(),
    getGraphById: jest.fn(),
}));

import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getGraphListing, getGraphById } from '../../import/general/get-graph-schema.js';
import GraphLayout, { EXPLORER_NODE_TYPES } from '../../import/layout/graph/graph.jsx';
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

//
// Note: BUILD_B differs in its VARIANT as well as its id. It used to differ only
//       by period, and with no Period row the two builds became indistinguishable
//       in the panel -- so 'follows the picker' passed against a panel that had
//       not changed.
//
const BUILD_B = {
    ...BUILD_A,
    id: 'build-b',
    label: 'September 2026 (b)',
    period: '2026-08',
    variant: '512d',
};
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

//
// rendered inside a router at a real address: the page reads its build from the
// path, so a bare render would be testing it without the input it takes.
//
async function setup(path = '/graph') {
    let utils;

    await act(async () => {
        utils = render(
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path='/graph' element={<GraphLayout />} />
                    <Route path='/graph/:graph' element={<GraphLayout />} />
                </Routes>
            </MemoryRouter>
        );
    });

    return utils;
}

const explorer = () => document.querySelector('[data-testid="explorer"]');
const picker = () => screen.getByRole('combobox', { name: 'Published build' });
const toggle = (name) => screen.getByRole('button', { name: new RegExp(name) });

//
// the picker is a mui Select: an element with role='combobox' and a menu that
// is portalled into the document only while it is open. So a test that reads or
// chooses an option opens the menu first, where against a <select> it fired one
// change event at the control.
//
// Note: chosen by `data-value`, which is the build id mui puts on each item, so
//       these read the same as the change events they replace -- by id, not by
//       whatever the option happens to be labelled.
//
async function openPicker() {
    await act(async () => {
        fireEvent.mouseDown(picker());
    });

    return screen.getAllByRole('option');
}

async function chooseBuild(id) {
    await openPicker();

    await act(async () => {
        fireEvent.click(document.querySelector(`[role='option'][data-value='${id}']`));
    });
}

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

    it('selects the build the address names', async () => {
        await setup('/graph/build-b');

        expect(getGraphById).toHaveBeenCalledWith('build-b');
        expect(getGraphById).not.toHaveBeenCalledWith('build-a');
    });

    it('falls back to the default for an id the listing does not hold', async () => {
        //
        // a link to a build that has since rolled off is an ordinary thing to
        // find in a bookmark. The page still has something true to draw, and
        // the picker shows what it drew instead.
        //
        await setup('/graph/build-gone');

        expect(getGraphById).toHaveBeenCalledWith('build-a');
        expect(getGraphById).not.toHaveBeenCalledWith('build-gone');
    });

    it('decodes an id the address carries encoded', async () => {
        getGraphListing.mockResolvedValue({
            default: 'build-a',
            graphs: [{ ...BUILD_A, id: 'build a/b' }, BUILD_B],
        });

        await setup(`/graph/${encodeURIComponent('build a/b')}`);

        expect(getGraphById).toHaveBeenCalledWith('build a/b');
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

describe('the tables below the graph', () => {
    //
    // the page fetched the whole schema in order to draw a slice of it, and used
    // to discard the rest on the line that measured it -- keeping one integer so
    // the caption could report the size of what it had thrown away.
    //
    const tables = () => document.querySelector('[data-testid="tables"]');

    it('are handed the whole build, not the slice the canvas drew', async () => {
        getGraphById.mockResolvedValue(schemaOf(200));

        await setup();

        expect(tables().getAttribute('data-node-types')).toBe('200');
        expect(explorer().getAttribute('data-types')).toBe(String(EXPLORER_NODE_TYPES));
    });

    it('are told which types the canvas is drawing', async () => {
        getGraphById.mockResolvedValue(schemaOf(200));

        await setup();

        expect(tables().getAttribute('data-drawn')).toBe(String(EXPLORER_NODE_TYPES));
    });

    it('are handed the canvas\'s own colour assignment', async () => {
        //
        // so a swatch in a row is the colour that namespace is in the graph above
        // it. Recomputed over all 200 types it would rank them differently and
        // paint something else.
        //
        await setup();

        expect(tables().getAttribute('data-painted')).toBe('2');
    });

    it('cost the page no extra request', async () => {
        //
        // the listing, and the build the picker selected. Adding the tables added
        // neither a third call nor a second copy of either.
        //
        getGraphById.mockResolvedValue(schemaOf(200));

        await setup();

        expect(getGraphListing).toHaveBeenCalledTimes(1);
        expect(getGraphById).toHaveBeenCalledTimes(1);
    });

    it('are cleared when a build fails to load', async () => {
        //
        // the same rule the canvas follows: a stale table under a fresh label is
        // indistinguishable from a correct one.
        //
        getGraphById.mockResolvedValue(null);

        await setup();

        expect(tables().getAttribute('data-node-types')).toBe('none');
    });

    it('follow the picker to another build', async () => {
        getGraphById.mockResolvedValue(schemaOf(200));

        await setup();

        getGraphById.mockResolvedValue(schemaOf(7));

        await chooseBuild('build-b');

        expect(tables().getAttribute('data-node-types')).toBe('7');
    });
});

describe('the picker', () => {
    it('offers every build the listing returned', async () => {
        await setup();

        expect(await openPicker()).toHaveLength(2);
    });

    //
    // the listing labels a build with a sentence -- 'September 2026
    // (all-sources, 1024d, run 2026-09-19 05:00 UTC)' -- and the builds it
    // returns differ only in the last few characters of it. Seven of those made
    // a 466px control beside the page heading, and a phone's option list a
    // screenful of wrapped paragraphs to choose between builds that read as
    // identical until their end. Every constant part of that sentence is in the
    // build panel directly below the picker.
    //
    it('labels a build by the run time that tells it from the others', async () => {
        getGraphListing.mockResolvedValue({
            default: 'build-a',
            graphs: [BUILD_A, { ...BUILD_A, id: 'build-c', run: '2026-09-18T05:00:00Z' }],
        });

        await setup();
        await openPicker();

        expect(screen.getByRole('option', { name: '2026-09-15 05:00 UTC' })).toBeTruthy();
        expect(screen.getByRole('option', { name: '2026-09-18 05:00 UTC' })).toBeTruthy();
    });

    it('adds the field that varies when the run time is not the whole difference', async () => {
        //
        // the two builds in the listing were run at the same time and differ by
        // variant, so the variant is part of what an option has to say. Neither
        // is named when every build is the same, which is the published case.
        //
        await setup();
        await openPicker();

        expect(screen.getByRole('option', { name: '2026-09-15 05:00 UTC · 1024d' })).toBeTruthy();
        expect(screen.getByRole('option', { name: '2026-09-15 05:00 UTC · 512d' })).toBeTruthy();
    });

    it('says nothing about the period, which is a partition key', async () => {
        //
        // the same reason the build panel has no Period row: it is the partition
        // the builds were listed out of, not a window over what is in them, and
        // an option ending '2026-08' reads as though it bounded something.
        //
        await setup();
        const options = await openPicker();

        expect(options.map((one) => one.textContent).join()).not.toContain('2026-08');
    });

    it('keeps the listing labels when the short ones would name two builds', async () => {
        //
        // two builds run in the same minute, of the same dataset and variant,
        // derive one label between them. A shorter label is worth having; one
        // that names two different builds is not.
        //
        getGraphListing.mockResolvedValue({
            default: 'build-a',
            graphs: [BUILD_A, { ...BUILD_A, id: 'build-c', label: 'September 2026 (c)' }],
        });

        await setup();
        await openPicker();

        expect(screen.getByRole('option', { name: 'September 2026 (a)' })).toBeTruthy();
        expect(screen.getByRole('option', { name: 'September 2026 (c)' })).toBeTruthy();
    });

    it('falls back to the listing label for a build with no run time', async () => {
        getGraphListing.mockResolvedValue({
            default: 'build-a',
            graphs: [BUILD_A, { ...BUILD_A, id: 'build-c', label: 'Run unrecorded', run: null }],
        });

        await setup();
        await openPicker();

        expect(screen.getByRole('option', { name: 'Run unrecorded' })).toBeTruthy();
        expect(screen.getByRole('option', { name: '2026-09-15 05:00 UTC' })).toBeTruthy();
    });

    it('swaps the graph when another build is chosen', async () => {
        await setup();
        getGraphById.mockResolvedValue(schemaOf(3));

        await chooseBuild('build-b');

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
        await openPicker();

        const broken = screen.getByRole('option', { name: /Broken build/ });
        expect(broken).toHaveAttribute('aria-disabled', 'true');
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

        await chooseBuild('build-b');

        expect(detail('Variant')).toBe('512d');
    });

    it('puts the chosen build in the address, so it can be linked to', async () => {
        //
        // the selection used to live only in component state, which meant it had
        // no address: nothing to share, and the back button did not move between
        // builds.
        //
        await setup();

        await chooseBuild('build-b');

        expect(getGraphById).toHaveBeenLastCalledWith('build-b');
        expect(picker()).toHaveTextContent('2026-09-15 05:00 UTC · 512d');
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

    it('does not offer a Period row at all', async () => {
        //
        // the listing's `period` is a partition key -- the builds are listed out
        // of a partition and an id is chosen from within it -- not a window over
        // the data. This build carries 76 distinct dates and economic series going
        // back eighteen years, so '2026-09' bounds none of it, and a row headed
        // 'Period' read as though it did.
        //
        await setup();

        expect(detail('Period')).toBeUndefined();
        expect([...document.querySelectorAll('.graph-details-row dt')].map(d => d.textContent))
            .toEqual(['Nodes', 'Edges', 'Sources', 'Run', 'Built', 'Dataset', 'Variant']);
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

describe('the panels', () => {
    it('start closed, so a phone opens on the graph', async () => {
        await setup();

        expect(toggle('Build details').getAttribute('aria-expanded')).toBe('false');
        expect(toggle('Legend').getAttribute('aria-expanded')).toBe('false');
    });

    it('start open on a wide screen, which has room for all three columns', async () => {
        //
        // one piece of state answering to two defaults. jsdom does not implement
        // matchMedia at all, which is why the case above sees the closed default
        // and why this one has to supply the query itself.
        //
        window.matchMedia = jest.fn().mockReturnValue({ matches: true });

        try {
            await setup();

            expect(toggle('Build details').getAttribute('aria-expanded')).toBe('true');
            expect(toggle('Legend').getAttribute('aria-expanded')).toBe('true');
        } finally {
            delete window.matchMedia;
        }
    });

    it('fold away without being unmounted, so the graph keeps its colours', async () => {
        //
        // the explorer beside them reads its palette from the same render, so a
        // panel is hidden by the stylesheet rather than removed by react.
        //
        await setup();

        expect(document.querySelector('.graph-details')).not.toBeNull();
        expect(document.querySelector('.graph-legend')).not.toBeNull();
    });

    it('sit in the same grid as the title, so the layout can place both', async () => {
        //
        // the header is a grid ITEM rather than a row above the grid -- that is
        // what lets it stack first on a phone and sit over the middle column on a
        // wide screen without the markup differing. If it drifts back outside
        // '.graph-layout' the areas naming it stop applying and it silently
        // returns to heading the left column.
        //
        await setup();

        expect(document.querySelector('.graph-layout > .graph-header')).not.toBeNull();
        expect(document.querySelector('.graph-layout > .graph-panel-build')).not.toBeNull();
        expect(document.querySelector('.graph-layout > .graph-canvas')).not.toBeNull();
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

    it('drop the summary once the panel is open, leaving the heading the line', async () => {
        //
        // the summary is what a FOLDED panel says instead of its contents, so it
        // is gone once the contents are there. Open, it was a second copy of
        // something one or two lines below it -- '9.88M nodes' over the Nodes
        // row, '2 namespaces' over a list of two namespaces -- and on a wide
        // screen the pair shared a 16rem column, which wrapped 'Legend' and its
        // count onto two lines to say one thing twice.
        //
        await setup();

        fireEvent.click(toggle('Legend'));

        expect(document.querySelector('.graph-panel-legend .graph-panel-summary')).toBeNull();
        expect(document.querySelector('.graph-panel-build .graph-panel-summary')).not.toBeNull();
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

    it('keep each column in the document outline while it is folded away', async () => {
        //
        // the toggle sits INSIDE the heading rather than replacing it. Both
        // columns now fold at every width, and a bare button is not a heading --
        // a reader navigating this page by headings would otherwise find the
        // graph and the tables and nothing that names either reference column.
        //
        await setup();

        ['build', 'legend'].forEach((key) => {
            const heading = document.querySelector(`.graph-panel-${key} .graph-panel-heading`);

            expect(heading.tagName).toBe('H6');
            expect(heading.querySelector('.graph-panel-toggle')).not.toBeNull();
        });
    });

    it('are absent when there is nothing to put in them', async () => {
        getGraphListing.mockResolvedValue(null);

        await setup();

        expect(document.querySelector('.graph-panel')).toBeNull();
    });
});

//
// the rule between a reference column and the graph, which carries both of the
// things a boundary can do: an arrow that folds the column, and a strip that
// drags it narrower.
//
// Note: these run with the wide default, because below the breakpoint the
//       columns are stacked bands and there is no vertical rule to put either
//       control on. jsdom implements no matchMedia at all, which is why the
//       query has to be supplied.
//
// Note: jsdom lays nothing out, so every width a drag reads back off the
//       element is supplied by the test. 312px is the rail plus its padding at
//       the top of the clamp -- 18rem + 1.5rem -- which is what a wide window
//       actually gives these columns.
//
describe('the divider between a column and the graph', () => {
    const panel = (key) => document.querySelector(`.graph-panel-${key}`);
    const grip = (key) => panel(key).querySelector('.graph-panel-grip');
    const fold = (key) => panel(key).querySelector('.graph-panel-fold');
    const width = (key) => panel(key).style.getPropertyValue('--graph-panel-width');

    //
    // jsdom implements no PointerEvent, so testing-library cannot carry clientX
    // on one. A MouseEvent of the same TYPE can: react dispatches on the type,
    // and clientX and button are MouseEvent's own properties.
    //
    function pointer(type, target, init = {}) {
        fireEvent(target, new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            ...init,
        }));
    }

    function sized(key, px) {
        Object.defineProperty(panel(key), 'offsetWidth', { value: px, configurable: true });
    }

    beforeEach(() => {
        window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    });

    afterEach(() => {
        delete window.matchMedia;
    });

    it('folds the column from the arrow on the rule', async () => {
        await setup();

        expect(toggle('Build details').getAttribute('aria-expanded')).toBe('true');

        fireEvent.click(fold('build'));

        expect(toggle('Build details').getAttribute('aria-expanded')).toBe('false');
    });

    it('takes both controls away with the column they folded', async () => {
        await setup();

        fireEvent.click(fold('build'));

        expect(fold('build')).toBeNull();
        expect(grip('build')).toBeNull();
    });

    it('points each arrow outward, the way its own column closes', async () => {
        //
        // which is the direction the folded rail's chevron then points back
        // along to reopen it. Both used to point right, so the legend's said
        // 'closes off the edge of the page'.
        //
        await setup();

        expect(fold('build').querySelector('[data-testid="ChevronLeftIcon"]')).not.toBeNull();
        expect(fold('legend').querySelector('[data-testid="ChevronRightIcon"]')).not.toBeNull();
    });

    it('names the column each arrow folds', async () => {
        await setup();

        expect(fold('build')).toHaveAttribute('aria-label', 'Collapse build details');
        expect(fold('legend')).toHaveAttribute('aria-label', 'Collapse legend');
    });

    it('keeps the drag strip out of the accessibility tree', async () => {
        //
        // folding is on the keyboard path twice over -- the heading and the
        // arrow -- and a width is a preference rather than information. A
        // draggable div in the tab order would announce a control that does
        // nothing when it is reached.
        //
        await setup();

        expect(grip('build')).toHaveAttribute('aria-hidden', 'true');
        expect(grip('build')).not.toHaveAttribute('tabindex');
    });

    it('narrows the column as it is dragged inward', async () => {
        await setup();
        sized('build', 312);

        pointer('pointerdown', grip('build'), { clientX: 500, button: 0 });
        pointer('pointermove', window, { clientX: 400 });

        expect(width('build')).toBe('212px');
    });

    it('drags the legend the other way, its rule being on its left', async () => {
        await setup();
        sized('legend', 312);

        pointer('pointerdown', grip('legend'), { clientX: 500, button: 0 });
        pointer('pointermove', window, { clientX: 600 });

        expect(width('legend')).toBe('212px');
    });

    it('will not make a column wider than the stylesheet gives it', async () => {
        //
        // there is nothing a wider column would show that it is not showing
        // already -- the legend's namespace grid is two abreast at 18rem and
        // stays two -- and the space would come out of the graph.
        //
        await setup();
        sized('build', 312);

        pointer('pointerdown', grip('build'), { clientX: 500, button: 0 });
        pointer('pointermove', window, { clientX: 900 });

        expect(width('build')).toBe('312px');
    });

    it('resists at its minimum before it gives way', async () => {
        //
        // 176px is the floor; a boundary that folded the instant it was reached
        // would fold the column whenever somebody overshot by a pixel.
        //
        await setup();
        sized('build', 312);

        pointer('pointerdown', grip('build'), { clientX: 500, button: 0 });
        pointer('pointermove', window, { clientX: 350 });

        expect(width('build')).toBe('176px');
        expect(toggle('Build details').getAttribute('aria-expanded')).toBe('true');
    });

    it('folds the column once it is dragged well past that', async () => {
        await setup();
        sized('build', 312);

        pointer('pointerdown', grip('build'), { clientX: 500, button: 0 });
        pointer('pointermove', window, { clientX: 300 });

        expect(toggle('Build details').getAttribute('aria-expanded')).toBe('false');
    });

    it('gives a column folded by the drag its designed width back', async () => {
        //
        // the width it folded at is the narrowest the drag would go, which is
        // not a width anybody chose.
        //
        await setup();
        sized('build', 312);

        pointer('pointerdown', grip('build'), { clientX: 500, button: 0 });
        pointer('pointermove', window, { clientX: 300 });
        fireEvent.click(toggle('Build details'));

        expect(width('build')).toBe('');
    });

    it('keeps the stylesheet\'s width as the ceiling on a second drag', async () => {
        //
        // the ceiling is read off the element with the inline width taken off
        // and then put back, so a column already narrowed can still be dragged
        // back out to the width the stylesheet gives it rather than being
        // capped at wherever the last drag left it.
        //
        await setup();
        sized('build', 312);

        pointer('pointerdown', grip('build'), { clientX: 500, button: 0 });
        pointer('pointermove', window, { clientX: 400 });
        pointer('pointerup', window);
        expect(width('build')).toBe('212px');

        pointer('pointerdown', grip('build'), { clientX: 400, button: 0 });
        pointer('pointermove', window, { clientX: 900 });

        expect(width('build')).toBe('312px');
    });

    it('stops narrowing once the pointer is released', async () => {
        await setup();
        sized('build', 312);

        pointer('pointerdown', grip('build'), { clientX: 500, button: 0 });
        pointer('pointermove', window, { clientX: 400 });
        pointer('pointerup', window);
        pointer('pointermove', window, { clientX: 250 });

        expect(width('build')).toBe('212px');
    });

    it('ignores a drag that did not start with the primary button', async () => {
        await setup();
        sized('build', 312);

        pointer('pointerdown', grip('build'), { clientX: 500, button: 2 });
        pointer('pointermove', window, { clientX: 400 });

        expect(width('build')).toBe('');
    });
});

//
// the legend points at the canvas: what a reader can do by clicking a node,
// they can now do to a whole class of them from the words beside it.
//
describe('the legend as a control over the canvas', () => {
    const entry = (name) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
    const emphasis = () => explorer().getAttribute('data-emphasis');

    it('lights a namespace while it is pointed at, and drops it on the way out', async () => {
        await setup();

        fireEvent.mouseEnter(entry('bls'));
        expect(emphasis()).toBe('namespace:bls');

        fireEvent.mouseLeave(entry('bls'));
        expect(emphasis()).toBe('none');
    });

    it('holds one when it is clicked, and lets go when it is clicked again', async () => {
        await setup();

        fireEvent.click(entry('bls'));
        expect(entry('bls')).toHaveAttribute('aria-pressed', 'true');
        expect(emphasis()).toBe('namespace:bls');

        fireEvent.click(entry('bls'));
        expect(entry('bls')).toHaveAttribute('aria-pressed', 'false');
        expect(emphasis()).toBe('none');
    });

    it('moves the hold to another entry rather than adding to it', async () => {
        await setup();

        fireEvent.click(entry('bls'));
        fireEvent.click(entry('sec'));

        expect(entry('bls')).toHaveAttribute('aria-pressed', 'false');
        expect(entry('sec')).toHaveAttribute('aria-pressed', 'true');
    });

    it('previews a pointed entry over the held one, and returns to it', async () => {
        //
        // the same rule the canvas follows for a node: pointing at another one
        // previews it, and moving off returns to the pinned one.
        //
        await setup();

        fireEvent.click(entry('bls'));
        fireEvent.mouseEnter(entry('sec'));
        expect(emphasis()).toBe('namespace:sec');

        fireEvent.mouseLeave(entry('sec'));
        expect(emphasis()).toBe('namespace:bls');
    });

    it('marks an edge origin rather than a namespace', async () => {
        await setup();

        fireEvent.click(entry('enrichment'));

        expect(emphasis()).toBe('origin:enrichment');
    });

    it('lights an entry reached by the keyboard', async () => {
        await setup();

        fireEvent.focus(entry('bls'));
        expect(emphasis()).toBe('namespace:bls');

        fireEvent.blur(entry('bls'));
        expect(emphasis()).toBe('none');
    });

    it('lets go when the canvas is clicked', async () => {
        await setup();

        fireEvent.click(entry('bls'));
        fireEvent.click(explorer());

        expect(emphasis()).toBe('none');
        expect(entry('bls')).toHaveAttribute('aria-pressed', 'false');
    });

    it('lets go when another build is selected', async () => {
        //
        // a namespace out of the build being left need not exist in the next
        // one, and an emphasis on something the new legend does not list is a
        // canvas dimmed against nothing.
        //
        await setup();

        fireEvent.click(entry('bls'));
        await chooseBuild('build-b');

        expect(emphasis()).toBe('none');
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

        await chooseBuild('build-b');

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

describe('the api icons', () => {
    //
    // they head the canvas column rather than the page. Both describe the graph
    // -- the request it was drawn from -- and in the page header they sat at the
    // far edge of the window, a column and a half from the thing they name.
    //
    it('sit at the top of the column the graph is drawn in', async () => {
        await setup();

        const head = document.querySelector('.graph-canvas > .graph-canvas-header');

        expect(head).not.toBeNull();
        expect(head.querySelector('.api-links')).not.toBeNull();
        expect(document.querySelector('.graph-header .api-links')).toBeNull();
    });

    it('are there while the graph is not', async () => {
        //
        // a build that could not be loaded still has a request worth opening,
        // and it is the one that failed.
        //
        getGraphById.mockResolvedValue(null);

        await setup();

        expect(document.querySelector('.graph-canvas-header .api-links')).not.toBeNull();
        expect(document.querySelector('.graph-caption')).toBeNull();
    });

    it('are there while the build is still loading', async () => {
        //
        // never resolves, so this is the state every cold load passes through.
        // The request is worth opening most while it is the thing being waited
        // on, and the icons moving in once it lands would be a row that grows
        // under the reader.
        //
        getGraphById.mockReturnValue(new Promise(() => {}));

        await setup();

        expect(document.body.textContent).toContain('Loading the graph');
        expect(document.querySelector('.graph-canvas-header .api-links')).not.toBeNull();
    });

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

        await chooseBuild('build-b');

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
