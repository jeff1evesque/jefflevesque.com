/**
 * summary-trigger.test.jsx: the shared trigger summary block.
 *
 * A presentational shell the trigger content pages fill in: two headed sections, each
 * with an accordion list, plus an optional paginated table. Everything it does is
 * decided by props, so the tests are mostly about what appears and what does not.
 *
 * The parts worth holding are the ones with state behind them: the accordions are
 * single-open (opening one closes the last, and clicking the open one closes it), and
 * the anchor '#' link only exists while the heading is hovered.
 *
 * Note: jsdom does not implement Element.scrollIntoView, so the anchor's click handler
 *       throws unless it is stubbed. That is an environment gap rather than a defect --
 *       the handler is exactly what a browser needs to make a same-page anchor animate.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import SummaryTrigger from '../../import/general/summary-trigger.jsx';

//
// Note: 'rows_per_page_option' is supplied alongside a small page size. The default
//       options are [10, 25, 100], and MUI warns 'out-of-range value' when the select's
//       value is not among them -- which setup.js turns into a failure. A caller
//       paginating three rows would pass its own options too.
//
const PAGED = { rows_per_page: 2, rows_per_page_option: [2, 10] };

const LABELS = [
    { id: 'pattern', label: 'Pattern', align: 'left', minWidth: 100 },
    { id: 'count', label: 'Count', align: 'right', minWidth: 80, format: (v) => v.toFixed(2) },
];

const ROWS = [
    { pattern: 'Morning Star', count: 12 },
    { pattern: 'Evening Star', count: 7 },
    { pattern: 'Hammer', count: 3 },
];

const ACCORDIONS = [
    { id: 'first', title: 'First Panel', content: 'first body' },
    { id: 'second', title: 'Second Panel', content: 'second body' },
];

function setup(props = {}) {
    const held = React.createRef();

    const utils = render(
        <MemoryRouter>
            <SummaryTrigger ref={held} {...props} />
        </MemoryRouter>
    );

    return { ...utils, page: held.current };
}

const text = () => document.body.textContent.replace(/\s+/g, ' ');
const heading = (name) => [...document.querySelectorAll('h5')]
    .find(h => h.textContent.includes(name));
const anchors = () => document.querySelectorAll('.anchor-hash');
const panelButton = (title) => [...document.querySelectorAll('[role="button"]')]
    .find(b => b.textContent.includes(title));

describe('the headings', () => {
    it('defaults the two section headings', () => {
        setup();

        expect(text()).toContain('Trigger Summary');
        expect(text()).toContain('Trigger Integration');
    });

    it('takes custom headings', () => {
        setup({ header_summary: 'What It Does', header_integration: 'How It Connects' });

        expect(text()).toContain('What It Does');
        expect(text()).toContain('How It Connects');
    });

    it('renders no top header unless one is given', () => {
        setup();

        expect(document.querySelector('h4')).toBeNull();
    });

    it('renders the top header when given', () => {
        setup({ header: 'Candlestick' });

        expect(document.querySelector('h4').textContent).toBe('Candlestick');
    });

    it('ignores a non-string header', () => {
        //
        // propTypes objects to the type and setup.js treats that console.error as a
        // failure, so it is silenced deliberately -- what matters is that the component
        // falls back rather than rendering '42' as a heading.
        //
        const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});

        setup({ header: 42 });

        expect(document.querySelector('h4')).toBeNull();
        expect(quiet.mock.calls.flat().map(String).join(' ')).toContain('Invalid prop `header`');

        quiet.mockRestore();
    });

    it('gives each heading a slug id so it can be linked to', () => {
        setup({ header_summary: 'What It Does' });

        expect(document.querySelector('#what-it-does')).toBeTruthy();
    });
});

describe('the hover anchor', () => {
    it('is absent until the heading is hovered', () => {
        setup();

        expect(anchors()).toHaveLength(0);
    });

    it('appears on the summary heading while hovered', async () => {
        setup();

        await userEvent.hover(heading('Trigger Summary'));

        expect(anchors()).toHaveLength(1);
    });

    it('disappears again when the pointer leaves', async () => {
        setup();

        await userEvent.hover(heading('Trigger Summary'));
        await userEvent.unhover(heading('Trigger Summary'));

        expect(anchors()).toHaveLength(0);
    });

    it('appears on the integration heading too', async () => {
        //
        // the two headings track hover in separate state keys, so both need checking --
        // and only 'hover_hash_summary' is declared in the constructor. The integration
        // one works because undefined is falsy, not because it was initialised.
        //
        setup();

        await userEvent.hover(heading('Trigger Integration'));

        expect(anchors()).toHaveLength(1);
    });

    it('disappears again when the pointer leaves the integration heading', async () => {
        //
        // the leave handler is a second copy of the summary heading's, differing only
        // in the state key -- and the key it clears is the failure worth catching,
        // since clearing the other one leaves this anchor stuck on the page.
        //
        setup();

        await userEvent.hover(heading('Trigger Integration'));
        await userEvent.unhover(heading('Trigger Integration'));

        expect(anchors()).toHaveLength(0);
    });

    it('scrolls the integration heading into view when its anchor is clicked', async () => {
        const scroll = jest.fn();
        Element.prototype.scrollIntoView = scroll;

        setup({ header_integration: 'How It Connects' });
        await userEvent.hover(heading('How It Connects'));
        await userEvent.click(anchors()[0]);

        expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth' });

        delete Element.prototype.scrollIntoView;
    });

    it('links to the heading id on the current path', async () => {
        setup({ header_summary: 'What It Does' });

        await userEvent.hover(heading('What It Does'));

        expect(anchors()[0].getAttribute('href')).toContain('#what-it-does');
    });

    it('scrolls the heading into view when clicked', async () => {
        //
        // the anchor changes the url, and the handler is what makes the jump animate
        // rather than snap. jsdom has no scrollIntoView at all, so it is stubbed here
        // and asserted on.
        //
        const scroll = jest.fn();
        Element.prototype.scrollIntoView = scroll;

        setup({ header_summary: 'What It Does' });
        await userEvent.hover(heading('What It Does'));
        await userEvent.click(anchors()[0]);

        expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth' });

        delete Element.prototype.scrollIntoView;
    });

    it('tracks whichever key setHoverHash is given', () => {
        const { page } = setup();

        act(() => {
            page.setHoverHash('hover_hash_summary', true);
        });

        expect(page.state.hover_hash_summary).toBe(true);
    });
});

describe('the accordions', () => {
    it('renders one panel per entry', () => {
        setup({ accordion_summary: ACCORDIONS });

        expect(text()).toContain('First Panel');
        expect(text()).toContain('Second Panel');
    });

    it('starts with every panel closed', () => {
        const { page } = setup({ accordion_summary: ACCORDIONS });

        expect(page.state.accordion_summary_current).toBe(false);
    });

    it('opens the panel that was clicked', async () => {
        const { page } = setup({ accordion_summary: ACCORDIONS });

        await userEvent.click(panelButton('First Panel'));

        expect(page.state.accordion_summary_current).toBe('first');
    });

    it('closes the open panel when it is clicked again', () => {
        //
        // the toggle: the handler compares against the currently open id and clears it
        // on a match, which is what lets a visitor collapse the section entirely.
        //
        const { page } = setup({ accordion_summary: ACCORDIONS });

        act(() => {
            page.handleChangeSummaryAccordion('first');
        });
        act(() => {
            page.handleChangeSummaryAccordion('first');
        });

        expect(page.state.accordion_summary_current).toBe(false);
    });

    it('keeps only one panel open at a time', () => {
        //
        // a single 'current' id rather than a set, so opening the second closes the
        // first without the caller having to manage it.
        //
        const { page } = setup({ accordion_summary: ACCORDIONS });

        act(() => {
            page.handleChangeSummaryAccordion('first');
        });
        act(() => {
            page.handleChangeSummaryAccordion('second');
        });

        expect(page.state.accordion_summary_current).toBe('second');
    });

    it('tracks the integration accordions independently', () => {
        //
        // two separate state keys, so a panel open in one section does not collapse the
        // other. The handlers are otherwise identical copies.
        //
        const { page } = setup({
            accordion_summary: ACCORDIONS,
            accordion_integration: ACCORDIONS,
        });

        act(() => {
            page.handleChangeSummaryAccordion('first');
        });
        act(() => {
            page.handleChangeIntegrationAccordion('second');
        });

        expect(page.state.accordion_summary_current).toBe('first');
        expect(page.state.accordion_integration_current).toBe('second');
    });

    it('toggles an integration panel closed as well', () => {
        const { page } = setup({ accordion_integration: ACCORDIONS });

        act(() => {
            page.handleChangeIntegrationAccordion('first');
        });
        act(() => {
            page.handleChangeIntegrationAccordion('first');
        });

        expect(page.state.accordion_integration_current).toBe(false);
    });

    it('opens an integration panel that was clicked', async () => {
        //
        // the cases above call the handler directly, which leaves the integration
        // panels' own onChange unexercised -- and those are a copy of the summary
        // ones, so a panel wired to 'handleChangeSummaryAccordion' would open the
        // wrong section and pass every assertion above.
        //
        const { page } = setup({ accordion_integration: ACCORDIONS });

        await userEvent.click(panelButton('Second Panel'));

        expect(page.state.accordion_integration_current).toBe('second');
        expect(page.state.accordion_summary_current).toBe(false);
    });

    it('renders no panels when none are supplied', () => {
        setup();

        expect(document.querySelectorAll('[role="button"]')).toHaveLength(0);
    });
});

describe('the trigger table', () => {
    it('is absent without rows', () => {
        setup({ trigger_table_labels: LABELS });

        expect(document.querySelector('table')).toBeNull();
    });

    it('is absent without labels', () => {
        //
        // BOTH are required: rows with no column definitions would render an empty
        // table rather than nothing.
        //
        setup({ trigger_table: ROWS });

        expect(document.querySelector('table')).toBeNull();
    });

    it('renders once both are supplied', () => {
        setup({ trigger_table: ROWS, trigger_table_labels: LABELS });

        expect(document.querySelector('table')).toBeTruthy();
    });

    it('heads the table with the column labels', () => {
        setup({ trigger_table: ROWS, trigger_table_labels: LABELS });

        const headers = [...document.querySelectorAll('th')].map(h => h.textContent);
        expect(headers).toEqual(['Pattern', 'Count']);
    });

    it('renders a row per entry', () => {
        setup({ trigger_table: ROWS, trigger_table_labels: LABELS });

        expect(document.querySelectorAll('tbody tr')).toHaveLength(3);
    });

    it('applies a column formatter to a numeric value', () => {
        setup({ trigger_table: ROWS, trigger_table_labels: LABELS });

        expect(text()).toContain('12.00');
    });

    it('leaves a non-numeric value unformatted', () => {
        //
        // the formatter is applied only when the value is a number, so a column that
        // mixes numbers with 'n/a' does not crash on the string.
        //
        setup({
            trigger_table: [{ pattern: 'Doji', count: 'n/a' }],
            trigger_table_labels: LABELS,
        });

        expect(text()).toContain('n/a');
    });

    it('shows only the current page of rows', () => {
        setup({ trigger_table: ROWS, trigger_table_labels: LABELS, ...PAGED });

        expect(document.querySelectorAll('tbody tr')).toHaveLength(2);
    });

    it('moves to the next page of rows', () => {
        const { page } = setup({ trigger_table: ROWS, trigger_table_labels: LABELS, ...PAGED });

        act(() => {
            page.handleChangePage(null, 1);
        });

        expect(page.state.page).toBe(1);
        expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
    });

    it('coerces the rows-per-page value to a number', () => {
        //
        // the select hands back a STRING, and it is used to slice the row array -- so
        // without the '+' the arithmetic would concatenate rather than add.
        //
        const { page } = setup({ trigger_table: ROWS, trigger_table_labels: LABELS, ...PAGED });

        act(() => {
            page.handleChangeRowsPerPage({ target: { value: '10' } });
        });

        expect(page.state.rows_per_page).toBe(10);
        expect(typeof page.state.rows_per_page).toBe('number');
    });

    it('counts every row, not just the visible page', () => {
        //
        // the pagination control reports the full length, so a visitor can see there is
        // more than one page.
        //
        setup({ trigger_table: ROWS, trigger_table_labels: LABELS });

        expect(text()).toContain('3');
    });
});

describe('the supplied content', () => {
    it('renders the summary element', () => {
        setup({ summary: <p>a summary paragraph</p> });

        expect(text()).toContain('a summary paragraph');
    });

    it('renders the element below the summary', () => {
        setup({ summary_below: <p>below the summary</p> });

        expect(text()).toContain('below the summary');
    });

    it('renders the integration element', () => {
        setup({ summary_integration: <p>how it integrates</p> });

        expect(text()).toContain('how it integrates');
    });

    it('renders the footer', () => {
        setup({ footer: 'a closing note' });

        expect(document.querySelector('.summary-footer').textContent).toBe('a closing note');
    });

    it('leaves the footer empty when none is given', () => {
        setup();

        expect(document.querySelector('.summary-footer').textContent).toBe('');
    });

    it('ignores a non-string footer', () => {
        const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});

        setup({ footer: 99 });

        expect(document.querySelector('.summary-footer').textContent).toBe('');
        expect(quiet.mock.calls.flat().map(String).join(' ')).toContain('Invalid prop `footer`');

        quiet.mockRestore();
    });
});
