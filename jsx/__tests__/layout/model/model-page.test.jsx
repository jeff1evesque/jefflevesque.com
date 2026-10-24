/**
 * model-page.test.jsx: /model/:model, one model on its own (#243).
 *
 * The api is replaced at source.js, so each case says what the listing and the
 * two reports answer, and when. The charts are drawn for real -- see
 * attempts-chart.test.jsx and track-chart.test.jsx for what is in them -- and
 * these cases are about the page round them: who the model is, its figures, and
 * what it says when there is nothing to draw -- and from format 5, a stock
 * model's holds and Combined (#300).
 */

jest.mock('recharts', () => require('../../../test-support/model-fixtures.js').sizedRecharts());
jest.mock('../../../import/layout/model/source.js', () => ({
    loadListing: jest.fn(),
    loadReport: jest.fn(),
    loadOptionPicks: jest.fn(),
}));

//
// the reader's subscriptions, for the bell beside the name (#255). Signed out
// unless a case says otherwise -- and the api's session reader imports Amplify,
// which jest cannot load unmocked
//
jest.mock('../../../import/general/account-api.js', () => ({
    __esModule: true,
    listSubscriptions: jest.fn(),
}));

//
// New York's today, as the page reads it for when a stock model's holds switch
// on and when their first results come in (#300): Jan 7, 2027, once every hold
// is on, unless a case says otherwise
//
let mockToday = '2027-01-07';

jest.mock('../../../import/layout/model/scores.js', () => ({
    __esModule: true,
    ...jest.requireActual('../../../import/layout/model/scores.js'),
    newYorkToday: () => mockToday,
}));

import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ModelPageRoute, {
    ATTEMPTS_LINE,
    ATTEMPTS_NOTE,
    CardRows,
    ModelPage,
    attemptRows,
    liveFigure,
    liveLine,
    liveRows,
    ordinal,
    placeAmong,
    rankAmong,
    sentence,
} from '../../../import/layout/model/model-page.jsx';
import { loadListing, loadOptionPicks, loadReport } from '../../../import/layout/model/source.js';
import { listSubscriptions } from '../../../import/general/account-api.js';
import { SCORES, formatGap, formatScore, noteOf, scoreOf } from '../../../import/layout/model/scores.js';
import {
    OPTIONS_TASK,
    TASKS,
    behindOf,
    downModelOf,
    historyOf,
    listingOf,
    modelOf,
    olderTrackOf,
    optionsHistoryOf,
    optionsListingOf,
    optionsModelOf,
    optionsTrackOf,
    heldListingOf,
    heldModelOf,
    heldTrackOf,
    holdsBehindOf,
    phoneScreen,
    timedHistoryOf,
    trackOf,
    wideScreen,
    withAverageDays,
    withTop10,
} from '../../../test-support/model-fixtures.js';

//
// what loss's name says of it, wherever a page names it (#265)
//
const LOSS_NOTE = scoreOf('loss').note;

//
// what a live version learned from, as a format 4 listing gives it (#295)
//
const TRAINED = { training: 7, stopping: 3, first: '2026-10-05', last: '2026-10-19' };

//
// a wide screen's card by its name, and its rows under its rule (#267): each a
// name and a value, or a heading's name alone
//
function cardOf(label) {
    const cards = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-cards');

    return within(cards).getByText(label).closest('.model-stat');
}

function rowsOf(card) {
    return [...card.querySelectorAll('.model-stat-row')].map((row) => [...row.children].map((cell) => cell.textContent));
}

//
// the take-down checks' table (#300), in a wide screen's Live version card or
// under a phone's boxes: its header's names, then each row's cells, or null
// where there is none
//
function checksIn(where) {
    const table = screen.getByRole('region', { name: 'Summary' }).querySelector(`.model-summary-${where} .model-checks`);

    return table ? [...table.querySelectorAll('tr')].map((row) => [...row.children].map((cell) => cell.textContent)) : null;
}

//
// what a phone shows under its boxes (#300), in order: a line of text, or a
// list's or a table's class
//
function underBoxes() {
    const details = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-details');

    return [...details.children].map((each) => (each.tagName === 'P' && !each.classList.contains('model-trained-line') ? each.textContent : each.className));
}

//
// a promise and the way to settle it, for an answer a case holds back
//
function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });

    return { promise, resolve };
}

function answer({ listing = listingOf(), history = historyOf(), track = trackOf() } = {}) {
    loadListing.mockResolvedValue(listing);
    loadReport.mockImplementation((name, kind) => Promise.resolve(kind === 'history' ? history : track));
}

async function open(name = 'pt-gnn', props = {}) {
    let view;

    await act(async () => {
        view = render(
            <MemoryRouter>
                <ModelPage name={name} {...props} />
            </MemoryRouter>
        );
    });

    return view;
}

beforeEach(() => {
    loadListing.mockReset();
    loadReport.mockReset();
    loadOptionPicks.mockReset();
    listSubscriptions.mockReset();
    listSubscriptions.mockResolvedValue(null);
    // the charts a case folds are kept, as a reader's are (#253)
    window.localStorage.clear();
    mockToday = '2027-01-07';
});

describe('the bell beside the name (#255)', () => {
    const LIVE = { alarm: 'live', since: '2026-10-18T12:00:00Z', terms: '2026-10' };
    const bell = () => document.querySelector('.model-heading a[href$="/alarm"]');

    it('is plain for a reader signed out, and leads to the model\'s alarm page', async () => {
        answer();
        await open('pt-gnn');

        expect(bell()).toHaveAttribute('href', '/model/pt-gnn/alarm');
        expect(bell()).toHaveAccessibleName('Alarm for pt-gnn');
        expect(bell().querySelector('svg')).toHaveAttribute('data-testid', 'NotificationsIcon');
    });

    it('rings in green for a reader who holds the model\'s alarm', async () => {
        listSubscriptions.mockResolvedValue([{ model: 'pt-gnn', ...LIVE }]);
        answer();
        await open('pt-gnn');

        expect(bell()).toHaveAccessibleName('Alarm for pt-gnn: subscribed');
        expect(bell().querySelector('svg')).toHaveClass('subscribed');
    });

    it('stays plain for a reader who holds another model\'s alarm, or a stream\'s of its name', async () => {
        listSubscriptions.mockResolvedValue([
            { model: 'tables', ...LIVE },
            { stream: 'pt-gnn', alarm: 'ingest', since: '2026-09-26T12:00:00Z', terms: '2026-09' },
        ]);
        answer();
        await open('pt-gnn');

        expect(bell().querySelector('svg')).toHaveAttribute('data-testid', 'NotificationsIcon');
    });

    it('is not drawn for a retired model', async () => {
        listSubscriptions.mockResolvedValue([{ model: 'beater', ...LIVE }]);
        answer();
        await open('beater');

        expect(screen.getByRole('heading', { name: 'beater' })).toBeInTheDocument();
        expect(bell()).toBeNull();
    });

    it('asks for the subscriptions once', async () => {
        answer();
        await open('pt-gnn');

        expect(listSubscriptions).toHaveBeenCalledTimes(1);
    });

    it('stays plain when the subscriptions could not be listed', async () => {
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        listSubscriptions.mockRejectedValue(new Error('busy, try again'));
        answer();
        await open('pt-gnn');

        expect(quiet).toHaveBeenCalledWith(expect.stringContaining('busy, try again'));
        expect(bell().querySelector('svg')).toHaveAttribute('data-testid', 'NotificationsIcon');

        quiet.mockRestore();
    });

    it('lets the subscriptions go when they land after the page has', async () => {
        const late = deferred();

        listSubscriptions.mockReturnValue(late.promise);
        answer();

        const { unmount } = await open('pt-gnn');

        unmount();

        await act(async () => late.resolve([{ model: 'pt-gnn', ...LIVE }]));

        expect(bell()).toBeNull();
    });
});

describe('ordinal', () => {
    it.each([[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [102, '102nd'], [111, '111th']])(
        '%i is %s', (place, said) => {
            expect(ordinal(place)).toBe(said);
        },
    );
});

describe('placeAmong', () => {
    const { models } = listingOf();
    const task = TASKS[0];

    it('says where a model stands among the scored models of its task', () => {
        expect(placeAmong(models[0], models, task, 'loss')).toBe('1st of 3 Next-day direction models');
        expect(placeAmong(models[2], models, task, 'loss')).toBe('3rd of 3 Next-day direction models');
        expect(placeAmong(models[1], models, task, 'acc_up')).toBe('1st of 3 Next-day direction models');
    });

    it('names the task by its id where the listing does not describe it', () => {
        expect(placeAmong(models[0], models, undefined, 'loss')).toBe('1st of 3 direction models');
    });

    it('gives the place in two parts, for a wide screen\'s row (#267)', () => {
        expect(rankAmong(models[2], models, task, 'loss')).toEqual({ rank: '3rd of 3', among: 'Next-day direction models' });
        expect(rankAmong(models[3], models, TASKS[1], 'loss')).toBeNull();
    });

    it('says nothing for the only model of its task, or one with no score', () => {
        const unscored = { ...models[0], score: null };

        expect(placeAmong(models[3], models, TASKS[1], 'loss')).toBe('');
        expect(placeAmong(unscored, [unscored, models[1], models[2]], task, 'loss')).toBe('');
    });
});

describe('liveFigure', () => {
    it('says when the live version went live, and after what', () => {
        expect(liveFigure(modelOf())).toEqual({ value: 'Oct 9', detail: 'went live after a nightly update' });
        expect(liveFigure(modelOf({ live: { since: '2026-10-12', kind: 'weekly' } })).detail).toBe('went live after a weekly retrain');
    });

    it('says a first version has not been beaten yet', () => {
        expect(liveFigure(modelOf({ live: { since: '2026-10-05', kind: 'first' } }))).toEqual({ value: 'Oct 5', detail: 'its first version, not yet beaten' });
        expect(liveFigure(modelOf({ live: { since: null, kind: null } }))).toEqual({ value: '–', detail: 'its first version, not yet beaten' });
        expect(liveFigure(modelOf({ live: { since: null, kind: 'nightly' } })).value).toBe('–');
    });

    it('says when a retired model retired, and when its last version went live', () => {
        expect(liveFigure(modelOf({ retired: '2026-10-02' }))).toEqual({ value: 'Retired Oct 2', detail: 'its last version went live Oct 9' });
        expect(liveFigure(modelOf({ retired: '2026-10-02', live: { since: null, kind: null } })).detail).toBe('no longer trained');
    });

    it('says when a live version was taken down, and the check of each day on its own that did it (#263)', () => {
        expect(liveFigure(downModelOf())).toEqual({ value: 'Taken down Oct 19', detail: 'worse than the baseline 5 scored days in a row' });
    });

    it('says an average\'s check as an average\'s (#263)', () => {
        expect(liveFigure(downModelOf({ down: { since: '2026-10-19', days: 5, in_a_row: 10 } })).detail)
            .toBe('its 5-day average was worse than the baseline’s 10 days in a row');
    });

    it.each([
        ['not_ahead', 'it went live without beating the baseline'],
        ['track_record', 'its track record showed nothing better than the baseline'],
    ])('says why a live version was taken down where no check did it, from format 4 (%s, #295)', (reason, words) => {
        expect(liveFigure(downModelOf({ down: { since: '2026-10-23', reason: reason, days: null, in_a_row: null } })))
            .toEqual({ value: 'Taken down Oct 23', detail: words });
    });
});

describe('before there is a model to show', () => {
    it('says it is loading while the listing is on its way', async () => {
        loadListing.mockReturnValue(new Promise(() => {}));

        await open();

        expect(screen.getByText('Loading the model…')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '‹ All models' })).toHaveAttribute('href', '/model');
    });

    describe('while the listing is on its way, its own shape (#274)', () => {
        beforeEach(() => {
            loadListing.mockReturnValue(new Promise(() => {}));
        });

        it('names the model, as the address does, and says it is loading to a screen reader alone', async () => {
            await open('tables');

            expect(screen.getByRole('heading', { name: 'tables' })).toBeInTheDocument();
            expect(screen.getByRole('status')).toHaveTextContent(/^Loading the model…$/);
            expect(screen.getByRole('status')).toHaveClass('visually-hidden');
            expect(document.querySelector('.model-heading > .graph-pending-bar')).not.toBeNull();
            expect(document.querySelectorAll('.model-lede .model-pending-line')).toHaveLength(2);
        });

        it('draws no bell, which a retired model would not have', async () => {
            await open();

            expect(document.querySelector('.model-heading a[href$="/alarm"]')).toBeNull();
        });

        it('draws the score picker\'s name over bars, as which scores it offers is the task\'s, which the listing says (#279)', async () => {
            await open('pt-gnn');

            const picker = document.querySelector('.model-controls .model-picker-pending');

            expect(picker).toHaveAttribute('aria-hidden', 'true');
            expect(picker.querySelector('.model-control-label')).toHaveTextContent('Score');
            expect(picker.querySelectorAll('.model-score-buttons .graph-pending-bar')).toHaveLength(4);
            expect(screen.queryByRole('button', { name: 'Up/down accuracy' })).toBeNull();
        });

        it('names the three figures over bars, as a wide screen\'s cards and a phone\'s boxes, the score as loss, which every task opens on', async () => {
            await open('pt-gnn', { scores: { direction: 'auc_up' } });

            const summary = document.querySelector('.model-summary');

            expect(summary).toHaveAttribute('aria-hidden', 'true');
            expect([...summary.querySelectorAll('.model-stat-label')].map((label) => label.textContent))
                .toEqual(['Live version', 'Attempts that went live', 'Loss']);
            expect([...summary.querySelectorAll('.stream-focus-figure-label')].map((label) => label.textContent))
                .toEqual(['Live version', 'Went live', 'Loss']);
        });

        it('draws each chart\'s card under its title, its frame as tall as its chart (#300)', async () => {
            await open();

            const cards = [...document.querySelectorAll('.model-card')];

            expect(cards.map((card) => card.querySelector('.model-fold').textContent))
                .toEqual(['Each attempt against the live version', 'Track record']);
            expect(cards.map((card) => card.querySelector('.model-chart-pending').style.height)).toEqual(['200px', '300px']);
        });
    });

    it('gives the placeholders\' places to the model once the listing lands (#274)', async () => {
        const listing = deferred();

        loadListing.mockReturnValue(listing.promise);
        loadReport.mockImplementation((name, kind) => Promise.resolve(kind === 'history' ? historyOf() : trackOf()));
        await open();

        await act(async () => listing.resolve(listingOf()));

        expect(await screen.findByRole('heading', { name: 'Each attempt against the live version' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Track record: Loss' })).toBeInTheDocument();
        expect(document.querySelector('.graph-pending-bar, .model-chart-pending')).toBeNull();
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('says there are no models to show yet where the listing could not be had', async () => {
        answer({ listing: null });

        await open();

        expect(screen.getByText('No models to show yet.')).toBeInTheDocument();
        expect(loadReport).not.toHaveBeenCalled();
    });

    it('says a name the listing does not hold is not a model, and asks for no report of it', async () => {
        answer();

        await open('no-such-model');

        expect(screen.getByRole('heading', { name: 'Model not found' })).toBeInTheDocument();
        expect(screen.getByText('There is no model named “no-such-model”.')).toBeInTheDocument();
        expect(loadReport).not.toHaveBeenCalled();
    });

    it('sets nothing once it has gone, whenever the listing lands', async () => {
        const listing = deferred();

        loadListing.mockReturnValue(listing.promise);

        const { unmount } = await open();

        unmount();
        await act(async () => listing.resolve(listingOf()));

        expect(loadReport).not.toHaveBeenCalled();
    });

    it('sets nothing once it has gone, whenever a report lands', async () => {
        const history = deferred();

        loadListing.mockResolvedValue(listingOf());
        loadReport.mockReturnValue(history.promise);

        const { unmount } = await open();

        unmount();
        await act(async () => history.resolve(historyOf()));

        expect(loadReport).toHaveBeenCalledTimes(2);
    });
});

describe('the model', () => {
    it('names it, its status, what it predicts and what it is', async () => {
        answer();

        await open();

        expect(screen.getByRole('heading', { name: 'pt-gnn' })).toBeInTheDocument();
        expect(screen.getByText('Live')).toHaveClass('model-pill');
        expect(screen.getByText('Up or down, scored the next day. A graph model of the market')).toBeInTheDocument();
    });

    it('says what its task predicts in its task\'s own sentence, and falls back to the task\'s name without one (#251)', async () => {
        const listing = listingOf();

        listing.tasks[0].description = '';
        answer({ listing: listing });

        await open();

        expect(document.querySelector('.model-lede')).toHaveTextContent(/^Predicts next-day direction\. A graph model of the market$/);
    });

    it('leaves out what is not there: a task the listing does not describe, or no description', async () => {
        answer({ listing: { tasks: [], models: [modelOf({ description: '' })] } });

        await open();

        expect(document.querySelector('.model-lede')).toHaveTextContent(/^$/);
    });

    it('asks for both of its reports', async () => {
        answer();

        await open();

        expect(loadReport).toHaveBeenCalledWith('pt-gnn', 'history', 20);
        expect(loadReport).toHaveBeenCalledWith('pt-gnn', 'track-record', 20);
    });

    it('draws its two charts once both are in, the track record\'s title naming its score (#300)', async () => {
        answer();

        await open();

        expect(screen.getByRole('heading', { name: 'Each attempt against the live version' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Track record: Loss' })).toBeInTheDocument();
    });
});

describe('the model it names', () => {
    it('is the listing\'s model of its name, and none while there is no listing to look in', () => {
        const page = new ModelPage({ name: 'pt-gnn' });

        expect(page.model()).toBeNull();
        expect(page.model(null)).toBeNull();
        expect(page.model(listingOf()).name).toBe('pt-gnn');
    });
});

describe('CardRows', () => {
    it('draws a card\'s rows under its rule, a name and a value each, and nothing at its foot where it is handed nothing (#267)', () => {
        const { container } = render(<CardRows rows={[{ key: 'trained', name: 'Trained on', value: '7 days, Oct 5 to Oct 19' }]} />);

        expect(rowsOf(container)).toEqual([['Trained on', '7 days, Oct 5 to Oct 19']]);
        expect(container.querySelector('.model-stat-body').children).toHaveLength(1);
    });

    it('draws nothing, not even the rule, with neither rows nor anything at its foot', () => {
        const { container } = render(<CardRows rows={[]} />);

        expect(container).toBeEmptyDOMElement();
    });
});

describe('sentence', () => {
    it('makes a figure\'s line a sentence of its note: capitalized, with a full stop (#253)', () => {
        expect(sentence('went live after a weekly retrain')).toBe('Went live after a weekly retrain.');
        expect(sentence('0.060 better than the baseline, 1.660')).toBe('0.060 better than the baseline, 1.660.');
    });

    it('says nothing for no line', () => {
        expect(sentence('')).toBe('');
        expect(sentence(null)).toBe('');
    });
});

describe('the summary', () => {
    //
    // a wide screen's card. A phone's boxes say the same figures again, and the
    // stylesheet shows one or the other -- see 'the summary, on a phone'
    //
    function stat(label) {
        const cards = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-cards');

        return within(cards).getByText(label).closest('.model-stat');
    }

    it('says when the live version went live and what made it, and how many attempts did, of every kind (#300)', async () => {
        answer({ history: historyOf(4, { 1: { kind: 'weekly', went_live: true }, 3: { kind: 'weekly' } }) });

        await open();

        expect(stat('Live version')).toHaveTextContent('Oct 9nightly update');
        expect(stat('Attempts that went live')).toHaveTextContent('4 of 30of every nightly update and weekly retrain');
    });

    it('says what the count is of where there is no history too (#300)', async () => {
        answer({ history: null });

        await open();

        expect(stat('Attempts that went live').querySelector('.model-stat-detail')).toHaveTextContent(/^of every nightly update and weekly retrain$/);
        expect(ATTEMPTS_LINE).toBe('of every nightly update and weekly retrain');
    });

    it('gives the 20-day score beside the baseline and where it stands in its task', async () => {
        answer();

        await open();

        expect(stat('Loss, last 20 days')).toHaveTextContent('1.600');
        expect(stat('Loss, last 20 days')).toHaveTextContent('0.060 better than the baseline, 1.660');
        expect(rowsOf(stat('Loss, last 20 days'))[0]).toEqual(['Among Next-day direction models', '1st of 3']);
    });

    it('follows the score picked', async () => {
        answer();

        await open('pt-gnn', { scores: { direction: 'acc_up' } });

        expect(stat('Up/down accuracy, last 20 days')).toHaveTextContent('54.0%');
        expect(stat('Up/down accuracy, last 20 days')).toHaveTextContent('2.0 pts better than the baseline, 52.0%');
        expect(stat('Up/down accuracy, last 20 days')).toHaveTextContent('2nd of 3');
    });

    it('says how many days a new model\'s score is over', async () => {
        answer();

        await open('fresh');

        expect(stat('Loss, 6 days so far')).toBeInTheDocument();
        expect(stat('Live version')).toHaveTextContent('its first version, not yet beaten');
    });

    it('says a single day, as a day', async () => {
        answer({ listing: listingOf([modelOf({ scored_days: 1 })]) });

        await open();

        expect(stat('Loss, 1 day so far')).toBeInTheDocument();
    });

    it('calls a score level with the baseline where the two print alike', async () => {
        answer({ listing: listingOf([modelOf({ baseline: { loss: 1.6001, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.5 } })]) });

        await open();

        expect(stat('Loss, last 20 days')).toHaveTextContent('level with the baseline, 1.600');
    });

    it('prints a dash, and nothing beside it, for a model with no score yet', async () => {
        answer({ listing: listingOf([modelOf({ score: null, baseline: null })]) });

        await open();

        expect(stat('Loss, last 20 days').querySelector('.model-stat-value')).toHaveTextContent('–');
        expect(stat('Loss, last 20 days').querySelectorAll('.model-stat-detail')).toHaveLength(1);
    });
});

describe('a listing that says how many scored days its models\' scores average, from format 4 (#293)', () => {
    //
    // pt-gnn with 25 scored days, New over 30 and Live over 20, beside tables
    //
    const over = (days, models = [modelOf({ scored_days: 25 }), modelOf({ name: 'tables', scored_days: 40 })]) => withAverageDays(listingOf(models), days);

    function stat(label) {
        const cards = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-cards');

        return within(cards).getByText(label).closest('.model-stat');
    }

    it('asks for both reports with them, and for another model\'s track record', async () => {
        answer({ listing: over(30) });
        await open();

        expect(loadReport).toHaveBeenCalledWith('pt-gnn', 'history', 30);
        expect(loadReport).toHaveBeenCalledWith('pt-gnn', 'track-record', 30);

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Compare with' }), 'tables');

        expect(loadReport).toHaveBeenLastCalledWith('tables', 'track-record', 30);
    });

    it('keeps the model New until it has that many, its pill counting to them, and its score so far', async () => {
        answer({ listing: over(30) });
        await open();

        expect(document.querySelector('.model-heading .model-pill')).toHaveTextContent(/^New · day 25 of 30$/);
        expect(stat('Loss, 25 days so far')).toHaveTextContent('1.600');
    });

    it('names the score by them once the model has that many', async () => {
        answer({ listing: over(20) });
        const twenty = await open();

        expect(document.querySelector('.model-heading .model-pill')).toHaveTextContent(/^Live$/);
        expect(stat('Loss, last 20 days')).toBeInTheDocument();
        twenty.unmount();

        answer({ listing: over(10) });
        await open('tables');

        expect(stat('Loss, last 10 days')).toBeInTheDocument();
    });

    it('says them in the track record\'s legend, its panel and its table (#300)', async () => {
        answer({ listing: over(30), track: trackOf(5) });
        await open();

        const track = screen.getByRole('region', { name: 'Track record: Loss' });
        const legend = within(track).getByRole('list', { name: 'Legend' });

        await userEvent.click(within(track).getByRole('button', { name: 'Show the numbers' }));

        expect(within(legend).getByText('Last 30 days’ average')).toBeInTheDocument();
        expect(within(legend).getByText('Baseline, last 30 days')).toBeInTheDocument();
        expect(track.querySelector('.model-card-sub')).toHaveTextContent(/^Each day’s real predictions, scored once that day’s prices are in\.$/);
        expect(within(track).getByText('Know-nothing baseline, 30 days')).toBeInTheDocument();
        expect(within(within(track).getByRole('table')).getAllByRole('columnheader').map((cell) => cell.textContent))
            .toEqual(['Day', 'This day', '30 days', 'Baseline, 30 days']);
    });
});

describe('a live version taken down for doing worse than the baseline (#263)', () => {
    const DOWN_LINE = 'Nothing predicts until a new version beats the baseline on the days it was tested on.';
    const CHECKS = ['Each day', '5-day average', '20-day average'];

    //
    // a wide screen's card, as 'the summary' reads one, and a phone's box
    //
    function stat(label) {
        const cards = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-cards');

        return within(cards).getByText(label).closest('.model-stat');
    }

    function noteOf(at) {
        const row = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-boxes');

        return row.querySelectorAll('.stream-focus-figure-label')[at];
    }

    it('says Behind baseline beside the name', async () => {
        answer({ listing: listingOf([downModelOf()]) });
        await open('lagging');

        expect(document.querySelector('.model-heading .model-pill')).toHaveTextContent('Behind baseline');
        expect(document.querySelector('.model-heading .model-pill')).toHaveClass('model-pill-down');
    });

    it('says when it was taken down, the check that did it, and in gray under it that nothing predicts until a version beats the baseline (#300)', async () => {
        answer({ listing: listingOf([downModelOf()]) });
        await open('lagging');

        const details = [...stat('Live version').querySelectorAll('.model-stat-detail')].map((line) => line.textContent);

        expect(stat('Live version').querySelector('.model-stat-value')).toHaveTextContent('Taken down Oct 19');
        expect(details).toEqual(['Worse than the baseline 5 scored days in a row.']);
        expect(stat('Live version').querySelector('.model-stat-head').lastElementChild).toHaveClass('model-stat-down');
        expect(stat('Live version').querySelector('.model-stat-down')).toHaveTextContent(new RegExp(`^${DOWN_LINE}$`));
        expect(checksIn('cards')).toEqual([CHECKS, ['5 of 5', '1 of 10', 'not yet']]);
    });

    it('names a phone\'s box Taken down, with the day as its value, where a live version\'s box keeps its one name and value (#272)', async () => {
        answer({ listing: listingOf([modelOf(), downModelOf()]) });

        const { unmount } = await open();
        const box = () => noteOf(0).closest('.stream-focus-figure');

        expect(box().querySelector('.stream-focus-short')).toBeNull();

        unmount();
        await open('lagging');

        expect(box().querySelector('.stream-focus-figure-label .stream-focus-short')).toHaveTextContent(/^Taken down$/);
        expect(box().querySelector('.stream-focus-figure-value .stream-focus-short')).toHaveTextContent(/^Oct 19$/);
        expect(box().querySelector('.stream-focus-figure-label .stream-focus-long')).toHaveTextContent(/^Live version$/);
        expect(box().querySelector('.stream-focus-figure-value .stream-focus-long')).toHaveTextContent(/^Taken down Oct 19$/);
    });

    it('keeps the check that did it in a phone\'s note, and it and what happens next under the boxes (#300)', async () => {
        answer({ listing: listingOf([downModelOf()]) });
        await open('lagging');

        expect(noteOf(0)).toHaveAccessibleDescription('Worse than the baseline 5 scored days in a row.');
        expect(document.querySelector('.model-down-line')).toHaveTextContent(`Worse than the baseline 5 scored days in a row. ${DOWN_LINE}`);
    });

    it('words an average\'s check as an average\'s, in a phone\'s note', async () => {
        answer({ listing: listingOf([downModelOf({ down: { since: '2026-10-19', days: 20, in_a_row: 5 } })]) });
        await open('lagging');

        expect(noteOf(0)).toHaveAccessibleDescription('Its 20-day average was worse than the baseline’s 5 days in a row.');
    });

    it.each([
        ['not_ahead', 'It went live without beating the baseline.'],
        ['track_record', 'Its track record showed nothing better than the baseline.'],
    ])('says why where no check did it, from format 4, on a wide screen and in a phone\'s note (%s, #295)', async (reason, why) => {
        answer({ listing: listingOf([downModelOf({ down: { since: '2026-10-23', reason: reason, days: null, in_a_row: null }, behind: behindOf(0, 0) })], 4) });
        await open('lagging');

        const details = [...stat('Live version').querySelectorAll('.model-stat-detail')].map((line) => line.textContent);

        expect(stat('Live version').querySelector('.model-stat-value')).toHaveTextContent('Taken down Oct 23');
        expect(details).toEqual([why]);
        expect(stat('Live version').querySelector('.model-stat-down')).toHaveTextContent(DOWN_LINE);
        expect(noteOf(0)).toHaveAccessibleDescription(why);
        expect(document.querySelector('.model-down-line')).toHaveTextContent(`${why} ${DOWN_LINE}`);
        expect(screen.getByRole('region', { name: 'Summary' })).not.toHaveTextContent(/null|undefined/);
    });

    it('says how many days in a row each check has been worse, in a table at the Live version card\'s foot (#300)', async () => {
        answer({ listing: listingOf([downModelOf()]) });
        await open('lagging');

        expect(rowsOf(stat('Live version'))).toEqual([['First predicted', 'Sep 1']]);
        expect(stat('Live version').querySelector('.model-checks caption')).toHaveTextContent('Days in a row worse than the baseline');
        expect(stat('Live version').querySelector('.model-stat-body').lastElementChild).toHaveClass('model-checks-block');
        expect(checksIn('cards')).toEqual([CHECKS, ['5 of 5', '1 of 10', 'not yet']]);
        expect(stat('Loss, last 20 days')).not.toHaveTextContent('Days in a row');
    });

    it('notes under the checks what "not yet" means, and what a check at its limit does, on a wide screen and under a phone\'s boxes (#300)', async () => {
        answer({ listing: listingOf([downModelOf()]) });
        await open('lagging');

        const NOTE = 'A check says “not yet” until it has the scored days it needs. One that reaches its limit takes the version down.';

        expect(stat('Live version').querySelector('.model-checks-block').lastElementChild).toHaveClass('model-checks-note');
        expect(document.querySelector('.model-summary-cards .model-checks-note')).toHaveTextContent(new RegExp(`^${NOTE}$`));
        expect(document.querySelector('.model-summary-boxes .model-checks-note')).toHaveTextContent(new RegExp(`^${NOTE}$`));
    });

    it('says so of a model still live too, which shows how close it is, on a wide screen and under a phone\'s boxes', async () => {
        answer({ listing: listingOf([modelOf({ behind: behindOf() })]) });
        await open();

        expect(checksIn('cards')).toEqual([CHECKS, ['4 of 5', '0 of 10', 'not yet']]);
        expect(checksIn('boxes')).toEqual(checksIn('cards'));
        expect(noteOf(2)).toHaveAccessibleDescription(LOSS_NOTE);
        expect(stat('Live version').querySelector('.model-stat-head')).toHaveTextContent(/^Live versionOct 9nightly update$/);
        expect(document.querySelector('.model-stat-down')).toBeNull();
        expect(screen.queryByText(DOWN_LINE)).toBeNull();
        expect(document.querySelector('.model-down-line')).toBeNull();
    });

    it('fades a check without its days, where a count is in the figures\' ink', async () => {
        answer({ listing: listingOf([modelOf({ behind: behindOf() })]) });
        await open();

        const cells = [...document.querySelectorAll('.model-summary-cards .model-checks td')];

        expect(cells.map((cell) => cell.className)).toEqual(['', '', 'model-checks-none']);
    });

    it('says none of it for a retired model, or where the listing gives no checks, as one before format 2', async () => {
        answer({ listing: listingOf([modelOf({ retired: '2026-10-02', behind: behindOf() }), modelOf({ name: 'older' })]) });

        const { unmount } = await open();

        expect(screen.queryByText(/^Days in a row worse/)).toBeNull();

        unmount();
        await open('older');

        expect(screen.queryByText(/^Days in a row worse/)).toBeNull();
        expect(screen.queryByText(DOWN_LINE)).toBeNull();
    });

    it('names its score so far where it was taken down before its 20th scored day', async () => {
        answer({ listing: listingOf([downModelOf({ scored_days: 7 })]) });
        await open('lagging');

        expect(stat('Loss, 7 days so far')).toBeInTheDocument();
    });

    it('keeps its bell, since a new version can still go live', async () => {
        answer({ listing: listingOf([downModelOf()]) });
        await open('lagging');

        expect(document.querySelector('.model-heading a[href$="/alarm"]')).toHaveAttribute('href', '/model/lagging/alarm');
    });
});

describe('what the live version trained on, from format 4 (#295)', () => {
    function noteOf(at) {
        const row = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-boxes');

        return row.querySelectorAll('.stream-focus-figure-label')[at];
    }

    it('says it in the Live version card\'s rows on a wide screen, and after how it went live in a phone\'s note', async () => {
        answer({ listing: listingOf([modelOf({ live: { since: '2026-10-09', kind: 'nightly', days: TRAINED } })], 4) });
        await open();

        expect(rowsOf(cardOf('Live version'))).toEqual([['Trained on', '7 days, Oct 5 to Oct 19'], ['First predicted', 'Sep 1']]);
        expect(noteOf(0)).toHaveAccessibleDescription('Went live after a nightly update.');
        expect(document.querySelector('.model-trained-line')).toHaveTextContent('Trained on7 days, Oct 5 to Oct 19');
    });

    it('says a version that learned from one day as one day', async () => {
        answer({ listing: listingOf([modelOf({ live: { since: '2026-10-09', kind: 'first', days: { ...TRAINED, training: 1, first: '2026-10-08', last: '2026-10-08' } } })], 4) });
        await open();

        expect(rowsOf(cardOf('Live version'))).toContainEqual(['Trained on', '1 day, Oct 8']);
    });

    it('says it of one taken down, last under a phone\'s boxes, after why it was (#300)', async () => {
        answer({
            listing: listingOf([downModelOf({
                live: { since: '2026-10-09', kind: 'first', days: TRAINED },
                down: { since: '2026-10-23', reason: 'not_ahead', days: null, in_a_row: null },
            })], 4),
        });
        await open('lagging');

        expect(noteOf(0)).toHaveAccessibleDescription('It went live without beating the baseline.');
        expect(underBoxes().slice(-3)).toEqual([
            'It went live without beating the baseline. Nothing predicts until a new version beats the baseline on the days it was tested on.',
            'model-checks-block',
            'model-trained-line',
        ]);
    });

    it('says nothing of it where the listing gives none, as before format 4', async () => {
        answer();
        await open();

        expect(screen.queryByText('Trained on')).toBeNull();
        expect(document.querySelector('.model-trained-line')).toBeNull();
        expect(noteOf(0)).toHaveAccessibleDescription('Went live after a nightly update.');
    });
});

describe('the summary, on a phone', () => {
    const RETRAINS = { 1: { kind: 'weekly', went_live: true }, 3: { kind: 'weekly' } };
    const WENT = 'Of every nightly attempt, how many scored a loss no higher than the live version’s and replaced it.';

    //
    // the row of boxes a phone shows in place of the cards (#253)
    //
    function boxes() {
        const row = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-boxes');

        return [...row.querySelectorAll('.stream-focus-figure')];
    }

    //
    // a box's name as a phone shows it: its shorter one, where it has one
    //
    function named(box) {
        const label = box.querySelector('.stream-focus-figure-label');

        return (label.querySelector('.stream-focus-short') || label).textContent;
    }

    const values = () => boxes().map((box) => box.querySelector('.stream-focus-figure-value'));
    const notes = () => boxes().map((box) => box.querySelector('.stream-focus-figure-label'));

    it('draws the three figures as one row of boxes, a name over a value', async () => {
        answer({ history: historyOf(4, RETRAINS) });

        await open();

        expect(boxes()).toHaveLength(3);
        expect(boxes().map(named)).toEqual(['Live version', 'Went live', 'Loss']);
        expect(values().map((value) => value.textContent)).toEqual(['Oct 9', '4 of 30', '1.600']);
    });

    it('keeps the cards\' names for the screens with room for them', async () => {
        answer();

        await open();

        expect(boxes()[1].querySelector('.stream-focus-long')).toHaveTextContent('Attempts that went live');
        expect(boxes()[2].querySelector('.stream-focus-long')).toHaveTextContent('Loss, last 20 days');
    });

    it('moves the line under each card\'s value into its box\'s note, as a sentence, after what the score measures (#265)', async () => {
        answer({ history: historyOf(4, RETRAINS) });

        await open();

        expect(notes()[0]).toHaveAccessibleDescription('Went live after a nightly update.');
        expect(notes()[1]).toHaveAccessibleDescription(`${WENT} Weekly retrains: 1 of 2.`);
        expect(notes()[2]).toHaveAccessibleDescription(`${LOSS_NOTE} 1st of 3 Next-day direction models.`);
    });

    it('says the score\'s name and how it stands against the baseline first under the boxes, with the arrow (#300)', async () => {
        answer();

        await open();

        const line = document.querySelector('.model-score-line');

        expect(line).toHaveTextContent('Loss, last 20 days: ▲ 0.060 better than the baseline, 1.660');
        expect(line).toHaveClass('model-gap-better');
        expect(line.querySelector('.model-gap-arrow')).toHaveTextContent('▲');
        expect(underBoxes()[0]).toBe(line.textContent);
    });

    it('puts under the boxes the score\'s line, loss\'s parts, why it was taken down, its checks, and what it trained on, in that order (#300)', async () => {
        answer({
            listing: listingOf([downModelOf({ live: { since: '2026-10-09', kind: 'nightly', days: TRAINED } })], 4),
            track: trackOf(5, '2026-09-01', () => 1.6),
        });

        await open('lagging');

        expect(underBoxes()).toEqual([
            'Loss, last 20 days: ▼ 0.040 worse than the baseline, 1.660',
            'model-parts',
            'Worse than the baseline 5 scored days in a row. Nothing predicts until a new version beats the baseline on the days it was tested on.',
            'model-checks-block',
            'model-trained-line',
        ]);
    });

    it('says only what going live is where there are no weekly retrains, or no history', async () => {
        answer({ history: null });

        await open();

        expect(notes()[1]).toHaveAccessibleDescription(WENT);
    });

    it('says only what the score measures where there is nothing to say beside it', async () => {
        answer({ listing: listingOf([modelOf({ score: null, baseline: null })]) });

        await open();

        expect(values()[2]).toHaveTextContent('–');
        expect(notes()[2]).toHaveAccessibleDescription(LOSS_NOTE);
    });

    it('starts the score\'s note with what the score picked measures', async () => {
        answer();

        await open('pt-gnn', { scores: { direction: 'acc_up' } });

        expect(notes()[2]).toHaveAccessibleDescription(`${scoreOf('acc_up').note} 2nd of 3 Next-day direction models.`);
        expect(document.querySelector('.model-score-line')).toHaveTextContent('Up/down accuracy, last 20 days: ▲ 2.0 pts better than the baseline, 52.0%');
    });

    it('colors the attempts blue, and the score green where it beats the baseline', async () => {
        answer();

        await open();

        expect(values()[0].className).toBe('stream-focus-figure-value');
        expect(values()[1]).toHaveClass('stream-focus-figure-total');
        expect(values()[2]).toHaveClass('stream-focus-figure-good');
    });

    it('colors the score red where the baseline beats it, and leaves it uncolored where the two are level', async () => {
        answer({ listing: listingOf([modelOf({ baseline: { loss: 1.5, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.5 } })]) });

        const { unmount } = await open();

        expect(values()[2]).toHaveClass('stream-focus-figure-bad');

        unmount();
        answer({ listing: listingOf([modelOf({ baseline: { loss: 1.6001, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.5 } })]) });

        await open();

        expect(values()[2].className).toBe('stream-focus-figure-value');
    });
});

describe('the score\'s name on its card (#265)', () => {
    //
    // the name over a wide screen's score card
    //
    function named(label) {
        const cards = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-cards');

        return within(cards).getByText(label);
    }

    it.each(SCORES.map((score) => [score.key, score.label, score.note]))('carries %s\'s note', async (key, label, note) => {
        answer();
        await open('pt-gnn', { scores: { direction: key } });

        expect(named(`${label}, last 20 days`)).toHaveAccessibleDescription(note);
        expect(named(`${label}, last 20 days`).querySelector('svg')).toHaveAttribute('data-testid', 'InfoOutlinedIcon');
    });

    it('can be reached from the keyboard, and shows its note under the pointer', async () => {
        answer();
        await open();

        expect(named('Loss, last 20 days')).toHaveAttribute('tabindex', '0');

        await userEvent.hover(named('Loss, last 20 days'));

        expect(await screen.findByRole('tooltip')).toHaveTextContent(LOSS_NOTE);
    });

    it('carries it while the score is so far, for a new model', async () => {
        answer();
        await open('fresh');

        expect(named('Loss, 6 days so far')).toHaveAccessibleDescription(LOSS_NOTE);
    });
});

describe('loss, part by part (#265)', () => {
    //
    // a track record whose newest 20-day loss is the listing's 1.600, against the
    // baseline's 1.660, as the trainer's are: every day's loss 1.6
    //
    const steady = () => trackOf(5, '2026-09-01', () => 1.6);

    //
    // the parts' rows under a wide screen's score card, or under a phone's boxes:
    // the stylesheet shows one or the other
    //
    function rowsIn(where) {
        const list = screen.getByRole('region', { name: 'Summary' }).querySelector(`.model-summary-${where} .model-parts`);

        return list ? [...list.querySelectorAll('.model-part')] : [];
    }

    const read = (row) => [
        row.querySelector('.model-part-name').textContent,
        row.querySelector('.model-part-value').textContent,
        row.querySelector('.model-part-gap').textContent,
    ];

    //
    // how far a part stands from the baseline's, as its line prints it, signed:
    // positive where it is better
    //
    const signedGap = (text) => (text.startsWith('▼') ? -1 : 1) * Number(text.match(/([0-9.]+)/)[1]);

    //
    // the score's card's figure, and how far it stands from the baseline's in
    // the line under it
    //
    function figures() {
        const card = within(screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-cards'))
            .getByText('Loss, last 20 days')
            .closest('.model-stat');

        return {
            score: Number(card.querySelector('.model-stat-value').textContent),
            gap: signedGap(card.querySelector('.model-stat-detail').textContent),
        };
    }

    it('shows the three under the score\'s card while Loss is picked, each with how far it stands from the baseline\'s (#300)', async () => {
        answer({ track: steady() });
        await open();

        expect(rowsIn('cards').map(read)).toEqual([
            ['Up or down', '0.720', '▼ 0.020 worse'],
            ['Beats the average stock', '0.620', '▲ 0.073 better'],
            ['Size of the move', '0.260', '▲ 0.007 better'],
        ]);
        expect(within(screen.getByRole('region', { name: 'Summary' })).getAllByRole('list', { name: 'Loss, part by part' })).toHaveLength(2);
    });

    it('adds the three up to the figure, and how far each stands from the baseline\'s up to the figure\'s own, within 0.001', async () => {
        answer({ track: steady() });
        await open();

        const sum = (values) => values.reduce((total, value) => total + value, 0);
        const values = rowsIn('cards').map((row) => Number(row.querySelector('.model-part-value').textContent));
        const gaps = rowsIn('cards').map((row) => signedGap(row.querySelector('.model-part-gap').textContent));

        expect(Math.abs(sum(values) - figures().score)).toBeLessThanOrEqual(0.001);
        expect(Math.abs(sum(gaps) - figures().gap)).toBeLessThanOrEqual(0.001);
    });

    it('marks each part better or worse than the baseline\'s, as the card\'s own line is, the arrow alone in its color (#300)', async () => {
        answer({ track: steady() });
        await open();

        expect(rowsIn('cards').map((row) => row.querySelector('.model-part-gap').className)).toEqual([
            'model-part-gap model-gap-worse',
            'model-part-gap model-gap-better',
            'model-part-gap model-gap-better',
        ]);
        expect(rowsIn('cards').map((row) => row.querySelector('.model-gap-arrow').textContent)).toEqual(['▼', '▲', '▲']);
    });

    it('calls a part level with the baseline\'s so, with no arrow', async () => {
        const track = steady();
        const last = track[track.length - 1];

        last.baseline_average = { ...last.baseline_average, up_log_loss: last.average.up_log_loss };
        answer({ track: track });
        await open();

        expect(rowsIn('cards')[0].querySelector('.model-part-gap')).toHaveTextContent(/^level$/);
        expect(rowsIn('cards')[0].querySelector('.model-part-gap')).toHaveClass('model-gap-level');
        expect(rowsIn('cards')[0].querySelector('.model-gap-arrow')).toBeNull();
    });

    it('shows the same rows under the boxes on a phone', async () => {
        answer({ track: steady() });
        await open();

        expect(rowsIn('boxes').map(read)).toEqual(rowsIn('cards').map(read));
    });

    it('takes them from the track record\'s newest day: its 20-day averages', async () => {
        //
        // a 25th day's loss of 1.7, whose move is 0.36: the newest 20-day
        // average of the move takes in 19 days of 0.26 and that one
        //
        const track = trackOf(25, '2026-09-01', (at) => (at === 24 ? 1.7 : 1.6));

        answer({ track: track });
        await open();

        const gap = Number(formatScore(0.267, 'loss')) - Number(formatScore(0.265, 'loss'));

        expect(read(rowsIn('cards')[2])).toEqual(['Size of the move', formatScore(0.265, 'loss'), `▲ ${formatGap(gap, 'loss')} better`]);
    });

    it('leaves out the baseline\'s side of a part the baseline has none of', async () => {
        const track = steady();
        const last = track[track.length - 1];

        last.baseline_average = { ...last.baseline_average, beats_log_loss: null };
        answer({ track: track });
        await open();

        expect(rowsIn('cards')[1].querySelector('.model-part-value')).toHaveTextContent('0.620');
        expect(rowsIn('cards')[1].querySelector('.model-part-gap')).toBeNull();
    });

    it.each(['auc_up', 'auc_beats', 'acc_up'])('shows none with %s picked', async (score) => {
        answer({ track: steady() });
        await open('pt-gnn', { scores: { direction: score } });

        expect(document.querySelector('.model-parts')).toBeNull();
    });

    it('shows none for a track record written before them, and the rest of the page as it is', async () => {
        answer({ track: olderTrackOf() });
        await open();

        expect(document.querySelector('.model-parts')).toBeNull();
        expect(figures().score).toBe(1.6);
        expect(screen.getByRole('heading', { name: 'Each attempt against the live version' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Track record: Loss' })).toBeInTheDocument();
    });

    it('shows none while the track record is on its way', async () => {
        loadListing.mockResolvedValue(listingOf());
        loadReport.mockImplementation((name, kind) => (kind === 'history' ? Promise.resolve(historyOf()) : new Promise(() => {})));

        await open();

        expect(screen.getByText('Loading the track record…')).toBeInTheDocument();
        expect(document.querySelector('.model-parts')).toBeNull();
    });

    it.each([['could not be had', null], ['has no days yet', []]])('shows none where the track record %s', async (name, track) => {
        answer({ track: track });
        await open();

        expect(document.querySelector('.model-parts')).toBeNull();
        expect(figures().score).toBe(1.6);
    });
});

describe('each card\'s rows on a wide screen (#267)', () => {
    //
    // a history whose seventh night, Oct 9, is the one pt-gnn's live version went
    // live on, with a loss 0.010 lower than the version before it
    //
    const wentOn = () => historyOf(7, { 6: { went_live: true, attempt: { loss: 1.59 }, live: { loss: 1.6 } } });
    const keys = (rows) => rows.map((row) => row.key);

    it('splits each card into its top part, then its rows under a rule, and puts nothing under the cards', async () => {
        answer();
        await open();

        const cards = [...document.querySelectorAll('.model-summary-cards > *')];

        expect(cards).toHaveLength(3);
        cards.forEach((card) => {
            expect(card).toHaveClass('model-stat');
            expect([...card.children].map((part) => part.className)).toEqual(['model-stat-head', 'model-stat-body']);
        });
    });

    describe('Live version', () => {
        it('says by how much the live version beat the one it replaced, in loss, whatever score is picked', async () => {
            answer({ history: wentOn() });
            await open('pt-gnn', { scores: { direction: 'auc_up' } });

            expect(rowsOf(cardOf('Live version'))).toEqual([
                ['Beat the version it replaced by', '0.010'],
                ['First predicted', 'Sep 1'],
            ]);
        });

        it.each([
            ['a first version', { live: { since: '2026-10-09', kind: 'first' } }],
            ['one taken down', { down: { since: '2026-10-19', days: 1, in_a_row: 5 } }],
            ['a retired model', { retired: '2026-10-20' }],
            ['a night the history does not hold', { live: { since: '2026-10-12', kind: 'nightly' } }],
        ])('says nothing of beating the version before for %s', (name, overrides) => {
            expect(keys(liveRows(modelOf(overrides), wentOn()))).not.toContain('beat');
        });

        it('says nothing of it for a version that only matched the one before it, or while the history is on its way', () => {
            const matched = historyOf(7, { 6: { went_live: true, attempt: { loss: 1.6 }, live: { loss: 1.6 } } });

            expect(keys(liveRows(modelOf(), matched))).toEqual(['started']);
            expect(keys(liveRows(modelOf(), undefined))).toEqual(['started']);
        });

        it('says when the model first predicted, and nothing where the listing gives no day', () => {
            expect(liveRows(modelOf(), null)).toEqual([{ key: 'started', name: 'First predicted', value: 'Sep 1' }]);
            expect(liveRows(modelOf({ started: null }), null)).toEqual([]);
        });

        it('gives a retired model no checks, though the listing has them', () => {
            expect(keys(liveRows(modelOf({ retired: '2026-10-02', behind: behindOf() }), null))).toEqual(['started']);
        });

        it('says what the live version trained on, from format 4, before what it beat the one before by (#295, #300)', () => {
            const rows = liveRows(modelOf({ live: { since: '2026-10-09', kind: 'nightly', days: TRAINED } }), wentOn());

            expect(keys(rows)).toEqual(['trained', 'beat', 'started']);
            expect(rows[0]).toEqual({ key: 'trained', name: 'Trained on', value: '7 days, Oct 5 to Oct 19' });
        });

        it('says first which holds a stock model predicts, where it is handed them (#300)', () => {
            const rows = liveRows(modelOf({ live: { since: '2026-10-09', kind: 'nightly', days: TRAINED } }), wentOn(), '1, 5 and 20 days');

            expect(keys(rows)).toEqual(['predicts', 'trained', 'beat', 'started']);
            expect(rows[0]).toEqual({ key: 'predicts', name: 'Predicts', value: '1, 5 and 20 days' });
            expect(keys(liveRows(modelOf(), null, ''))).toEqual(['started']);
        });

        it('says so of one taken down or retired too, as it says what the version that predicted learned from (#295)', () => {
            const live = { since: '2026-10-09', kind: 'nightly', days: TRAINED };

            expect(keys(liveRows(downModelOf({ live: live, behind: [] }), null))).toEqual(['trained', 'started']);
            expect(keys(liveRows(modelOf({ live: live, retired: '2026-10-20' }), null))).toEqual(['trained', 'started']);
        });

        it('says nothing of it where the listing gives none, as before format 4 (#295)', () => {
            expect(keys(liveRows(modelOf({ live: { since: '2026-10-09', kind: 'nightly', days: null } }), null))).toEqual(['started']);
        });

        it('says what made the live version, or how a first version or a retired model\'s came to be, or for one taken down, why (#300)', () => {
            expect(liveLine(modelOf())).toBe('nightly update');
            expect(liveLine(modelOf({ live: { since: '2026-10-12', kind: 'weekly' } }))).toBe('weekly retrain');
            expect(liveLine(modelOf({ scored_days: 6, live: { since: '2026-10-09', kind: 'nightly' } }))).toBe('nightly update');
            expect(liveLine(modelOf({ live: { since: '2026-10-05', kind: 'first' } }))).toBe('its first version, not yet beaten');
            expect(liveLine(modelOf({ live: { since: null, kind: null } }))).toBe('its first version, not yet beaten');
            expect(liveLine(modelOf({ retired: '2026-10-02' }))).toBe('its last version went live Oct 9');
            expect(liveLine(downModelOf())).toBe('Worse than the baseline 5 scored days in a row.');
        });

        it('says why for every take-down, a check\'s too, which the checks\' table no longer names (#295, #300)', () => {
            const downFor = (reason) => downModelOf({ down: { since: '2026-10-23', reason: reason, days: null, in_a_row: null } });

            expect(liveLine(downFor('not_ahead'))).toBe('It went live without beating the baseline.');
            expect(liveLine(downFor('track_record'))).toBe('Its track record showed nothing better than the baseline.');
            expect(liveLine(downModelOf({ down: { since: '2026-10-19', reason: 'worse', days: 1, in_a_row: 5, hold: 5 } })))
                .toBe('Its 5-day hold did worse than the baseline 5 scored days in a row.');
        });
    });

    describe('Attempts that went live', () => {
        it('counts each kind that went live, then says how the newest night went, and when it started and how long it took', async () => {
            answer({ history: timedHistoryOf({ 4: { went_live: true } }) });
            await open();

            const card = cardOf('Attempts that went live');

            expect(card.querySelector('.model-stat-head')).toHaveTextContent(/of every nightly update and weekly retrain$/);
            expect(rowsOf(card)).toEqual([
                ['Nightly updates', '1 of 5 went live'],
                ['Last attempt', 'Oct 16, went live'],
                ['Started', '3:58 AM ET'],
                ['Took', '9 min 52 s'],
                ['Its held-out loss', '1.614, live 1.600'],
            ]);
        });

        it('says last that attempts are judged on the 1-day hold, for a stock model with holds (#300)', () => {
            expect(attemptRows(historyOf(2), true).map((row) => [row.name, row.value])).toEqual([
                ['Nightly updates', '0 of 2 went live'],
                ['Last attempt', 'Oct 2, kept back'],
                ['Its held-out loss', '1.611, live 1.600'],
                ['Judged on', 'the 1-day hold'],
            ]);
            expect(attemptRows(historyOf(2)).map((row) => row.key)).not.toContain('judged');
        });

        it('gives the held-out loss alone where the live version has none, as on a first night (#300)', () => {
            const rows = attemptRows(historyOf(1, { 0: { live: { loss: null } } }));

            expect(rows.find((row) => row.key === 'loss').value).toBe('1.610');
        });

        it('gives no held-out loss for a night with none', () => {
            expect(attemptRows(historyOf(1, { 0: { attempt: { loss: null } } })).map((row) => row.key)).not.toContain('loss');
        });

        it('has no times for a night before Oct 15, and a row for weekly retrains only where there were some', async () => {
            answer({ history: historyOf(4, { 1: { kind: 'weekly', went_live: true }, 3: { kind: 'weekly' } }) });
            await open();

            expect(rowsOf(cardOf('Attempts that went live'))).toEqual([
                ['Nightly updates', '0 of 2 went live'],
                ['Weekly retrains', '1 of 2 went live'],
                ['Last attempt', 'Oct 6, kept back'],
                ['Its held-out loss', '1.613, live 1.600'],
            ]);
        });

        it.each([['could not be had', null], ['has no nights yet', []]])('says what its count is of, and has no rule or rows, where the history %s', async (name, history) => {
            answer({ history: history });
            await open();

            const card = cardOf('Attempts that went live');

            expect(card.querySelector('.model-stat-head')).toHaveTextContent(/of every nightly update and weekly retrain$/);
            expect(card.querySelector('.model-stat-body')).toBeNull();
            expect(attemptRows(history)).toEqual([]);
        });
    });

    describe('the score', () => {
        //
        // a track record whose newest 20-day loss is the listing's, as the
        // parts' own cases use
        //
        const steady = () => trackOf(5, '2026-09-01', () => 1.6);

        it('puts its place among its task\'s models first, then at its foot the parts under a heading of their own, under its rule (#272, #300)', async () => {
            answer({ track: steady() });
            await open();

            const body = cardOf('Loss, last 20 days').querySelector('.model-stat-body');

            expect([...body.children].map((part) => part.className)).toEqual(['model-stat-rows', 'model-stat-group']);
            expect(rowsOf(body)).toEqual([['Among Next-day direction models', '1st of 3']]);
            expect(body.querySelector('.model-stat-group-head')).toHaveTextContent('Loss, part by part');
            expect(body.querySelector('.model-stat-group > .model-parts')).not.toBeNull();
            expect(cardOf('Loss, last 20 days').querySelector('.model-stat-head')).not.toHaveTextContent('Next-day direction models');
        });

        it('gives the only model of its task no place, and keeps the heading and the parts', async () => {
            answer({ listing: listingOf([modelOf()]), track: steady() });
            await open();

            const body = cardOf('Loss, last 20 days').querySelector('.model-stat-body');

            expect([...body.children].map((part) => part.className)).toEqual(['model-stat-group']);
            expect(rowsOf(body)).toEqual([]);
        });

        it('keeps its place, and has no heading or parts, with another score picked', async () => {
            answer({ track: steady() });
            await open('pt-gnn', { scores: { direction: 'auc_up' } });

            const body = cardOf('Up/down AUC, last 20 days').querySelector('.model-stat-body');

            expect(rowsOf(body)).toEqual([['Among Next-day direction models', '1st of 3']]);
            expect(body.querySelector('.model-parts')).toBeNull();
        });

        it.each([['written before the parts', olderTrackOf], ['that could not be had', () => null]])('has no heading for a track record %s, which has no parts to head (#272)', async (name, track) => {
            answer({ track: track() });
            await open();

            expect(rowsOf(cardOf('Loss, last 20 days'))).toEqual([['Among Next-day direction models', '1st of 3']]);
        });
    });
});

describe('the score picker', () => {
    it('hands the score picked up, with the model\'s task, for both pages to show (#279)', async () => {
        const onScore = jest.fn();

        answer();
        await open('pt-gnn', { onScore: onScore });

        await userEvent.click(screen.getByRole('button', { name: 'Up/down AUC' }));

        expect(onScore).toHaveBeenCalledWith('direction', 'auc_up');
    });

    it('changes nothing, and breaks nothing, picked where no store listens (#279)', async () => {
        loadListing.mockResolvedValue(optionsListingOf());
        loadReport.mockImplementation((name, kind) => Promise.resolve(kind === 'history' ? optionsHistoryOf() : optionsTrackOf(30)));
        await open('pt-options');

        await userEvent.click(screen.getByRole('button', { name: 'Profit AUC' }));
        await userEvent.click(screen.getByRole('button', { name: '20 days' }));

        expect(screen.getByRole('button', { name: 'Loss' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: '1 day' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows the score it is handed as picked', async () => {
        answer();

        await open('pt-gnn', { scores: { direction: 'auc_beats' } });

        expect(screen.getByRole('button', { name: 'Beat-the-average AUC' })).toHaveAttribute('aria-pressed', 'true');
    });
});

describe('a report that is not in', () => {
    it('says each is loading while it is on its way', async () => {
        loadListing.mockResolvedValue(listingOf());
        loadReport.mockReturnValue(new Promise(() => {}));

        await open();

        expect(screen.getByText('Loading the nightly attempts…')).toBeInTheDocument();
        expect(screen.getByText('Loading the track record…')).toBeInTheDocument();
    });

    it('draws each one\'s card under its title while it is on its way, and says so to a screen reader (#274)', async () => {
        loadListing.mockResolvedValue(listingOf());
        loadReport.mockReturnValue(new Promise(() => {}));

        await open();

        const lines = screen.getAllByRole('status');

        expect(lines.map((line) => line.textContent)).toEqual(['Loading the nightly attempts…', 'Loading the track record…']);
        lines.forEach((line) => expect(line).toHaveClass('visually-hidden'));
        expect([...document.querySelectorAll('.model-chart-pending')]
            .map((frame) => frame.closest('.model-card').querySelector('.model-fold').textContent))
            .toEqual(['Each attempt against the live version', 'Track record']);
    });

    it('says each could not be loaded where it could not be had', async () => {
        answer({ history: null, track: null });

        await open();

        expect(screen.getByText('The nightly attempts could not be loaded.')).toBeInTheDocument();
        expect(screen.getByText('The track record could not be loaded.')).toBeInTheDocument();
    });

    it('says each has nothing in it yet where it is empty', async () => {
        answer({ history: [], track: [] });

        await open();

        expect(screen.getByText('No nightly attempts yet.')).toBeInTheDocument();
        expect(screen.getByText('No days scored yet.')).toBeInTheDocument();
    });
});

describe('another model beside the track record', () => {
    const legendOfTrack = () => within(screen.getByRole('region', { name: 'Track record: Loss' })).getByRole('list', { name: 'Legend' });

    it('is asked for when it is picked, and drawn once it is in', async () => {
        answer();
        await open();

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Compare with' }), 'tables');

        expect(loadReport).toHaveBeenLastCalledWith('tables', 'track-record', 20);
        expect(within(legendOfTrack()).getByText('tables')).toHaveClass('model-legend-name');
    });

    it('offers the other models of its task only, by name', async () => {
        answer();
        await open();

        expect(within(screen.getByRole('combobox', { name: 'Compare with' })).getAllByRole('option').map((option) => option.textContent))
            .toEqual(['No other model', 'fresh', 'tables']);
    });

    it('lets go of one that lands after another was picked', async () => {
        const slow = deferred();

        answer();
        await open();

        loadReport.mockImplementation((name) => (name === 'tables' ? slow.promise : Promise.resolve(trackOf())));

        const menu = screen.getByRole('combobox', { name: 'Compare with' });

        await userEvent.selectOptions(menu, 'tables');
        await userEvent.selectOptions(menu, 'fresh');
        await act(async () => slow.resolve(null));

        expect(screen.queryByText('The track record of tables could not be loaded.')).toBeNull();
        expect(within(legendOfTrack()).getByText('fresh')).toBeInTheDocument();
    });

    it('asks for nothing when none is picked', async () => {
        answer();
        await open();

        const menu = screen.getByRole('combobox', { name: 'Compare with' });

        await userEvent.selectOptions(menu, 'tables');
        loadReport.mockClear();
        await userEvent.selectOptions(menu, '');

        expect(loadReport).not.toHaveBeenCalled();
    });
});

describe('the went-live ticks', () => {
    it('mark the track record on each night the history says a version went live', async () => {
        answer({
            history: historyOf(3, { 0: { day: '2026-09-02', went_live: true }, 2: { day: '2026-09-04', went_live: true } }),
            track: trackOf(5),
        });

        const { container } = await open();

        expect(container.querySelectorAll('.model-track .model-went-live')).toHaveLength(2);
    });

    it('mark nothing while the history is not in', async () => {
        answer({ history: null });

        const { container } = await open();

        expect(container.querySelector('.model-went-live')).toBeNull();
    });
});

describe('an options model (#279)', () => {
    //
    // a format 3 listing, pt-options' history, and thirty days of its track
    // record, the last four without their 5-day results and the last nineteen
    // without their 20-day ones -- see optionsTrackOf
    //
    function options({ listing = optionsListingOf(), track = optionsTrackOf(30) } = {}) {
        loadListing.mockResolvedValue(listing);
        loadReport.mockImplementation((name, kind) => {
            if (kind === 'history') {
                return Promise.resolve(name === 'pt-options' ? optionsHistoryOf() : historyOf());
            }

            return Promise.resolve(name === 'pt-options' ? track : withTop10(trackOf()));
        });
    }

    function stat(label) {
        const cards = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-cards');

        return within(cards).getByText(label).closest('.model-stat');
    }

    const picker = (name) => within(screen.getByRole('group', { name: name })).getAllByRole('button');
    const pressed = (name) => picker(name).filter((button) => button.getAttribute('aria-pressed') === 'true').map((button) => button.textContent);
    const trackOn = () => document.querySelector('.model-track .model-chart').getAttribute('aria-label');

    describe('its scores', () => {
        it('are its task\'s own, in its picker, which hands one up with its task', async () => {
            const onScore = jest.fn();

            options();
            await open('pt-options', { onScore: onScore });

            expect(picker('Score').map((button) => button.textContent)).toEqual(['Loss', 'Profit AUC', 'Top 10 gain', 'Top 10 wins']);

            await userEvent.click(screen.getByRole('button', { name: 'Profit AUC' }));

            expect(onScore).toHaveBeenCalledWith('option-picks', 'profit_auc');
        });

        it('show its own loss, beside its baseline\'s, under its task\'s note, and no parts of loss', async () => {
            options();
            await open('pt-options');

            expect(stat('Loss, last 20 days').querySelector('.model-stat-value')).toHaveTextContent('0.840');
            expect(stat('Loss, last 20 days')).toHaveTextContent('0.040 better than the baseline, 0.880');
            expect(within(stat('Loss, last 20 days')).getByText('Loss, last 20 days')).toHaveAccessibleDescription(noteOf('loss', OPTIONS_TASK));
            expect(document.querySelector('.model-parts')).toBeNull();
        });

        it.each([
            ['profit_auc', 'Profit AUC', '0.550', '0.050 better than the baseline, 0.500'],
            ['top10_gain', 'Top 10 gain', '3.10%', '7.30 pts better than the baseline, −4.20%'],
            ['top10_wins', 'Top 10 wins', '6.2', '2.1 better than the baseline, 4.1'],
        ])('show %s picked, with no dash for a score it has', async (key, label, value, against) => {
            options();
            await open('pt-options', { scores: { 'option-picks': key } });

            expect(stat(`${label}, last 20 days`).querySelector('.model-stat-value')).toHaveTextContent(value);
            expect(stat(`${label}, last 20 days`)).toHaveTextContent(against);
            expect(within(stat(`${label}, last 20 days`)).getByText(`${label}, last 20 days`)).toHaveAccessibleDescription(noteOf(key, OPTIONS_TASK));
        });

        it('rank it among its own task\'s models alone, where it is the only one', async () => {
            options();
            await open('pt-options', { scores: { 'option-picks': 'top10_gain' } });

            expect(rowsOf(stat('Top 10 gain, last 20 days'))).toEqual([]);
        });

        it('leave a stock model\'s picker and figures as they were, the top 10\'s after its four', async () => {
            options();
            await open('pt-gnn', { scores: { direction: 'top10_wins' } });

            expect(picker('Score').map((button) => button.textContent))
                .toEqual(['Loss', 'Up/down AUC', 'Beat-the-average AUC', 'Up/down accuracy', 'Top 10 gain', 'Top 10 wins']);
            expect(stat('Top 10 wins, last 20 days').querySelector('.model-stat-value')).toHaveTextContent('5.6');
            expect(screen.queryByRole('group', { name: 'Hold' })).toBeNull();
        });
    });

    describe('its holds', () => {
        it('are picked beside the score, on the 1-day hold to start, which the track record is drawn on', async () => {
            options();
            await open('pt-options');

            expect(picker('Hold').map((button) => button.textContent)).toEqual(['1 day', '5 days', '20 days']);
            expect(pressed('Hold')).toEqual(['1 day']);
            expect(trackOn()).toMatch(/^Loss on the 1-day hold of pt-options/);
        });

        it('hand the hold picked up', async () => {
            const onHold = jest.fn();

            options();
            await open('pt-options', { onHold: onHold });

            await userEvent.click(screen.getByRole('button', { name: '5 days' }));

            expect(onHold).toHaveBeenCalledWith(5);
        });

        it('switch the track record\'s columns to the hold picked, and leave the attempts on the plain scores', async () => {
            options();

            const { container } = await open('pt-options', { hold: 5 });

            expect(pressed('Hold')).toEqual(['5 days']);
            expect(trackOn()).toMatch(/^Loss on the 5-day hold of pt-options/);
            expect(container.querySelectorAll('.model-track .model-day-dot')).toHaveLength(26);
            expect(container.querySelector('.model-card:not(.model-track)')).not.toHaveTextContent(/hold/);
        });

        it.each([
            [5, 3, 'No 5-day results yet: each one comes in 6 trading days after its prediction.'],
            [20, 15, 'No 20-day results yet: each one comes in 21 trading days after its prediction.'],
        ])('say why the %s-day hold has nothing to draw, where no day\'s result is in yet, under a title naming it (#300)', async (hold, days, said) => {
            options({ track: optionsTrackOf(days) });
            await open('pt-options', { hold: hold });

            expect(screen.getByText(said)).toHaveClass('model-track-none');
            expect(document.querySelector('.model-track .model-chart')).toBeNull();
            expect(within(document.querySelector('.model-track')).getByRole('heading', { name: `Track record, ${hold}-day hold: Loss` })).toBeInTheDocument();
        });

        it('offer the holds the track record has columns for, on the first where the one handed is none of them', async () => {
            const without = optionsTrackOf(30).map((row) => {
                const drop = (scores) => Object.fromEntries(Object.entries(scores).filter(([key]) => !key.endsWith('_20d')));

                return { ...row, score: drop(row.score), baseline: drop(row.baseline), average: drop(row.average), baseline_average: drop(row.baseline_average) };
            });

            options({ track: without });
            await open('pt-options', { hold: 20 });

            expect(picker('Hold').map((button) => button.textContent)).toEqual(['1 day', '5 days']);
            expect(pressed('Hold')).toEqual(['1 day']);
        });

        it('are offered while the track record is on its way, so the picker does not arrive after the page', async () => {
            loadListing.mockResolvedValue(optionsListingOf());
            loadReport.mockReturnValue(new Promise(() => {}));
            await open('pt-options');

            expect(picker('Hold').map((button) => button.textContent)).toEqual(['1 day', '5 days', '20 days']);
        });

        it('go where the track record has no hold columns, or could not be had', async () => {
            options({ track: trackOf() });

            const { unmount } = await open('pt-options');

            expect(screen.queryByRole('group', { name: 'Hold' })).toBeNull();

            unmount();
            options({ track: null });
            await open('pt-options');

            expect(screen.queryByRole('group', { name: 'Hold' })).toBeNull();
        });
    });

    describe('its take-downs', () => {
        const down = () => optionsModelOf({ down: { since: '2026-10-19', days: 1, in_a_row: 5, hold: 5 }, behind: [] });

        it('name the hold that took the live version down', async () => {
            options({ listing: optionsListingOf([down()]) });
            await open('pt-options');

            const box = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-boxes .stream-focus-figure-label');

            expect(stat('Live version').querySelector('.model-stat-value')).toHaveTextContent('Taken down Oct 19');
            expect(box).toHaveAccessibleDescription('Its 5-day hold did worse than the baseline 5 scored days in a row.');
            expect(document.querySelector('.model-down-line')).toHaveTextContent(
                'Its 5-day hold did worse than the baseline 5 scored days in a row. Nothing predicts until a new version beats the baseline on the days it was tested on.',
            );
            expect(liveFigure(down()).detail).toBe('its 5-day hold did worse than the baseline 5 scored days in a row');
        });

        it('list each check for each hold in the Live version card, a row of its table each (#300)', async () => {
            options();
            await open('pt-options');

            expect(rowsOf(stat('Live version'))).toEqual([['First predicted', 'Sep 1']]);
            expect(checksIn('cards')).toEqual([
                ['Hold', 'Each day', '5-day average', '20-day average'],
                ['1 day', '2 of 5', '0 of 10', '0 of 5'],
                ['5 days', '0 of 5', '0 of 10', 'not yet'],
                ['20 days', '0 of 5', 'not yet', 'not yet'],
            ]);
            expect([...document.querySelectorAll('.model-summary-cards .model-checks tbody th')].map((cell) => cell.getAttribute('scope')))
                .toEqual(['row', 'row', 'row']);
        });
    });

    describe('the track record\'s menu', () => {
        const offered = () => within(screen.getByRole('combobox', { name: 'Compare with' })).getAllByRole('option').map((option) => option.textContent);

        it('offers no other model on loss, where no other is of its task', async () => {
            options();
            await open('pt-options');

            expect(screen.queryByRole('combobox', { name: 'Compare with' })).toBeNull();
        });

        it('offers the other tasks\' models on a score they share', async () => {
            options();
            await open('pt-options', { scores: { 'option-picks': 'top10_gain' } });

            expect(offered()).toEqual(['No other model', 'beater', 'fresh', 'pt-gnn', 'tables']);
        });

        it('offers a stock model its own task\'s models first, and the options model after them, only on a shared score', async () => {
            options();

            const { unmount } = await open('pt-gnn', { scores: { direction: 'top10_gain' } });

            expect(offered()).toEqual(['No other model', 'fresh', 'tables', 'beater', 'pt-options']);

            unmount();
            options();
            await open('pt-gnn');

            expect(offered()).toEqual(['No other model', 'fresh', 'tables']);
        });

        it('draws another task\'s model on its own scores, and lets it go once the score picked is no longer shared', async () => {
            options();

            const view = await open('pt-options', { scores: { 'option-picks': 'top10_gain' } });

            await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Compare with' }), 'pt-gnn');

            expect(loadReport).toHaveBeenLastCalledWith('pt-gnn', 'track-record', 20);
            expect(trackOn()).toMatch(/of pt-options and pt-gnn/);

            await act(async () => {
                view.rerender(
                    <MemoryRouter>
                        <ModelPage name='pt-options' scores={{ 'option-picks': 'loss' }} />
                    </MemoryRouter>
                );
            });

            expect(trackOn()).not.toMatch(/pt-gnn/);
            expect(screen.queryByRole('combobox', { name: 'Compare with' })).toBeNull();
        });
    });

    describe('its picks (#290)', () => {
        it.each([['signed out', null], ['signed in', []]])(
            'are neither drawn nor asked for, %s: they have a page of their own',
            async (label, subscriptions) => {
                listSubscriptions.mockResolvedValue(subscriptions);
                options();
                await open('pt-options');

                expect(loadOptionPicks).not.toHaveBeenCalled();
                expect(document.querySelector('.model-picks')).toBeNull();
                expect(screen.queryByText(/top 10, held|Tonight’s top 10/i)).toBeNull();
                expect(screen.queryByRole('textbox', { name: 'Look up a stock' })).toBeNull();
            },
        );
    });
});

describe('the route', () => {
    it('reads the model\'s name from the address', async () => {
        answer();

        await act(async () => {
            render(
                <MemoryRouter initialEntries={['/model/tables']}>
                    <Routes>
                        <Route path='/model/:model' element={<ModelPageRoute />} />
                    </Routes>
                </MemoryRouter>
            );
        });

        expect(screen.getByRole('heading', { name: 'tables' })).toBeInTheDocument();
        expect(loadReport).toHaveBeenCalledWith('tables', 'history', 20);
    });
});

describe('a stock model\'s holds, from format 5 on (#300)', () => {
    //
    // tables-gnn's record: thirty days, the newest five without their 5-day
    // results, and none with a 20-day result or a combined score
    //
    function held({ listing = heldListingOf(), track = heldTrackOf(30), history = historyOf() } = {}) {
        loadListing.mockResolvedValue(listing);
        loadReport.mockImplementation((name, kind) => Promise.resolve(kind === 'history' ? history : track));
    }

    function stat(label) {
        return within(screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-cards')).getByText(label).closest('.model-stat');
    }

    const picker = (name) => within(screen.getByRole('group', { name: name })).getAllByRole('button');
    const pressed = (name) => picker(name).filter((button) => button.getAttribute('aria-pressed') === 'true').map((button) => button.textContent);
    const trackOn = () => document.querySelector('.model-track .model-chart').getAttribute('aria-label');
    const holdsTable = () => document.querySelector('.model-holds-table');
    const tableRows = () => [...holdsTable().querySelectorAll('tbody tr')];

    describe('the hold picker', () => {
        it('is beside the score picker on a format 5 stock model: 1, 5 and 20 days and Combined, on 1 day to start', async () => {
            held();
            await open('tables-gnn');

            expect(picker('Hold').map((button) => button.textContent)).toEqual(['1 day', '5 days', '20 days', 'Combined']);
            expect(pressed('Hold')).toEqual(['1 day']);
            expect(trackOn()).toMatch(/^Loss on the 1-day hold of tables-gnn/);
        });

        it('is on no stock model whose track record and listing have no holds, as before format 5', async () => {
            answer();
            await open();

            expect(screen.queryByRole('group', { name: 'Hold' })).toBeNull();
            expect(document.querySelector('.model-hold-line')).toBeNull();
            expect(document.querySelector('.model-by-hold')).toBeNull();
        });

        it('is there while the track record is on its way, from the listing\'s holds', async () => {
            loadListing.mockResolvedValue(heldListingOf());
            loadReport.mockImplementation((name, kind) => (kind === 'history' ? Promise.resolve(historyOf()) : new Promise(() => {})));
            await open('tables-gnn');

            expect(picker('Hold').map((button) => button.textContent)).toEqual(['1 day', '5 days', '20 days', 'Combined']);
        });

        it('hands the hold picked up, Combined by its name', async () => {
            const onHold = jest.fn();

            held();
            await open('tables-gnn', { onHold: onHold });
            await userEvent.click(screen.getByRole('button', { name: 'Combined' }));
            await userEvent.click(screen.getByRole('button', { name: '20 days' }));

            expect(onHold.mock.calls).toEqual([['combined'], [20]]);
        });

        it('says under the pickers what the hold is, and when its results come in', async () => {
            held();

            const { unmount } = await open('tables-gnn', { hold: 5 });

            expect(document.querySelector('.model-hold-line')).toHaveTextContent(
                '5-day hold: bought at 9:40 AM on the next trading day and sold at 3:40 PM 5 trading days later, the days the options models’ 5-day hold uses. Each result comes in 6 trading days after its prediction.',
            );

            unmount();
            await open('tables-gnn');

            expect(document.querySelector('.model-hold-line')).toHaveTextContent(/^1-day hold: from 9:40 AM to 3:40 PM on the next trading day/);
        });

        it('falls back to 1 day on an options model, which has no Combined', async () => {
            loadListing.mockResolvedValue(optionsListingOf());
            loadReport.mockImplementation((name, kind) => Promise.resolve(kind === 'history' ? optionsHistoryOf() : optionsTrackOf(30)));
            await open('pt-options', { hold: 'combined' });

            expect(pressed('Hold')).toEqual(['1 day']);
            expect(picker('Hold').map((button) => button.textContent)).not.toContain('Combined');
            expect(document.querySelector('.model-hold-line')).toBeNull();
        });
    });

    describe('the score card', () => {
        it('names the hold, and gives its score and the baseline\'s from the listing\'s holds', async () => {
            const model = heldModelOf();

            held();
            await open('tables-gnn', { hold: 5 });

            const card = stat('Loss, 5-day hold, last 20 days');

            expect(card.querySelector('.model-stat-value')).toHaveTextContent(formatScore(model.holds['5d'].score.loss, 'loss'));
            expect(card.querySelector('.model-stat-detail')).toHaveTextContent(
                `▲ 0.050 better than the baseline, ${formatScore(model.holds['5d'].baseline.loss, 'loss')}`,
            );
            expect(card.querySelector('.model-stat-detail')).toHaveClass('model-gap-better');
        });

        it('names the 1-day hold beside its picker, and gives the listing\'s own scores on it', async () => {
            held();
            await open('tables-gnn');

            expect(stat('Loss, 1-day hold, last 20 days').querySelector('.model-stat-value'))
                .toHaveTextContent(formatScore(heldModelOf().score.loss, 'loss'));
        });

        it('says how many days the hold has scored and when each result comes in, under its place', async () => {
            held();
            await open('tables-gnn', { hold: 5 });

            expect(rowsOf(stat('Loss, 5-day hold, last 20 days'))).toEqual([
                ['Among Next-day direction models', '1st of 2'],
                ['Scored days on this hold', '25'],
                ['Each result comes in', '6 trading days later'],
            ]);
        });

        it('counts a hold\'s days so far by its own days', async () => {
            const track = heldTrackOf(30, { notIn: 20 });

            held({ listing: heldListingOf([heldModelOf({}, track)]), track: track });
            await open('tables-gnn', { hold: 5 });

            expect(stat('Loss, 5-day hold, 10 days so far')).toBeInTheDocument();
        });

        it('says a hold with no day scored yet has none, and when its first result comes in, on the card and in place of the chart', async () => {
            held();
            await open('tables-gnn', { hold: 20 });

            const card = stat('Loss, 20-day hold');

            expect(card.querySelector('.model-stat-value')).toHaveTextContent('–');
            expect(card.querySelector('.model-stat-detail')).toHaveTextContent('No 20-day results yet: each one comes in 21 trading days after its prediction.');
            expect(rowsOf(card)).toContainEqual(['Scored days on this hold', 'none yet']);
            expect(document.querySelector('.model-track .model-chart')).toBeNull();
            expect(document.querySelector('.model-track .model-track-none')).toHaveTextContent('No 20-day results yet: each one comes in 21 trading days after its prediction.');
            expect(within(document.querySelector('.model-track')).getByRole('heading', { name: 'Track record, 20-day hold: Loss' })).toBeInTheDocument();
            expect(screen.getAllByText('No 20-day results yet: each one comes in 21 trading days after its prediction.')).toHaveLength(3);
        });

        it('folds the track record\'s card on a hold with no results, as it folds the chart\'s', async () => {
            held();
            await open('tables-gnn', { hold: 20 });

            await userEvent.click(within(document.querySelector('.model-track')).getByRole('button', { name: 'Track record, 20-day hold: Loss' }));

            expect(document.querySelector('.model-track .model-track-none')).toBeNull();
            expect(within(document.querySelector('.model-track')).getByRole('button', { name: 'Track record, 20-day hold: Loss' })).toHaveAttribute('aria-expanded', 'false');
        });

        it('shows loss\'s three parts on the hold, from its own columns', async () => {
            const track = heldTrackOf(30);
            const newest = track[track.length - 1];

            held({ track: track });
            await open('tables-gnn', { hold: 5 });

            const values = [...stat('Loss, 5-day hold, last 20 days').querySelectorAll('.model-part-value')].map((value) => value.textContent);

            expect(values).toEqual([
                formatScore(newest.average.up_log_loss_5d, 'loss'),
                formatScore(newest.average.beats_log_loss_5d, 'loss'),
                formatScore(newest.average.move_pinball_5d, 'loss'),
            ]);
        });

        it('carries the note of the score on the hold: on Combined, loss averages the day\'s three', async () => {
            held({ track: heldTrackOf(30, { twenty: 30 }) });
            await open('tables-gnn', { hold: 'combined' });

            expect(within(stat('Loss, combined')).getByText('Loss, combined')).toHaveAccessibleDescription(noteOf('loss', { scores: ['loss'] }, 'combined'));
        });
    });

    describe('Combined', () => {
        it('offers the top 10\'s two disabled, in the buttons and the phone\'s menu', async () => {
            held();
            await open('tables-gnn', { hold: 'combined' });

            expect(picker('Score').filter((button) => button.disabled).map((button) => button.textContent)).toEqual(['Top 10 gain', 'Top 10 wins']);
            expect([...document.querySelectorAll('.model-scores:not(.model-holds) option:disabled')].map((option) => option.textContent))
                .toEqual(['Top 10 gain', 'Top 10 wins']);
        });

        it('shows loss where a top 10\'s score is picked, and leaves the score picked as it was', async () => {
            const onScore = jest.fn();

            held();
            await open('tables-gnn', { hold: 'combined', scores: { direction: 'top10_gain' }, onScore: onScore });

            expect(pressed('Score')).toEqual(['Loss']);
            expect(stat('Loss, combined')).toBeInTheDocument();
            expect(onScore).not.toHaveBeenCalled();
        });

        it('shows the top 10\'s score again on another hold', async () => {
            held();
            await open('tables-gnn', { hold: 5, scores: { direction: 'top10_gain' } });

            expect(pressed('Score')).toEqual(['Top 10 gain']);
            expect(stat('Top 10 gain, 5-day hold, last 20 days')).toBeInTheDocument();
        });
    });

    describe('the attempts', () => {
        it('stay as they are on every hold, with all three of their charts', async () => {
            held({ history: timedHistoryOf() });

            //
            // the card as drawn, but for the ids recharts numbers its clips by,
            // which count up from one chart drawn to the next
            //
            const drawn = () => document.querySelector('.model-attempts').innerHTML.replace(/recharts\d+-clip/g, 'clip');
            const { unmount } = await open('tables-gnn');
            const before = drawn();

            unmount();
            await open('tables-gnn', { hold: 5 });

            expect(drawn()).toBe(before);
            expect(screen.getByRole('heading', { name: 'How long each attempt took' })).toBeInTheDocument();
        });

        it('are said to be judged on the 1-day hold', async () => {
            held();
            await open('tables-gnn', { hold: 20 });

            expect(rowsOf(stat('Attempts that went live'))).toContainEqual(['Judged on', 'the 1-day hold']);
        });

        it('say nothing of a hold for a model without holds, or an options model', async () => {
            answer();

            const { unmount } = await open();

            expect(rowsOf(stat('Attempts that went live')).map((row) => row[0])).not.toContain('Judged on');

            unmount();
            loadListing.mockResolvedValue(optionsListingOf());
            loadReport.mockImplementation((name, kind) => Promise.resolve(kind === 'history' ? optionsHistoryOf() : optionsTrackOf(30)));
            await open('pt-options');

            expect(rowsOf(stat('Attempts that went live')).map((row) => row[0])).not.toContain('Judged on');
        });

        it('say at the card\'s foot why they are judged on the 1-day hold', async () => {
            held();
            await open('tables-gnn');

            const body = stat('Attempts that went live').querySelector('.model-stat-body');

            expect(body.lastElementChild).toHaveClass('model-stat-note');
            expect(body.lastElementChild.textContent).toBe(ATTEMPTS_NOTE);
            expect(ATTEMPTS_NOTE).toBe('Each night’s attempt is tested on the newest 3 days, which don’t have 5 or 20-day results yet. The longer holds are judged on their real scored days, by the take-down checks.');
        });

        it.each([['could not be had', null], ['has no nights yet', []]])('have no note where the history %s', async (name, history) => {
            held({ history: history });
            await open('tables-gnn');

            expect(document.querySelector('.model-stat-note')).toBeNull();
        });

        it('have no note for a model without holds, or an options model', async () => {
            answer();

            const { unmount } = await open();

            expect(document.querySelector('.model-stat-note')).toBeNull();

            unmount();
            loadListing.mockResolvedValue(optionsListingOf());
            loadReport.mockImplementation((name, kind) => Promise.resolve(kind === 'history' ? optionsHistoryOf() : optionsTrackOf(30)));
            await open('pt-options');

            expect(document.querySelector('.model-stat-note')).toBeNull();
        });

        it('are said to be judged on the 1-day hold where only the track record has holds', async () => {
            answer({ track: heldTrackOf(30) });
            await open();

            expect(rowsOf(stat('Attempts that went live'))).toContainEqual(['Judged on', 'the 1-day hold']);
            expect(document.querySelector('.model-stat-note').textContent).toBe(ATTEMPTS_NOTE);
            expect(document.querySelector('.model-by-hold, .model-when')).toBeNull();
        });
    });

    describe('the Live version card', () => {
        it('says first which holds the model predicts', async () => {
            held();
            await open('tables-gnn');

            expect(rowsOf(stat('Live version'))).toEqual([['Predicts', '1, 5 and 20 days'], ['First predicted', 'Sep 1']]);
        });

        it('says when a hold yet to switch on does', async () => {
            mockToday = '2026-11-13';
            held();
            await open('tables-gnn');

            expect(rowsOf(stat('Live version'))[0]).toEqual(['Predicts', '1 and 5 days; 20 days from the Nov 21 retrain']);
        });

        it('says nothing of what an options model, or a stock model without holds, predicts', async () => {
            loadListing.mockResolvedValue(heldListingOf());
            loadReport.mockImplementation((name, kind) => Promise.resolve(kind === 'history' ? optionsHistoryOf() : optionsTrackOf(30)));

            const { unmount } = await open('pt-options');

            expect(rowsOf(stat('Live version')).map((row) => row[0])).not.toContain('Predicts');

            unmount();
            answer();
            await open();

            expect(rowsOf(stat('Live version')).map((row) => row[0])).not.toContain('Predicts');
        });

        it('notes under its checks what "not yet" means, and when a hold yet to switch on does, on a wide screen and under a phone\'s boxes', async () => {
            const NOTE = 'A check says “not yet” until its hold has the scored days it needs. A hold that reaches its limit takes the version down.';
            const notes = () => [...document.querySelectorAll('.model-summary .model-checks-note')].map((note) => note.textContent);

            mockToday = '2026-11-13';
            held({ listing: heldListingOf([heldModelOf({ behind: holdsBehindOf() })]) });

            const { unmount } = await open('tables-gnn');

            expect(notes()).toEqual([`The 20-day hold switches on at the Nov 21 retrain. ${NOTE}`, `The 20-day hold switches on at the Nov 21 retrain. ${NOTE}`]);

            unmount();
            mockToday = '2027-01-07';
            await open('tables-gnn');

            expect(notes()).toEqual([NOTE, NOTE]);
        });
    });

    describe('Scores by hold', () => {
        it('has a row for each hold and Combined, and a column for each score', async () => {
            held();
            await open('tables-gnn');

            expect(screen.getByRole('heading', { name: /Scores by hold/ })).toBeInTheDocument();
            expect([...holdsTable().querySelectorAll('thead th')].map((cell) => cell.textContent))
                .toEqual(['Hold', 'Loss', 'Up/down AUC', 'Beat-the-average AUC', 'Up/down accuracy', 'Top 10 gain', 'Top 10 wins']);
            expect(tableRows().map((row) => row.querySelector('.model-holds-name').textContent)).toEqual(['1 day', '5 days', '20 days', 'Combined']);
        });

        it('gives each cell the hold\'s average and how it stands against the baseline\'s, with the arrow', async () => {
            const model = heldModelOf();

            held();
            await open('tables-gnn');

            const loss = tableRows()[1].querySelectorAll('td')[0];

            expect(loss.querySelector('.model-holds-value')).toHaveTextContent(formatScore(model.holds['5d'].score.loss, 'loss'));
            expect(loss.querySelector('.model-gap')).toHaveTextContent('▲ 0.050 better');
            expect(loss.querySelector('.model-gap')).toHaveClass('model-gap-better');
        });

        it('says each hold\'s scored days and when its results come in', async () => {
            held();
            await open('tables-gnn');

            expect(tableRows().map((row) => [...row.querySelectorAll('.model-holds-about')].map((line) => line.textContent))).toEqual([
                ['last 20 of 30 scored days', 'Comes in the next trading day'],
                ['last 20 of 25 scored days', 'Comes in 6 trading days after the prediction'],
                ['no scored days yet', 'Comes in 21 trading days after the prediction'],
                ['no scored days yet', 'Comes in with the day’s 20-day result'],
            ]);
        });

        it('says Combined has no top 10, and a hold with no day yet has no figure', async () => {
            held();
            await open('tables-gnn');

            const combined = [...tableRows()[3].querySelectorAll('td')];

            expect(combined.slice(-2).map((cell) => cell.textContent)).toEqual(['–no combined score', '–no combined score']);
            expect(tableRows()[2].querySelector('td')).toHaveTextContent(/^–$/);
        });

        it('says a hold of one scored day so far as one day', async () => {
            const model = heldModelOf();

            held({ listing: heldListingOf([{ ...model, holds: { ...model.holds, '5d': { ...model.holds['5d'], days: 1 } } }]) });
            await open('tables-gnn');

            expect(tableRows()[1].querySelector('.model-holds-about')).toHaveTextContent(/^1 scored day so far$/);
        });

        it('shades the hold picked', async () => {
            held();
            await open('tables-gnn', { hold: 5 });

            expect(tableRows().map((row) => row.className)).toEqual(['', 'model-holds-picked', '', '']);
        });

        it('is drawn for no options model', async () => {
            loadListing.mockResolvedValue(heldListingOf());
            loadReport.mockImplementation((name, kind) => Promise.resolve(kind === 'history' ? optionsHistoryOf() : optionsTrackOf(30)));
            await open('pt-options');

            expect(document.querySelector('.model-by-hold')).toBeNull();
        });

        it('becomes \'<score> by hold\' on a phone: the score picked on every hold, a line each, with its days', async () => {
            held();
            await open('tables-gnn', { hold: 5, scores: { direction: 'auc_up' } });

            const list = screen.getByRole('list', { name: 'Up/down AUC by hold' });
            const lines = [...list.querySelectorAll('li')];

            expect(lines.map((line) => line.querySelector('.model-holds-name').textContent)).toEqual(['1 day', '5 days', '20 days', 'Combined']);
            expect(lines[1].querySelector('.model-holds-about')).toHaveTextContent('last 20 of 25 scored days');
            expect(lines[1].querySelector('.model-gap .model-gap-arrow')).toHaveTextContent('▲');
            expect(lines.map((line) => line.className)).toEqual(['', 'model-holds-picked', '', '']);
            expect(document.querySelector('.model-by-hold h5 .model-holds-phone')).toHaveTextContent('Up/down AUC by hold');
        });

        it('says over the table what it holds, and over the phone\'s list what that holds', async () => {
            held();
            await open('tables-gnn');

            const card = document.querySelector('.model-by-hold');

            expect(card.querySelector('.model-card-sub.model-holds-wide').textContent).toBe(
                'Each hold’s scores over its own latest 20 scored days, beside the baseline’s on the same days. Combined is the average of the 1, 5 and 20-day scores of the same prediction days, so it comes in with the 20-day result. The top 10 has no combined score: a 20-day gain and a 1-day gain aren’t the same kind of number.',
            );
            expect(card.querySelector('.model-card-sub.model-holds-phone').textContent).toBe(
                'Each over its hold’s own latest 20 scored days. Pick another score above to see it on every hold.',
            );
        });

        it('says nothing of Combined where the listing gives it none, nor of the top 10 for a task without one', async () => {
            const model = heldModelOf();
            const three = Object.fromEntries(Object.entries(model.holds).filter(([key]) => key !== 'combined'));
            const about = () => document.querySelector('.model-by-hold .model-card-sub.model-holds-wide').textContent;

            held({ listing: heldListingOf([{ ...model, holds: three }]) });

            const { unmount } = await open('tables-gnn');

            expect(about()).toBe('Each hold’s scores over its own latest 20 scored days, beside the baseline’s on the same days.');

            unmount();

            const listing = heldListingOf();

            listing.tasks[0].scores = ['loss', 'auc_up', 'auc_beats', 'acc_up'];
            held({ listing: listing });
            await open('tables-gnn');

            expect(about()).toBe(
                'Each hold’s scores over its own latest 20 scored days, beside the baseline’s on the same days. Combined is the average of the 1, 5 and 20-day scores of the same prediction days, so it comes in with the 20-day result.',
            );
        });

        it('folds down to its title and opens again, the fold kept for the next visit', async () => {
            const card = () => document.querySelector('.model-by-hold');
            const fold = () => within(card()).getByRole('button', { name: /^Scores by hold/ });

            held();

            const { unmount } = await open('tables-gnn');

            expect(fold()).toHaveAttribute('aria-expanded', 'true');

            await userEvent.click(fold());

            expect(fold()).toHaveAttribute('aria-expanded', 'false');
            expect(card().querySelector('.model-card-sub, .model-holds-table, .model-holds-list')).toBeNull();
            expect(screen.getByRole('heading', { name: /Scores by hold/ })).toBeInTheDocument();

            unmount();
            await open('tables-gnn');

            expect(fold()).toHaveAttribute('aria-expanded', 'false');
            expect(card().querySelector('.model-holds-table')).toBeNull();

            await userEvent.click(fold());

            expect(fold()).toHaveAttribute('aria-expanded', 'true');
            expect(card().querySelector('.model-holds-table')).not.toBeNull();
            expect(card().querySelector('.model-holds-list')).not.toBeNull();
        });

        it('keeps a phone\'s title on the score picked while folded', async () => {
            held();
            await open('tables-gnn', { scores: { direction: 'auc_up' } });
            await userEvent.click(within(document.querySelector('.model-by-hold')).getByRole('button', { name: /^Scores by hold/ }));

            expect(document.querySelector('.model-by-hold h5 .model-holds-phone')).toHaveTextContent(/^Up\/down AUC by hold$/);
            expect(document.querySelector('.model-by-hold h5 .model-holds-wide')).toHaveTextContent(/^Scores by hold$/);
        });
    });

    describe('When results come in', () => {
        const card = () => document.querySelector('.model-when');
        const lines = () => [...card().querySelectorAll('.model-when-item')].map((item) => [...item.children].map((part) => part.textContent));

        it('closes the page: a box for each hold, when its results come in, and when its first was scored', async () => {
            held();
            await open('tables-gnn');

            expect(document.querySelector('.model-page').lastElementChild).toBe(card());
            expect(within(card()).getByRole('heading', { name: 'When results come in' })).toBeInTheDocument();
            expect(lines()).toEqual([
                ['1 day', 'Comes in the next trading day', 'First scored Sep 2'],
                ['5 days', 'Comes in 6 trading days after the prediction', 'First scored Sep 9'],
                ['20 days', 'Comes in 21 trading days after the prediction'],
                ['Combined', 'Comes in with the day’s 20-day result'],
            ]);
        });

        it('says when a hold yet to switch on does, and when the first results are due', async () => {
            mockToday = '2026-11-13';
            held();
            await open('tables-gnn');

            expect(lines().slice(2)).toEqual([
                ['20 days', 'Comes in 21 trading days after the prediction', 'Switches on at the Nov 21 retrain; first scored Dec 24'],
                ['Combined', 'Comes in with the day’s 20-day result', 'First scored Dec 24'],
            ]);
        });

        it('names the retrain a hold switched on at, where its first day scored came the week after it', async () => {
            const track = heldTrackOf(30, { from: '2026-11-02' });

            held({ listing: heldListingOf([heldModelOf({}, track)]), track: track });
            await open('tables-gnn');

            expect(lines().slice(0, 2)).toEqual([
                ['1 day', 'Comes in the next trading day', 'First scored Nov 3'],
                ['5 days', 'Comes in 6 trading days after the prediction', 'First scored Nov 10, from the Oct 31 retrain'],
            ]);
        });

        it('says no first day while the track record is on its way', async () => {
            loadListing.mockResolvedValue(heldListingOf());
            loadReport.mockImplementation((name, kind) => (kind === 'history' ? Promise.resolve(historyOf()) : new Promise(() => {})));
            await open('tables-gnn');

            expect(lines()).toEqual([
                ['1 day', 'Comes in the next trading day'],
                ['5 days', 'Comes in 6 trading days after the prediction'],
                ['20 days', 'Comes in 21 trading days after the prediction'],
                ['Combined', 'Comes in with the day’s 20-day result'],
            ]);
        });

        it('is drawn for no options model, and no stock model without holds', async () => {
            loadListing.mockResolvedValue(heldListingOf());
            loadReport.mockImplementation((name, kind) => Promise.resolve(kind === 'history' ? optionsHistoryOf() : optionsTrackOf(30)));

            const { unmount } = await open('pt-options');

            expect(card()).toBeNull();

            unmount();
            answer();
            await open();

            expect(card()).toBeNull();
        });

        it('folds down to its title and opens again, the fold kept for the next visit', async () => {
            const fold = () => within(card()).getByRole('button', { name: 'When results come in' });

            held();

            const { unmount } = await open('tables-gnn');

            expect(fold()).toHaveAttribute('aria-expanded', 'true');

            await userEvent.click(fold());

            expect(fold()).toHaveAttribute('aria-expanded', 'false');
            expect(card().querySelector('.model-when-list')).toBeNull();
            expect(document.querySelector('.model-by-hold .model-holds-table')).not.toBeNull();

            unmount();
            await open('tables-gnn');

            expect(fold()).toHaveAttribute('aria-expanded', 'false');
            expect(card().querySelector('.model-when-list')).toBeNull();

            await userEvent.click(fold());

            expect(fold()).toHaveAttribute('aria-expanded', 'true');
            expect(lines()).toHaveLength(4);
        });
    });

    describe('on a phone', () => {
        afterEach(wideScreen);

        it('names the score box with its hold, and puts the hold\'s figure in it', async () => {
            phoneScreen();
            held();
            await open('tables-gnn', { hold: 5 });

            const box = screen.getByRole('region', { name: 'Summary' }).querySelectorAll('.model-summary-boxes .stream-focus-figure')[2];

            expect(box.querySelector('.stream-focus-figure-label .stream-focus-short')).toHaveTextContent('Loss, 5 days');
            expect(box.querySelector('.stream-focus-figure-value')).toHaveTextContent(formatScore(heldModelOf().holds['5d'].score.loss, 'loss'));
            expect(document.querySelector('.model-score-line')).toHaveTextContent(/^Loss, 5-day hold, last 20 days: ▲ 0\.050 better than the baseline/);
        });

        it('says a hold with no results yet, under the boxes, in place of how it stands', async () => {
            phoneScreen();
            held();
            await open('tables-gnn', { hold: 'combined' });

            expect(document.querySelector('.model-score-line')).toHaveTextContent(
                /^No combined scores yet: each one comes in with its day’s 20-day result, 21 trading days after its prediction\.$/,
            );
        });
    });

    describe('a take-down', () => {
        it('names the hold that did worse, and never says null or undefined', async () => {
            const down = heldModelOf({ down: { since: '2026-10-19', reason: 'worse', days: 1, in_a_row: 5, hold: 5 } });

            held({ listing: heldListingOf([down]) });
            await open('tables-gnn');

            expect(document.querySelector('.model-down-line')).toHaveTextContent(/^Its 5-day hold did worse than the baseline 5 scored days in a row\. Nothing predicts/);
            expect(stat('Live version').querySelector('.model-stat-detail')).toHaveTextContent(/^Its 5-day hold did worse than the baseline 5 scored days in a row\./);
            expect(screen.getByRole('region', { name: 'Summary' })).not.toHaveTextContent(/null|undefined/);
        });

        it('names the hold whose track record showed nothing better, and none for one that went live behind', async () => {
            const downFor = (reason, hold) => heldModelOf({ down: { since: '2026-10-19', reason: reason, days: null, in_a_row: null, hold: hold } });

            held({ listing: heldListingOf([downFor('track_record', 20)]) });

            const { unmount } = await open('tables-gnn');

            expect(document.querySelector('.model-down-line')).toHaveTextContent(
                /^Its 20-day hold’s track record showed nothing better than the baseline, even on the days this version predicted itself\./,
            );

            unmount();
            held({ listing: heldListingOf([downFor('not_ahead', null)]) });
            await open('tables-gnn');

            expect(document.querySelector('.model-down-line')).toHaveTextContent(/^It went live without beating the baseline\./);
            expect(screen.getByRole('region', { name: 'Summary' })).not.toHaveTextContent(/null|undefined/);
        });
    });
});
