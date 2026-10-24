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

//
// the reader's subscriptions, for the bells (#255). Signed out unless a case says
// otherwise -- and the api's session reader imports Amplify, which jest cannot load
// unmocked
//
jest.mock('../../import/general/account-api.js', () => ({
    __esModule: true,
    listSubscriptions: jest.fn(),
}));

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import ModelLayout, { linkedCompare, writeCompare } from '../../import/layout/model.jsx';
import { loadListing, loadReport } from '../../import/layout/model/source.js';
import { listSubscriptions } from '../../import/general/account-api.js';
import { COMPARE_COLORS, SCORES, formatScore, noteOf } from '../../import/layout/model/scores.js';
import { readLayout, writeLayout } from '../../import/general/layout-preference.js';
import {
    OPTIONS_TASK,
    behindOf,
    downModelOf,
    heldListingOf,
    heldModelOf,
    heldTrackOf,
    listingOf,
    modelOf,
    optionsListingOf,
    optionsTrackOf,
    phoneScreen,
    trackOf,
    wideScreen,
    withAverageDays,
    withTop10,
} from '../../test-support/model-fixtures.js';

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

//
// the models a list names, in its order: the links of their names, and not the
// bells beside them (#255)
//
function namesIn(name) {
    return within(screen.getByRole('list', { name: `${name} models` }))
        .getAllByRole('link')
        .filter((link) => link.classList.contains('model-name'))
        .map((link) => link.textContent);
}

function box(name) {
    return screen.getByRole('checkbox', { name: `Compare ${name}` });
}

beforeEach(() => {
    loadListing.mockReset();
    loadReport.mockReset();
    listSubscriptions.mockReset();
    listSubscriptions.mockResolvedValue(null);
    at('/model');
    // the filters' fold and width are kept, as a reader's are (#253)
    window.localStorage.clear();
});

describe('the bells (#255)', () => {
    //
    // one on every row whose model can still go live, leading to its alarm page,
    // and ringing for a reader who holds its alarm -- from one ask of the reader's
    // subscriptions, for every row, as /stream asks
    //
    const LIVE = { alarm: 'live', since: '2026-10-18T12:00:00Z', terms: '2026-10' };
    const bellOf = (name) => document.querySelector(`a[href="/model/${name}/alarm"] svg`);

    it('gives every model that has not retired a plain bell, for a reader signed out', async () => {
        answer();
        await open();

        ['pt-gnn', 'tables', 'fresh'].forEach((name) => {
            expect(bellOf(name)).toHaveAttribute('data-testid', 'NotificationsIcon');
        });
        expect(document.querySelector('a[href="/model/beater/alarm"]')).toBeNull();
    });

    it('rings the bell of a model whose alarm the reader holds, and no other', async () => {
        listSubscriptions.mockResolvedValue([{ model: 'tables', ...LIVE }]);
        answer();
        await open();

        expect(screen.getByRole('link', { name: 'Alarm for tables: subscribed' })).toHaveAttribute('href', '/model/tables/alarm');
        expect(bellOf('tables')).toHaveAttribute('data-testid', 'NotificationsActiveIcon');
        expect(bellOf('pt-gnn')).toHaveAttribute('data-testid', 'NotificationsIcon');
        expect(bellOf('fresh')).toHaveAttribute('data-testid', 'NotificationsIcon');
    });

    it('lights no bell for a stream\'s alarm, even one sharing a model\'s name', async () => {
        listSubscriptions.mockResolvedValue([{ stream: 'pt-gnn', alarm: 'ingest', since: '2026-09-26T12:00:00Z', terms: '2026-09' }]);
        answer();
        await open();

        expect(bellOf('pt-gnn')).toHaveAttribute('data-testid', 'NotificationsIcon');
    });

    it('asks for the subscriptions once, for the whole list', async () => {
        answer();
        await open();

        expect(listSubscriptions).toHaveBeenCalledTimes(1);
        expect(screen.getAllByRole('link', { name: /^Alarm for / })).toHaveLength(3);
    });

    it('leaves every bell plain when the subscriptions could not be listed', async () => {
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        listSubscriptions.mockRejectedValue(new Error('busy, try again'));
        answer();
        await open();

        expect(quiet).toHaveBeenCalledWith(expect.stringContaining('busy, try again'));
        expect(bellOf('pt-gnn')).toHaveAttribute('data-testid', 'NotificationsIcon');

        quiet.mockRestore();
    });

    it('lets the subscriptions go when they land after the page has', async () => {
        const late = deferred();

        listSubscriptions.mockReturnValue(late.promise);
        answer();

        const { unmount } = await open();

        unmount();

        await act(async () => late.resolve([{ model: 'pt-gnn', ...LIVE }]));

        expect(document.querySelector('a[href="/model/pt-gnn/alarm"]')).toBeNull();
    });
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

    describe('while the listing is on its way, its own shape (#274)', () => {
        afterEach(wideScreen);

        function waiting(props = {}) {
            loadListing.mockReturnValue(new Promise(() => {}));

            return open(props);
        }

        function filters() {
            return screen.getByRole('complementary', { name: 'Filters' });
        }

        it('says it is loading to a screen reader, in a line the page does not show, and holds a bar for the count', async () => {
            await waiting();

            expect(screen.getByRole('status')).toHaveTextContent(/^Loading the models…$/);
            expect(screen.getByRole('status')).toHaveClass('visually-hidden');
            expect(document.querySelector('.model-count > .graph-pending-bar')).not.toBeNull();
        });

        it('opens the filters on a wide screen, each status named over a bar for its count, and the task a bar', async () => {
            await waiting();

            const rows = [...filters().querySelectorAll('.model-filter-pending')];

            expect(filters()).toHaveClass('model-filters-open');
            expect(rows.map((row) => row.textContent)).toEqual(['', 'Live', 'New', 'Behind baseline', 'Retired']);
            rows.forEach((row) => expect(row.querySelector('.model-filter-count > .graph-pending-bar')).not.toBeNull());
            expect(filters().querySelector('.model-filter-sets')).toHaveAttribute('aria-hidden', 'true');
        });

        it('folds the filters to a band on a phone, with a bar for how many it shows, and opens it when tapped', async () => {
            phoneScreen();
            await waiting();

            const band = within(filters()).getByRole('button', { name: 'Filters' });

            expect(filters()).toHaveClass('model-filters-closed');
            expect(band.querySelector('.model-filters-summary > .graph-pending-bar')).not.toBeNull();

            await userEvent.click(band);

            expect(filters()).toHaveClass('model-filters-open');
        });

        it('sizes a folded column\'s bar by the stylesheet, so it runs down a wide screen\'s rail rather than across it', async () => {
            //
            // a width of its own stood across the rail, whose words are turned on
            // their side, and made it 74px wide -- see '_model.scss'
            //
            writeLayout('model', 'wide', { fold: { filters: true } });
            await waiting();

            expect(filters()).toHaveClass('model-filters-closed');
            expect(filters().querySelector('.model-filters-summary > .graph-pending-bar')).not.toHaveAttribute('style');
        });

        it('draws the sort, which works before the listing lands, the hint, and the list\'s score picker as its name over bars (#279)', async () => {
            await waiting();

            await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'name');

            const picker = document.querySelector('.model-group .model-picker-pending');

            expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveValue('name');
            expect(screen.getByText('Tick two or three models that predict the same thing to compare them.')).toHaveClass('model-hint');
            expect(picker.querySelector('.model-control-label')).toHaveTextContent('Score');
            expect(screen.queryByRole('group', { name: 'Score' })).toBeNull();
        });

        it('draws two rows of bars in the list\'s box, laid out as its rows will be, each with its box disabled and no bell', async () => {
            await waiting();

            const rows = [...document.querySelectorAll('.model-row-pending')];

            expect(rows).toHaveLength(2);
            expect(document.querySelector('.model-list-head')).toBeNull();
            expect([...rows[0].children].map((cell) => cell.classList[1]))
                .toEqual(['model-cell-compare', 'model-cell-model', 'model-cell-parts', 'model-cell-trend', 'model-cell-since']);
            rows.forEach((row) => {
                expect(row.querySelector('input[type="checkbox"]')).toBeDisabled();
                expect(row.querySelector('.control-tray')).toBeNull();
            });
        });

        it('gives the bars\' places to the lists once the listing lands, sorted as the sort was set while it waited', async () => {
            const listing = deferred();

            loadListing.mockReturnValue(listing.promise);
            loadReport.mockResolvedValue(trackOf(5));
            await open();
            await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'name');

            await act(async () => listing.resolve(listingOf()));

            expect(document.querySelector('.model-row-pending')).toBeNull();
            expect(screen.queryByRole('status')).toBeNull();
            expect(document.querySelector('.model-count')).toHaveTextContent('4');
            expect(namesIn('Next-day direction')).toEqual(['fresh', 'pt-gnn', 'tables']);
        });
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

    describe('folding a list under its name (#300)', () => {
        const foldOf = (name) => within(group(name)).getByRole('button', { name: name });

        it('opens every list on a first visit, each name saying so', async () => {
            answer();

            await open();

            expect(foldOf('Next-day direction')).toHaveAttribute('aria-expanded', 'true');
            expect(foldOf('Beat the average')).toHaveAttribute('aria-expanded', 'true');
        });

        it('folds a list down to its name and count, and opens it again, leaving the other open', async () => {
            answer();

            await open();
            await userEvent.click(foldOf('Next-day direction'));

            const folded = group('Next-day direction');

            expect(foldOf('Next-day direction')).toHaveAttribute('aria-expanded', 'false');
            expect(within(folded).getByText('3 models')).toBeInTheDocument();
            expect(folded.querySelector('.model-group-detail')).toBeNull();
            expect(within(folded).queryByRole('group', { name: 'Score' })).toBeNull();
            expect(screen.queryByRole('list', { name: 'Next-day direction models' })).toBeNull();
            expect(screen.getByRole('list', { name: 'Beat the average models' })).toBeInTheDocument();

            await userEvent.click(foldOf('Next-day direction'));

            expect(foldOf('Next-day direction')).toHaveAttribute('aria-expanded', 'true');
            expect(namesIn('Next-day direction')).toEqual(['pt-gnn', 'tables', 'fresh']);
        });

        it('keeps each list\'s fold for the next visit, by its task', async () => {
            answer();

            const { unmount } = await open();

            await userEvent.click(foldOf('Beat the average'));

            expect(readLayout('model-list', 'wide').fold).toEqual({ beats: true });

            unmount();
            await open();

            expect(foldOf('Beat the average')).toHaveAttribute('aria-expanded', 'false');
            expect(foldOf('Next-day direction')).toHaveAttribute('aria-expanded', 'true');
        });
    });

    it('leaves out a task\'s line under its name where the listing has none', async () => {
        const listing = listingOf();

        listing.tasks[1].description = '';
        answer(listing);

        await open();

        expect(group('Beat the average').querySelector('.model-group-detail')).toBeNull();
    });

    it('asks for each model\'s track record, for its trend line, averaged over 20 days where the listing does not say (#293)', async () => {
        answer();

        await open();

        expect(loadReport.mock.calls.map((call) => call.join(' '))).toEqual([
            'pt-gnn track-record 20', 'tables track-record 20', 'fresh track-record 20', 'beater track-record 20',
        ]);
    });

    describe('a listing that says how many scored days its models\' scores average, from format 4 (#293)', () => {
        //
        // the listing's models, pt-gnn with 25 scored days: Live over 20, and
        // New over 30
        //
        const over = (days) => withAverageDays(listingOf([
            modelOf({ scored_days: 25 }),
            modelOf({ name: 'tables', scored_days: 40, score: { loss: 1.62, auc_up: 0.54, auc_beats: 0.52, acc_up: 0.55 } }),
            modelOf({ name: 'fresh', scored_days: 0, score: null, baseline: null, live: { since: '2026-10-22', kind: 'first' } }),
        ]), days);

        it('asks for each track record averaged over that many', async () => {
            answer(over(30));

            await open();

            expect(loadReport.mock.calls.map((call) => call.join(' '))).toEqual([
                'pt-gnn track-record 30', 'tables track-record 30', 'fresh track-record 30',
            ]);
        });

        it('says them over each row\'s parts, and names the trend lines by them', async () => {
            answer(over(30));

            await open();

            const rowOf = (name) => screen.getByRole('link', { name: name }).closest('.model-row');

            expect(rowOf('tables').querySelector('.model-parts-note')).toHaveTextContent(/, last 30 days$/);
            expect(rowOf('pt-gnn').querySelector('.model-parts-note')).toHaveTextContent(/, 25 days so far$/);
            expect(screen.getByRole('img', { name: 'pt-gnn\'s 30-day Loss, over the last 60 days' })).toBeInTheDocument();
        });

        it('keeps a model New until it has that many scored days, its pill counting to them, and only New before its first', async () => {
            answer(over(30));

            await open();

            const pill = (name) => screen.getByRole('link', { name: name }).parentNode.querySelector('.model-pill');

            expect(pill('pt-gnn')).toHaveTextContent(/^New · day 25 of 30$/);
            expect(pill('tables')).toHaveTextContent(/^Live$/);
            expect(pill('fresh')).toHaveTextContent(/^New$/);
        });

        it('counts the statuses in the filters by them', async () => {
            const count = (name) => screen.getByRole('button', { name: new RegExp(`^${name}`) }).querySelector('.model-filter-count').textContent;

            answer(over(30));
            const thirty = await open();

            expect([count('Live'), count('New')]).toEqual(['1', '2']);
            thirty.unmount();

            answer(over(20));
            await open();

            expect([count('Live'), count('New')]).toEqual(['2', '1']);
        });

        it('says them under the comparison\'s title', async () => {
            answer(over(30));
            await open();

            await userEvent.click(box('pt-gnn'));
            await userEvent.click(box('tables'));

            expect(screen.getByRole('region', { name: 'Comparison' }).querySelector('.model-card-sub'))
                .toHaveTextContent('Lines are averages of the last 30 days');
        });
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

    it('shows the score picked in every row, and sorts by it', async () => {
        answer();

        await open({ scores: { direction: 'acc_up' } });

        expect([...group('Next-day direction').querySelectorAll('.model-cell-score .visually-hidden')].map((name) => name.textContent))
            .toEqual(['Up/down accuracy: ', 'Up/down accuracy: ', 'Up/down accuracy: ']);
        expect(namesIn('Next-day direction')).toEqual(['tables', 'pt-gnn', 'fresh']);
    });

    it('lays each row out as #300 lays it out: the model, its score, its trend line and when it went live, with no headings over them', async () => {
        answer();

        await open({ scores: { direction: 'auc_up' } });

        const row = group('Next-day direction').querySelector('.model-row');

        expect(group('Next-day direction').querySelector('.model-list-head')).toBeNull();
        expect([...row.children].map((cell) => cell.classList[1]))
            .toEqual(['model-cell-compare', 'model-cell-model', 'model-cell-score', 'model-cell-trend', 'model-cell-since']);
    });

    it('gives the days under each row\'s figure the note of the score picked (#265)', async () => {
        answer();

        await open({ scores: { direction: 'auc_beats' } });

        const days = group('Next-day direction').querySelector('.model-score-days');

        expect(days).toHaveTextContent('last 20 days');
        expect(days).toHaveAccessibleDescription(SCORES.find((score) => score.key === 'auc_beats').note);
        expect(days.querySelector('svg')).toHaveAttribute('data-testid', 'InfoOutlinedIcon');
    });

    it('lets the keyboard reach the note, and shows it under the pointer (#265)', async () => {
        answer();

        await open({ scores: { direction: 'acc_up' } });

        const days = group('Next-day direction').querySelector('.model-score-days');

        expect(days).toHaveAttribute('tabindex', '0');

        await userEvent.hover(days);

        expect(await screen.findByRole('tooltip')).toHaveTextContent(SCORES.find((each) => each.key === 'acc_up').note);
    });

    describe('on Loss, a list of stock models shows loss\'s three parts in its place (#283)', () => {
        const noteIn = () => group('Next-day direction').querySelector('.model-parts-note');

        it('says over each row\'s parts what they add up to, and names each part, as #300 lays it out', async () => {
            answer();

            await open();

            const row = screen.getByRole('link', { name: 'pt-gnn' }).closest('.model-row');

            expect(group('Next-day direction').querySelector('.model-list')).toHaveClass('model-list-parts');
            expect(row.querySelector('.model-parts-note')).toHaveTextContent(/^Loss 1\.600, part by part, last 20 days$/);
            expect([...row.querySelectorAll('.model-part-cell-name')].map((name) => name.textContent))
                .toEqual(['Up or down', 'Beats the average stock', 'Size of the move']);
        });

        it('lets the keyboard reach the line over them, with loss\'s note', async () => {
            answer();

            await open();

            expect(noteIn()).toHaveAttribute('tabindex', '0');
            expect(noteIn()).toHaveAccessibleDescription(SCORES[0].note);

            await userEvent.hover(noteIn());

            expect(await screen.findByRole('tooltip')).toHaveTextContent(SCORES[0].note);
        });

        it('fills every row\'s parts from its track record, and no row shows the sum', async () => {
            answer();

            await open();

            const rows = [...group('Next-day direction').querySelectorAll('.model-row')];

            expect(rows).toHaveLength(3);
            expect(group('Next-day direction').querySelector('.model-score-value')).toBeNull();
            rows.forEach((row) => {
                expect([...row.querySelectorAll('.model-part-cell-value')].map((value) => value.textContent)).toEqual(['0.720', '0.620', '0.268']);
            });
        });

        it('still sorts by the sum, which decides what goes live', async () => {
            answer();

            await open();

            expect(namesIn('Next-day direction')).toEqual(['pt-gnn', 'tables', 'fresh']);
        });

        it('shows any other score as its one figure, and no parts', async () => {
            answer();

            await open({ scores: { direction: 'auc_up' } });

            expect(group('Next-day direction').querySelector('.model-list')).not.toHaveClass('model-list-parts');
            expect(noteIn()).toBeNull();
            expect(group('Next-day direction').querySelector('.model-cell-parts')).toBeNull();
            expect(group('Next-day direction').querySelector('.model-score-value')).toHaveTextContent('0.560');
        });
    });

    it('hands the score picked in a list up, with its task, for both pages to show (#279)', async () => {
        const onScore = jest.fn();

        answer();
        await open({ onScore: onScore });

        await userEvent.click(within(group('Next-day direction')).getByRole('button', { name: 'Beat-the-average AUC' }));

        expect(onScore).toHaveBeenCalledWith('direction', 'auc_beats');
    });
});

describe('the title (#296)', () => {
    //
    // the docs' page on the models, which /model links in place of its intro
    //
    const GUIDE = 'https://jeff1evesque.github.io/jefflevesque.com/guide/models/';

    it('has no intro under it, and nothing to fold one on a phone', async () => {
        answer();
        await open();

        expect(document.querySelector('.model-intro')).toHaveTextContent(/^Models4$/);
        expect(document.querySelector('.model-lede')).toBeNull();
        expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Less' })).toBeNull();
    });

    it('links the docs\' page on the models from the Sort row and from the title\'s row, each in a new tab', async () => {
        answer();
        await open();

        const sortRow = document.querySelector('.model-main > .model-controls');
        const titleRow = document.querySelector('.model-heading');

        [sortRow, titleRow].forEach((row) => {
            const link = within(row).getByRole('link', { name: 'How the models work' });

            expect(link).toHaveAttribute('href', GUIDE);
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
            expect(link).toHaveClass('api-link');
            expect(link.querySelector('svg')).toHaveAttribute('data-testid', 'DescriptionOutlinedIcon');
        });
    });

    it('draws the Sort row\'s large, as /stream\'s is on a computer, and the title row\'s medium, as on a phone', async () => {
        answer();
        await open();

        expect(document.querySelector('.model-controls-docs svg')).toHaveClass('MuiSvgIcon-fontSizeLarge');
        expect(document.querySelector('.model-heading-docs svg')).toHaveClass('MuiSvgIcon-fontSizeMedium');
    });

    it('names the link in a tooltip', async () => {
        answer();
        await open();

        await userEvent.hover(within(document.querySelector('.model-controls')).getByRole('link', { name: 'How the models work' }));

        expect(await screen.findByRole('tooltip')).toHaveTextContent('How the models work');
    });

    it('keeps the Sort row\'s link while the listing is on its way', async () => {
        loadListing.mockReturnValue(new Promise(() => {}));
        await open();

        expect(within(document.querySelector('.model-controls')).getByRole('link', { name: 'How the models work' })).toHaveAttribute('href', GUIDE);
    });

    it('keeps no fold for an intro in the layout this browser keeps, on a phone', async () => {
        phoneScreen();
        writeLayout('model', 'narrow', { fold: { filters: true, intro: false } });
        answer();
        await open();

        await userEvent.click(screen.getByRole('button', { name: 'Filters 4 models' }));

        expect(readLayout('model', 'narrow').fold).toEqual({ filters: false });
        wideScreen();
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

    it('offer Behind baseline once the listing carries the trainer\'s checks, count a model taken down, and hide it when pressed (#263)', async () => {
        const { models } = listingOf();

        answer(listingOf([...models.map((model) => ({ ...model, behind: behindOf() })), downModelOf()]));
        await open();

        const statuses = within(within(filters()).getByRole('region', { name: 'Status' })).getAllByRole('button');

        expect(statuses.map((row) => row.textContent)).toEqual(['Live2', 'New1', 'Behind baseline1', 'Retired1']);
        expect(namesIn('Next-day direction')).toContain('lagging');

        await userEvent.click(screen.getByRole('button', { name: 'Behind baseline 1' }));

        expect(namesIn('Next-day direction')).toEqual(['pt-gnn', 'tables', 'fresh']);
        expect(document.querySelector('.model-count')).toHaveTextContent('4 of 5');
    });

    it('leave Behind baseline out of a listing before format 2, which can take no model down (#263)', async () => {
        answer();
        await open();

        expect(within(filters()).queryByRole('button', { name: /^Behind baseline/ })).toBeNull();
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

describe('the filters, dragged and kept (#253)', () => {
    afterEach(wideScreen);

    function filters() {
        return screen.getByRole('complementary', { name: 'Filters' });
    }

    const grip = () => filters().querySelector('.model-filters-grip');
    const width = () => filters().style.getPropertyValue('--model-filters-width');

    //
    // jsdom implements no PointerEvent, so testing-library cannot carry clientX
    // on one. A MouseEvent of the same type can -- see graph.test.jsx
    //
    function pointer(type, target, init = {}) {
        fireEvent(target, new MouseEvent(type, { bubbles: true, cancelable: true, ...init }));
    }

    //
    // the column at its own 14rem, as a wide screen lays it out and jsdom does
    // not
    //
    function sized(px = 196) {
        Object.defineProperty(filters(), 'offsetWidth', { value: px, configurable: true });
    }

    async function dragFrom(x) {
        answer();
        const view = await open();

        sized();
        pointer('pointerdown', grip(), { clientX: x, button: 0 });

        return view;
    }

    it('draw a strip on the open column\'s edge to drag it by, and none while it is folded', async () => {
        answer();
        await open();

        expect(grip()).toHaveAttribute('aria-hidden', 'true');

        await userEvent.click(within(filters()).getByRole('button', { name: 'Collapse the filters' }));

        expect(grip()).toBeNull();
    });

    it('follow a drag wider or narrower, and keep the width once the pointer comes up', async () => {
        await dragFrom(300);

        pointer('pointermove', window, { clientX: 384 });

        expect(width()).toBe('280px');
        expect(readLayout('model', 'wide').size).toEqual({});

        pointer('pointerup', window);

        expect(readLayout('model', 'wide')).toEqual({ fold: { filters: false }, size: { filters: 280 } });
    });

    it('stop at 10rem and at 22rem', async () => {
        await dragFrom(300);

        pointer('pointermove', window, { clientX: 600 });
        expect(width()).toBe('308px');

        pointer('pointermove', window, { clientX: 250 });
        expect(width()).toBe('146px');

        pointer('pointermove', window, { clientX: 196 });
        expect(width()).toBe('140px');
        expect(filters()).toHaveClass('model-filters-open');

        pointer('pointerup', window);

        expect(readLayout('model', 'wide').size).toEqual({ filters: 140 });
    });

    it('fold into the rail once dragged more than 48px past 10rem, keep the fold, and follow the pointer no further', async () => {
        await dragFrom(300);

        pointer('pointermove', window, { clientX: 195 });

        expect(filters()).toHaveClass('model-filters-closed');
        expect(readLayout('model', 'wide')).toEqual({ fold: { filters: true }, size: {} });

        pointer('pointermove', window, { clientX: 600 });

        expect(filters()).toHaveClass('model-filters-closed');
    });

    it('start no drag from a button other than the main one', async () => {
        await dragFrom(300);
        pointer('pointerup', window);

        pointer('pointerdown', grip(), { clientX: 300, button: 2 });
        pointer('pointermove', window, { clientX: 384 });

        expect(width()).toBe('');
    });

    it('stop following the pointer when the page goes mid-drag', async () => {
        const removed = jest.spyOn(window, 'removeEventListener');
        const { unmount } = await dragFrom(300);

        unmount();

        expect(removed).toHaveBeenCalledWith('pointermove', expect.any(Function));
        expect(removed).toHaveBeenCalledWith('pointerup', expect.any(Function));

        removed.mockRestore();
    });

    it('open at the width this browser kept, and at their own where it kept one outside 10rem to 22rem', async () => {
        writeLayout('model', 'wide', { fold: {}, size: { filters: 280 } });
        answer();

        const { unmount } = await open();

        expect(width()).toBe('280px');

        unmount();
        writeLayout('model', 'wide', { fold: {}, size: { filters: 400 } });
        answer();
        await open();

        expect(width()).toBe('');
        expect(filters()).toHaveClass('model-filters-open');
    });

    it('keep a fold by the arrow or the heading, and open folded on the next visit', async () => {
        answer();

        const { unmount } = await open();

        await userEvent.click(within(filters()).getByRole('button', { name: 'Collapse the filters' }));

        expect(readLayout('model', 'wide').fold).toEqual({ filters: true });

        unmount();
        answer();
        await open();

        expect(filters()).toHaveClass('model-filters-closed');

        await userEvent.click(within(filters()).getByRole('button', { name: /^Filters/ }));

        expect(readLayout('model', 'wide').fold).toEqual({ filters: false });
    });

    it('keep a phone\'s band opened or folded, apart from a wide screen\'s column', async () => {
        phoneScreen();
        answer();

        const { unmount } = await open();

        await userEvent.click(within(filters()).getByRole('button', { name: 'Filters 4 models' }));

        expect(readLayout('model', 'narrow').fold).toEqual({ filters: false });
        expect(readLayout('model', 'wide').fold).toEqual({});

        unmount();
        answer();
        await open();

        expect(filters()).toHaveClass('model-filters-open');
    });
});

describe('two tasks, from format 3 on (#279)', () => {
    //
    // a format 3 listing: the stock tasks with their top 10's, and pt-options of
    // the options task, each model's track record with the columns its task has
    //
    function both(props = {}) {
        answer(optionsListingOf(), (name) => (name === 'pt-options' ? optionsTrackOf(5) : withTop10(trackOf(5))));

        return open(props);
    }

    const buttonsIn = (where) => within(within(where).getByRole('group', { name: 'Score' })).getAllByRole('button');
    const pressedIn = (where) => buttonsIn(where).filter((button) => button.getAttribute('aria-pressed') === 'true').map((button) => button.textContent);
    const daysIn = (name) => group(name).querySelector('.model-score-days, .model-parts-note');

    it('draws a list for each task, each under a score picker of its own task\'s scores', async () => {
        await both();

        expect(buttonsIn(group('Option picks')).map((button) => button.textContent)).toEqual(['Loss', 'Profit AUC', 'Top 10 gain', 'Top 10 wins']);
        expect(buttonsIn(group('Next-day direction')).map((button) => button.textContent))
            .toEqual(['Loss', 'Up/down AUC', 'Beat-the-average AUC', 'Up/down accuracy', 'Top 10 gain', 'Top 10 wins']);
        expect(namesIn('Option picks')).toEqual(['pt-options']);
        expect(screen.getByRole('button', { name: 'Option picks 1' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('links each options model to its picks under its description, and no stock model (#290)', async () => {
        await both();

        const link = within(group('Option picks')).getByRole('link', { name: 'See its picks ›' });

        expect(link).toHaveAttribute('href', '/model/pt-options/picks');
        expect(link.previousElementSibling).toHaveClass('model-description');
        expect(within(group('Next-day direction')).queryByRole('link', { name: 'See its picks ›' })).toBeNull();
    });

    it('links no retired options model to picks it no longer makes (#290)', async () => {
        const listing = optionsListingOf();

        answer(
            { ...listing, models: listing.models.map((model) => (model.name === 'pt-options' ? { ...model, retired: '2026-10-19' } : model)) },
            (name) => (name === 'pt-options' ? optionsTrackOf(5) : withTop10(trackOf(5))),
        );
        await open();

        expect(screen.queryByRole('link', { name: 'See its picks ›' })).toBeNull();
    });

    it('changes nothing, and breaks nothing, where a score is picked with no store listening', async () => {
        await both();
        await userEvent.click(within(group('Option picks')).getByRole('button', { name: 'Top 10 gain' }));

        expect(pressedIn(group('Option picks'))).toEqual(['Loss']);
    });

    it('hands up a score picked in the options list with its task, and leaves the stock list on its own', async () => {
        const onScore = jest.fn();

        await both({ onScore: onScore });
        await userEvent.click(within(group('Option picks')).getByRole('button', { name: 'Top 10 gain' }));

        expect(onScore).toHaveBeenCalledWith('option-picks', 'top10_gain');
    });

    it('shows each list on its own task\'s score, under its task\'s note', async () => {
        await both({ scores: { 'option-picks': 'top10_gain' } });

        expect(pressedIn(group('Option picks'))).toEqual(['Top 10 gain']);
        expect(pressedIn(group('Next-day direction'))).toEqual(['Loss']);
        expect(group('Option picks').querySelector('.model-cell-score .visually-hidden')).toHaveTextContent('Top 10 gain:');
        expect(daysIn('Option picks')).toHaveAccessibleDescription(noteOf('top10_gain', OPTIONS_TASK));
        expect(daysIn('Next-day direction')).toHaveTextContent(/^Loss 1\.600, part by part, last 20 days$/);
        expect(group('Option picks').querySelector('.model-score-value')).toHaveTextContent('3.10%');
    });

    it('leaves the stock list as it was: its rows, and on Loss, loss\'s parts (#283)', async () => {
        await both();

        expect(namesIn('Next-day direction')).toEqual(['pt-gnn', 'tables', 'fresh']);
        expect([...group('Next-day direction').querySelector('.model-row').querySelectorAll('.model-part-cell-value')].map((value) => value.textContent))
            .toEqual(['0.720', '0.620', '0.268']);
    });

    it('keeps the options list on its one figure for Loss, which adds up other scores (#283)', async () => {
        await both();

        expect(group('Option picks').querySelector('.model-list')).not.toHaveClass('model-list-parts');
        expect(group('Option picks').querySelector('.model-cell-parts')).toBeNull();
        expect(daysIn('Option picks')).toHaveTextContent(/^last 20 days$/);
        expect(group('Option picks').querySelector('.model-score-value')).toHaveTextContent('0.840');
    });

    it('lets a stock model and pt-options be ticked together on Top 10 gain, drawn each beside its own baseline', async () => {
        const { container } = await both({ scores: { direction: 'top10_gain' } });

        await userEvent.click(box('pt-gnn'));

        expect(box('pt-options')).toBeEnabled();

        await userEvent.click(box('pt-options'));

        const chart = screen.getByRole('region', { name: 'Comparison' });

        expect(within(chart).getByRole('heading', { name: 'Comparing pt-gnn and pt-options' })).toBeInTheDocument();
        expect(container.querySelectorAll('.model-compare .recharts-line-curve')).toHaveLength(4);
        expect(within(chart).getByText(/These trades last different lengths/)).toBeInTheDocument();
        expect(window.location.search).toBe('?compare=pt-gnn,pt-options');
    });

    it('turns pt-options down beside a stock model on loss, as before', async () => {
        await both();

        await userEvent.click(box('pt-gnn'));

        expect(box('pt-options')).toBeDisabled();
    });

    it('compares two tasks by a picker of its own of the scores they share, apart from the lists\' pickers', async () => {
        await both({ scores: { direction: 'top10_gain' } });

        await userEvent.click(box('pt-gnn'));
        await userEvent.click(box('pt-options'));

        const chart = screen.getByRole('region', { name: 'Comparison' });

        expect(buttonsIn(chart).map((button) => button.textContent)).toEqual(['Top 10 gain', 'Top 10 wins']);

        await userEvent.click(within(chart).getByRole('button', { name: 'Top 10 wins' }));

        expect(chart.querySelector('.model-chart')).toHaveAttribute('aria-label', expect.stringMatching(/^Top 10 wins, 20-day averages of pt-gnn and pt-options/));
        expect(pressedIn(group('Next-day direction'))).toEqual(['Top 10 gain']);
    });

    it('ticks a third of either task on the score compared, and follows the list\'s picker again once one task is left', async () => {
        await both({ scores: { direction: 'top10_gain' } });

        await userEvent.click(box('pt-gnn'));
        await userEvent.click(box('pt-options'));

        expect(box('tables')).toBeEnabled();

        await userEvent.click(box('pt-options'));
        await userEvent.click(box('tables'));

        const chart = screen.getByRole('region', { name: 'Comparison' });

        expect(within(chart).queryByRole('group', { name: 'Score' })).toBeNull();
        expect(chart.querySelector('.model-chart')).toHaveAttribute('aria-label', expect.stringMatching(/^Top 10 gain, 20-day averages of pt-gnn and tables/));
    });

    it('reopens a comparison of two tasks from its address, on the first score they share', async () => {
        at('/model?compare=pt-options,tables');

        await both();

        const chart = screen.getByRole('region', { name: 'Comparison' });

        expect(box('pt-options')).toBeChecked();
        expect(box('tables')).toBeChecked();
        expect(pressedIn(chart)).toEqual(['Top 10 gain']);
    });

    it('reads an address of two tasks as what the tasks let it compare', () => {
        const { models, tasks } = optionsListingOf();

        expect(linkedCompare('?compare=pt-gnn,pt-options,beater', models, tasks).map((each) => each.name))
            .toEqual(['pt-gnn', 'pt-options', 'beater']);
        expect(linkedCompare('?compare=pt-gnn,pt-options', models).map((each) => each.name)).toEqual(['pt-gnn']);
        expect(linkedCompare('?compare=pt-gnn,pt-options', listingOf().models.concat([models[4]]), listingOf().tasks).map((each) => each.name))
            .toEqual(['pt-gnn']);
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

describe('the lists\' holds, from format 5 on (#300)', () => {
    //
    // a format 5 listing: tables-gnn and pt-gnn with their holds, a little
    // behind it, and pt-options with its three, each model's track record with
    // its holds' columns -- the newest five days without their 5-day results,
    // and none with a 20-day result
    //
    const BEHIND = { loss: (at) => 1.62 + (at % 3) * 0.01 };

    function held(props = {}) {
        answer(heldListingOf(), (name) => {
            if (name === 'pt-options') {
                return optionsTrackOf(30);
            }

            return heldTrackOf(30, name === 'pt-gnn' ? BEHIND : {});
        });

        return open(props);
    }

    const buttons = (name, picker) => within(within(group(name)).getByRole('group', { name: picker })).getAllByRole('button');
    const pressedIn = (name, picker) => buttons(name, picker).filter((button) => button.getAttribute('aria-pressed') === 'true').map((button) => button.textContent);
    const rowOf = (name) => screen.getByRole('link', { name: name }).closest('.model-row');

    it('gives each list a hold picker of its own beside its score picker, with Combined for a task of stocks', async () => {
        await held();

        expect(buttons('Next-day direction', 'Hold').map((button) => button.textContent)).toEqual(['1 day', '5 days', '20 days', 'Combined']);
        expect(buttons('Option picks', 'Hold').map((button) => button.textContent)).toEqual(['1 day', '5 days', '20 days']);
        expect(within(group('Next-day direction')).getByRole('group', { name: 'Hold' }).closest('.model-controls'))
            .toBe(within(group('Next-day direction')).getByRole('group', { name: 'Score' }).closest('.model-controls'));
    });

    it('opens on 1 day, so each list reads as before format 5: its rows on the listing\'s own scores', async () => {
        await held({ scores: { direction: 'auc_up' } });

        expect(pressedIn('Next-day direction', 'Hold')).toEqual(['1 day']);
        expect(pressedIn('Option picks', 'Hold')).toEqual(['1 day']);
        expect(rowOf('tables-gnn').querySelector('.model-cell-score .visually-hidden')).toHaveTextContent(/^Up\/down AUC:$/);
        expect(rowOf('tables-gnn').querySelector('.model-score-days')).toHaveTextContent(/^last 20 days$/);
        expect(rowOf('tables-gnn').querySelector('.model-score-value')).toHaveTextContent(formatScore(heldModelOf().score.auc_up, 'auc_up'));
    });

    it('changes nothing, and breaks nothing, where a hold is picked with no store listening', async () => {
        await held();
        await userEvent.click(within(group('Next-day direction')).getByRole('button', { name: '5 days' }));

        expect(pressedIn('Next-day direction', 'Hold')).toEqual(['1 day']);
    });

    it('hands the hold picked up with its task', async () => {
        const onHold = jest.fn();

        await held({ onHold: onHold });
        await userEvent.click(within(group('Next-day direction')).getByRole('button', { name: 'Combined' }));
        await userEvent.click(within(group('Option picks')).getByRole('button', { name: '20 days' }));

        expect(onHold.mock.calls).toEqual([['direction', 'combined'], ['option-picks', 20]]);
    });

    it('puts each row\'s score, how it stands, its days and its trend line on the hold picked, named with it', async () => {
        await held({ holds: { direction: 5 }, scores: { direction: 'auc_up' } });

        const row = rowOf('tables-gnn');

        expect(row.querySelector('.model-cell-score .visually-hidden')).toHaveTextContent('Up/down AUC, 5-day hold:');
        expect(row.querySelector('.model-score-value')).toHaveTextContent(formatScore(heldModelOf().holds['5d'].score.auc_up, 'auc_up'));
        expect(row.querySelector('.model-score-days')).toHaveTextContent(/^last 20 days$/);
        expect(group('Next-day direction').querySelector('.model-hold-line')).toHaveTextContent(/^5-day hold: bought at 9:40 AM on the next trading day/);
        expect(within(row).getByRole('img', { name: 'tables-gnn\'s 20-day Up/down AUC, 5-day hold, over the last 60 days' })).toBeInTheDocument();
    });

    it('puts loss\'s three parts on the hold, from its own columns', async () => {
        await held({ holds: { direction: 5 } });

        const newest = heldTrackOf(30).slice(-1)[0];

        expect([...rowOf('tables-gnn').querySelectorAll('.model-part-cell-value')].map((cell) => cell.textContent)).toEqual([
            formatScore(newest.average.up_log_loss_5d, 'loss'),
            formatScore(newest.average.beats_log_loss_5d, 'loss'),
            formatScore(newest.average.move_pinball_5d, 'loss'),
        ]);
    });

    it('leaves the other task\'s list on its own hold', async () => {
        await held({ holds: { direction: 20 } });

        expect(pressedIn('Next-day direction', 'Hold')).toEqual(['20 days']);
        expect(pressedIn('Option picks', 'Hold')).toEqual(['1 day']);
    });

    it('offers no Combined on the options list, and shows it on 1 day where Combined is kept for it', async () => {
        await held({ holds: { 'option-picks': 'combined' } });

        expect(pressedIn('Option picks', 'Hold')).toEqual(['1 day']);
    });

    it('disables the top 10\'s two on Combined, and shows loss for one picked', async () => {
        await held({ holds: { direction: 'combined' }, scores: { direction: 'top10_wins' } });

        expect(buttons('Next-day direction', 'Score').filter((button) => button.disabled).map((button) => button.textContent))
            .toEqual(['Top 10 gain', 'Top 10 wins']);
        expect(pressedIn('Next-day direction', 'Score')).toEqual(['Loss']);
        expect(buttons('Option picks', 'Score').some((button) => button.disabled)).toBe(false);
    });

    it('sorts each list by its models\' scores on the hold, and by name where none has one yet', async () => {
        await held({ holds: { direction: 5 } });

        expect(namesIn('Next-day direction')).toEqual(['tables-gnn', 'pt-gnn']);
    });

    it('draws no hold picker on a list whose models the listing gives no holds, as before format 5', async () => {
        answer(optionsListingOf(), (name) => (name === 'pt-options' ? optionsTrackOf(5) : withTop10(trackOf(5))));
        await open({ holds: { direction: 5 } });

        expect(within(group('Next-day direction')).queryByRole('group', { name: 'Hold' })).toBeNull();
        expect(within(group('Option picks')).queryByRole('group', { name: 'Hold' })).toBeNull();
        expect(group('Next-day direction').querySelector('.model-hold-line')).toBeNull();
        expect(group('Next-day direction').querySelector('.model-parts-note')).toHaveTextContent(/, last 20 days$/);
    });

    it('draws each model ticked on its list\'s hold in the comparison, named with it', async () => {
        await held({ holds: { direction: 5 } });

        fireEvent.click(box('tables-gnn'));
        fireEvent.click(box('pt-gnn'));

        const legend = within(screen.getByRole('region', { name: 'Comparison' })).getByRole('list', { name: 'Legend' });

        expect(legend).toHaveTextContent('tables-gnn, 5-day hold');
        expect(legend).toHaveTextContent('pt-gnn, 5-day hold');
    });

    it('names no hold in the comparison on 1 day, as before format 5', async () => {
        await held();

        fireEvent.click(box('tables-gnn'));
        fireEvent.click(box('pt-gnn'));

        expect(within(screen.getByRole('region', { name: 'Comparison' })).getByRole('list', { name: 'Legend' })).not.toHaveTextContent('hold');
    });
});
