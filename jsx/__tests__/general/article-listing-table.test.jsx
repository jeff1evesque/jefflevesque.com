/**
 * article-listing-table.test.jsx: the listing as a table, as /stream and /data draw
 * it -- ArticleListing handed `columns`, and so ListingTable.
 *
 * jsdom lays nothing out, so none of this sees a column line up, a card stack, or
 * a row follow a finger. What it can hold is everything those rest on: a header
 * per column, a cell per figure carrying its column's name, the order the rows
 * come in -- sorted, filtered, or the reader's own -- and the grips that change
 * it, by key and by the drag the grip starts.
 *
 * Note: rows are named by the page's stream ids and shown by stream-name.js's
 *       labels, as the two pages pass them, so the filter's two ways of matching
 *       are both in play.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DragControls } from 'framer-motion';

import ArticleListing from '../../import/general/article-listing.jsx';
import ListingTable, { sortValue, compareFigures } from '../../import/general/listing-table.jsx';

const COLUMNS = [
    { key: 'Health', numeric: true, sortable: true },
    { key: 'Rate', pill: true },
    { key: 'Total Records', numeric: true, sortable: true },
    { key: 'Lag' },
    { key: 'RDF', on: 'Available' },
];

const ROWS = [
    {
        name: 'stock-market',
        detail: { 'Health': '99.6%', 'Rate': 'Hour', 'Total Records': '1,284,113', 'RDF': 'Available' },
        control_tray: <button type='button'>Chart S&amp;P 500</button>,
    },
    {
        name: 'stock-split',
        detail: { 'Health': '97.25%', 'Rate': 'Day', 'Total Records': '76,644,387', 'RDF': 'None' },
    },
    {
        name: 'bls',
        detail: { 'Health': 'n/a', 'Rate': 'Day', 'Total Records': '0 (unpublished)', 'Lag': '1-2 months', 'RDF': 'Available' },
    },
    {
        name: 'sec',
        detail: { 'Health': '88.4%', 'Rate': 'Minute', 'Total Records': '912', 'RDF': 'Available' },
    },
];

function setup(props = {}) {
    return render(
        <ArticleListing
            title='Streams'
            name_label='Stream'
            stream_labels={true}
            columns={COLUMNS}
            list_article={ROWS}
            {...props}
        />
    );
}

//
// the rows' names, top to bottom, as shown
//
function names() {
    return [...document.querySelectorAll('.listing-table tbody th')].map((cell) => cell.textContent);
}

//
// the row named `name`'s cell in the `label` column
//
function cell(name, label) {
    const row = [...document.querySelectorAll('.listing-table tbody tr')]
        .find((tr) => tr.querySelector('th').textContent === name);

    return row.querySelector(`td[data-label="${label}"]`);
}

const header = (text) => screen.getByRole('button', { name: text });

describe('the table', () => {
    it('names each column once, in order, after the name', () => {
        setup();

        const headers = [...document.querySelectorAll('.listing-table thead th')]
            .map((th) => th.textContent.trim());

        expect(headers).toEqual(['Stream', 'Health', 'Rate', 'Total Records', 'Lag', 'RDF', 'Controls']);
    });

    it('draws a row per stream, under the name the page shows for it', () => {
        setup();

        expect(names()).toEqual(['S&P 500', 'Stock Splits', 'Bureau of Labor Statistics', 'SEC Filings']);
    });

    it('right-aligns a numeric column, and labels every cell with its column', () => {
        setup();

        expect(cell('SEC Filings', 'Total Records')).toHaveClass('listing-table-numeric');
        expect(cell('SEC Filings', 'Rate')).not.toHaveClass('listing-table-numeric');
        expect(document.querySelectorAll('.listing-table tbody td[data-label]')).toHaveLength(ROWS.length * COLUMNS.length);
    });

    it('shows a field a stream does not have as a dash, and one not measured yet as n/a', () => {
        //
        // n/a is a figure still to come; a blank is a figure the stream will never
        // have. The two read differently on purpose.
        //
        setup();

        expect(cell('SEC Filings', 'Lag')).toHaveClass('listing-table-blank');
        expect(cell('SEC Filings', 'Lag').querySelector('.listing-table-empty')).toHaveTextContent('—');
        expect(cell('Bureau of Labor Statistics', 'Lag')).toHaveTextContent('1-2 months');
        expect(cell('Bureau of Labor Statistics', 'Health')).toHaveTextContent('n/a');
        expect(cell('Bureau of Labor Statistics', 'Health')).not.toHaveClass('listing-table-blank');
    });

    it('puts a figure\'s note in front of it, so the figure keeps to the right edge', () => {
        setup();

        const records = cell('Bureau of Labor Statistics', 'Total Records');

        expect(records.querySelector('.listing-table-note')).toHaveTextContent('unpublished');
        expect(records.textContent).toBe('unpublished 0');
    });

    it('draws a rate as a pill, and marks the value that means yes', () => {
        setup();

        expect(cell('SEC Filings', 'Rate').querySelector('.listing-table-pill')).toHaveTextContent('Minute');
        expect(cell('SEC Filings', 'RDF').querySelector('.listing-table-pill-on')).toHaveTextContent('Available');
    });

    it('draws any other value of a yes column as an outlined pill, an answer rather than a gap (#167, #192)', () => {
        setup();

        const none = cell('Stock Splits', 'RDF').querySelector('.listing-table-pill');

        expect(none).toHaveTextContent('None');
        expect(none).not.toHaveClass('listing-table-pill-on');
        expect(none).toHaveClass('listing-table-pill-off');
        expect(cell('SEC Filings', 'Rate').querySelector('.listing-table-pill')).not.toHaveClass('listing-table-pill-off');
    });

    it('marks the cells of a column some rows leave empty, so a card sets them after the rest (#167)', () => {
        setup();

        expect(cell('Bureau of Labor Statistics', 'Lag')).toHaveClass('listing-table-partial');
        expect(cell('S&P 500', 'Lag')).toHaveClass('listing-table-partial', 'listing-table-blank');
        ['Health', 'Rate', 'Total Records', 'RDF'].forEach((label) => {
            expect(cell('Bureau of Labor Statistics', label)).not.toHaveClass('listing-table-partial');
        });
    });

    it('reads which columns some rows leave empty from every row, not only the ones on screen (#167)', () => {
        setup();

        fireEvent.change(screen.getByPlaceholderText('Filter by name'), { target: { value: 'bls' } });

        expect(names()).toEqual(['Bureau of Labor Statistics']);
        expect(cell('Bureau of Labor Statistics', 'Lag')).toHaveClass('listing-table-partial');
    });

    it('marks no row by the listing\'s own name', () => {
        //
        // /stream named its charted stream as `name`, until it stopped charting one
        // (#152). /data's `name` is the listing's, which names no row.
        //
        setup({ name: 'sec' });

        expect(document.querySelectorAll('.listing-table-selected')).toHaveLength(0);
    });

    it('marks the row /data names as its selected identifier', () => {
        setup({ name: 'data', selected_identifier: 'bls' });

        expect(document.querySelector('.listing-table-selected th')).toHaveTextContent('Bureau of Labor Statistics');
    });

    it('draws the page\'s own controls in the last cell', () => {
        setup();

        expect(screen.getByRole('button', { name: 'Chart S&P 500' }).closest('td'))
            .toHaveClass('listing-table-controls');
    });

    it('counts the rows it shows', () => {
        setup();

        expect(document.querySelector('.listing-table .title-count')).toHaveTextContent('4');
    });

    it('shows a row by its own name when the page gives no labels', () => {
        //
        // a listing of names that are not stream ids, which stream-name.js would
        // otherwise try to relabel
        //
        setup({ stream_labels: false });

        expect(names()).toEqual(['stock-market', 'stock-split', 'bls', 'sec']);
    });

    it('shows a row by its own name when drawn with no label at all', () => {
        render(<ListingTable columns={COLUMNS} rows={ROWS} />);

        expect(names()).toEqual(['stock-market', 'stock-split', 'bls', 'sec']);
        expect(screen.getByRole('button', { name: 'Name' })).toBeInTheDocument();
    });
});

describe('the title row', () => {
    //
    // a page can put a control of its own at the end of the row -- the Filter,
    // on a phone's /data (#165)
    //
    it('carries the page\'s own control after its name and count, and marks the row (#194)', () => {
        const { container } = setup({ actions: <button type='button'>Filter</button> });
        const title = container.querySelector('.listing-table-title');

        expect(title).toHaveClass('has-actions');
        expect(container.querySelector('.listing-table-head')).toHaveClass('has-actions');
        expect(title.firstElementChild).toHaveClass('listing-table-name');
        expect(title.querySelector('.listing-table-name h5')).not.toBeNull();
        expect(title.querySelector('.listing-table-name .title-count')).not.toBeNull();
        expect(title.lastElementChild).toHaveClass('listing-table-actions');
        expect(title.querySelector('.listing-table-actions').textContent).toBe('Filter');
        expect(container.querySelector('.listing-table-head').lastElementChild).toHaveClass('listing-table-tools');
    });

    it('carries nothing else without one', () => {
        const { container } = setup();

        expect(container.querySelector('.listing-table-title')).not.toHaveClass('has-actions');
        expect(container.querySelector('.listing-table-head')).not.toHaveClass('has-actions');
        expect(container.querySelector('.listing-table-actions')).toBeNull();
    });
});

describe('sorting by a header', () => {
    it('sorts ascending, then descending, then goes back to the reader\'s order', () => {
        setup();

        fireEvent.click(header('Total Records'));
        expect(names()).toEqual(['Bureau of Labor Statistics', 'SEC Filings', 'S&P 500', 'Stock Splits']);

        fireEvent.click(header('Total Records'));
        expect(names()).toEqual(['Stock Splits', 'S&P 500', 'SEC Filings', 'Bureau of Labor Statistics']);

        fireEvent.click(header('Total Records'));
        expect(names()).toEqual(['S&P 500', 'Stock Splits', 'Bureau of Labor Statistics', 'SEC Filings']);
    });

    it('sorts a figure not measured yet last, either way round', () => {
        setup();

        fireEvent.click(header('Health'));
        expect(names()).toEqual(['SEC Filings', 'Stock Splits', 'S&P 500', 'Bureau of Labor Statistics']);

        fireEvent.click(header('Health'));
        expect(names()).toEqual(['S&P 500', 'Stock Splits', 'SEC Filings', 'Bureau of Labor Statistics']);
    });

    it('sorts the name column by the name shown', () => {
        setup();

        fireEvent.click(header('Stream'));

        expect(names()).toEqual(['Bureau of Labor Statistics', 'S&P 500', 'SEC Filings', 'Stock Splits']);
    });

    it('says which way it is sorted, for a screen reader', () => {
        setup();

        const th = header('Health').closest('th');

        expect(th).toHaveAttribute('aria-sort', 'none');
        fireEvent.click(header('Health'));
        expect(th).toHaveAttribute('aria-sort', 'ascending');
        fireEvent.click(header('Health'));
        expect(th).toHaveAttribute('aria-sort', 'descending');
    });

    it('does not sort a column that is not sortable', () => {
        setup();

        expect(screen.queryByRole('button', { name: 'Rate' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Lag' })).toBeNull();
    });
});

describe('the sort menu', () => {
    const menu = () => screen.getByRole('combobox', { name: 'Sort' });

    it('offers the reader\'s order, and each sortable column both ways round', () => {
        setup();

        expect([...menu().options].map((option) => option.textContent)).toEqual([
            'Your order',
            'Stream, A to Z',
            'Stream, Z to A',
            'Health, low to high',
            'Health, high to low',
            'Total Records, low to high',
            'Total Records, high to low',
        ]);
    });

    it('sorts as the headers do, and goes back with Your order', () => {
        setup();

        fireEvent.change(menu(), { target: { value: 'Total Records|descending' } });
        expect(names()).toEqual(['Stock Splits', 'S&P 500', 'SEC Filings', 'Bureau of Labor Statistics']);

        fireEvent.change(menu(), { target: { value: '' } });
        expect(names()).toEqual(['S&P 500', 'Stock Splits', 'Bureau of Labor Statistics', 'SEC Filings']);
    });
});

describe('the filter', () => {
    const filter = () => screen.getByPlaceholderText('Filter by name');

    it('narrows the rows by the name shown', () => {
        setup();

        fireEvent.change(filter(), { target: { value: 's&p' } });

        expect(names()).toEqual(['S&P 500']);
    });

    it('narrows the rows by the stream\'s id as well', () => {
        setup();

        fireEvent.change(filter(), { target: { value: 'stock-' } });

        expect(names()).toEqual(['S&P 500', 'Stock Splits']);
    });

    it('draws a magnifying glass, rather than an at sign', () => {
        setup();

        expect(document.querySelector('.listing-table-filter svg')).not.toBeNull();
        expect(document.querySelector('.listing-table-head').textContent).not.toContain('@');
    });
});

describe('the reader\'s order', () => {
    const grip = (name) => screen.getByRole('button', { name: `Move ${name}` });

    it('follows the order it is given, the rest after it in the page\'s', () => {
        setup({ order: ['sec', 'bls'], onReorder: jest.fn() });

        expect(names()).toEqual(['SEC Filings', 'Bureau of Labor Statistics', 'S&P 500', 'Stock Splits']);
    });

    it('moves a row with the arrow keys, and says where it went', () => {
        const onReorder = jest.fn();
        setup({ onReorder: onReorder });

        fireEvent.keyDown(grip('SEC Filings'), { key: 'ArrowUp' });

        expect(onReorder).toHaveBeenCalledWith(['stock-market', 'stock-split', 'sec', 'bls']);
        expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('SEC Filings, 3 of 4');

        fireEvent.keyDown(grip('S&P 500'), { key: 'ArrowDown' });

        expect(onReorder).toHaveBeenLastCalledWith(['stock-split', 'stock-market', 'bls', 'sec']);
    });

    it('leaves the first row where it is on an arrow up, and the last on an arrow down', () => {
        const onReorder = jest.fn();
        setup({ onReorder: onReorder });

        fireEvent.keyDown(grip('S&P 500'), { key: 'ArrowUp' });
        fireEvent.keyDown(grip('SEC Filings'), { key: 'ArrowDown' });
        fireEvent.keyDown(grip('SEC Filings'), { key: 'Enter' });

        expect(onReorder).not.toHaveBeenCalled();
    });

    it('starts a drag from the grip, and from nowhere else', () => {
        //
        // the grip hands the pointer to framer-motion's Reorder, which does the
        // moving; a row itself takes no drag, so a swipe on it scrolls a phone
        //
        const start = jest.spyOn(DragControls.prototype, 'start').mockImplementation(() => {});

        try {
            setup({ onReorder: jest.fn() });

            fireEvent.pointerDown(document.querySelector('.listing-table tbody td[data-label="Health"]'));
            expect(start).not.toHaveBeenCalled();

            fireEvent.pointerDown(grip('Stock Splits'));
            expect(start).toHaveBeenCalledTimes(1);
        } finally {
            start.mockRestore();
        }
    });

    it('hides the grips while a sort is on, and while the filter is', () => {
        setup({ onReorder: jest.fn() });

        expect(screen.getAllByRole('button', { name: /^Move / })).toHaveLength(4);

        fireEvent.click(header('Health'));
        expect(screen.queryAllByRole('button', { name: /^Move / })).toHaveLength(0);

        fireEvent.click(header('Health'));
        fireEvent.click(header('Health'));
        expect(screen.getAllByRole('button', { name: /^Move / })).toHaveLength(4);

        fireEvent.change(screen.getByPlaceholderText('Filter by name'), { target: { value: 'sec' } });
        expect(screen.queryAllByRole('button', { name: /^Move / })).toHaveLength(0);
    });

    it('offers Reset order only while the order differs from the page\'s, and resets with null', () => {
        const onReorder = jest.fn();
        const { rerender } = setup({ onReorder: onReorder });

        expect(screen.queryByRole('button', { name: 'Reset order' })).toBeNull();

        rerender(
            <ArticleListing
                title='Streams'
                name_label='Stream'
                stream_labels={true}
                columns={COLUMNS}
                list_article={ROWS}
                order={['stock-market', 'stock-split', 'bls', 'sec']}
                onReorder={onReorder}
            />
        );
        expect(screen.queryByRole('button', { name: 'Reset order' })).toBeNull();

        rerender(
            <ArticleListing
                title='Streams'
                name_label='Stream'
                stream_labels={true}
                columns={COLUMNS}
                list_article={ROWS}
                order={['sec']}
                onReorder={onReorder}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Reset order' }));

        expect(onReorder).toHaveBeenCalledWith(null);
    });

    it('draws Reset order as a pill with an icon before its words, still named by them (#169)', () => {
        setup({ onReorder: jest.fn(), order: ['sec'] });

        const reset = screen.getByRole('button', { name: 'Reset order' });

        expect(reset).toHaveClass('listing-table-reset');
        expect(reset.firstElementChild.tagName.toLowerCase()).toBe('svg');
        expect(reset.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    });

    it('draws no grips for a page that takes no order', () => {
        setup();

        expect(screen.queryAllByRole('button', { name: /^Move / })).toHaveLength(0);
        expect(document.querySelector('.listing-table-grip')).toBeNull();
    });
});

describe('a listing without columns', () => {
    it('draws the cards it always has, with the magnifying glass in the filter', () => {
        //
        // /model's listing, which passes no columns
        //
        render(
            <MemoryRouter>
                <ArticleListing
                    title='Models'
                    left_column={false}
                    list_article={[{ name: 'model', link: '#', detail: { 'Health': '98%' } }]}
                />
            </MemoryRouter>
        );

        expect(document.querySelector('.listing-table')).toBeNull();
        expect(document.querySelectorAll('.article-link')).toHaveLength(1);
        expect(document.querySelector('.input-group-text svg')).not.toBeNull();
        expect(document.querySelector('.input-group-text').textContent).not.toContain('@');
    });
});

describe('sortValue', () => {
    it('reads the number off the front of a figure, as the page formats it', () => {
        expect(sortValue('1,284,113')).toBe(1284113);
        expect(sortValue('99.6%')).toBe(99.6);
        expect(sortValue('0 (unpublished)')).toBe(0);
        expect(sortValue('.5')).toBe(0.5);
        expect(sortValue(912)).toBe(912);
    });

    it('reads text without its case, and nothing from n/a or a blank', () => {
        expect(sortValue('Hive')).toBe('hive');
        expect(sortValue('n/a')).toBeNull();
        expect(sortValue(' ')).toBeNull();
        expect(sortValue(null)).toBeNull();
        expect(sortValue(undefined)).toBeNull();
    });
});

describe('compareFigures', () => {
    it('puts numbers before text, and nothing after everything, either way round', () => {
        expect(compareFigures('5', 'Hive', 'ascending')).toBeLessThan(0);
        expect(compareFigures('Hive', '5', 'descending')).toBeGreaterThan(0);
        expect(compareFigures('n/a', '5', 'ascending')).toBeGreaterThan(0);
        expect(compareFigures('n/a', '5', 'descending')).toBeGreaterThan(0);
        expect(compareFigures('5', 'n/a', 'descending')).toBeLessThan(0);
        expect(compareFigures('n/a', '', 'ascending')).toBe(0);
    });

    it('turns the order round for descending', () => {
        expect(compareFigures('2', '10', 'ascending')).toBeLessThan(0);
        expect(compareFigures('2', '10', 'descending')).toBeGreaterThan(0);
        expect(compareFigures('7', '7', 'descending')).toBe(0);
    });
});
