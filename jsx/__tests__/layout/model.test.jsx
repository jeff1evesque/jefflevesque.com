/**
 * model.test.jsx: the /model article listing page.
 *
 * ModelLayout is a shell. It renders a placeholder graphics row, a one-checkbox
 * category filter, and an ArticleListing that is handed a list containing a
 * single empty string -- which the listing discards, so the page always reports
 * zero models.
 *
 * Most of the component's state is unreachable. filterColumn() takes (style,
 * btn), but render() calls it with NO arguments, so btn is always false and the
 * whole `if (btn && this.state.display_filter_button)` branch is dead. Nothing
 * ever sets display_apply_filter_button or hide_all either, because the only
 * code that would is inside that branch. Three of the four state fields are
 * therefore inert, and the tests below pin that rather than pretending the
 * filter UI works.
 *
 * Note: a router is required -- ArticleListing renders its rows as NavLinks.
 *       No Provider is needed: ModelLayout imports the plain ArticleListing, not
 *       redux/container/article-listing.jsx.
 */

import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import ModelLayout from '../../import/layout/model.jsx';

function renderModel(props = {}) {
    const ref = React.createRef();

    render(
        <MemoryRouter>
            <ModelLayout ref={ref} {...props} />
        </MemoryRouter>
    );

    return ref;
}

describe('the page shell', () => {
    it('renders the placeholder graphics row', () => {
        //
        // 'graphics' is a literal text node in the markup, not a component. It
        // is pinned so that replacing it with a real chart is a visible change.
        //
        const { container } = render(
            <MemoryRouter><ModelLayout /></MemoryRouter>
        );

        expect(container.querySelector('.listing-graphic')).toHaveTextContent('graphics');
    });

    it('titles the listing "Models"', () => {
        renderModel();

        expect(screen.getByRole('heading', { name: 'Models' })).toBeInTheDocument();
    });

    it('reports zero models, because the list it passes down holds one empty string', () => {
        //
        // ModelLayout passes list_article={['']}. ArticleListing renders a row
        // only when renderDetail() returns something, and an empty string has no
        // 'detail', so every row is dropped and the count shows 0. The page has
        // never listed anything.
        //
        const { container } = render(
            <MemoryRouter><ModelLayout /></MemoryRouter>
        );

        expect(container.querySelector('.title-count')).toHaveTextContent('0');
        expect(container.querySelectorAll('.article-link')).toHaveLength(0);
    });

    it('suppresses the listing tag column', () => {
        const { container } = render(
            <MemoryRouter><ModelLayout /></MemoryRouter>
        );

        expect(container.querySelector('.article-tags')).not.toBeInTheDocument();
    });

    it('offers no sort options, because list_drop is empty', () => {
        renderModel();

        expect(screen.getByRole('button', { name: 'Sort' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'A-Z' })).not.toBeInTheDocument();
    });
});

describe('the category filter', () => {
    it('starts with StockMarket checked', () => {
        renderModel();

        expect(screen.getByRole('checkbox')).toBeChecked();
        expect(screen.getByText('StockMarket')).toBeInTheDocument();
    });

    it('unchecks and re-checks as it is clicked', () => {
        renderModel();
        const checkbox = screen.getByRole('checkbox');

        return userEvent.click(checkbox)
            .then(() => {
                expect(checkbox).not.toBeChecked();
                return userEvent.click(checkbox);
            })
            .then(() => {
                expect(checkbox).toBeChecked();
            });
    });

    it('does not change what is listed when it is toggled', async () => {
        //
        // WORTH KNOWING: display_performance drives nothing but the checkbox's
        // own checked attribute. It is not passed to ArticleListing and not read
        // anywhere else, so the filter is decorative.
        //
        const { container } = render(
            <MemoryRouter><ModelLayout /></MemoryRouter>
        );

        const before = container.querySelector('.article-listing').innerHTML;
        await userEvent.click(screen.getByRole('checkbox'));

        expect(container.querySelector('.article-listing').innerHTML).toBe(before);
        expect(container.querySelector('.title-count')).toHaveTextContent('0');
    });

    it('renders in the default desktop column style', () => {
        const { container } = render(
            <MemoryRouter><ModelLayout /></MemoryRouter>
        );

        expect(container.querySelector('.checkbox-vertical-default')).toBeInTheDocument();
        expect(container.querySelector('.checkbox-vertical-expanded')).not.toBeInTheDocument();
    });
});

describe('the unreachable mobile filter', () => {
    it('never shows the Category button', () => {
        //
        // render() calls this.filterColumn() with no arguments, so btn defaults
        // to false and the mobile button is never produced.
        //
        renderModel();

        expect(screen.queryByRole('button', { name: 'Category' })).not.toBeInTheDocument();
    });

    it('still has no Category button after the filter is used', async () => {
        renderModel();

        await userEvent.click(screen.getByRole('checkbox'));

        expect(screen.queryByRole('button', { name: 'Category' })).not.toBeInTheDocument();
    });

    it('blanks the whole page if hide_all is ever set', () => {
        //
        // hide_all is only assigned inside the unreachable branch, so this is
        // what the page WOULD do: render() drops both the filter and the listing
        // and leaves an empty container. Pinned because a future change that
        // makes the branch reachable inherits this behaviour.
        //
        const ref = renderModel();

        act(() => ref.current.setState({ hide_all: true }));

        expect(screen.queryByRole('heading', { name: 'Models' })).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('completes the expand-and-apply cycle when driven by hand', () => {
        //
        // calling filterColumn(style, btn) directly is the only way into this
        // half of the component. Walked end to end here to record what the dead
        // code was built to do, so that deleting it -- or wiring it up to the
        // mobile breakpoint the way header-menu.jsx does -- is a decision made
        // with the behaviour in front of you.
        //
        // The cycle is: Category hides the page and swaps the sidebar for an
        // expanded filter; Apply Filter puts the page back.
        //
        const ref = renderModel();

        const { container: trigger } = render(
            <MemoryRouter>{ref.current.filterColumn('default', true)}</MemoryRouter>
        );

        return userEvent.click(within(trigger).getByRole('button', { name: 'Category' }))
            .then(() => {
                expect(ref.current.state).toMatchObject({
                    display_filter_button: false,
                    display_apply_filter_button: true,
                    hide_all: true,
                });
                expect(screen.queryByRole('heading', { name: 'Models' })).not.toBeInTheDocument();

                const { container: expanded } = render(
                    <MemoryRouter>{ref.current.filterColumn('expanded')}</MemoryRouter>
                );

                expect(within(expanded).getByText('Edit Content Filter')).toBeInTheDocument();
                expect(expanded.querySelector('.checkbox-vertical-expanded')).toBeInTheDocument();
                expect(expanded.querySelector('.checkbox-vertical-default')).not.toBeInTheDocument();

                return userEvent.click(
                    within(expanded).getByRole('button', { name: 'Apply Filter' })
                );
            })
            .then(() => {
                expect(ref.current.state).toMatchObject({
                    display_filter_button: true,
                    display_apply_filter_button: false,
                    hide_all: false,
                });
                expect(screen.getByRole('heading', { name: 'Models' })).toBeInTheDocument();
            });
    });
});

describe('the error boundary', () => {
    it('does not show the fallback for the normal render', () => {
        renderModel();

        expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Models' })).toBeInTheDocument();
    });
});
