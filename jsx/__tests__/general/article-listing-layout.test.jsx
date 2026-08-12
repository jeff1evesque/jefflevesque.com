/**
 * article-listing-layout.test.jsx: what each listing row renders and dispatches.
 *
 * The third and last slice of this component. article-listing.test.jsx covers the
 * filter, article-listing-sort.test.jsx the comparators; this covers layout(), which
 * is the largest method and the one with the most branching -- the sort dropdown, the
 * two mutually exclusive row shapes, and the redux dispatch a stock-split row makes
 * when it is clicked.
 *
 * The dispatch is worth the most attention. It reads five fields off item.performance,
 * each with its own fallback to 'n/a', and it exists TWICE -- once for the row shape
 * with a control tray and once for the plain link. The two copies are character for
 * character identical, so both are driven here: a fix applied to one and not the other
 * would otherwise pass.
 */

import React from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import streamName from '../../import/general/stream-name.js';
import ArticleListing from '../../import/general/article-listing.jsx';

//
// a stock-split row, the only kind that dispatches. 'detail' must be non-empty or
// renderDetail returns null and layout() drops the row entirely.
//
function splitRow(overrides = {}) {
    return {
        name: 'aapl',
        link: '/data?symbol=aapl',
        type: 'stock-split',
        detail: { Ratio: '4:1', Date: '09/10/2026' },
        performance: {
            started_on: '09/10/2026 09:00',
            completed_on: '09/10/2026 09:05',
            retry: 0,
            expected_runtime: 5.5,
            actual_runtime: 4.25,
        },
        ...overrides,
    };
}

function setup(props = {}) {
    const dispatchArticleProp = jest.fn();

    const utils = render(
        <MemoryRouter>
            <ArticleListing
                title='Streams'
                dispatchArticleProp={dispatchArticleProp}
                {...props}
            />
        </MemoryRouter>
    );

    return { ...utils, dispatchArticleProp };
}

const rows = () => [...document.querySelectorAll('.article-link')];
const dropdownItems = () => [...document.querySelectorAll('.dropdown-item')];
const article = (dispatch) => dispatch.mock.calls[0][0].article;

describe('the sort dropdown', () => {
    it('renders an item per list_drop entry', async () => {
        setup({ list_drop: ['None', 'A-Z', 'Health'], list_article: [splitRow()] });

        await userEvent.click(document.querySelector('#dropdown-item-button'));

        expect(dropdownItems().map(i => i.textContent)).toEqual(['None', 'A-Z', 'Health']);
    });

    it('falls back to its own two options when the caller gives none', async () => {
        //
        // model.jsx passes an empty array deliberately, but a caller that omits the prop
        // entirely gets A-Z and None rather than an empty menu.
        //
        setup({ list_article: [splitRow()] });

        await userEvent.click(document.querySelector('#dropdown-item-button'));

        expect(dropdownItems().map(i => i.textContent)).toEqual(['A-Z', 'None']);
    });

    it('renders no items at all for an empty list_drop', async () => {
        setup({ list_drop: [], list_article: [splitRow()] });

        await userEvent.click(document.querySelector('#dropdown-item-button'));

        expect(dropdownItems()).toHaveLength(0);
    });

    it('marks the chosen item active', async () => {
        setup({ list_drop: ['None', 'A-Z'], list_article: [splitRow()] });

        await userEvent.click(document.querySelector('#dropdown-item-button'));
        await userEvent.click(dropdownItems()[1]);
        await userEvent.click(document.querySelector('#dropdown-item-button'));

        expect(dropdownItems()[1].className).toContain('active');
    });

    it('moves the active mark when a different item is chosen', async () => {
        //
        // the handler clears every previously marked item before setting the new one, so
        // exactly one option reads as current.
        //
        setup({ list_drop: ['A-Z', 'None'], list_article: [splitRow()] });

        await userEvent.click(document.querySelector('#dropdown-item-button'));
        await userEvent.click(dropdownItems()[0]);
        await userEvent.click(document.querySelector('#dropdown-item-button'));
        await userEvent.click(dropdownItems()[1]);
        await userEvent.click(document.querySelector('#dropdown-item-button'));

        expect(dropdownItems().filter(i => i.className.includes('active'))).toHaveLength(1);
    });
});

describe('the order button', () => {
    it('does nothing until a sort has been chosen', async () => {
        //
        // reversing an unsorted listing is meaningless, and handleSelect would be handed
        // null as the key -- which the comparator cannot use.
        //
        const { container } = setup({ list_article: [splitRow(), splitRow({ name: 'msft' })] });
        const before = rows().map(r => r.textContent);

        await userEvent.click(container.querySelector('.svg-order button'));

        expect(rows().map(r => r.textContent)).toEqual(before);
    });

    it('reverses the listing once a sort is active', async () => {
        const { container } = setup({
            list_drop: ['A-Z'],
            list_article: [splitRow({ name: 'aapl' }), splitRow({ name: 'msft' })],
        });

        await userEvent.click(document.querySelector('#dropdown-item-button'));
        await userEvent.click(dropdownItems()[0]);
        const ascending = rows().map(r => r.querySelector('h6').textContent);

        await userEvent.click(container.querySelector('.svg-order button'));

        expect(rows().map(r => r.querySelector('h6').textContent)).toEqual([...ascending].reverse());
    });
});

describe('the row label', () => {
    it('shows the raw name by default, which is what a ticker needs', () => {
        //
        // the home-page stock-split column lists SYMBOLS. Mapping unconditionally would
        // rewrite any ticker colliding with a stream id -- a symbol 'bls' would render as
        // 'Bureau of Labor Statistics'.
        //
        setup({ list_article: [splitRow({ name: 'bls' })] });

        expect(rows()[0].querySelector('h6').textContent).toBe('bls');
    });

    it('maps ids to display names when the caller opts in', () => {
        setup({
            stream_labels: true,
            list_article: [{ name: 'StockMarket', link: '#', detail: { Health: '98%' } }],
        });

        expect(rows()[0].querySelector('h6').textContent).toBe(streamName('StockMarket'));
    });
});

describe('the two row shapes', () => {
    it('renders a plain row as a link to its target', () => {
        setup({ list_article: [splitRow()] });

        expect(rows()[0].tagName.toLowerCase()).toBe('a');
        expect(rows()[0].getAttribute('href')).toContain('symbol=aapl');
    });

    it('renders a row with a control tray as a div instead', () => {
        //
        // a tray carries its own controls, so the row must not also be a navigation
        // link -- a click on a control would otherwise route away.
        //
        setup({ list_article: [splitRow({ control_tray: <button>tray</button> })] });

        expect(rows()[0].tagName.toLowerCase()).toBe('div');
        expect(rows()[0].textContent).toContain('tray');
    });

    it('renders a loader beside the name when one is supplied', () => {
        setup({ list_article: [splitRow({ control_tray: <span>t</span>, loader: <i>spin</i> })] });

        expect(rows()[0].textContent).toContain('spin');
    });

    it('sends a row with no usable link to the site root', () => {
        //
        // WORTH KNOWING. layout() substitutes '#' for a missing or placeholder link,
        // meaning "nowhere" -- but this is a react-router NavLink, and it resolves '#'
        // to the current basename, so the href is '/'. Clicking such a row navigates to
        // the HOME page rather than doing nothing.
        //
        // Harmless where it happens today (the stream listing's rows all carry links),
        // but it is not the inert row the '#' suggests. A plain <div>, as the
        // control-tray shape already uses, would be inert.
        //
        setup({ list_article: [splitRow({ link: null })] });

        expect(rows()[0].getAttribute('href')).toBe('/');
    });

    it('drops a row whose detail renders to nothing', () => {
        //
        // layout() filters the nulls out, so an entry with nothing to show is absent
        // rather than an empty card -- and the heading count reflects that.
        //
        setup({ list_article: [splitRow(), { name: 'empty', detail: {} }] });

        expect(rows()).toHaveLength(1);
        expect(document.querySelector('.title-count').textContent).toBe('1');
    });
});

describe('clicking a stock-split row', () => {
    it.each([
        ['as a link', {}],
        ['with a control tray', { control_tray: <span>tray</span> }],
    ])('dispatches the split article %s', async (name, extra) => {
        //
        // the handler exists twice, once per row shape, character for character
        // identical. Both are driven so a fix to one copy alone cannot pass.
        //
        const { dispatchArticleProp } = setup({ list_article: [splitRow(extra)] });

        await userEvent.click(rows()[0]);

        expect(dispatchArticleProp).toHaveBeenCalledTimes(1);
        expect(article(dispatchArticleProp)).toMatchObject({
            type: 'stock-split',
            ticker: 'aapl',
            date: '09/10/2026',
            clicked: true,
            started_on: '09/10/2026 09:00',
            completed_on: '09/10/2026 09:05',
            retry: 0,
            expected_runtime: 5.5,
            actual_runtime: 4.25,
        });
    });

    it.each([
        ['started_on'],
        ['completed_on'],
        ['retry'],
    ])('defaults a missing %s to n/a', async (field) => {
        const performance = { ...splitRow().performance };
        delete performance[field];
        const { dispatchArticleProp } = setup({ list_article: [splitRow({ performance })] });

        await userEvent.click(rows()[0]);

        expect(article(dispatchArticleProp)[field]).toBe('n/a');
    });

    it.each([
        ['expected_runtime'],
        ['actual_runtime'],
    ])('defaults a non-numeric %s to n/a', async (field) => {
        //
        // the two runtimes are validated rather than merely present-checked, because they
        // are rendered as figures -- 'n/a' is the only non-numeric value the sheet can
        // show.
        //
        const performance = { ...splitRow().performance, [field]: 'soon' };
        const { dispatchArticleProp } = setup({ list_article: [splitRow({ performance })] });

        await userEvent.click(rows()[0]);

        expect(article(dispatchArticleProp)[field]).toBe('n/a');
    });

    it('dispatches nothing for a row of another type', async () => {
        const { dispatchArticleProp } = setup({
            list_article: [splitRow({ type: 'stream' })],
        });

        await userEvent.click(rows()[0]);

        expect(dispatchArticleProp).not.toHaveBeenCalled();
    });

    it('dispatches nothing for a split row carrying no performance', async () => {
        const row = splitRow();
        delete row.performance;
        const { dispatchArticleProp } = setup({ list_article: [row] });

        await userEvent.click(rows()[0]);

        expect(dispatchArticleProp).not.toHaveBeenCalled();
    });

    it('dispatches nothing for a row with no type at all', async () => {
        const row = splitRow();
        delete row.type;
        const { dispatchArticleProp } = setup({ list_article: [row] });

        await userEvent.click(rows()[0]);

        expect(dispatchArticleProp).not.toHaveBeenCalled();
    });
});

describe('the left column', () => {
    it('is shown by default', () => {
        setup({ list_article: [splitRow()] });

        expect(document.querySelector('.article-tags')).toBeTruthy();
    });

    it('is omitted when the caller turns it off', () => {
        //
        // home-page renders two listings side by side and suppresses both tag columns.
        //
        setup({ left_column: false, list_article: [splitRow()] });

        expect(document.querySelector('.article-tags')).toBeNull();
    });
});

describe('the filter box', () => {
    it('is labelled with the column it searches', () => {
        setup({ list_article: [splitRow()] });

        expect(document.querySelector('input.form-control').getAttribute('placeholder'))
            .toBe('Filter by name');
    });

    it('names a custom search column', () => {
        setup({ search_column: 'ticker', list_article: [splitRow()] });

        expect(document.querySelector('input.form-control').getAttribute('placeholder'))
            .toBe('Filter by ticker');
    });
});
