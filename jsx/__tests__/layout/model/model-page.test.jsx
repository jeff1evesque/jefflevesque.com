/**
 * model-page.test.jsx: /model/:model, one model on its own (#243).
 *
 * The api is replaced at source.js, so each case says what the listing and the
 * two reports answer, and when. The charts are drawn for real -- see
 * attempts-chart.test.jsx and track-chart.test.jsx for what is in them -- and
 * these cases are about the page round them: who the model is, its figures, and
 * what it says when there is nothing to draw.
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

import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ModelPageRoute, {
    ModelPage,
    attemptRows,
    attemptsLine,
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
import { SCORES, formatScore, noteOf, scoreOf } from '../../../import/layout/model/scores.js';
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
    picksOf,
    timedHistoryOf,
    trackOf,
    withTop10,
} from '../../../test-support/model-fixtures.js';

//
// what loss's name says of it, wherever a page names it (#265)
//
const LOSS_NOTE = scoreOf('loss').note;

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
    loadOptionPicks.mockResolvedValue(picksOf());
    listSubscriptions.mockReset();
    listSubscriptions.mockResolvedValue(null);
    // the charts a case folds are kept, as a reader's are (#253)
    window.localStorage.clear();
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

        it('draws each chart\'s card under its title, its frame as tall as its chart', async () => {
            await open();

            const cards = [...document.querySelectorAll('.model-card')];

            expect(cards.map((card) => card.querySelector('.model-fold').textContent))
                .toEqual(['Each attempt against the live version', 'Track record']);
            cards.forEach((card) => expect(card.querySelector('.model-chart-pending').style.height).toBe('280px'));
        });
    });

    it('gives the placeholders\' places to the model once the listing lands (#274)', async () => {
        const listing = deferred();

        loadListing.mockReturnValue(listing.promise);
        loadReport.mockImplementation((name, kind) => Promise.resolve(kind === 'history' ? historyOf() : trackOf()));
        await open();

        await act(async () => listing.resolve(listingOf()));

        expect(await screen.findByRole('heading', { name: 'Each attempt against the live version' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Track record' })).toBeInTheDocument();
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

        expect(loadReport).toHaveBeenCalledWith('pt-gnn', 'history');
        expect(loadReport).toHaveBeenCalledWith('pt-gnn', 'track-record');
    });

    it('draws its two charts once both are in', async () => {
        answer();

        await open();

        expect(screen.getByRole('heading', { name: 'Each attempt against the live version' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Track record' })).toBeInTheDocument();
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

    it('says when the live version went live, and how many attempts did, since the history\'s first night', async () => {
        answer({ history: historyOf(4, { 1: { kind: 'weekly', went_live: true }, 3: { kind: 'weekly' } }) });

        await open();

        expect(stat('Live version')).toHaveTextContent('Oct 9went live after a nightly update');
        expect(stat('Attempts that went live')).toHaveTextContent('4 of 30every attempt since Oct 1');
    });

    it('says "nightly attempts" under the count where there are no weekly retrains, or no history', async () => {
        answer({ history: null });

        await open();

        expect(stat('Attempts that went live')).toHaveTextContent('nightly attempts');
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

describe('a live version taken down for doing worse than the baseline (#263)', () => {
    const DOWN_LINE = 'Nothing predicts until a new version beats the baseline on the days it was tested on.';
    const BEHIND = 'Days in a row worse than the baseline: each day 4 of 5, 5-day average 0 of 10, 20-day average not yet.';

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

    it('says when it was taken down, and that nothing predicts until a version beats the baseline, the check that did it in its rows (#267)', async () => {
        answer({ listing: listingOf([downModelOf()]) });
        await open('lagging');

        const details = [...stat('Live version').querySelectorAll('.model-stat-detail')].map((line) => line.textContent);

        expect(stat('Live version').querySelector('.model-stat-value')).toHaveTextContent('Taken down Oct 19');
        expect(details).toEqual(['Nothing predicts until a version beats the baseline.']);
        expect(rowsOf(stat('Live version'))).toContainEqual(['Each day', '5 of 5']);
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

    it('keeps the check that did it, and what happens next, in a phone\'s note', async () => {
        answer({ listing: listingOf([downModelOf()]) });
        await open('lagging');

        expect(noteOf(0)).toHaveAccessibleDescription(`Worse than the baseline 5 scored days in a row. ${DOWN_LINE}`);
    });

    it('words an average\'s check as an average\'s, in a phone\'s note', async () => {
        answer({ listing: listingOf([downModelOf({ down: { since: '2026-10-19', days: 20, in_a_row: 5 } })]) });
        await open('lagging');

        expect(noteOf(0)).toHaveAccessibleDescription(`Its 20-day average was worse than the baseline’s 5 days in a row. ${DOWN_LINE}`);
    });

    it('says how many days in a row each check has been worse, in the Live version card\'s rows (#267)', async () => {
        answer({ listing: listingOf([downModelOf()]) });
        await open('lagging');

        expect(rowsOf(stat('Live version'))).toEqual([
            ['First predicted', 'Sep 1'],
            ['Days in a row worse than the baseline'],
            ['Each day', '5 of 5'],
            ['5-day average', '1 of 10'],
            ['20-day average', 'not yet'],
        ]);
        expect(stat('Loss, last 20 days')).not.toHaveTextContent('Days in a row');
    });

    it('says so of a model still live too, which shows how close it is, and nothing of being taken down', async () => {
        answer({ listing: listingOf([modelOf({ behind: behindOf() })]) });
        await open();

        expect(rowsOf(stat('Live version')).slice(-4)).toEqual([
            ['Days in a row worse than the baseline'],
            ['Each day', '4 of 5'],
            ['5-day average', '0 of 10'],
            ['20-day average', 'not yet'],
        ]);
        expect(noteOf(2)).toHaveAccessibleDescription(`${LOSS_NOTE} 0.060 better than the baseline, 1.660. ${BEHIND}`);
        expect(stat('Live version').querySelector('.model-stat-head')).toHaveTextContent(/^Live versionOct 9went live after a nightly update$/);
        expect(screen.queryByText(DOWN_LINE)).toBeNull();
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
        expect(notes()[2]).toHaveAccessibleDescription(`${LOSS_NOTE} 0.060 better than the baseline, 1.660. 1st of 3 Next-day direction models.`);
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

        expect(notes()[2]).toHaveAccessibleDescription(`${scoreOf('acc_up').note} 2.0 pts better than the baseline, 52.0%. 2nd of 3 Next-day direction models.`);
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
        row.querySelector('.model-part-baseline').textContent,
    ];

    //
    // the score's card's figure, and the baseline's in the line under it
    //
    function figures() {
        const card = within(screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-cards'))
            .getByText('Loss, last 20 days')
            .closest('.model-stat');

        return {
            score: Number(card.querySelector('.model-stat-value').textContent),
            baseline: Number(card.querySelector('.model-stat-detail').textContent.match(/([0-9.]+)$/)[1]),
        };
    }

    it('shows the three under the score\'s card while Loss is picked, each beside the baseline\'s', async () => {
        answer({ track: steady() });
        await open();

        expect(rowsIn('cards').map(read)).toEqual([
            ['Up or down', '0.720', 'worse than baseline 0.700'],
            ['Beats the average stock', '0.620', 'better than baseline 0.693'],
            ['Size of the move', '0.260', 'better than baseline 0.267'],
        ]);
        expect(within(screen.getByRole('region', { name: 'Summary' })).getAllByRole('list', { name: 'Loss, part by part' })).toHaveLength(2);
    });

    it('adds the three up to the figure, and the baseline\'s up to the baseline\'s, within 0.001', async () => {
        answer({ track: steady() });
        await open();

        const sum = (values) => values.reduce((total, value) => total + value, 0);
        const values = rowsIn('cards').map((row) => Number(row.querySelector('.model-part-value').textContent));
        const baselines = rowsIn('cards').map((row) => Number(row.querySelector('.model-part-baseline').textContent.split(' ').pop()));

        expect(Math.abs(sum(values) - figures().score)).toBeLessThanOrEqual(0.001);
        expect(Math.abs(sum(baselines) - figures().baseline)).toBeLessThanOrEqual(0.001);
    });

    it('marks each part better or worse than the baseline\'s, as the card\'s own line is', async () => {
        answer({ track: steady() });
        await open();

        expect(rowsIn('cards').map((row) => row.querySelector('.model-part-baseline').className)).toEqual([
            'model-part-baseline model-gap-worse',
            'model-part-baseline model-gap-better',
            'model-part-baseline model-gap-better',
        ]);
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

        expect(read(rowsIn('cards')[2])).toEqual(['Size of the move', formatScore(0.265, 'loss'), 'better than baseline 0.267']);
    });

    it('leaves out the baseline\'s side of a part the baseline has none of', async () => {
        const track = steady();
        const last = track[track.length - 1];

        last.baseline_average = { ...last.baseline_average, beats_log_loss: null };
        answer({ track: track });
        await open();

        expect(rowsIn('cards')[1].querySelector('.model-part-value')).toHaveTextContent('0.620');
        expect(rowsIn('cards')[1].querySelector('.model-part-baseline')).toBeNull();
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
        expect(screen.getByRole('heading', { name: 'Track record' })).toBeInTheDocument();
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

        it('says how the live version came to be live, or for one taken down, what happens next', () => {
            expect(liveLine(modelOf())).toBe('went live after a nightly update');
            expect(liveLine(modelOf({ live: { since: '2026-10-05', kind: 'first' } }))).toBe('its first version, not yet beaten');
            expect(liveLine(downModelOf())).toBe('Nothing predicts until a version beats the baseline.');
        });
    });

    describe('Attempts that went live', () => {
        it('counts each kind that went live, then says how the newest night went, and when it started and how long it took', async () => {
            answer({ history: timedHistoryOf({ 4: { went_live: true } }) });
            await open();

            const card = cardOf('Attempts that went live');

            expect(card.querySelector('.model-stat-head')).toHaveTextContent(/every attempt since Oct 12$/);
            expect(rowsOf(card)).toEqual([
                ['Nightly updates', '1 of 5'],
                ['Last attempt, Oct 16'],
                ['Result', 'went live'],
                ['Started', '3:58 AM ET'],
                ['Took', '9 min 52 s'],
            ]);
        });

        it('has no times for a night before Oct 15, and a row for weekly retrains only where there were some', async () => {
            answer({ history: historyOf(4, { 1: { kind: 'weekly', went_live: true }, 3: { kind: 'weekly' } }) });
            await open();

            expect(rowsOf(cardOf('Attempts that went live'))).toEqual([
                ['Nightly updates', '0 of 2'],
                ['Weekly retrains', '1 of 2'],
                ['Last attempt, Oct 6'],
                ['Result', 'kept back'],
            ]);
        });

        it.each([['could not be had', null], ['has no nights yet', []]])('says "nightly attempts", and has no rule or rows, where the history %s', async (name, history) => {
            answer({ history: history });
            await open();

            const card = cardOf('Attempts that went live');

            expect(card.querySelector('.model-stat-head')).toHaveTextContent(/nightly attempts$/);
            expect(card.querySelector('.model-stat-body')).toBeNull();
            expect(attemptRows(history)).toEqual([]);
            expect(attemptsLine(history)).toBe('nightly attempts');
        });
    });

    describe('the score', () => {
        //
        // a track record whose newest 20-day loss is the listing's, as the
        // parts' own cases use
        //
        const steady = () => trackOf(5, '2026-09-01', () => 1.6);

        it('puts its place among its task\'s models first, then a heading over the parts, then the parts, under its rule (#272)', async () => {
            answer({ track: steady() });
            await open();

            const body = cardOf('Loss, last 20 days').querySelector('.model-stat-body');

            expect([...body.children].map((part) => part.className)).toEqual(['model-stat-rows', 'model-parts']);
            expect(rowsOf(body)).toEqual([['Among Next-day direction models', '1st of 3'], ['Loss, part by part']]);
            expect(body.querySelector('.model-stat-row:last-child')).toHaveClass('model-stat-row-head');
            expect(cardOf('Loss, last 20 days').querySelector('.model-stat-head')).not.toHaveTextContent('Next-day direction models');
        });

        it('gives the only model of its task no place, and keeps the heading and the parts', async () => {
            answer({ listing: listingOf([modelOf()]), track: steady() });
            await open();

            const body = cardOf('Loss, last 20 days').querySelector('.model-stat-body');

            expect([...body.children].map((part) => part.className)).toEqual(['model-stat-rows', 'model-parts']);
            expect(rowsOf(body)).toEqual([['Loss, part by part']]);
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
    const legendOfTrack = () => within(screen.getByRole('region', { name: 'Track record' })).getByRole('list', { name: 'Legend' });

    it('is asked for when it is picked, and drawn once it is in', async () => {
        answer();
        await open();

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Compare with' }), 'tables');

        expect(loadReport).toHaveBeenLastCalledWith('tables', 'track-record');
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
        ])('say why the %s-day hold has nothing to draw, where no day\'s result is in yet', async (hold, days, said) => {
            options({ track: optionsTrackOf(days) });
            await open('pt-options', { hold: hold });

            expect(screen.getByText(said)).toHaveClass('model-status-empty');
            expect(document.querySelector('.model-track')).toBeNull();
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
            expect(box).toHaveAccessibleDescription(
                'The 5-day hold did worse than the baseline 5 scored days in a row. Nothing predicts until a new version beats the baseline on the days it was tested on.',
            );
            expect(liveFigure(down()).detail).toBe('the 5-day hold did worse than the baseline 5 scored days in a row');
        });

        it('list each check for each hold in the Live version card', async () => {
            options();
            await open('pt-options');

            expect(rowsOf(stat('Live version'))).toEqual([
                ['First predicted', 'Sep 1'],
                ['Days in a row worse than the baseline'],
                ['1-day hold'],
                ['Each day', '2 of 5'],
                ['5-day average', '0 of 10'],
                ['20-day average', '0 of 5'],
                ['5-day hold'],
                ['Each day', '0 of 5'],
                ['5-day average', '0 of 10'],
                ['20-day average', 'not yet'],
                ['20-day hold'],
                ['Each day', '0 of 5'],
                ['5-day average', 'not yet'],
                ['20-day average', 'not yet'],
            ]);
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

            expect(loadReport).toHaveBeenLastCalledWith('pt-gnn', 'track-record');
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

    describe('its picks', () => {
        it('come after the charts, asked for by its name', async () => {
            options();
            await open('pt-options');

            const cards = [...document.querySelectorAll('.model-card')];

            expect(loadOptionPicks).toHaveBeenCalledWith('pt-options');
            expect(cards[cards.length - 1]).toBe(screen.getByRole('region', { name: 'Tonight’s top 10' }));
        });

        it('are not drawn, nor asked for, for a stock model', async () => {
            options();
            await open('pt-gnn');

            expect(screen.queryByRole('region', { name: 'Tonight’s top 10' })).toBeNull();
            expect(loadOptionPicks).not.toHaveBeenCalled();
        });
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
        expect(loadReport).toHaveBeenCalledWith('tables', 'history');
    });
});
