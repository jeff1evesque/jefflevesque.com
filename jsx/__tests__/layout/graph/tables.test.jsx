/**
 * tables.test.jsx: everything in the build the canvas could not draw.
 *
 * The component's job is to make the whole build reachable, so what is worth
 * holding is the set of ways a table can be subtly wrong while still rendering:
 *
 *   - showing only the rows the canvas already showed, which is the defect the
 *     tables exist to fix
 *   - sorting a count column as text, which puts 9 above 10,000,000 and reads as
 *     a broken table rather than a wrong sort
 *   - painting a namespace a different color from the graph above it, which
 *     invents a relationship between two unrelated sources
 *   - leaving the reader on a page that no longer exists after a filter
 *
 * Note: MUI's table is not mocked. It is what renders the cells being asserted
 *       on, and a stub would let a column that never reaches the dom pass.
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

import GraphTables, {
    nodeRows,
    edgeRows,
    arrange,
    PENDING_ROWS,
} from '../../../import/layout/graph/tables.jsx';

//
// `n` node types across two namespaces with descending counts, and one edge per
// adjacent pair. Counts straddle a power of ten so a text sort is distinguishable
// from a numeric one.
//
function schemaOf(n) {
    const node_types = {};
    for (let i = 0; i < n; i++) {
        const ns = i % 2 === 0 ? 'bls' : 'sec';
        node_types[`${ns}_T${i}`] = {
            count: i === 0 ? 10000000 : n - i,
            source_type_uri: `https://example.com/ontology/${ns}/T${i}`,
        };
    }

    const edge_types = {};
    for (let i = 0; i + 1 < n; i++) {
        const src = `${i % 2 === 0 ? 'bls' : 'sec'}_T${i}`;
        const dst = `${(i + 1) % 2 === 0 ? 'bls' : 'sec'}_T${i + 1}`;
        edge_types[`(${src}, r${i}, ${dst})`] = {
            src_type: src,
            dst_type: dst,
            relation: `r${i}`,
            origin: i % 3 === 0 ? 'raw' : 'enrichment',
            count: i === 0 ? 9 : (i + 1) * 100,
        };
    }

    return { version: '1', node_types: node_types, edge_types: edge_types };
}

const FULL = schemaOf(40);
const DRAWN = {
    version: '1',
    node_types: { bls_T0: FULL.node_types.bls_T0, sec_T1: FULL.node_types.sec_T1 },
    edge_types: {},
};
const PAINTED = new Map([['bls', '#111111'], ['sec', '#222222']]);

function setup(props = {}) {
    return render(
        <GraphTables schema={FULL} drawn={DRAWN} painted={PAINTED} {...props} />
    );
}

const tab = (name) => screen.getByRole('button', { name: new RegExp(name) });
const filter = () => screen.getByLabelText('Filter rows');
const bodyRows = () => [...document.querySelectorAll('tbody tr')];
const cells = (row) => [...row.querySelectorAll('td')].map(c => c.textContent);
const firstColumn = () => bodyRows().map(r => r.querySelector('td').textContent);

describe('reaching the whole build', () => {
    it('is the point: rows the canvas never drew are here', async () => {
        //
        // the canvas holds two of the forty node types. The defect this component
        // exists to fix is a table that agrees with the canvas.
        //
        setup();

        fireEvent.change(filter(), { target: { value: 'bls_T38' } });

        expect(firstColumn().join()).toContain('bls_T38');
        expect(Object.keys(DRAWN.node_types)).not.toContain('bls_T38');
    });

    it('counts every node type on its tab, not the drawn ones', () => {
        setup();

        expect(within(tab('Node types')).getByText('40')).toBeTruthy();
    });

    it('counts every edge type on its tab', () => {
        setup();

        expect(within(tab('Edge types')).getByText('39')).toBeTruthy();
    });

    it('marks which rows the canvas is drawing', () => {
        setup();

        fireEvent.change(filter(), { target: { value: 'bls_T0 ' } });

        const drawn = bodyRows().map(r => cells(r)[2]);

        expect(drawn.some(Boolean)).toBe(true);
    });

    it('adds no request of its own', () => {
        //
        // the whole premise: these rows come out of a document the page had
        // already fetched to draw the canvas. A later change reaching for the
        // knowledge-graph tables/* api instead would still render, and would be
        // answering across the published window rather than for the build in the
        // picker -- rows that look right and belong to something else.
        //
        const fetched = jest.spyOn(global, 'fetch');

        setup();
        fireEvent.click(tab('Edge types'));
        fireEvent.change(filter(), { target: { value: 'sec' } });

        expect(fetched).not.toHaveBeenCalled();

        fetched.mockRestore();
    });

    it('draws nothing at all without a build', () => {
        const { container } = setup({ schema: null });

        expect(container.querySelector('.graph-tables')).toBeNull();
    });

    it('draws nothing for a payload missing its edge types', () => {
        const { container } = setup({ schema: { node_types: {} } });

        expect(container.querySelector('.graph-tables')).toBeNull();
    });
});

describe('before the build arrives', () => {
    //
    // no schema is where a page that has not loaded yet and a page whose build
    // failed both land, and they want opposite things: the first is a table on
    // its way and should look like one, the second is over and should leave the
    // failure above it to do the talking. `loading` is what tells them apart.
    //
    // What the empty one is for is the bottom of a phone screen. The rule, the
    // tabs, the filter box and a hundred rows used to appear together, all at
    // once, under a page that had been blank -- and on a wide screen the rule
    // the page's third divider rides on was not there to ride on.
    //
    const waiting = (props = {}) => setup({ schema: null, loading: true, ...props });

    it('draws the table empty rather than not at all', () => {
        const { container } = waiting();

        expect(container.querySelector('.graph-tables-pending')).not.toBeNull();
        expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    });

    it('heads it with the columns the node table will have', () => {
        //
        // 'nodes' is the tab the real one opens on, so these are the headings
        // that will still be there when the rows arrive. Heading it with the
        // other table's columns would be a row of labels that changes under the
        // reader for no reason they asked for.
        //
        const { container } = waiting();

        expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent))
            .toEqual(['Node type', 'Nodes', 'On canvas', 'Ontology term']);
    });

    it('offers the controls without letting them be used', () => {
        //
        // a filter box that takes keystrokes and drops them when the build
        // lands is worse than one that says it is not ready.
        //
        const { container } = waiting();

        [...container.querySelectorAll('.graph-tables-tab')].forEach((button) => {
            expect(button).toBeDisabled();
        });

        expect(container.querySelector('.graph-tables-search')).toBeDisabled();
    });

    it('is hidden from assistive technology', () => {
        //
        // it is a picture of a table rather than a table: there is nothing in it
        // to read, and the page announces the wait once, in the canvas above.
        //
        const { container } = waiting();

        expect(container.querySelector('.graph-tables-pending'))
            .toHaveAttribute('aria-hidden', 'true');
    });

    it('draws more rows than the box holds, so it is as tall as the table', () => {
        //
        // the box stops at 32rem -- 448px, at this site's 14px root -- and the
        // table that replaces this opens on 25 rows, which always reach it. A
        // dense row is 30.5px under a 34px heading, so a dozen fell 48px short
        // and everything under the table moved when the build landed.
        //
        const { container } = waiting();

        expect(container.querySelectorAll('tbody tr')).toHaveLength(PENDING_ROWS);
        expect(34 + PENDING_ROWS * 30.5).toBeGreaterThanOrEqual(448);
    });

    it('holds the pager\'s place under the rows, turned off', () => {
        //
        // the pager used to arrive with the build: a 52px row appearing under a
        // table that had been on screen all along.
        //
        const { container } = waiting();
        const pager = container.querySelector('.graph-tables-pending .MuiTablePagination-root');

        expect(pager).not.toBeNull();
        expect(pager.querySelectorAll('button').length).toBeGreaterThan(0);
        pager.querySelectorAll('button').forEach((button) => {
            expect(button).toBeDisabled();
        });
        expect(pager.querySelector('.MuiSelect-select')).toHaveAttribute('aria-disabled', 'true');
    });

    it('leaves the count the pager will show blank', () => {
        //
        // a count of nothing prints '0-0 of 0', which is a wrong answer on
        // screen rather than an honest wait. What it will say depends on the
        // build, so it is a bar until there is one.
        //
        const { container } = waiting();
        const shown = container.querySelector(
            '.graph-tables-pending .MuiTablePagination-displayedRows'
        );

        expect(shown.textContent).toBe('');
        expect(shown.querySelector('.graph-pending-bar')).not.toBeNull();
    });

    it('stops as soon as there is a build, loading or not', () => {
        //
        // the placeholder answers to the absence of a schema rather than to the
        // flag, so a build that lands while the flag is still up is drawn
        // rather than covered by a picture of itself.
        //
        const { container } = setup({ loading: true });

        expect(container.querySelector('.graph-tables-pending')).toBeNull();
        expect(bodyRows().length).toBeGreaterThan(0);
    });
});

describe('switching tabs', () => {
    it('shows the edge types when asked', () => {
        setup();

        fireEvent.click(tab('Edge types'));

        expect(firstColumn().join()).toContain('→');
    });

    it('says which one is showing', () => {
        setup();

        expect(tab('Node types').getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(tab('Edge types'));

        expect(tab('Edge types').getAttribute('aria-pressed')).toBe('true');
        expect(tab('Node types').getAttribute('aria-pressed')).toBe('false');
    });

    it('returns to the first page, which the other tab may not have', () => {
        //
        // 40 node types is two pages; landing on page two of the edge types and
        // switching back would otherwise show a page that exists on neither.
        //
        setup();

        fireEvent.click(screen.getByLabelText('Go to next page'));
        fireEvent.click(tab('Edge types'));

        expect(screen.getByLabelText('Go to next page')).toBeTruthy();
        expect(document.body.textContent).toContain('1–25 of 39');
    });
});

describe('paging', () => {
    it('shows the first page of a build too large for one', () => {
        setup();

        expect(bodyRows()).toHaveLength(25);
        expect(document.body.textContent).toContain('1\u201325 of 40');
    });

    it('shows more rows when asked for more', () => {
        setup();

        fireEvent.mouseDown(screen.getByRole('combobox'));
        fireEvent.click(screen.getByRole('option', { name: '50' }));

        expect(bodyRows()).toHaveLength(40);
    });

    it('ignores a click on the tab already showing', () => {
        //
        // re-selecting the open tab would otherwise reset the sort and the page
        // under a reader who had just set both.
        //
        setup();

        fireEvent.click(screen.getByLabelText('Go to next page'));
        fireEvent.click(tab('Node types'));

        expect(document.body.textContent).toContain('26\u201340 of 40');
    });
});

describe('sorting', () => {
    it('opens on the biggest, because that is what a build is shaped by', () => {
        setup();

        expect(firstColumn()[0]).toContain('bls_T0');
    });

    it('sorts a count numerically rather than as text', () => {
        //
        // bls_T0 holds 10,000,000 and one edge holds 9. Compared as strings,
        // '9' sorts above '10000000' and the largest row lands last.
        //
        setup();

        fireEvent.click(screen.getByRole('button', { name: 'Nodes' }));

        const counts = bodyRows().map(r => Number(cells(r)[1].replace(/,/g, '')));

        expect(counts[0]).toBe(1);
        expect(Math.max(...counts)).not.toBe(counts[0]);
    });

    it('reverses when the same column is asked again', () => {
        setup();

        const sortBy = () => screen.getByRole('button', { name: 'Nodes' });

        fireEvent.click(sortBy());
        const ascending = bodyRows().map(r => Number(cells(r)[1].replace(/,/g, '')));

        fireEvent.click(sortBy());
        const descending = bodyRows().map(r => Number(cells(r)[1].replace(/,/g, '')));

        expect(ascending[0]).toBeLessThan(descending[0]);
    });

    it('sorts a name alphabetically', () => {
        setup();

        fireEvent.click(screen.getByRole('button', { name: 'Node type' }));

        const names = firstColumn();

        expect(names[0]).toContain('bls_T0');
        expect([...names].sort()).toEqual(names);
    });
});

describe('filtering', () => {
    it('matches on what the reader can see', () => {
        setup();

        fireEvent.change(filter(), { target: { value: 'sec_T3' } });

        expect(firstColumn().every(n => n.includes('sec_T3'))).toBe(true);
    });

    it('matches the ontology term too', () => {
        setup();

        fireEvent.change(filter(), { target: { value: 'ontology/sec' } });

        expect(firstColumn().every(n => n.startsWith('sec'))).toBe(true);
        expect(firstColumn().length).toBeGreaterThan(0);
    });

    it('ignores case', () => {
        setup();

        fireEvent.change(filter(), { target: { value: 'BLS_T12' } });

        expect(firstColumn().join()).toContain('bls_T12');
    });

    it('returns to the first page, so a filter never lands on an empty one', () => {
        //
        // filtering 40 rows down to one while sitting on page two showed an empty
        // table over a control reporting one result.
        //
        setup();

        fireEvent.click(screen.getByLabelText('Go to next page'));
        fireEvent.change(filter(), { target: { value: 'bls_T0 ' } });

        expect(bodyRows().length).toBeGreaterThan(0);
    });

    it('says nothing matched rather than pretending otherwise', () => {
        setup();

        fireEvent.change(filter(), { target: { value: 'no such type' } });

        expect(bodyRows()).toHaveLength(0);
        expect(document.body.textContent).toContain('0');
    });
});

describe('agreeing with the graph above it', () => {
    it('paints a namespace the color the canvas gave it', () => {
        //
        // assignNamespaceColors deals out eight slots by rank, so the same
        // namespace gets a different color depending on the set it was ranked
        // against. Recomputing here over all 151 types would paint swatches that
        // disagree with the graph the reader is looking at.
        //
        setup();

        const swatch = document.querySelector('tbody .graph-legend-swatch');

        expect(swatch.getAttribute('style')).toContain('rgb(17, 17, 17)');
    });

    it('leaves a namespace the canvas never painted without a color', () => {
        setup({ painted: new Map([['sec', '#222222']]) });

        fireEvent.change(filter(), { target: { value: 'bls_T0 ' } });

        const swatch = document.querySelector('tbody .graph-legend-swatch');

        expect(swatch.getAttribute('style')).toBeNull();
    });

    it('draws an origin with the legend\'s own line', () => {
        setup();

        fireEvent.click(tab('Edge types'));

        const line = document.querySelector('tbody .graph-tables-origin line');

        expect(line).not.toBeNull();
        expect(line.getAttribute('stroke')).toBeTruthy();
    });

    it('prints a unification edge as owl:sameAs, the name the legend gives it', () => {
        //
        // the legend above calls this line owl:sameAs. A table calling the same
        // line 'unification' is one line going by two names on one page.
        //
        const schema = schemaOf(4);
        schema.edge_types.same = {
            src_type: 'bls_T0', relation: 'owl_sameAs', dst_type: 'sec_T1', count: 7, origin: 'unification',
        };
        setup({ schema: schema });

        fireEvent.click(tab('Edge types'));
        fireEvent.change(filter(), { target: { value: 'owl_sameAs' } });

        const row = bodyRows()[0];

        expect(cells(row)[2]).toBe('owl:sameAs');
        expect(row.querySelector('.graph-tables-origin line').getAttribute('stroke-dasharray')).toBeTruthy();
    });
});

describe('nodeRows', () => {
    it('reads the namespace off the ontology uri', () => {
        const rows = nodeRows(
            { node_types: { odd_Name: { count: 1, source_type_uri: 'https://e.com/ontology/bls/X' } } },
            new Set(),
            PAINTED
        );

        expect(rows[0].namespace).toBe('bls');
        expect(rows[0].color).toBe('#111111');
    });

    it('falls back to the id prefix where there is no uri', () => {
        const rows = nodeRows({ node_types: { sec_Thing: { count: 2 } } }, new Set(), PAINTED);

        expect(rows[0].namespace).toBe('sec');
        expect(rows[0].uri).toBe('');
    });

    it('marks a drawn type and does not mark the rest', () => {
        const schema = { node_types: { a_X: { count: 1 }, a_Y: { count: 1 } } };
        const rows = nodeRows(schema, new Set(['a_X']), PAINTED);

        expect(rows.find(r => r.id === 'a_X').drawn).toBe(true);
        expect(rows.find(r => r.id === 'a_Y').drawn).toBe(false);
    });

    it('answers nothing for no schema', () => {
        expect(nodeRows(null, new Set(), PAINTED)).toEqual([]);
        expect(nodeRows({}, new Set(), PAINTED)).toEqual([]);
    });
});

describe('edgeRows', () => {
    it('carries the triple and its origin', () => {
        const rows = edgeRows({
            edge_types: { k: { src_type: 'a', relation: 'r', dst_type: 'b', count: 3, origin: 'raw' } },
        });

        expect(rows[0]).toMatchObject({ src: 'a', relation: 'r', dst: 'b', count: 3, origin: 'raw' });
    });

    it('names a unification edge owl:sameAs, and keeps the schema\'s value for its line', () => {
        const rows = edgeRows({
            edge_types: { k: { src_type: 'a', relation: 'owl_sameAs', dst_type: 'b', count: 3, origin: 'unification' } },
        });

        expect(rows[0]).toMatchObject({ origin: 'owl:sameAs', schemaOrigin: 'unification' });
    });

    it('sorts on the name the column prints', () => {
        //
        // sorted on the schema's value, owl:sameAs would follow raw -- out of
        // order in the column a reader is looking at.
        //
        const rows = edgeRows({
            edge_types: {
                one: { src_type: 'a', relation: 'r', dst_type: 'b', count: 1, origin: 'raw' },
                two: { src_type: 'a', relation: 'owl_sameAs', dst_type: 'b', count: 1, origin: 'unification' },
                three: { src_type: 'a', relation: 'r', dst_type: 'b', count: 1, origin: 'enrichment' },
            },
        });

        expect(arrange(rows, '', { key: 'origin', direction: 'asc' }).map(r => r.origin))
            .toEqual(['enrichment', 'owl:sameAs', 'raw']);
    });

    it('is found by either name for its origin', () => {
        //
        // 'owl:sameAs' is what the row prints; 'unification' is what the api
        // answers, and what a reader arriving from the api docs will type.
        //
        const rows = edgeRows({
            edge_types: { k: { src_type: 'a', relation: 'r', dst_type: 'b', count: 3, origin: 'unification' } },
        });

        expect(arrange(rows, 'owl:sameAs', null)).toHaveLength(1);
        expect(arrange(rows, 'unification', null)).toHaveLength(1);
    });

    it('keys on the schema\'s own key, not the triple', () => {
        //
        // the triple is what a reader sees and is not guaranteed unique; the key
        // is what the document is keyed by.
        //
        const rows = edgeRows({
            edge_types: {
                one: { src_type: 'a', relation: 'r', dst_type: 'b', count: 1 },
                two: { src_type: 'a', relation: 'r', dst_type: 'b', count: 2 },
            },
        });

        expect(rows.map(r => r.key)).toEqual(['one', 'two']);
    });

    it('answers nothing for no schema', () => {
        expect(edgeRows(null)).toEqual([]);
        expect(edgeRows({})).toEqual([]);
    });
});

describe('arrange', () => {
    const rows = [
        { search: 'alpha', name: 'alpha', count: 9 },
        { search: 'beta', name: 'beta', count: 10000000 },
        { search: 'gamma', name: 'gamma', count: 100 },
    ];

    it('orders numbers by value', () => {
        expect(arrange(rows, '', { key: 'count', direction: 'asc' }).map(r => r.count))
            .toEqual([9, 100, 10000000]);
    });

    it('orders booleans with false first ascending', () => {
        const marked = [{ search: 'a', drawn: true }, { search: 'b', drawn: false }];

        expect(arrange(marked, '', { key: 'drawn', direction: 'asc' }).map(r => r.drawn))
            .toEqual([false, true]);
    });

    it('leaves the order alone when nothing is sorted by', () => {
        expect(arrange(rows, '', null).map(r => r.name)).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('does not mutate what it was given', () => {
        const before = rows.map(r => r.name);

        arrange(rows, '', { key: 'count', direction: 'asc' });

        expect(rows.map(r => r.name)).toEqual(before);
    });

    it('trims the query, so a stray space is not a filter', () => {
        expect(arrange(rows, '  beta  ', null)).toHaveLength(1);
    });
});

describe('a day of the tables', () => {
    //
    // the Retrieval graph hands this a day of the knowledge graph tables api, put
    // into a schema's shape. Its node types carry no ontology term, and two
    // measures a build's do not: how many of their nodes can be found by name,
    // and how many values are held about them -- what the canvas above was
    // chosen by.
    //
    const DAY = {
        node_types: {
            market_quotes_OptionSnapshot: { count: 9603436, entities: 0, facts: 0 },
            filings_SECFiling: { count: 2441, entities: 2441, facts: 24800 },
            cap_Info: { count: 893, entities: 893, facts: 12532 },
            ximpim_PercentChange: { count: 9336, entities: 0, facts: 18672 },
        },
        edge_types: {
            '(filings_SECFiling, filings_hasIssuer, filings_Issuer)': {
                src_type: 'filings_SECFiling',
                relation: 'filings_hasIssuer',
                dst_type: 'filings_Issuer',
                count: 2441,
                origin: 'raw',
            },
        },
    };

    const dayTables = (props = {}) => render(
        <GraphTables
            schema={DAY}
            drawn={{ node_types: { filings_SECFiling: DAY.node_types.filings_SECFiling } }}
            painted={new Map()}
            terms={false}
            lookups
            scope='on this day'
            weight='entities'
            {...props}
        />
    );

    const headings = () => [...document.querySelectorAll('thead th')].map((th) => th.textContent);

    it('leads with what can be looked up, and prints no ontology term', () => {
        //
        // an empty column the width of a uri, on every row, would read as a term
        // the page failed to find -- the tables carry none.
        //
        dayTables();

        expect(headings()).toEqual(['Node type', 'Entities', 'Facts', 'Nodes', 'On canvas']);
    });

    it('opens on the types with the most to find, as the canvas was chosen', () => {
        dayTables();

        //
        // the two with nothing to find tie at zero, and keep the day's own order
        //
        expect(firstColumn()).toEqual([
            'filings_SECFiling',
            'cap_Info',
            'market_quotes_OptionSnapshot',
            'ximpim_PercentChange',
        ]);
        expect(cells(bodyRows()[0]).slice(1, 4)).toEqual(['2,441', '24,800', '2,441']);
    });

    it('sorts facts biggest first on the first click, as it does every count', () => {
        dayTables();

        fireEvent.click(screen.getByRole('button', { name: 'Facts' }));

        expect(cells(bodyRows()[0])[2]).toBe('24,800');
        expect(cells(bodyRows()[1])[2]).toBe('18,672');
    });

    it('names its tables for the day', () => {
        dayTables();

        expect(screen.getByRole('table', { name: 'Node types on this day' })).toBeInTheDocument();
    });

    it('is headed the same way while the day is still on its way', () => {
        //
        // the page says what the rows will carry, since there are none yet to
        // ask. Headings that changed when the day arrived would move under the
        // reader.
        //
        dayTables({ schema: null, loading: true });

        expect(headings()).toEqual(['Node type', 'Entities', 'Facts', 'Nodes', 'On canvas']);
    });

    it('drops the ontology term wherever no row has one, whatever it was told', () => {
        //
        // the rows decide once they are here -- the props only stand in for them
        // while there are none.
        //
        render(<GraphTables schema={DAY} drawn={null} painted={new Map()} />);

        expect(headings()).not.toContain('Ontology term');
    });
});
