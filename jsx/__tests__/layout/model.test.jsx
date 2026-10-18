/**
 * model.test.jsx: /model, every model and how it scores (#243).
 *
 * The page lists the models from the model api's listing, one list per task,
 * under filters by task and status, a score picker and a sort, and compares two
 * or three models of one task on a chart over the lists. What is compared is
 * kept in the address, '?compare=a,b', so a comparison can be linked.
 *
 * The api is replaced at source.js, so each case says what the listing answers.
 * Recharts is drawn for real, in a container given a size -- see sizedRecharts
 * in test-support/model-fixtures.js. A row and the comparison have tests of
 * their own, under layout/model/; these cases are about the page round them.
 */

jest.mock('recharts', () => require('../../test-support/model-fixtures.js').sizedRecharts());
jest.mock('../../import/layout/model/source.js', () => ({
    loadListing: jest.fn(),
    loadReport: jest.fn(),
}));

import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import ModelLayout, { linkedCompare, writeCompare } from '../../import/layout/model.jsx';
import { loadListing, loadReport } from '../../import/layout/model/source.js';
import { COMPARE_COLORS } from '../../import/layout/model/scores.js';
import { listingOf, modelOf, phoneScreen, trackOf, wideScreen } from '../../test-support/model-fixtures.js';

function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });

    return { promise, resolve };
}

function answer(listing = listingOf(), records = () => trackOf(5)) {
    loadListing.mockResolvedValue(listing);
    loadReport.mockImplementation((name) => Promise.resolve(records(name)));
}

async function open(props = {}) {
    const ref = React.createRef();
    let view;

    await act(async () => {
        view = render(
            <MemoryRouter>
                <ModelLayout ref={ref} {...props} />
            </MemoryRouter>
        );
    });

    return { ...view, ref };
}

//
// the address the page was opened at
//
function at(address) {
    window.history.replaceState(null, '', address);
}

function group(name) {
    return screen.getByRole('region', { name: name });
}

function namesIn(name) {
    return within(screen.getByRole('list', { name: `${name} models` }))
        .getAllByRole('link')
        .map((link) => link.textContent);
}

function box(name) {
    return screen.getByRole('checkbox', { name: `Compare ${name}` });
}

beforeEach(() => {
    loadListing.mockReset();
    loadReport.mockReset();
    at('/model');
});

describe('linkedCompare', () => {
    const { models } = listingOf();

    it('reads the models an address compares, each in the color slot of its place', () => {
        expect(linkedCompare('?compare=tables,pt-gnn', models)).toEqual([
            { name: 'tables', slot: 0 },
            { name: 'pt-gnn', slot: 1 },
        ]);
    });

    it('passes over a name the listing does not hold, one named twice, another task\'s, and a fourth', () => {
        const four = models.concat([modelOf({ name: 'fourth' })]);

        expect(linkedCompare('?compare=nope,pt-gnn,pt-gnn,beater, tables ,fresh,fourth', four).map((each) => each.name))
            .toEqual(['pt-gnn', 'tables', 'fresh']);
    });

    it('compares nothing where the address says nothing', () => {
        expect(linkedCompare('', models)).toEqual([]);
        expect(linkedCompare('?compare=', models)).toEqual([]);
    });
});

describe('writeCompare', () => {
    it('puts the comparison in the address, its commas as commas, in place of it rather than after it', () => {
        const length = window.history.length;

        writeCompare(['pt-gnn', 'tables']);

        expect(window.location.search).toBe('?compare=pt-gnn,tables');
        expect(window.history.length).toBe(length);
    });

    it('keeps whatever else the address holds', () => {
        at('/model?x=1#top');

        writeCompare(['pt-gnn']);

        expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/model?x=1&compare=pt-gnn#top');
    });

    it('takes the comparison out where nothing is compared', () => {
        at('/model?compare=pt-gnn,tables');

        writeCompare([]);

        expect(window.location.search).toBe('');
    });

    it('leaves an address that already says it alone', () => {
        at('/model?compare=pt-gnn,tables');

        const replace = jest.spyOn(window.history, 'replaceState');

        writeCompare(['pt-gnn', 'tables']);

        expect(replace).not.toHaveBeenCalled();
        replace.mockRestore();
    });
});

describe('the page before the listing', () => {
    it('titles itself "Models", and says it is loading', async () => {
        loadListing.mockReturnValue(new Promise(() => {}));

        await open();

        expect(screen.getByRole('heading', { name: 'Models' })).toBeInTheDocument();
        expect(screen.getByText('Loading the models…')).toBeInTheDocument();
        expect(document.querySelector('.model-count')).toHaveTextContent(/^$/);
    });

    it('says there are no models to show yet, and counts none, where the listing could not be had', async () => {
        answer(null);

        await open();

        expect(screen.getByText('No models to show yet.')).toBeInTheDocument();
        expect(document.querySelector('.model-count')).toHaveTextContent('0');
        expect(loadReport).not.toHaveBeenCalled();
    });

    it('says no models have been published yet for an empty listing', async () => {
        answer({ tasks: [], models: [] });

        await open();

        expect(screen.getByText('No models have been published yet.')).toBeInTheDocument();
        expect(document.querySelector('.model-count')).toHaveTextContent('0');
    });

    it('sets nothing once it has gone, whenever the listing or a record lands', async () => {
        const listing = deferred();

        loadListing.mockReturnValue(listing.promise);

        const first = await open();

        first.unmount();
        await act(async () => listing.resolve(listingOf()));
        expect(loadReport).not.toHaveBeenCalled();

        const record = deferred();

        loadListing.mockResolvedValue(listingOf());
        loadReport.mockReturnValue(record.promise);

        const second = await open();

        second.unmount();
        await act(async () => record.resolve(trackOf()));
        expect(loadReport).toHaveBeenCalledTimes(4);
    });
});

describe('the lists', () => {
    it('lists every model, one list per task, and counts them', async () => {
        answer();

        await open();

        expect(document.querySelector('.model-count')).toHaveTextContent('4');
        expect(within(group('Next-day direction')).getByText('3 models')).toBeInTheDocument();
        expect(within(group('Beat the average')).getByText('1 model')).toBeInTheDocument();
        expect(within(group('Next-day direction')).getByText('Up or down, scored the next day.')).toBeInTheDocument();
    });

    it('leaves out a task\'s line under its name where the listing has none', async () => {
        const listing = listingOf();

        listing.tasks[1].description = '';
        answer(listing);

        await open();

        expect(group('Beat the average').querySelector('.model-group-detail')).toBeNull();
    });

    it('asks for each model\'s track record, for its trend line', async () => {
        answer();

        await open();

        expect(loadReport.mock.calls.map((call) => call.join(' '))).toEqual([
            'pt-gnn track-record', 'tables track-record', 'fresh track-record', 'beater track-record',
        ]);
    });

    it('draws a trend line once a record is in, and passes over one that could not be had', async () => {
        answer(listingOf(), (name) => (name === 'tables' ? null : trackOf(5)));

        await open();

        expect(screen.getByRole('img', { name: 'pt-gnn\'s 20-day Loss, over the last 60 days' })).toBeInTheDocument();
        expect(group('Next-day direction').querySelector('.model-trend-none')).toHaveAttribute('title', 'Could not be loaded');
    });

    it('sorts by the best score to start with', async () => {
        answer();

        await open();

        expect(namesIn('Next-day direction')).toEqual(['pt-gnn', 'tables', 'fresh']);
    });

    it('sorts by what the sort menu says', async () => {
        answer();
        await open();

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'name');
        expect(namesIn('Next-day direction')).toEqual(['fresh', 'pt-gnn', 'tables']);

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'went');
        expect(namesIn('Next-day direction')).toEqual(['tables', 'pt-gnn', 'fresh']);
    });

    it('heads the score\'s column with the score picked, and sorts by it', async () => {
        answer();

        await open({ score: 'acc_up' });

        expect(group('Next-day direction').querySelector('.model-list-head')).toHaveTextContent('Up/down accuracy, last 20 days');
        expect(namesIn('Next-day direction')).toEqual(['tables', 'pt-gnn', 'fresh']);
    });

    it('hands the score picked up, for both pages to show', async () => {
        const onScore = jest.fn();

        answer();
        await open({ onScore: onScore });

        await userEvent.click(screen.getByRole('button', { name: 'Beat-the-average AUC' }));

        expect(onScore).toHaveBeenCalledWith('auc_beats');
    });
});

describe('the title', () => {
    it('says what the models are for, what they read and what they predict, linking the graph and the data (#251)', async () => {
        answer();
        await open();

        const lede = document.querySelector('.model-lede');

        expect(lede).toHaveTextContent(
            'Each night these models read the day’s knowledge graph, built from the data this site collects, and predict '
            + 'how each S&P 500 stock will move the next trading day. Once that day’s prices are in, every prediction is '
            + 'graded against a guess that knows nothing, to show whether the data can predict the market at all.'
        );
        expect(within(lede).getByRole('link', { name: 'knowledge graph' })).toHaveAttribute('href', '/graph');
        expect(within(lede).getByRole('link', { name: 'data this site collects' })).toHaveAttribute('href', '/stream');
    });
});

describe('the filters', () => {
    afterEach(wideScreen);

    //
    // the filters' column, and the button that is its heading, named as it is
    // while the column is open
    //
    function filters() {
        return screen.getByRole('complementary', { name: 'Filters' });
    }

    it('offer every task and every status as a row, pressed while its models are shown, with how many it holds', async () => {
        answer();
        await open();

        const rows = within(filters()).getAllByRole('button', { pressed: true });

        expect(rows.map((row) => row.textContent)).toEqual(['Next-day direction3', 'Beat the average1', 'Live2', 'New1', 'Retired1']);
        expect(within(filters()).queryByRole('checkbox')).toBeNull();
        expect(within(filters()).getByRole('region', { name: 'What it predicts' })).toBeInTheDocument();
        expect(within(filters()).getByRole('region', { name: 'Status' })).toBeInTheDocument();
    });

    it('hide a task\'s list when its row is pressed, and show it again when it is pressed again (#251)', async () => {
        answer();
        await open();

        const row = screen.getByRole('button', { name: 'Beat the average 1' });

        await userEvent.click(row);

        expect(row).toHaveAttribute('aria-pressed', 'false');
        expect(screen.queryByRole('region', { name: 'Beat the average' })).toBeNull();
        expect(document.querySelector('.model-count')).toHaveTextContent('3 of 4');

        await userEvent.click(row);

        expect(row).toHaveAttribute('aria-pressed', 'true');
        expect(group('Beat the average')).toBeInTheDocument();
        expect(document.querySelector('.model-count')).toHaveTextContent('4');
    });

    it('hide the models of a status when its row is pressed', async () => {
        answer();
        await open();

        await userEvent.click(screen.getByRole('button', { name: 'New 1' }));

        expect(namesIn('Next-day direction')).toEqual(['pt-gnn', 'tables']);
    });

    it('say so when they leave no model', async () => {
        answer();
        await open();

        await userEvent.click(screen.getByRole('button', { name: 'Next-day direction 3' }));
        await userEvent.click(screen.getByRole('button', { name: 'Beat the average 1' }));

        expect(screen.getByText('No model matches these filters.')).toBeInTheDocument();
        expect(document.querySelector('.model-count')).toHaveTextContent('0 of 4');
    });

    it('open on a wide screen, and fold to a rail by the arrow on its edge or by its heading (#251)', async () => {
        answer();
        await open();

        const heading = within(filters()).getByRole('button', { name: 'Filters' });

        expect(filters()).toHaveClass('model-filters-open');
        expect(heading).toHaveAttribute('aria-expanded', 'true');

        await userEvent.click(within(filters()).getByRole('button', { name: 'Collapse the filters' }));

        expect(filters()).toHaveClass('model-filters-closed');
        expect(heading).toHaveAttribute('aria-expanded', 'false');
        expect(within(filters()).queryByRole('button', { name: 'Collapse the filters' })).toBeNull();

        await userEvent.click(heading);

        expect(filters()).toHaveClass('model-filters-open');
        expect(heading).toHaveAttribute('aria-expanded', 'true');

        await userEvent.click(heading);

        expect(filters()).toHaveClass('model-filters-closed');
    });

    it('say while folded how many models they show, and how many of them where some are hidden', async () => {
        answer();
        await open();

        const heading = within(filters()).getByRole('button', { name: 'Filters' });

        expect(heading.querySelector('.model-filters-summary')).toBeNull();

        await userEvent.click(heading);

        expect(heading.querySelector('.model-filters-summary')).toHaveTextContent(/^4 models$/);

        await userEvent.click(heading);
        await userEvent.click(screen.getByRole('button', { name: 'New 1' }));
        await userEvent.click(heading);

        expect(heading.querySelector('.model-filters-summary')).toHaveTextContent(/^3 of 4 models$/);
    });

    it('start folded on a phone, as a band that opens when it is tapped', async () => {
        phoneScreen();
        answer();
        await open();

        const heading = within(filters()).getByRole('button', { name: 'Filters 4 models' });

        expect(filters()).toHaveClass('model-filters-closed');
        expect(heading).toHaveAttribute('aria-expanded', 'false');

        await userEvent.click(heading);

        expect(filters()).toHaveClass('model-filters-open');
    });
});

describe('compare', () => {
    it('says how to start one, then how to finish it', async () => {
        answer();
        await open();

        expect(screen.getByText('Tick two or three models that predict the same thing to compare them.')).toBeInTheDocument();

        await userEvent.click(box('pt-gnn'));

        expect(screen.getByText('Tick one or two more Next-day direction models to compare them with pt-gnn.')).toBeInTheDocument();
    });

    it('draws the comparison once two of one task are ticked, and writes it in the address', async () => {
        answer();
        await open();

        await userEvent.click(box('pt-gnn'));
        await userEvent.click(box('tables'));

        expect(screen.getByRole('heading', { name: 'Comparing pt-gnn and tables' })).toBeInTheDocument();
        expect(window.location.search).toBe('?compare=pt-gnn,tables');
    });

    it('lets no model of another task be ticked beside them, and says why', async () => {
        answer();
        await open();

        await userEvent.click(box('pt-gnn'));

        expect(box('beater')).toBeDisabled();
        expect(box('tables')).toBeEnabled();
    });

    it('lets no fourth be ticked', async () => {
        const listing = listingOf();

        listing.models.push(modelOf({ name: 'fourth' }));
        answer(listing);
        await open();

        await userEvent.click(box('pt-gnn'));
        await userEvent.click(box('tables'));
        await userEvent.click(box('fresh'));

        expect(box('fourth')).toBeDisabled();
        expect(screen.getByRole('heading', { name: 'Comparing pt-gnn, tables and fresh' })).toBeInTheDocument();
    });

    it('turns down a model that cannot be ticked, however it is asked', async () => {
        answer();
        const { ref } = await open();

        await userEvent.click(box('pt-gnn'));
        act(() => ref.current.pick(listingOf().models[3]));

        expect(ref.current.state.picked.map((each) => each.name)).toEqual(['pt-gnn']);
    });

    it('keeps each model\'s color while it stays ticked, and gives a freed one to the next ticked', async () => {
        answer();
        const { container } = await open();
        const swatch = (name) => box(name).closest('.model-row').querySelector('.model-swatch');

        await userEvent.click(box('pt-gnn'));
        await userEvent.click(box('tables'));
        await userEvent.click(box('fresh'));

        expect(swatch('fresh')).toHaveStyle({ backgroundColor: COMPARE_COLORS[2] });

        await userEvent.click(box('pt-gnn'));

        expect(swatch('tables')).toHaveStyle({ backgroundColor: COMPARE_COLORS[1] });
        expect(swatch('fresh')).toHaveStyle({ backgroundColor: COMPARE_COLORS[2] });
        expect(swatch('pt-gnn')).toBeNull();
        expect(window.location.search).toBe('?compare=tables,fresh');

        await userEvent.click(box('pt-gnn'));

        expect(swatch('pt-gnn')).toHaveStyle({ backgroundColor: COMPARE_COLORS[0] });
        expect(window.location.search).toBe('?compare=pt-gnn,tables,fresh');

        const lines = [...container.querySelectorAll('.model-compare .recharts-line-curve')].map((line) => line.getAttribute('stroke'));

        expect(lines).toEqual(expect.arrayContaining(COMPARE_COLORS));
    });

    it('is cleared from its button, and from the address', async () => {
        answer();
        await open();

        await userEvent.click(box('pt-gnn'));
        await userEvent.click(box('tables'));
        await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

        expect(screen.queryByRole('heading', { name: /^Comparing/ })).toBeNull();
        expect(box('pt-gnn')).not.toBeChecked();
        expect(window.location.search).toBe('');
    });

    it('reopens from an address that names one', async () => {
        at('/model?compare=tables,pt-gnn');
        answer();

        await open();

        expect(screen.getByRole('heading', { name: 'Comparing tables and pt-gnn' })).toBeInTheDocument();
        expect(box('tables')).toBeChecked();
        expect(box('pt-gnn')).toBeChecked();
    });

    it('rewrites an address that names what cannot be compared as what it does compare', async () => {
        at('/model?compare=pt-gnn,nope,beater');
        answer();

        await open();

        expect(window.location.search).toBe('?compare=pt-gnn');
    });
});
