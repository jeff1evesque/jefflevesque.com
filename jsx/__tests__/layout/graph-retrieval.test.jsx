/**
 * graph-retrieval.test.jsx: the Retrieval graph, one published day of the tables.
 *
 * The page is the Training graph's layout -- graph.test.jsx holds that layout's
 * folding, dragging, legend and canvas at length -- handed a different source. So
 * what is held here is what the source changes, and nothing it shares:
 *
 *   - what the picker offers: the published days, newest first, with the newest
 *     the default and a day the tables no longer list falling back to it
 *   - how a day is loaded, and what its details panel says about it -- the day and
 *     the run that published it come with the picker, and every other row is
 *     totalled from the day's own rows, or read off them, and waits for them
 *   - which types the canvas draws: a day weighed by its node count is its own
 *     build again, so it is weighed by what can be found by name
 *   - what the legend calls them: a day's types carry no uri, so the namespace
 *     is the vocabulary the day's predicates file each one under
 *   - that the page says so, and links both of the requests it was drawn from
 *   - that it is arranged apart from the Training graph
 *
 * Note: the canvas and the tables are probes, as in graph.test.jsx, recording what
 *       reached them. The day's loaders are mocked and the url builders beside
 *       them are real, so the icons are held to the requests a loader would make.
 */

import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';

jest.mock('../../import/animation/graph-explorer.jsx', () => ({
    __esModule: true,
    default: ({ data }) => (
        <div
            data-testid='explorer'
            data-types={data ? Object.keys(data.node_types).sort().join(' ') : 'none'}
        />
    ),
    TAIL: 'shade',
}));

jest.mock('../../import/layout/graph/tables.jsx', () => ({
    __esModule: true,
    default: ({ schema, terms, lookups, scope, weight, loading }) => (
        <div
            data-testid='tables'
            data-node-types={schema ? Object.keys(schema.node_types).length : 'none'}
            data-terms={String(terms)}
            data-lookups={String(lookups)}
            data-scope={scope}
            data-weight={weight}
            data-loading={String(!!loading)}
        />
    ),
}));

jest.mock('../../import/general/get-graph-tables.js', () => ({
    __esModule: true,
    ...jest.requireActual('../../import/general/get-graph-tables.js'),
    getTableDays: jest.fn(),
    getTableDay: jest.fn(),
}));

jest.mock('../../import/general/get-graph-schema.js', () => ({
    __esModule: true,
    ...jest.requireActual('../../import/general/get-graph-schema.js'),
    getGraphListing: jest.fn(),
    getGraphById: jest.fn(),
}));

import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { getTableDays, getTableDay, dayRequests, daysRequest } from '../../import/general/get-graph-tables.js';
import { getGraphListing, getGraphById } from '../../import/general/get-graph-schema.js';
import { RetrievalGraph } from '../../import/layout/graph/graph.jsx';
import { API_DOCS } from '../../import/general/api-url.js';
import { readLayout } from '../../import/general/layout-preference.js';

//
// the published days as getTableDays answers them: each with the run that
// published it, which is the run of the build that holds the day, and when that
// finished.
//
const DAYS = [
    { day: '2026-09-23', run: '2026-09-24T05:00:42Z', published: '2026-09-24T06:41:18Z' },
    { day: '2026-09-22', run: '2026-09-23T05:00:25Z', published: '2026-09-23T06:43:55Z' },
    { day: '2026-09-21', run: '2026-09-22T05:00:25Z', published: '2026-09-22T06:40:12Z' },
];

//
// what the day panel says over a source outside the graph
//
const NOTE = 'Not in the graph: its data is kept in a table of its own.';

//
// a day shaped as the loader answers one: nine million market snapshots that
// carry no name and no value, three named types, and a nameless company node
// that touches one of them -- so which of them the canvas draws is decided by
// the weight and nothing else.
//
function dayOf() {
    return {
        node_types: {
            market_quotes_OptionSnapshot: { count: 9_603_436, entities: 0, facts: 0 },
            filings_SECFiling: { count: 2_441, entities: 2_441, facts: 24_800 },
            filings_Issuer: { count: 1_600, entities: 1_600, facts: 5_176 },
            cap_Info: { count: 893, entities: 893, facts: 12_532 },
            sec_enrichment_UnifiedCompany: { count: 500, entities: 0, facts: 1_000 },
        },
        edge_types: {
            '(filings_SECFiling, filings_hasIssuer, filings_Issuer)': {
                src_type: 'filings_SECFiling', relation: 'filings_hasIssuer', dst_type: 'filings_Issuer',
                count: 2_441, origin: 'raw',
            },
            '(filings_Issuer, refersToCompany, sec_enrichment_UnifiedCompany)': {
                src_type: 'filings_Issuer', relation: 'refersToCompany', dst_type: 'sec_enrichment_UnifiedCompany',
                count: 1_600, origin: 'enrichment',
            },
            '(market_quotes_OptionSnapshot, observedInPeriod, cap_Info)': {
                src_type: 'market_quotes_OptionSnapshot', relation: 'observedInPeriod', dst_type: 'cap_Info',
                count: 10, origin: 'enrichment',
            },
        },
    };
}

//
// the same day as its loader answers one from rows whose predicates name the
// vocabularies: the SEC's filings, the SEC's enrichment and NOAA's alerts, each
// filed under its source. The market quotes are named by no predicate.
//
function namedDay() {
    const day = dayOf();
    const named = {
        filings_SECFiling: 'sec/filings',
        filings_Issuer: 'sec/filings',
        cap_Info: 'noaa/cap-model',
        sec_enrichment_UnifiedCompany: 'sec/enrichment',
    };

    Object.keys(named).forEach((id) => {
        day.node_types[id].vocabulary = named[id];
    });

    return day;
}

//
// where the router is, so a test can read the address the picker moved to
//
function Where() {
    return <output data-testid='where'>{useLocation().pathname}</output>;
}

async function setup(path = '/graph/retrieval') {
    await act(async () => {
        render(
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path='/graph/retrieval' element={<RetrievalGraph />} />
                    <Route path='/graph/retrieval/:day' element={<RetrievalGraph />} />
                </Routes>
                <Where />
            </MemoryRouter>
        );
    });
}

const explorer = () => screen.getByTestId('explorer');
const picker = () => screen.getByRole('combobox', { name: 'Published day' });

function detail(label) {
    const row = [...document.querySelectorAll('.graph-details-row')]
        .find((r) => r.querySelector('dt').textContent === label);

    return row ? row.querySelector('dd').textContent : undefined;
}

//
// the names that carry a note in one details row's value
//
function detailNoted(label) {
    const row = [...document.querySelectorAll('.graph-details-row')]
        .find((r) => r.querySelector('dt').textContent === label);

    return row ? [...row.querySelectorAll('dd .graph-details-noted')] : [];
}

async function chooseDay(day) {
    await act(async () => {
        fireEvent.mouseDown(picker());
    });
    await act(async () => {
        fireEvent.click(document.querySelector(`[role='option'][data-value='${day}']`));
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    getTableDays.mockResolvedValue(DAYS);
    getTableDay.mockResolvedValue(dayOf());
});

describe('choosing a day', () => {
    it('asks for the published days, and nothing of the builds', async () => {
        await setup();

        expect(getTableDays).toHaveBeenCalledTimes(1);
        expect(getGraphListing).not.toHaveBeenCalled();
        expect(getGraphById).not.toHaveBeenCalled();
    });

    it('opens on the newest published day', async () => {
        await setup();

        expect(getTableDay).toHaveBeenCalledWith('2026-09-23');
    });

    it('opens on the day the address names', async () => {
        await setup('/graph/retrieval/2026-09-21');

        expect(getTableDay).toHaveBeenCalledWith('2026-09-21');
        expect(getTableDay).not.toHaveBeenCalledWith('2026-09-23');
    });

    it('opens on the newest for a day the tables do not list', async () => {
        //
        // a day kept a year rolls off, and a link to one is an ordinary thing to
        // find in a bookmark -- the way a build that rolled off falls back to
        // the default build.
        //
        await setup('/graph/retrieval/2025-01-01');

        expect(getTableDay).toHaveBeenCalledWith('2026-09-23');
        expect(getTableDay).not.toHaveBeenCalledWith('2025-01-01');
    });

    it('offers every published day, newest first, by the day itself', async () => {
        await setup();

        await act(async () => {
            fireEvent.mouseDown(picker());
        });

        expect(screen.getAllByRole('option').map((option) => option.textContent))
            .toEqual(DAYS.map((row) => row.day));
    });

    it('labels its picker Day', async () => {
        await setup();

        expect(document.querySelector('.graph-picker-label').textContent).toBe('Day');
    });

    it('puts a chosen day in the address, and loads it', async () => {
        await setup();

        await chooseDay('2026-09-22');

        expect(screen.getByTestId('where')).toHaveTextContent('/graph/retrieval/2026-09-22');
        expect(getTableDay).toHaveBeenLastCalledWith('2026-09-22');
    });
});

describe('the heading', () => {
    it('names the page the Retrieval Graph, in title case as every page heading is', async () => {
        await setup();

        expect(screen.getByRole('heading', { name: 'Retrieval Graph' })).toBeInTheDocument();
    });
});

describe('the legend', () => {
    const namespaces = () => [...document.querySelectorAll('.graph-legend-namespaces .graph-legend-entry')]
        .map((entry) => entry.textContent);

    it('names each namespace under its source, as the day\'s predicates file it', async () => {
        //
        // the Training graph reads 'sec/filings' off its build's uris, and a day
        // with no uris read 'filings' -- the one type under two names on two
        // pages drawn from one run.
        //
        getTableDay.mockResolvedValue(namedDay());

        await setup();

        expect(namespaces()).toEqual(['sec/filings', 'noaa/cap-model']);
    });

    it('names a namespace by its type\'s name where no predicate files it', async () => {
        await setup();

        expect(namespaces()).toEqual(['filings', 'cap']);
    });
});

describe('the day details', () => {
    it('totals the day from its own rows', async () => {
        await setup();

        expect(detail('Day')).toBe('2026-09-23');
        expect(detail('Entities')).toBe('4,934');
        expect(detail('Facts')).toBe('43,508');
        expect(detail('Nodes')).toBe('9,608,870');
        expect(detail('Edges')).toBe('4,051');
        expect(detail('Node types')).toBe('5');
        expect(detail('Edge types')).toBe('3');
    });

    it('titles the panel for a day, and summarizes it folded by what can be found', async () => {
        await setup();

        const toggle = screen.getByRole('button', { name: /Day details/ });

        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(toggle.textContent).toContain('4.93K entities');
    });

    it('waits for the day before it totals anything, holding each row\'s place', async () => {
        //
        // the day is known the moment the list is; everything else is counted
        // off rows still on their way. A '0' there would be a claim.
        //
        getTableDay.mockReturnValue(new Promise(() => {}));

        await setup();

        expect(detail('Day')).toBe('2026-09-23');
        ['Entities', 'Facts', 'Nodes', 'Edges', 'Node types', 'Edge types', 'Sources'].forEach((label) => {
            const row = [...document.querySelectorAll('.graph-details-row')]
                .find((r) => r.querySelector('dt').textContent === label);

            expect({ label, pending: Boolean(row.querySelector('.graph-pending-bar')) })
                .toEqual({ label, pending: true });
        });
    });

    it('reads n/a for a day that could not be loaded', async () => {
        getTableDay.mockResolvedValue(null);

        await setup();

        expect(detail('Day')).toBe('2026-09-23');
        expect(detail('Entities')).toBe('n/a');
        expect(detail('Nodes')).toBe('n/a');
    });

    it('stands in with the day\'s own rows while the days are on their way', async () => {
        getTableDays.mockReturnValue(new Promise(() => {}));

        await setup();

        expect([...document.querySelectorAll('.graph-details-row dt')].map((dt) => dt.textContent))
            .toEqual([
                'Day', 'Run', 'Published', 'Sources', 'Entities', 'Facts', 'Node types', 'Nodes', 'Edge types', 'Edges',
            ]);
    });

    //
    // the six totals sit two abreast where the column has room for two, and one
    // to a line where it has been dragged too narrow. Which of those applies is
    // the stylesheet's to decide, and jsdom lays nothing out -- what is held here
    // is which rows pair, and that each pair is listed together, left then
    // right, which is the order a narrow column reads them in.
    //
    it('pairs its totals: Entities beside Facts, and each count of types beside what those types hold', async () => {
        await setup();

        const rows = [...document.querySelectorAll('.graph-details-row')];
        const labels = (paired) => rows
            .filter((row) => row.classList.contains('graph-details-pair') === paired)
            .map((row) => row.querySelector('dt').textContent);

        expect(labels(true)).toEqual(['Entities', 'Facts', 'Node types', 'Nodes', 'Edge types', 'Edges']);
        expect(labels(false)).toEqual(['Day', 'Run', 'Published', 'Sources']);
    });

    it('rules off Sources, where the rows that take a line each give way to the pairs', async () => {
        await setup();

        expect([...document.querySelectorAll('.graph-details-ruled dt')].map((dt) => dt.textContent))
            .toEqual(['Sources']);
    });

    it('pairs and rules the same rows while the days are on their way', async () => {
        //
        // a stand-in giving each total its own row would be three rows taller
        // than the panel that replaces it
        //
        getTableDays.mockReturnValue(new Promise(() => {}));

        await setup();

        const labels = (selector) => [...document.querySelectorAll(`.graph-details.graph-pending ${selector} dt`)]
            .map((dt) => dt.textContent);

        expect(labels('.graph-details-pair'))
            .toEqual(['Entities', 'Facts', 'Node types', 'Nodes', 'Edge types', 'Edges']);
        expect(labels('.graph-details-ruled')).toEqual(['Sources']);
    });

    //
    // the Training graph's panel lists the sources its build holds, and a day's
    // lists the sources the builder recorded for it: every source its tables
    // hold, a feed that never becomes a node included.
    //
    it('lists the sources the day\'s own list names, sorted', async () => {
        //
        // the list wins over the vocabularies, which say noaa and sec here and
        // cannot see a feed with no nodes at all
        //
        getTableDays.mockResolvedValue([
            { ...DAYS[0], sources: ['stock-split', 'sec', 'bls'] },
            ...DAYS.slice(1),
        ]);
        getTableDay.mockResolvedValue(namedDay());

        await setup();

        expect(detail('Sources')).toBe('bls, sec, stock-split');
    });

    //
    // a day published before the builder recorded its sources has no list, and
    // its vocabularies are filed under their sources
    //
    it('lists the sources the day\'s vocabularies are filed under, where the day has no list', async () => {
        getTableDays.mockResolvedValue(DAYS.map((row) => ({ ...row, sources: null })));
        getTableDay.mockResolvedValue(namedDay());

        await setup();

        expect(detail('Sources')).toBe('noaa, sec');
    });

    it('reads n/a for sources where no vocabulary is filed under one', async () => {
        //
        // every day published before the builder filed its vocabularies under
        // their sources. The market quotes' name says 'market', and a list read
        // off names came out short of the day's four.
        //
        await setup();

        expect(detail('Sources')).toBe('n/a');
    });

    //
    // a source the day lists that none of its node types come from -- a feed the
    // builder reads into a table of its own -- is shown by nothing else on the
    // page, so its name carries a note in a tooltip over it. See outsideGraph in
    // source.js.
    //
    describe('a source outside the graph', () => {
        beforeEach(() => {
            getTableDays.mockResolvedValue([
                { ...DAYS[0], sources: ['market', 'noaa', 'sec', 'stock-split'] },
                ...DAYS.slice(1),
            ]);
            getTableDay.mockResolvedValue(namedDay());
        });

        it('is the one name that carries a note', async () => {
            await setup();

            expect(detail('Sources')).toBe('market, noaa, sec, stock-split');
            expect(detailNoted('Sources').map((name) => name.textContent)).toEqual(['stock-split']);
        });

        it('is not a link, and the row holds none', async () => {
            await setup();

            expect(detailNoted('Sources')[0].tagName).toBe('SPAN');
            expect(screen.queryByRole('link', { name: 'stock-split' })).toBeNull();
        });

        it('is still read by its name, with the note describing it', async () => {
            await setup();

            const [noted] = detailNoted('Sources');

            expect(noted).toHaveTextContent('stock-split');
            expect(noted).toHaveAccessibleDescription(NOTE);
        });

        it('shows the note in a tooltip over it', async () => {
            await setup();

            fireEvent.mouseOver(detailNoted('Sources')[0]);

            expect(await screen.findByRole('tooltip')).toHaveTextContent(NOTE);
        });

        it('shows the note from the keyboard, since it can take focus', async () => {
            await setup();

            const [noted] = detailNoted('Sources');

            expect(noted).toHaveAttribute('tabindex', '0');

            //
            // MUI shows a tooltip on focus only when the focus came from the
            // keyboard, as a Tab does
            //
            fireEvent.keyDown(document.body, { key: 'Tab' });
            act(() => noted.focus());

            expect(await screen.findByRole('tooltip')).toHaveTextContent(NOTE);
        });

        it('is not a source whose node types the day holds, where the canvas draws none of them', async () => {
            //
            // market's one type here is nine million snapshots, none of which can
            // be found by name, so the canvas leaves it out. It is still in the
            // tables, and so in the graph.
            //
            await setup();

            expect(explorer().dataset.types.split(' ')).not.toContain('market_quotes_OptionSnapshot');
            expect(detailNoted('Sources').map((name) => name.textContent)).not.toContain('market');
        });

        it('is none on a day whose list is null, whose sources are read off its node types', async () => {
            getTableDays.mockResolvedValue(DAYS.map((row) => ({ ...row, sources: null })));

            await setup();

            expect(detail('Sources')).toBe('noaa, sec');
            expect(detailNoted('Sources')).toEqual([]);
        });
    });

    //
    // the two graphs of one day are one run's work. The build panel on the
    // Training graph says when its build ran and finished; the day panel says
    // which run published the day, and when that finished.
    //
    it('follows the day with the run that published it, and when that finished', async () => {
        //
        // directly under the Day, where the Training graph's panel has its
        // build's Run and Built: one day shows the same Run on both pages.
        //
        await setup();

        expect([...document.querySelectorAll('.graph-details-row dt')].slice(0, 3).map((dt) => dt.textContent))
            .toEqual(['Day', 'Run', 'Published']);
        expect(detail('Run')).toBe('2026-09-24 05:00 UTC');
        expect(detail('Published')).toBe('2026-09-24 06:41 UTC');
    });

    it('reads both off the days, above the totals still on their way', async () => {
        //
        // they come with the picker, as a build's Run and Built come with the
        // listing -- not a round trip later, with the totals. So what is filled
        // in is one block at the top of the panel, and what waits is the block
        // below it.
        //
        getTableDay.mockReturnValue(new Promise(() => {}));

        await setup();

        expect(detail('Run')).toBe('2026-09-24 05:00 UTC');
        expect(detail('Published')).toBe('2026-09-24 06:41 UTC');
        expect([...document.querySelectorAll('.graph-details-row')]
            .map((row) => Boolean(row.querySelector('.graph-pending-bar'))))
            .toEqual([false, false, false, true, true, true, true, true, true, true]);
    });

    it('follows the picker to another day', async () => {
        await setup();

        await chooseDay('2026-09-21');

        expect(detail('Run')).toBe('2026-09-22 05:00 UTC');
        expect(detail('Published')).toBe('2026-09-22 06:40 UTC');
    });

    it('reads n/a for both when the days say nothing of them', async () => {
        //
        // every day's row carried only the day before the api said where each
        // came from. The rest of the panel is as it was.
        //
        getTableDays.mockResolvedValue(DAYS.map((row) => ({ day: row.day, run: null, published: null })));

        await setup();

        expect(detail('Run')).toBe('n/a');
        expect(detail('Published')).toBe('n/a');
        expect(detail('Day')).toBe('2026-09-23');
        expect(detail('Entities')).toBe('4,934');
    });
});

describe('the canvas', () => {
    it('draws the day by what can be found by name, not by its node count', async () => {
        //
        // by count, nine million market snapshots lead, as they lead the day's
        // build -- and the two pages drew one graph. None of them can be found
        // by name.
        //
        await setup();

        expect(explorer().dataset.types).toBe('cap_Info filings_Issuer filings_SECFiling');
    });

    it('says what chose the types it draws', async () => {
        await setup();

        expect(document.querySelector('.graph-caption').textContent)
            .toContain('3 of 5 node types, by what can be found by name');
    });

    it('hands the tables the whole day, and how to show it', async () => {
        await setup();

        const tables = screen.getByTestId('tables');

        expect(tables.dataset).toMatchObject({
            nodeTypes: '5',
            terms: 'false',
            lookups: 'true',
            scope: 'on this day',
            weight: 'entities',
        });
    });
});

describe('the api icons', () => {
    it('link the documentation', async () => {
        await setup();

        expect(screen.getByRole('link', { name: 'API docs' })).toHaveAttribute('href', API_DOCS.knowledgeGraph);
    });

    it('link both of the requests the day was drawn from', async () => {
        await setup();

        const { nodeTypes, edgeTypes } = dayRequests('2026-09-23');

        expect(screen.getByRole('link', { name: 'Node types request' })).toHaveAttribute('href', String(nodeTypes));
        expect(screen.getByRole('link', { name: 'Edge types request' })).toHaveAttribute('href', String(edgeTypes));
    });

    it('mark the two apart, N for the node types and E for the edge types', async () => {
        await setup();

        const icon = (name) => screen.getByRole('link', { name }).querySelector('svg');

        expect(icon('Node types request')).toHaveAttribute('data-testid', 'DataObjectNIcon');
        expect(icon('Edge types request')).toHaveAttribute('data-testid', 'DataObjectEIcon');
    });

    it('link the days while no day is selected', async () => {
        getTableDays.mockResolvedValue(null);

        await setup();

        expect(screen.getByRole('link', { name: 'This request' })).toHaveAttribute('href', String(daysRequest()));
    });
});

describe('when something cannot be loaded', () => {
    it('says so when the days cannot be listed', async () => {
        getTableDays.mockResolvedValue(null);

        await setup();

        expect(document.body.textContent).toContain('The published days could not be listed.');
    });

    it('says so when the day cannot be loaded', async () => {
        getTableDay.mockResolvedValue(null);

        await setup();

        expect(document.body.textContent).toContain('That day could not be loaded.');
        expect(screen.queryByTestId('explorer')).toBeNull();
    });
});

describe('remembering how the page was arranged', () => {
    it('keeps the arrangement apart from the Training graph\'s', async () => {
        //
        // a column folded on one page is a column on a different page with a
        // different panel in it.
        //
        await setup();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Day details/ }));
        });

        expect(readLayout('graph-retrieval', 'narrow').fold).toMatchObject({ build: false });
        expect(readLayout('graph', 'narrow').fold).toEqual({});
    });
});
