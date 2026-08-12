/**
 * article-listing.test.jsx: the shared listing component.
 *
 * Used by four layouts -- model, stream, data and home-page -- so it is the single
 * component behind every listing in the app. A change here is felt in all four,
 * which is why it earns direct tests rather than being covered incidentally
 * through them.
 *
 * The behaviour worth holding is the filter: it narrows a list held in state
 * against a second, untouched copy ('list_article_original'), which is what lets a
 * cleared search restore the full list. A filter that mutated the single source
 * would make the narrowing permanent, and only a clear-and-retype would reveal it.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import ArticleListing from '../../import/general/article-listing.jsx';

//
// Every one of the four callers passes 'list_article' as a prop, and the component
// treats props as the source of truth: it RENDERS from state but FILTERS from
// props, copying the prop into state on mount. So a realistic setup supplies it.
//
const LIST = [
    { name: 'StockMarket', link: '#', detail: { Health: '98%' } },
    { name: 'BLS', link: '#', detail: { Health: '91%' } },
    { name: 'SEC', link: '#', detail: { Health: '77%' } },
];

function setup(props = {}) {
    return render(
        <MemoryRouter>
            <ArticleListing title='Streams' {...props} />
        </MemoryRouter>
    );
}

function setupWithList(props = {}) {
    return setup({ list_article: LIST, ...props });
}

function filterBox() {
    return screen.getByPlaceholderText('Filter by name');
}

function bodyText() {
    return document.body.textContent.replace(/\s+/g, ' ');
}

describe('rendering', () => {
    it('shows the title it is given', () => {
        setup({ title: 'Data' });

        expect(bodyText()).toContain('Data');
    });

    it('counts the entries it is listing', () => {
        setup();

        expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('renders the default entry with its details', () => {
        //
        // the component ships a single seeded entry in state, which is what the
        // layouts replace once their data arrives. Before that this is what shows.
        //
        setup();

        const text = bodyText();
        expect(text).toContain('StockMarket');
        expect(text).toContain('Health');
        expect(text).toContain('Rate');
        expect(text).toContain('Stream Total');
    });

    it('renders each detail as a labelled value', () => {
        setup();

        const text = bodyText();
        expect(text).toContain('98%');
        expect(text).toContain('minute');
        expect(text).toContain('n/a');
    });

    it('offers a filter box and a sort control', () => {
        setup();

        expect(filterBox()).toBeInTheDocument();
        expect(screen.getByText('Sort')).toBeInTheDocument();
    });

    it('renders a tag section', () => {
        setup();

        expect(bodyText()).toContain('tag section');
    });
});

describe('the filter', () => {
    it('starts empty', () => {
        setupWithList();

        expect(filterBox()).toHaveValue('');
    });

    it('keeps a match and hides the rest', async () => {
        setupWithList();

        await userEvent.type(filterBox(), 'Stock');

        const text = bodyText();
        expect(text).toContain('StockMarket');
        expect(text).not.toContain('BLS');
    });

    it('is case insensitive', async () => {
        setupWithList();

        await userEvent.type(filterBox(), 'stockmarket');

        expect(bodyText()).toContain('StockMarket');
    });

    it('matches a substring, not just a prefix', async () => {
        setupWithList();

        await userEvent.type(filterBox(), 'Market');

        expect(bodyText()).toContain('StockMarket');
    });

    it('trims the search text', async () => {
        //
        // the value arrives straight from an input, so leading or trailing space is
        // easy to introduce and would otherwise match nothing.
        //
        setupWithList();

        await userEvent.type(filterBox(), '  BLS  ');

        expect(bodyText()).toContain('BLS');
    });

    it('shows nothing when nothing matches', async () => {
        setupWithList();

        await userEvent.type(filterBox(), 'zzzz-no-such-stream');

        const text = bodyText();
        expect(text).not.toContain('StockMarket');
        expect(text).not.toContain('BLS');
    });

    it('restores the full list when cleared', async () => {
        setupWithList();

        await userEvent.type(filterBox(), 'zzzz');
        expect(bodyText()).not.toContain('StockMarket');

        await userEvent.clear(filterBox());

        const text = bodyText();
        expect(text).toContain('StockMarket');
        expect(text).toContain('BLS');
        expect(text).toContain('SEC');
    });

    it('survives being narrowed, cleared and narrowed again', async () => {
        //
        // the compounding case. The filter reads the PROP each time rather than the
        // already-narrowed state, which is what makes this work -- narrowing the
        // single source would leave the second search with nothing to match.
        //
        setupWithList();

        await userEvent.type(filterBox(), 'Stock');
        await userEvent.clear(filterBox());
        await userEvent.type(filterBox(), 'SEC');

        expect(bodyText()).toContain('SEC');
    });

    it('reflects what was typed', async () => {
        setupWithList();

        await userEvent.type(filterBox(), 'abc');

        expect(filterBox()).toHaveValue('abc');
    });

    it('empties the list irrecoverably when no list_article prop was given', async () => {
        //
        // DOCUMENTS A HAZARD on a path no caller currently takes.
        //
        // The component seeds a placeholder entry into STATE, but search() filters
        // 'this.props.list_article'. With no such prop that is undefined, and
        // Object.assign([], undefined) is [] -- so any search empties the list, and
        // clearing the box assigns [] again rather than restoring the placeholder.
        //
        // Harmless today: all four callers pass the prop. It would bite the moment
        // someone rendered this component on its own state, and the symptom -- a
        // list that never comes back -- would not obviously point here.
        //
        setup();
        expect(bodyText()).toContain('StockMarket');

        await userEvent.type(filterBox(), 'Stock');
        expect(bodyText()).not.toContain('StockMarket');

        await userEvent.clear(filterBox());
        expect(bodyText()).not.toContain('StockMarket');
    });
});

describe('the sort control', () => {
    it('is clickable without breaking the listing', async () => {
        setup();

        await userEvent.click(screen.getByText('Sort'));

        expect(bodyText()).toContain('StockMarket');
    });
});

describe('props', () => {
    it('renders with no props at all', () => {
        //
        // every prop is optional, and three of the four layouts pass a different
        // subset, so a missing one must not stop it rendering.
        //
        expect(() => render(<MemoryRouter><ArticleListing /></MemoryRouter>)).not.toThrow();
    });

    it('accepts section tags', () => {
        expect(() => setup({ section_tags: ['alpha', 'beta'] })).not.toThrow();
    });

    it('accepts the stream_labels flag', () => {
        expect(() => setup({ stream_labels: true })).not.toThrow();
    });

    it('accepts a dispatch callback without calling it on mount', () => {
        //
        // the callback belongs to a user choosing an article; firing it on mount
        // would dispatch a selection nobody made.
        //
        const dispatchArticleProp = jest.fn();

        setup({ dispatchArticleProp });

        expect(dispatchArticleProp).not.toHaveBeenCalled();
    });
});
